param(
  [string]$SubscriptionId = "41ed14e3-32ad-413e-8c60-098816fb3742",
  [string]$TenantId = "acdda0dc-5331-40fc-aaaf-96230f3e1815",
  [string]$SubscriptionName = "ZeroNonsense.Dev",
  [string]$ResourceGroup = "rg-github-actions-backend-prod",
  [string]$Location = "westeurope",
  [ValidateSet("Consumption","Developer","Basic","Standard","Premium")]
  [string]$ApimSkuName = "Consumption",
  [ValidateSet("Consumption","Dedicated")]
  [string]$FunctionHostingPlan = "Consumption",
  [string]$FunctionRuntimeVersion = "24",
  [string]$WorkloadName = "releasescribe",
  [string]$PublisherEmail = "support@zerononsense.dev",
  [string]$PublisherName = "Zero Nonsense Dev",
  [string]$StateFile = ".provision-state.json"
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

function Warn-PythonArchitecture {
  try {
    $pyBits = (python -c "import struct; print(struct.calcsize('P')*8)" 2>$null).Trim()
    if ($pyBits -and $pyBits -ne "64") {
      Write-Warning "Cryptography will be significantly faster with 64-bit Python. Current Python architecture: ${pyBits}-bit."
    }
  } catch {
    # Optional warning only.
  }
}

function Ensure-ProviderRegistered {
  param(
    [string]$SubscriptionId,
    [string]$Namespace
  )

  $state = az provider show --subscription $SubscriptionId --namespace $Namespace --query registrationState -o tsv
  if ($state -eq "Registered") {
    return
  }

  Write-Host "Registering provider namespace: $Namespace"
  az provider register --subscription $SubscriptionId --namespace $Namespace --wait --output none
}

function New-StorageAccountWithFallback {
  param(
    [string]$SubscriptionId,
    [string]$ResourceGroup,
    [string]$Location,
    [string]$StorageName
  )

  try {
    az storage account create --subscription $SubscriptionId -n $StorageName -g $ResourceGroup -l $Location --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false --output none
    return
  } catch {
    Write-Warning "az storage account create failed; retrying via deployment fallback. Error: $($_.Exception.Message)"

    $templatePath = Join-Path $env:TEMP "storage-fallback-template.json"
    @'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "storageAccountName": { "type": "string" },
    "location": { "type": "string" }
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-05-01",
      "name": "[parameters('storageAccountName')]",
      "location": "[parameters('location')]",
      "sku": { "name": "Standard_LRS" },
      "kind": "StorageV2",
      "properties": {
        "minimumTlsVersion": "TLS1_2",
        "allowBlobPublicAccess": false
      }
    }
  ]
}
'@ | Set-Content -Path $templatePath -Encoding UTF8

    az deployment group create --subscription $SubscriptionId --resource-group $ResourceGroup --name "deploy-storage-$StorageName" --template-file $templatePath --parameters storageAccountName=$StorageName location=$Location --output none
  }
}

function New-FunctionAppWithRuntimeFallback {
  param(
    [string]$SubscriptionId,
    [string]$ResourceGroup,
    [string]$FunctionName,
    [string]$StorageName,
    [string]$PlanName,
    [string]$Location,
    [string]$HostingPlan,
    [string]$PreferredRuntimeVersion
  )

  $runtimeCandidates = @($PreferredRuntimeVersion, "22", "20") | Select-Object -Unique
  foreach ($runtime in $runtimeCandidates) {
    try {
      Write-Host "Attempting Function App create with Node runtime version $runtime"
      if ($HostingPlan -eq "Consumption") {
        az functionapp create --subscription $SubscriptionId -g $ResourceGroup -n $FunctionName --storage-account $StorageName --consumption-plan-location $Location --runtime node --runtime-version $runtime --functions-version 4 --os-type Linux --output none
      } else {
        az functionapp create --subscription $SubscriptionId -g $ResourceGroup -n $FunctionName --storage-account $StorageName --plan $PlanName --runtime node --runtime-version $runtime --functions-version 4 --os-type Linux --output none
      }
      Write-Host "Function App created with Node runtime version $runtime"
      return $runtime
    } catch {
      Write-Warning "Function App create failed for Node ${runtime}: $($_.Exception.Message)"
    }
  }

  throw "Failed to create Function App with Node runtimes: $($runtimeCandidates -join ', ')"
}

