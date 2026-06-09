import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/service/firebase", () => ({
  db: {},
  auth: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

import { AccountNotAllowedError, checkAllowedAccount } from "@/service/authService";
import { getDoc } from "firebase/firestore";

const mockGetDoc = getDoc as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkAllowedAccount (internal whitelist)", () => {
  it("returns role from an existing allowedAccounts/{uid} document", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: "user_uid_123",
      data: () => ({ role: 1, email: "admin@test.com" }),
    });

    const result = await checkAllowedAccount("user_uid_123", "admin@test.com");

    expect(result).toEqual({ id: "user_uid_123", role: 1 });
  });

  it("falls back to read-only when stored role is not admin", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: "user_uid_456",
      data: () => ({ role: "admin", email: "viewer@test.com" }),
    });

    const result = await checkAllowedAccount("user_uid_456", "viewer@test.com");

    expect(result).toEqual({ id: "user_uid_456", role: 0 });
  });

  it("returns viewer role for an existing role 0 account", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: "viewer_uid_789",
      data: () => ({ role: 0, email: "viewer@test.com" }),
    });

    const result = await checkAllowedAccount("viewer_uid_789", "viewer@test.com");

    expect(result).toEqual({ id: "viewer_uid_789", role: 0 });
  });

  it("rejects users that are authenticated but not whitelisted", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    });

    await expect(
      checkAllowedAccount("missing_uid", "outsider@test.com")
    ).rejects.toBeInstanceOf(AccountNotAllowedError);
  });
});
