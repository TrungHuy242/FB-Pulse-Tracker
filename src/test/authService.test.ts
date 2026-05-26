/**
 * Unit tests cho auth service logic.
 * Mock Firestore để test logic kiểm tra allowedAccounts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Firebase modules trước khi import ──────────────────────────────────
vi.mock("@/service/firebase", () => ({
  db: {},
  auth: {},
  googleProvider: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

import { checkAllowedAccount } from "@/service/authService";
import { getDocs } from "firebase/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockGetDocs = vi.mocked(getDocs);

const makeSnap = (docs: { id: string; data: () => Record<string, unknown> }[]) => ({
  empty: docs.length === 0,
  docs: docs.map((d) => ({ id: d.id, data: d.data })),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("checkAllowedAccount", () => {
  it("trả về null khi email không có trong allowedAccounts", async () => {
    mockGetDocs.mockResolvedValueOnce(makeSnap([]) as never);
    const result = await checkAllowedAccount("unknown@test.com");
    expect(result).toBeNull();
  });

  it("trả về account info với role admin (role=1)", async () => {
    mockGetDocs.mockResolvedValueOnce(
      makeSnap([{ id: "acc123", data: () => ({ role: 1, email: "admin@test.com" }) }]) as never
    );
    const result = await checkAllowedAccount("admin@test.com");
    expect(result).toEqual({ id: "acc123", role: 1 });
  });

  it("trả về account info với role read-only (role=0)", async () => {
    mockGetDocs.mockResolvedValueOnce(
      makeSnap([{ id: "acc456", data: () => ({ role: 0, email: "reader@test.com" }) }]) as never
    );
    const result = await checkAllowedAccount("reader@test.com");
    expect(result).toEqual({ id: "acc456", role: 0 });
  });

  it("mặc định role = 0 khi document không có trường role", async () => {
    mockGetDocs.mockResolvedValueOnce(
      makeSnap([{ id: "acc789", data: () => ({ email: "norole@test.com" }) }]) as never
    );
    const result = await checkAllowedAccount("norole@test.com");
    expect(result).toEqual({ id: "acc789", role: 0 });
  });

  it("mặc định role = 0 khi role không phải number", async () => {
    mockGetDocs.mockResolvedValueOnce(
      makeSnap([{ id: "accX", data: () => ({ email: "test@test.com", role: "admin" }) }]) as never
    );
    const result = await checkAllowedAccount("test@test.com");
    expect(result).toEqual({ id: "accX", role: 0 });
  });

  it("ném lỗi khi Firestore thất bại", async () => {
    mockGetDocs.mockRejectedValueOnce(new Error("Firestore error") as never);
    await expect(checkAllowedAccount("test@test.com")).rejects.toThrow("Firestore error");
  });
});
