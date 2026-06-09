import fetch from "node-fetch";

interface GpmProfileApiItem {
  id?: string;
  profile_id?: string;
  profileId?: string;
  name?: string;
  profile_name?: string;
  profileName?: string;
}

type GpmProfilesResponse =
  | GpmProfileApiItem[]
  | { data?: GpmProfileApiItem[] };

export interface GpmStartResponse {
  success: boolean;
  message?: string;
  remote_debugging_port?: number;
  data?: {
    remote_debugging_port?: number;
    selenium_remote_debug_address?: string;
  };
}

export class GpmClient {
  private apiUrl: string;

  constructor(apiUrl: string = "http://127.0.0.1:19995") {
    this.apiUrl = apiUrl;
  }

  /**
   * Kiểm tra kết nối tới GPM Login API
   */
  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiUrl}/api/v3/profiles?limit=1`);
      return res.ok;
    } catch {
      console.error("[GPM Client] Không thể kết nối tới GPM Login API. Hãy đảm bảo ứng dụng GPM Login đang mở và đang lắng nghe tại:", this.apiUrl);
      return false;
    }
  }

  /**
   * Lấy danh sách tất cả profiles từ GPM Login
   */
  async getProfiles(): Promise<Array<{ id: string; name: string }>> {
    const url = `${this.apiUrl}/api/v3/profiles?limit=1000`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
      
      const body = (await response.json()) as GpmProfilesResponse;
      // Trả về từ body.data (API v3) hoặc body (API v2 / direct list)
      const list = Array.isArray(body) ? body : body.data ?? [];
      
      if (!Array.isArray(list)) {
        console.warn("[GPM Client] API trả về danh sách không phải mảng:", body);
        return [];
      }

      return list.map((item) => ({
        id: item.id || item.profile_id || item.profileId || "",
        name: item.name || item.profile_name || item.profileName || "Unnamed Profile",
      })).filter((p) => p.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[GPM Client] Lỗi khi lấy danh sách profiles từ GPM Login:", message);
      return [];
    }
  }

  /**
   * Khởi động một profile qua GPM và lấy cổng debug
   * @param profileId - ID của profile GPM
   */
  async startProfile(profileId: string): Promise<number> {
    const url = `${this.apiUrl}/api/v3/profiles/start/${profileId}`;
    console.log(`[GPM Client] Đang gọi API mở profile: ${profileId}...`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
      
      const body = (await response.json()) as GpmStartResponse;
      console.log(`[GPM Client] Kết quả gọi mở Profile:`, JSON.stringify(body));

      // Hỗ trợ cả API v2 và v3 (Đọc port trực tiếp hoặc từ data.remote_debugging_port)
      let debugPort = body.remote_debugging_port || body.data?.remote_debugging_port;
      
      // Nếu API trả về địa chỉ selenium debug (ví dụ: localhost:12345), hãy parse lấy port
      if (!debugPort && body.data?.selenium_remote_debug_address) {
        const address = body.data.selenium_remote_debug_address; // "127.0.0.1:port" hoặc "localhost:port"
        const parts = address.split(":");
        const parsedPort = parseInt(parts[parts.length - 1]);
        if (!isNaN(parsedPort)) {
          debugPort = parsedPort;
        }
      }

      if (!debugPort) {
        throw new Error(`Không tìm thấy remote_debugging_port trong kết quả phản hồi của GPM.`);
      }

      console.log(`[GPM Client] Profile ${profileId} đã mở thành công ở debug port: ${debugPort}`);
      return debugPort;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[GPM Client] Lỗi khi mở profile ${profileId}:`, message);
      throw err;
    }
  }

  /**
   * Đóng một profile đang chạy qua GPM
   * @param profileId - ID của profile GPM
   */
  async closeProfile(profileId: string): Promise<boolean> {
    const url = `${this.apiUrl}/api/v3/profiles/close/${profileId}`;
    console.log(`[GPM Client] Đang gọi API đóng profile: ${profileId}...`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
      
      const body = (await response.json()) as { success: boolean; message?: string };
      console.log(`[GPM Client] Kết quả gọi đóng Profile:`, JSON.stringify(body));
      return body.success;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[GPM Client] Lỗi khi đóng profile ${profileId}:`, message);
      return false;
    }
  }
}
