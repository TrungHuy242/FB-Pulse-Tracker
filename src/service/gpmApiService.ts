/**
 * Frontend client for the local GPM Bridge HTTP API.
 *
 * The web app does not call GPM Login directly because the local GPM API does
 * not guarantee browser CORS support. Requests go through gpm-bridge instead.
 */
import type {
  GpmApiResponse,
  GpmBridgeHealth,
  GpmBrowserVersions,
  GpmExtension,
  GpmGroup,
  GpmGroupDTO,
  GpmListPayload,
  GpmPaginatedData,
  GpmProfile,
  GpmProfileDTO,
  GpmProxy,
  GpmProxyCheckResult,
  GpmProxyDTO,
  GpmStartOptions,
  GpmStartResult,
} from "@/types/gpm";

const BRIDGE_URL =
  (import.meta.env.VITE_GPM_BRIDGE_URL as string | undefined) ||
  "http://localhost:3001";

async function parseError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  return new Error(body.message || body.error || `HTTP ${res.status}`);
}

async function gpmGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BRIDGE_URL}${path}`);
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<T>;
}

async function gpmPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<T>;
}

function unwrapData<T>(payload: GpmApiResponse<T> | T): T | undefined {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "data" in payload
  ) {
    return (payload as GpmApiResponse<T>).data;
  }
  return payload as T;
}

function normalizeList<T>(
  payload: GpmApiResponse<GpmListPayload<T>> | GpmListPayload<T> | undefined
): { data: T[]; total: number } {
  const body = payload ? unwrapData<GpmListPayload<T>>(payload) : undefined;
  if (Array.isArray(body)) {
    return { data: body, total: body.length };
  }

  const page = body as GpmPaginatedData<T> | undefined;
  const data = Array.isArray(page?.data) ? page.data : [];
  return {
    data,
    total: typeof page?.total === "number" ? page.total : data.length,
  };
}

export async function getGpmBridgeHealth(): Promise<GpmBridgeHealth> {
  return gpmGet<GpmBridgeHealth>("/health");
}

export async function checkGpmBridgeHealth(): Promise<boolean> {
  try {
    const health = await fetch(`${BRIDGE_URL}/health`, {
      signal: AbortSignal.timeout(45000),
    });
    if (!health.ok) return false;
    const body = (await health.json().catch(() => null)) as GpmBridgeHealth | null;
    return body?.gpm?.ok ?? true;
  } catch {
    return false;
  }
}

export async function getGpmGroups(): Promise<GpmGroup[]> {
  const res = await gpmGet<GpmApiResponse<GpmGroup[]> | GpmGroup[]>("/gpm/groups");
  return normalizeList<GpmGroup>(res).data;
}

export async function getGpmGroupById(id: string): Promise<GpmGroup> {
  const res = await gpmGet<GpmApiResponse<GpmGroup> | GpmGroup>(`/gpm/groups/${id}`);
  const group = unwrapData<GpmGroup>(res);
  if (!group) throw new Error("Khong tim thay group");
  return group;
}

export async function createGpmGroup(data: GpmGroupDTO): Promise<GpmGroup> {
  const res = await gpmPost<GpmApiResponse<GpmGroup>>("/gpm/groups/create", data);
  if (!res.success || !res.data) throw new Error(res.message || "Tao group that bai");
  return res.data;
}

export async function updateGpmGroup(
  id: string,
  data: Partial<GpmGroupDTO>
): Promise<GpmGroup> {
  const res = await gpmPost<GpmApiResponse<GpmGroup>>(`/gpm/groups/update/${id}`, data);
  if (!res.success || !res.data) throw new Error(res.message || "Cap nhat group that bai");
  return res.data;
}

export async function deleteGpmGroup(id: string): Promise<void> {
  const res = await gpmGet<GpmApiResponse<unknown>>(`/gpm/groups/delete/${id}`);
  if (res.success === false) throw new Error(res.message || "Xoa group that bai");
}

export interface GetGpmProfilesParams {
  page?: number;
  page_size?: number;
  limit?: number;
  search?: string;
  group_id?: string;
  sort?: number | string;
}

export async function getGpmProfiles(
  params: GetGpmProfilesParams = {}
): Promise<{ data: GpmProfile[]; total: number }> {
  const qs = new URLSearchParams();
  const pageSize = params.page_size ?? params.limit;
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (pageSize !== undefined) qs.set("page_size", String(pageSize));
  if (params.search) qs.set("search", params.search);
  if (params.group_id) qs.set("group_id", params.group_id);
  if (params.sort !== undefined) qs.set("sort", String(params.sort));

  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await gpmGet<GpmApiResponse<GpmListPayload<GpmProfile>> | GpmListPayload<GpmProfile>>(
    `/gpm/profiles${suffix}`
  );
  const normalized = normalizeList<GpmProfile>(res);
  const runningIds = new Set(await getRunningGpmProfileIds());
  return {
    ...normalized,
    data: normalized.data.map((profile) => ({
      ...profile,
      is_running: runningIds.has(profile.id),
    })),
  };
}

export async function getGpmProfileById(id: string): Promise<GpmProfile> {
  const res = await gpmGet<GpmApiResponse<GpmProfile> | GpmProfile>(`/gpm/profiles/${id}`);
  const profile = unwrapData<GpmProfile>(res);
  if (!profile) throw new Error("Khong tim thay profile");
  return profile;
}

export async function createGpmProfile(data: GpmProfileDTO): Promise<GpmProfile> {
  const res = await gpmPost<GpmApiResponse<GpmProfile>>("/gpm/profiles/create", data);
  if (!res.success || !res.data) throw new Error(res.message || "Tao profile that bai");
  return res.data;
}

export async function updateGpmProfile(
  id: string,
  data: Partial<GpmProfileDTO>
): Promise<GpmProfile> {
  const res = await gpmPost<GpmApiResponse<GpmProfile>>(
    `/gpm/profiles/update/${id}`,
    data
  );
  if (!res.success || !res.data) throw new Error(res.message || "Cap nhat profile that bai");
  return res.data;
}

export async function deleteGpmProfile(
  id: string,
  mode: "soft" | "hard" = "soft"
): Promise<void> {
  const res = await gpmGet<GpmApiResponse<unknown>>(
    `/gpm/profiles/delete/${id}?mode=${mode}`
  );
  if (res.success === false) throw new Error(res.message || "Xoa profile that bai");
}

export async function startGpmProfile(
  id: string,
  opts?: GpmStartOptions
): Promise<GpmStartResult> {
  const qs = new URLSearchParams();
  if (opts?.remote_debugging_port) {
    qs.set("remote_debugging_port", String(opts.remote_debugging_port));
  }
  if (opts?.window_size) qs.set("window_size", opts.window_size);
  if (opts?.window_pos) qs.set("window_pos", opts.window_pos);
  if (opts?.window_scale) qs.set("window_scale", String(opts.window_scale));
  if (opts?.addition_args) qs.set("addition_args", opts.addition_args);

  const suffix = qs.toString() ? `?${qs}` : "";
  return gpmGet<GpmStartResult>(`/gpm/profiles/start/${id}${suffix}`);
}

export async function stopGpmProfile(id: string): Promise<void> {
  const res = await gpmGet<GpmApiResponse<unknown>>(`/gpm/profiles/stop/${id}`);
  if (res.success === false) throw new Error(res.message || "Dong profile that bai");
}

/**
 * Lấy danh sách profile IDs đang chạy browser thực tế từ bridge.
 * Bridge tracking trong memory, cập nhật khi start/stop.
 */
export async function getRunningGpmProfileIds(): Promise<string[]> {
  try {
    const res = await gpmGet<{ success: boolean; data: string[] }>("/gpm/profiles/running");
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

export async function getGpmProxies(): Promise<GpmProxy[]> {
  const res = await gpmGet<GpmApiResponse<GpmListPayload<GpmProxy>> | GpmListPayload<GpmProxy>>(
    "/gpm/proxies"
  );
  return normalizeList<GpmProxy>(res).data;
}

export async function createGpmProxy(data: GpmProxyDTO): Promise<GpmProxy> {
  const res = await gpmPost<GpmApiResponse<GpmProxy>>("/gpm/proxies/create", data);
  if (!res.success || !res.data) throw new Error(res.message || "Tao proxy that bai");
  return res.data;
}

export async function updateGpmProxy(
  id: string,
  data: Partial<GpmProxyDTO>
): Promise<GpmProxy> {
  const res = await gpmPost<GpmApiResponse<GpmProxy>>(`/gpm/proxies/update/${id}`, data);
  if (!res.success || !res.data) throw new Error(res.message || "Cap nhat proxy that bai");
  return res.data;
}

export async function deleteGpmProxy(id: string): Promise<void> {
  const res = await gpmGet<GpmApiResponse<unknown>>(`/gpm/proxies/delete/${id}`);
  if (res.success === false) throw new Error(res.message || "Xoa proxy that bai");
}

export async function checkGpmProxy(rawProxy: string): Promise<GpmProxyCheckResult> {
  const qs = new URLSearchParams({ raw_proxy: rawProxy });
  return gpmGet<GpmProxyCheckResult>(`/gpm/proxies/check?${qs}`);
}

export async function getGpmBrowserVersions(): Promise<string[]> {
  const res = await gpmGet<
    GpmApiResponse<GpmBrowserVersions | string[]> | GpmBrowserVersions | string[]
  >("/gpm/browsers/versions");
  const body = unwrapData<GpmBrowserVersions | string[]>(res);
  if (Array.isArray(body)) return body;
  return Array.from(new Set([...(body?.chromium ?? []), ...(body?.firefox ?? [])]));
}

export async function getGpmExtensions(): Promise<GpmExtension[]> {
  const res = await gpmGet<GpmApiResponse<GpmExtension[]> | GpmExtension[]>(
    "/gpm/extensions"
  );
  return normalizeList<GpmExtension>(res).data;
}
