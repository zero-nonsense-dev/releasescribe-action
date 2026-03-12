import { CommitLite } from "../types.js";

export interface RemoteReleasePlanRequest {
  owner: string;
  repo: string;
  defaultBranch: string;
  lastTag?: string;
  nextTagOverride?: string;
  releaseType: "auto" | "patch" | "minor" | "major";
  monorepo: boolean;
  packagesGlob: string;
  commits: CommitLite[];
  files: string[];
}

export interface RemoteReleasePlan {
  nextVersion: string;
  rootSection: string;
  releaseBody?: string;
  packageSections?: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export async function fetchRemoteReleasePlan(
  apiUrl: string,
  apiToken: string | undefined,
  request: RemoteReleasePlanRequest,
  timeoutMs = 15000
): Promise<RemoteReleasePlan> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {})
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Remote core API returned ${response.status}: ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as unknown;
    if (!isRecord(payload)) {
      throw new Error("Remote core API returned invalid payload");
    }

    const nextVersion = typeof payload.nextVersion === "string" ? payload.nextVersion : "";
    const rootSection = typeof payload.rootSection === "string" ? payload.rootSection : "";
    const releaseBody = typeof payload.releaseBody === "string" ? payload.releaseBody : undefined;
    const packageSections = toStringRecord(payload.packageSections);

    if (!nextVersion || !rootSection) {
      throw new Error("Remote core API must return nextVersion and rootSection");
    }

    return { nextVersion, rootSection, releaseBody, packageSections };
  } finally {
    clearTimeout(timer);
  }
}
