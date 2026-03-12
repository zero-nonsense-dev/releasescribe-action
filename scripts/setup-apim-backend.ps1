param(
  [string]$SubscriptionId = "41ed14e3-32ad-413e-8c60-098816fb3742",
  [string]$ResourceGroup = "rg-github-actions-backend-prod",
  [string]$ApimName = "apim-releasescribe-prod",
  [string]$FunctionName = "func-releasescribe-prod",
  [string]$BackendId = "releasescribe-func-backend",
  [string]$ApiId = "releasescribe-license-api"
)

$ErrorActionPreference = "Stop"

Write-Host "Setting up APIM Backend and Policy via REST API..."
Write-Host "APIM: $ApimName"
Write-Host "Function App: $FunctionName"

# Get Function App host key
Write-Host "Retrieving Function App host key..."
$funcKey = ""
try {
  $funcKey = az functionapp keys list --subscription $SubscriptionId -g $ResourceGroup -n $FunctionName --query functionKeys.default -o tsv 2>$null
  if ([string]::IsNullOrEmpty($funcKey)) {
    $funcKey = az functionapp keys list --subscription $SubscriptionId -g $ResourceGroup -n $FunctionName --query masterKey -o tsv 2>$null
  }
} catch {
  Write-Warning "Could not retrieve Function keys: $($_.Exception.Message)"
}

if ($funcKey) {
  Write-Host "Function host key retrieved successfully"
} else {
  Write-Warning "Function host key not available; skipping x-functions-key header policy"
}

$functionBackendUrl = "https://$FunctionName.azurewebsites.net"
$apiVersion = "2023-09-01-preview"
$apimResourceId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ApiManagement/service/$ApimName"

# Create backend via REST API
Write-Host "Creating/updating APIM backend: $BackendId"
$backendBody = @{
  properties = @{
    title = "ReleaseScribe Function Backend"
    description = "Backend for ReleaseScribe Function App"
    url = $functionBackendUrl
    protocol = "https"
    tls = @{
      validateCertificateChain = $true
      validateCertificateName = $true
    }
  }
}

try {
  $backendApiUrl = "$apimResourceId/backends/$BackendId?api-version=$apiVersion"
  $backendResponse = az rest --method put `
    --url "$backendApiUrl" `
    --body ($backendBody | ConvertTo-Json -Depth 10)
  Write-Host "Backend created/updated successfully"
} catch {
  Write-Warning "Backend setup failed: $($_.Exception.Message)"
}

# Create policy with function key header if available
Write-Host "Creating/updating APIM API policy..."
$policyXml = @"
<policies>
  <inbound>
    <base />
$(if ($funcKey) { "    <set-header name=`"x-functions-key`" exists-action=`"override`"><value>$funcKey</value></set-header>" })
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
"@

try {
  $policyApiUrl = "$apimResourceId/apis/$ApiId/policies/policy?api-version=$apiVersion"
  $policyResponse = az rest --method put `
    --url "$policyApiUrl" `
    --headers "Content-Type=application/xml" `
    --body $policyXml
  Write-Host "API policy created/updated successfully"
} catch {
  Write-Warning "API policy setup failed: $($_.Exception.Message)"
}

Write-Host "APIM Backend and Policy setup complete!"
