import fetch from "node-fetch";

interface GpmProfileApiItem {
  id?: string;
  profile_id?: string;
  profileId?: string;
  name?: string;
  profile_name?: string;
  profileName?: string;
}

interface GpmPaginatedProfiles {
  data?: GpmProfileApiItem[];
  total?: number;
}

type GpmProfilesResponse =
  | GpmProfileApiItem[]
  | { data?: GpmProfileApiItem[] | GpmPaginatedProfiles };

export interface GpmStartResponse {
  success?: boolean;
  message?: string;
  remote_debugging_port?: number;
  data?: {
    remote_debugging_port?: number;
    selenium_remote_debug_address?: string;
    driver_path?: string;
  };
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function extractProfiles(body: GpmProfilesResponse): GpmProfileApiItem[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  if (body.data && Array.isArray(body.data.data)) return body.data.data;
  return [];
}

function parseDebugPort(body: GpmStartResponse): number | null {
  let debugPort = body.remote_debugging_port ?? body.data?.remote_debugging_port;
  if (!debugPort && body.data?.selenium_remote_debug_address) {
    const parts = body.data.selenium_remote_debug_address.split(":");
    const parsedPort = Number.parseInt(parts[parts.length - 1] ?? "", 10);
    if (!Number.isNaN(parsedPort)) debugPort = parsedPort;
  }
  return debugPort ?? null;
}

export class GpmClient {
  private apiUrl: string;

  constructor(apiUrl: string = "http://127.0.0.1:9495") {
    this.apiUrl = apiUrl;
  }

  private async fetchJson<T>(paths: string[]): Promise<T> {
    let lastError: unknown = new Error("No GPM endpoint attempted");
    for (const path of paths) {
      try {
        const response = await fetch(`${this.apiUrl}${path}`);
        if (!response.ok) {
          lastError = new Error(`HTTP Error ${response.status}: ${response.statusText}`);
          continue;
        }
        return (await response.json()) as T;
      } catch (err: unknown) {
        lastError = err;
      }
    }
    throw lastError;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchJson<unknown>([
        "/api/v1/profiles?page=1&page_size=1",
        "/api/v3/profiles?limit=1",
      ]);
      return true;
    } catch {
      console.error(
        "[GPM Client] Cannot connect to GPM Login API. Check that GPM Login is running at:",
        this.apiUrl
      );
      return false;
    }
  }

  async getProfiles(): Promise<Array<{ id: string; name: string }>> {
    try {
      const body = await this.fetchJson<GpmProfilesResponse>([
        "/api/v1/profiles?page=1&page_size=1000",
        "/api/v3/profiles?limit=1000",
      ]);
      const list = extractProfiles(body);

      return list
        .map((item) => ({
          id: item.id || item.profile_id || item.profileId || "",
          name: item.name || item.profile_name || item.profileName || "Unnamed Profile",
        }))
        .filter((profile) => profile.id);
    } catch (err: unknown) {
      console.error(
        "[GPM Client] Failed to load profiles from GPM Login:",
        getErrorMessage(err)
      );
      return [];
    }
  }

  async startProfile(profileId: string): Promise<number> {
    console.log(`[GPM Client] Starting profile: ${profileId}`);

    const body = await this.fetchJson<GpmStartResponse>([
      `/api/v1/profiles/start/${encodeURIComponent(profileId)}`,
      `/api/v3/profiles/start/${encodeURIComponent(profileId)}`,
    ]);

    if (body.success === false) {
      throw new Error(body.message || "GPM returned success=false when starting profile");
    }

    const debugPort = parseDebugPort(body);
    if (!debugPort) {
      throw new Error("Cannot find remote_debugging_port in GPM start response");
    }

    console.log(`[GPM Client] Profile ${profileId} started on debug port ${debugPort}`);
    return debugPort;
  }

  async closeProfile(profileId: string): Promise<boolean> {
    console.log(`[GPM Client] Closing profile: ${profileId}`);

    try {
      const body = await this.fetchJson<{ success?: boolean; message?: string }>([
        `/api/v1/profiles/stop/${encodeURIComponent(profileId)}`,
        `/api/v3/profiles/close/${encodeURIComponent(profileId)}`,
      ]);
      return body.success !== false;
    } catch (err: unknown) {
      console.error(`[GPM Client] Failed to close profile ${profileId}:`, getErrorMessage(err));
      return false;
    }
  }
}
