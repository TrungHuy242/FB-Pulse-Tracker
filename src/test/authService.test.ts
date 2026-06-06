import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Firebase modules trước khi import ──────────────────────────────────
vi.mock("@/service/firebase", () => ({
  db: {},
  auth: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

import { checkAllowedAccount } from "@/service/authService";
import { getDoc, setDoc } from "firebase/firestore";

const mockGetDoc = vi.mocked(getDoc);
const mockSetDoc = vi.mocked(setDoc);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkAllowedAccount (UID-based with auto-creation)", () => {
  it("trả về role từ doc đã tồn tại", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: "user_uid_123",
      data: () => ({ role: 1, email: "admin@test.com" }),
    } as any);

    const result = await checkAllowedAccount("user_uid_123", "admin@test.com");
    expect(result).toEqual({ id: "user_uid_123", role: 1 });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("tự động tạo doc mới và gán role=1 nếu email chứa admin", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    } as any);
    mockSetDoc.mockResolvedValueOnce(undefined as any);

    const result = await checkAllowedAccount("admin_uid_456", "superadmin@gmail.com", "Super Admin");
    expect(result).toEqual({ id: "admin_uid_456", role: 1 });
    expect(mockSetDoc).toHaveBeenCalledOnce();
  });

  it("tự động tạo doc mới và gán role=0 nếu email thường", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    } as any);
    mockSetDoc.mockResolvedValueOnce(undefined as any);

    const result = await checkAllowedAccount("user_uid_789", "member@gmail.com");
    expect(result).toEqual({ id: "user_uid_789", role: 0 });
    expect(mockSetDoc).toHaveBeenCalledOnce();
  });

  it("trả về role dự kiến ngay cả khi setDoc lỗi ghi", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    } as any);
    mockSetDoc.mockRejectedValueOnce(new Error("Firebase Permission Denied") as never);

    const result = await checkAllowedAccount("user_uid_xxx", "admin@gmail.com");
    expect(result).toEqual({ id: "user_uid_xxx", role: 1 }); // vẫn trả về role dự kiến ở Client
  });
});
