/**
 * GPM Login local API types.
 *
 * Official docs:
 * https://documenter.getpostman.com/view/11184161/2sB3HnJKCv
 * https://api-docs.gpmloginapp.com/
 *
 * Default local API URL: http://127.0.0.1:9495
 */

export interface GpmApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  sender?: string;
}

export interface GpmPaginatedData<T> {
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
  data?: T[];
}

export type GpmListPayload<T> = T[] | GpmPaginatedData<T>;

export interface GpmBridgeHealth {
  status: "ok";
  bridge: true;
  gpmApiUrl: string;
  gpm: {
    ok: boolean;
    status?: number;
    message?: string;
  };
  timestamp: string;
}

export interface GpmGroup {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface GpmGroupDTO {
  name: string;
}

export type GpmBrowserType = 1 | 2;
export type GpmOsType = 1 | 2 | 3 | 4 | 5;
export type GpmWebRtcMode = 1 | 2 | 3 | 4;
export type GpmGeolocationMode = 1 | 2 | 3;
export type GpmCanvasMode = 1 | 2 | 3;
export type GpmWebGlImageMode = 1 | 2;
export type GpmWebGlMetadataMode = 1 | 2;
export type GpmAudioMode = 1 | 2;
export type GpmFontMode = 1 | 2;
export type GpmClientRectMode = 1 | 2;

export interface GpmProfile {
  id: string;
  name: string;
  group_id: string | null;
  raw_proxy: string | null;
  browser?: {
    name?: string;
    version?: string;
  };
  bypass_proxy_extensions: string | null;
  browser_type: GpmBrowserType;
  browser_version: string | null;
  os?: string;
  os_type: GpmOsType;
  custom_user_agent: string | null;
  task_bar_title: string | null;
  webrtc_mode: GpmWebRtcMode | null;
  fixed_webrtc_public_ip: string | null;
  port_protect: boolean | null;
  geolocation_mode: GpmGeolocationMode | null;
  canvas_mode: GpmCanvasMode | null;
  client_rect_mode: GpmClientRectMode | null;
  webgl_image_mode: GpmWebGlImageMode | null;
  webgl_metadata_mode: GpmWebGlMetadataMode | null;
  audio_mode: GpmAudioMode | null;
  is_masked_media: boolean | null;
  font_mode: GpmFontMode | null;
  timezone_base_on_ip: boolean;
  timezone: string | null;
  is_language_base_on_ip: boolean;
  fixed_language: string | null;
  startup_urls: string | null;
  note: string | null;
  created_at?: string;
  updated_at?: string;
  is_running?: boolean;
  debug_port?: number;
}

export interface GpmProfileDTO {
  name: string;
  group_id?: string | null;
  raw_proxy?: string | null;
  bypass_proxy_extensions?: string | null;
  browser_type?: GpmBrowserType;
  browser_version?: string | null;
  os_type?: GpmOsType;
  custom_user_agent?: string | null;
  task_bar_title?: string | null;
  webrtc_mode?: GpmWebRtcMode | null;
  fixed_webrtc_public_ip?: string | null;
  port_protect?: boolean | null;
  geolocation_mode?: GpmGeolocationMode | null;
  canvas_mode?: GpmCanvasMode | null;
  client_rect_mode?: GpmClientRectMode | null;
  webgl_image_mode?: GpmWebGlImageMode | null;
  webgl_metadata_mode?: GpmWebGlMetadataMode | null;
  audio_mode?: GpmAudioMode | null;
  is_masked_media?: boolean | null;
  font_mode?: GpmFontMode | null;
  timezone_base_on_ip?: boolean;
  timezone?: string | null;
  is_language_base_on_ip?: boolean;
  fixed_language?: string | null;
  startup_urls?: string | null;
  note?: string | null;
}

export interface GpmStartOptions {
  remote_debugging_port?: number;
  window_scale?: number;
  window_pos?: string;
  window_size?: string;
  addition_args?: string;
}

export interface GpmStartResult {
  success: boolean;
  message?: string;
  data?: {
    remote_debugging_port?: number;
    driver_path?: string;
    selenium_remote_debug_address?: string;
  };
  remote_debugging_port?: number;
  driver_path?: string;
  fbInfo?: {
    fbUid?: string;
    fbName?: string;
    fbAvatar?: string;
    fbUrl?: string;
    isLoggedIn: boolean;
  };
}

export interface GpmProxy {
  id: string;
  name: string;
  raw_proxy: string;
  created_at?: string;
  updated_at?: string;
}

export interface GpmProxyDTO {
  name: string;
  raw_proxy: string;
}

export interface GpmProxyCheckResult {
  success: boolean;
  data?: {
    ip?: string;
    country?: string;
    country_code?: string;
    city?: string;
    timezone?: string;
    isp?: string;
  };
  message?: string;
}

export interface GpmBrowserVersions {
  chromium?: string[];
  firefox?: string[];
}

export interface GpmExtension {
  id: string;
  name: string;
  version?: string;
  active?: boolean;
  path?: string;
}

export const GPM_BROWSER_TYPE_LABELS: Record<GpmBrowserType, string> = {
  1: "Chrome",
  2: "Firefox",
};

export const GPM_OS_TYPE_LABELS: Record<GpmOsType, string> = {
  1: "Windows",
  2: "macOS Intel",
  3: "macOS ARM",
  4: "Linux",
  5: "Android",
};

export const GPM_WEBRTC_MODE_LABELS: Record<GpmWebRtcMode, string> = {
  1: "Theo IP",
  2: "Co dinh",
  3: "That",
  4: "Tat",
};

export const GPM_GEOLOCATION_MODE_LABELS: Record<GpmGeolocationMode, string> = {
  1: "Cho phep",
  2: "Hoi",
  3: "Chan",
};

export const GPM_CANVAS_MODE_LABELS: Record<GpmCanvasMode, string> = {
  1: "Noise",
  2: "That",
  3: "Chan",
};

export const GPM_AUDIO_MODE_LABELS: Record<GpmAudioMode, string> = {
  1: "Noise",
  2: "That",
};

export const GPM_FONT_MODE_LABELS: Record<GpmFontMode, string> = {
  1: "An",
  2: "That",
};