function New-SafeKeyVaultName {
  param(
    [string]$RawName
  )

  $name = $RawName.ToLower()
  $name = ($name -replace "[^a-z0-9-]", "")
  $name = ($name -replace "-+", "-")
  if ($name.Length -gt 24) { $name = $name.Substring(0, 24) }
  $name = $name.Trim('-')

  if (-not $name) { $name = "kvrelscribe" }
  if ($name.Length -lt 3) { $name = ($name + "kvx").Substring(0, 3) }
  if ($name[0] -notmatch "[a-z]") { $name = "k" + $name.Substring(1) }
  if ($name[-1] -notmatch "[a-z0-9]") { $name = $name.TrimEnd('-') + "0" }

  return $name
}

function Get-OrInitState {
  param(
    [string]$Path,
    [string]$SubscriptionId,
    [string]$WorkloadName
  )

  $wl = ($WorkloadName.ToLower() -replace "[^a-z0-9]", "")
  if (-not $wl) { $wl = "releasescribe" }

  $rawKv = "kv-$wl-prod"
  $rawStorage = "sa${wl}fn"
  if ($rawStorage.Length -gt 24) { $rawStorage = $rawStorage.Substring(0, 24) }

  $state = [ordered]@{
    apimName = "apim-$wl-prod"
    lawName = "law-$wl-prod"
    appiName = "appi-$wl-prod"
    storageName = $rawStorage
    planName = "asp-$wl-prod"
    funcName = "func-$wl-prod"
    kvName = New-SafeKeyVaultName -RawName $rawKv
  }

  $state | ConvertTo-Json | Set-Content -Path $Path -Encoding UTF8
  return ($state | ConvertTo-Json | ConvertFrom-Json)
}

