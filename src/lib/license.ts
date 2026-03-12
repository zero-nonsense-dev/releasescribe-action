export interface LicenseValidationResult {
  valid: boolean;
  reason?: string;
  entitlements?: Record<string, unknown>;
}

export interface ValidateLicenseInput {
  apiUrl: string;
  licenseKey: string;
  owner: string;
  repo: string;
  runId?: string;
  workflow?: string;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function validateLicense(input: ValidateLicenseInput): Promise<LicenseValidationResult> {
  const timeoutMs = input.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "releasescribe-action/1",
        "x-license-key": input.licenseKey
      },
      body: JSON.stringify({
        licenseKey: input.licenseKey,
        owner: input.owner,
        repo: input.repo,
        runId: input.runId,
        workflow: input.workflow
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        valid: false,
        reason: `License API returned ${response.status}`
      };
    }

    const payload = (await response.json()) as unknown;
    if (!isRecord(payload)) {
      return { valid: false, reason: "Invalid license API response payload" };
    }

    const valid = payload.valid === true;
    const reason = typeof payload.message === "string" ? payload.message : undefined;
    const entitlements = isRecord(payload.entitlements) ? payload.entitlements : undefined;

    return { valid, reason, entitlements };
  } finally {
    clearTimeout(timer);
  }
}