function Exists-LogAnalyticsWorkspace {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$Name)
  try { az monitor log-analytics workspace show --subscription $SubscriptionId -g $ResourceGroup -n $Name --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-AppInsights {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$Name)
  try { az monitor app-insights component show --subscription $SubscriptionId -g $ResourceGroup -a $Name --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-StorageAccount {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$Name)
  try { az storage account show --subscription $SubscriptionId -g $ResourceGroup -n $Name --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-AppServicePlan {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$Name)
  try { az appservice plan show --subscription $SubscriptionId -g $ResourceGroup -n $Name --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-FunctionApp {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$Name)
  try { az functionapp show --subscription $SubscriptionId -g $ResourceGroup -n $Name --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-KeyVault {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$Name)
  try { az keyvault show --subscription $SubscriptionId -g $ResourceGroup -n $Name --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-ApimService {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$Name)
  try { az apim show --subscription $SubscriptionId -g $ResourceGroup -n $Name --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-ApimBackend {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$ServiceName,[string]$BackendId)
  try { az apim backend show --subscription $SubscriptionId --resource-group $ResourceGroup --service-name $ServiceName --backend-id $BackendId --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-ApimApi {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$ServiceName,[string]$ApiId)
  try { az apim api show --subscription $SubscriptionId --resource-group $ResourceGroup --service-name $ServiceName --api-id $ApiId --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Exists-ApimOperation {
  param([string]$SubscriptionId,[string]$ResourceGroup,[string]$ServiceName,[string]$ApiId,[string]$OperationId)
  try { az apim api operation show --subscription $SubscriptionId --resource-group $ResourceGroup --service-name $ServiceName --api-id $ApiId --operation-id $OperationId --query id -o tsv | Out-Null; return $true } catch { return $false }
}

function Supports-ApimBackendCommands {
  try {
    az apim backend -h --only-show-errors | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Supports-ApimPolicyCommands {
  try {
    az apim api policy -h --only-show-errors | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Get-FunctionHostKeySafe {
  param(
    [string]$SubscriptionId,
    [string]$ResourceGroup,
    [string]$FunctionName
  )

  $attempts = 4
  for ($i = 1; $i -le $attempts; $i++) {
    try {
      $key = az functionapp keys list --subscription $SubscriptionId -g $ResourceGroup -n $FunctionName --query functionKeys.default -o tsv
      if ($key) {
        return $key
      }
    } catch {
      Write-Warning "Function key lookup (default) failed on attempt ${i}/${attempts}: $($_.Exception.Message)"
    }

    try {
      $masterKey = az functionapp keys list --subscription $SubscriptionId -g $ResourceGroup -n $FunctionName --query masterKey -o tsv
      if ($masterKey) {
        return $masterKey
      }
    } catch {
      Write-Warning "Function key lookup (masterKey) failed on attempt ${i}/${attempts}: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds ([Math]::Min(15, 3 * $i))
  }

  Write-Warning "Could not retrieve Function host keys after ${attempts} attempts. Continuing without x-functions-key APIM header policy."
  return ""
}

Warn-PythonArchitecture

Write-Host "Setting subscription context..."
try {
  az account show --subscription $SubscriptionId --query id -o tsv | Out-Null
} catch {
  throw "Cannot access subscription $SubscriptionId. Run: az login --tenant $TenantId --use-device-code ; az account set --subscription $SubscriptionId"
}

az account set --subscription $SubscriptionId | Out-Null
$subId = az account show --subscription $SubscriptionId --query id -o tsv

Write-Host "Registering required provider namespaces..."
$providers = @(
  "Microsoft.OperationalInsights",
  "Microsoft.Insights",
  "Microsoft.Storage",
  "Microsoft.Web",
  "Microsoft.KeyVault",
  "Microsoft.ApiManagement"
)
foreach ($p in $providers) {
  Ensure-ProviderRegistered -SubscriptionId $SubscriptionId -Namespace $p
}

Write-Host "Ensuring resource group exists..."
$exists = az group exists --subscription $SubscriptionId --name $ResourceGroup | ConvertFrom-Json
if (-not $exists) {
  az group create --subscription $SubscriptionId --name $ResourceGroup --location $Location --output none
}
$Location = az group show --subscription $SubscriptionId --name $ResourceGroup --query location -o tsv

$statePath = if ([System.IO.Path]::IsPathRooted($StateFile)) { $StateFile } else { Join-Path $PSScriptRoot $StateFile }
$state = Get-OrInitState -Path $statePath -SubscriptionId $SubscriptionId -WorkloadName $WorkloadName

$apimName = $state.apimName
$lawName = $state.lawName
$appiName = $state.appiName
$storageName = $state.storageName
$planName = $state.planName
$funcName = $state.funcName
$kvName = $state.kvName

Write-Host "Ensuring Log Analytics workspace: $lawName"
if (-not (Exists-LogAnalyticsWorkspace -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Name $lawName)) {
  az monitor log-analytics workspace create --subscription $SubscriptionId -g $ResourceGroup -n $lawName -l $Location --output none
} else {
  Write-Host "Log Analytics workspace already exists."
}

Write-Host "Ensuring Application Insights: $appiName"
$lawId = az monitor log-analytics workspace show --subscription $SubscriptionId -g $ResourceGroup -n $lawName --query id -o tsv
if (-not (Exists-AppInsights -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Name $appiName)) {
  az monitor app-insights component create --subscription $SubscriptionId -a $appiName -g $ResourceGroup -l $Location --workspace $lawId --application-type web --output none
} else {
  Write-Host "Application Insights already exists."
}

Write-Host "Ensuring Function storage account: $storageName"
if (-not (Exists-StorageAccount -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Name $storageName)) {
  New-StorageAccountWithFallback -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Location $Location -StorageName $storageName
} else {
  Write-Host "Storage account already exists."
}

if ($FunctionHostingPlan -eq "Dedicated") {
  Write-Host "Ensuring App Service plan: $planName"
  if (-not (Exists-AppServicePlan -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Name $planName)) {
    az appservice plan create --subscription $SubscriptionId -g $ResourceGroup -n $planName -l $Location --sku B1 --is-linux --output none
  } else {
    Write-Host "App Service plan already exists."
  }
} else {
  Write-Host "Skipping App Service plan because Function hosting mode is Consumption."
}

Write-Host "Ensuring Function App: $funcName"
if (-not (Exists-FunctionApp -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Name $funcName)) {
  $selectedRuntime = New-FunctionAppWithRuntimeFallback -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -FunctionName $funcName -StorageName $storageName -PlanName $planName -Location $Location -HostingPlan $FunctionHostingPlan -PreferredRuntimeVersion $FunctionRuntimeVersion
} else {
  Write-Host "Function App already exists."
  $selectedRuntime = "existing"
}

$appiConn = az monitor app-insights component show --subscription $SubscriptionId -a $appiName -g $ResourceGroup --query connectionString -o tsv
az functionapp config appsettings set --subscription $SubscriptionId -g $ResourceGroup -n $funcName --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$appiConn" --output none

Write-Host "Ensuring Key Vault: $kvName"
if (-not (Exists-KeyVault -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Name $kvName)) {
  az keyvault create --subscription $SubscriptionId -g $ResourceGroup -n $kvName -l $Location --enable-rbac-authorization true --sku standard --output none
} else {
  Write-Host "Key Vault already exists."
}

Write-Host "Ensuring API Management instance: $apimName"
if (-not (Exists-ApimService -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Name $apimName)) {
  az apim create --subscription $SubscriptionId -g $ResourceGroup -n $apimName -l $Location --publisher-email $PublisherEmail --publisher-name $PublisherName --sku-name $ApimSkuName --output none
} else {
  Write-Host "APIM service already exists."
}

Write-Host "Creating APIM backend/API skeleton"
$funcHostKey = Get-FunctionHostKeySafe -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -FunctionName $funcName
$backendUrl = "https://$funcName.azurewebsites.net"
$supportsBackend = Supports-ApimBackendCommands

if ($supportsBackend) {
  if (-not (Exists-ApimBackend -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -ServiceName $apimName -BackendId "releasescribe-func-backend")) {
    try {
      az apim backend create --subscription $SubscriptionId --resource-group $ResourceGroup --service-name $apimName --backend-id releasescribe-func-backend --url $backendUrl --protocol http --output none
    } catch {
      Write-Warning "APIM backend create failed: $($_.Exception.Message)"
    }
  } else {
    Write-Host "APIM backend already exists."
  }
} else {
  Write-Warning "az apim backend command group is unavailable in this CLI version; skipping backend resource and using API service-url directly."
}

if ($supportsBackend) {
  try {
    if (-not (Exists-ApimBackend -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -ServiceName $apimName -BackendId "releasescribe-func-backend")) {
      Write-Warning "APIM backend 'releasescribe-func-backend' could not be verified after create attempt. Continuing with service-url mode."
    }
  } catch {
    Write-Warning "APIM backend verification failed: $($_.Exception.Message)"
  }
}

$apimApiReady = Exists-ApimApi -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -ServiceName $apimName -ApiId "releasescribe-license-api"
if (-not $apimApiReady) {
  try {
    az apim api create --subscription $SubscriptionId --resource-group $ResourceGroup --service-name $apimName --api-id releasescribe-license-api --display-name "ReleaseScribe License API" --path "v1" --protocols https --service-url $backendUrl --output none
  } catch {
    Write-Warning "APIM API create command failed: $($_.Exception.Message)"
  }
  $apimApiReady = Exists-ApimApi -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -ServiceName $apimName -ApiId "releasescribe-license-api"
}

if (-not $apimApiReady) {
  Write-Warning "APIM API 'releasescribe-license-api' could not be verified. Skipping APIM operation and policy setup for this run."
} else {
  if (-not (Exists-ApimOperation -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -ServiceName $apimName -ApiId "releasescribe-license-api" -OperationId "validate-license")) {
    try {
      az apim api operation create --subscription $SubscriptionId --resource-group $ResourceGroup --service-name $apimName --api-id releasescribe-license-api --operation-id validate-license --display-name "Validate License" --method POST --url-template "/licenses/validate" --output none
    } catch {
      Write-Warning "APIM operation validate-license create failed: $($_.Exception.Message)"
    }
  } else {
    Write-Host "APIM operation validate-license already exists."
  }

  if (-not (Exists-ApimOperation -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -ServiceName $apimName -ApiId "releasescribe-license-api" -OperationId "release-plan")) {
    try {
      az apim api operation create --subscription $SubscriptionId --resource-group $ResourceGroup --service-name $apimName --api-id releasescribe-license-api --operation-id release-plan --display-name "Release Plan" --method POST --url-template "/release-plan" --output none
    } catch {
      Write-Warning "APIM operation release-plan create failed: $($_.Exception.Message)"
    }
  } else {
    Write-Host "APIM operation release-plan already exists."
  }
}

$policyFile = Join-Path $env:TEMP "apim-releasescribe-policy.xml"
$policyHeaderBlock = if ($funcHostKey) {
@"
    <set-header name="x-functions-key" exists-action="override">
      <value>$funcHostKey</value>
    </set-header>
"@
} else {
  ""
}

@"
<policies>
  <inbound>
    <base />
$policyHeaderBlock
    <rate-limit calls="120" renewal-period="60" />
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
"@ | Set-Content -Path $policyFile -Encoding UTF8

$policyXml = Get-Content $policyFile -Raw
if ($apimApiReady -and (Supports-ApimPolicyCommands)) {
  try {
    az apim api policy create --subscription $SubscriptionId --resource-group $ResourceGroup --service-name $apimName --api-id releasescribe-license-api --xml-content $policyXml --output none
  } catch {
    Write-Warning "APIM policy create failed: $($_.Exception.Message)"
  }
} elseif (-not $apimApiReady) {
  Write-Warning "Skipping APIM policy because API is not ready."
} else {
  Write-Warning "Skipping APIM policy: az apim api policy command group is unavailable in this CLI version."
}

$baseUrl = "https://$apimName.azure-api.net/v1"
$apimPortal = "https://portal.azure.com/#@/resource/subscriptions/$subId/resourceGroups/$ResourceGroup/providers/Microsoft.ApiManagement/service/$apimName/overview"
$funcPortal = "https://portal.azure.com/#@/resource/subscriptions/$subId/resourceGroups/$ResourceGroup/providers/Microsoft.Web/sites/$funcName/overview"
$kvPortal = "https://portal.azure.com/#@/resource/subscriptions/$subId/resourceGroups/$ResourceGroup/providers/Microsoft.KeyVault/vaults/$kvName/overview"

Write-Host "=== Provisioning Complete ==="
Write-Host "Subscription: $SubscriptionName ($subId)"
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Location: $Location"
Write-Host "APIM: $apimName"
Write-Host "APIM SKU: $ApimSkuName"
Write-Host "Function App: $funcName"
Write-Host "Function Hosting Plan: $FunctionHostingPlan"
Write-Host "Function Runtime: Node $selectedRuntime"
Write-Host "Storage: $storageName"
Write-Host "App Insights: $appiName"
Write-Host "Log Analytics: $lawName"
Write-Host "Key Vault: $kvName"
Write-Host "APIM Base URL: $baseUrl"
Write-Host "APIM Portal: $apimPortal"
Write-Host "Function Portal: $funcPortal"
Write-Host "Key Vault Portal: $kvPortal"
