/**
 * Unit tests cho useAccountsTable hook.
 * Test pagination, filtering, và data fetching logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// ── Mock Firebase ────────────────────────────────────────────────────────────
vi.mock("@/service/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...path) => path.join("/")),
  getDocs: vi.fn(),
  query: vi.fn((...args) => args),
  orderBy: vi.fn(),
  limit: vi.fn((n) => ({ type: "limit", n })),
  startAfter: vi.fn((doc) => ({ type: "startAfter", doc })),
}));

vi.mock("@/contexts/LoadingContext", () => ({
  useLoading: () => ({
    showLoading: vi.fn(),
    closeLoading: vi.fn(),
  }),
}));

import { useAccountsTable } from "@/components/AccountsTable/hooks/useAccountsTable";
import { getDocs } from "firebase/firestore";

const mockGetDocs = vi.mocked(getDocs);

// ── Test data helpers ─────────────────────────────────────────────────────────
const makeSnap = (docs: { id: string; data: () => Record<string, unknown> }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: d.data })),
  size: docs.length,
});

const makeImport = (i: number) => ({
  id: `import${i}`,
  data: () => ({
    accountName: `User ${i}`,
    reactionsCount: i * 10,
    commentsCount: i * 5,
    sharesCount: 0,
    totalFiles: 1,
    status: "completed",
    importedAt: { toDate: () => new Date(2024, 0, i + 1) },
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("useAccountsTable", () => {
  it("fetch và trả về danh sách imports", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnap([makeImport(1), makeImport(2), makeImport(3)]) as never
    );

    const { result } = renderHook(() => useAccountsTable());

    await waitFor(() => {
      expect(result.current.load).toBe(false);
    });

    expect(result.current.tableData).toHaveLength(3);
    expect(result.current.tableData[0].accountName).toBe("User 1");
  });

  it("trả về array rỗng khi không có imports", async () => {
    mockGetDocs.mockResolvedValue(makeSnap([]) as never);

    const { result } = renderHook(() => useAccountsTable());

    await waitFor(() => {
      expect(result.current.load).toBe(false);
    });

    expect(result.current.tableData).toEqual([]);
  });

  it("lọc đúng theo tên account (array)", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnap([makeImport(1), makeImport(2), makeImport(3)]) as never
    );

    const { result } = renderHook(() =>
      useAccountsTable({ name: ["User 1", "User 3"] })
    );

    await waitFor(() => {
      expect(result.current.load).toBe(false);
    });

    expect(result.current.tableData).toHaveLength(2);
    expect(result.current.tableData.map((d) => d.accountName)).toEqual([
      "User 1",
      "User 3",
    ]);
  });

  it("lọc đúng theo tên account (string)", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnap([makeImport(1), makeImport(2), makeImport(3)]) as never
    );

    const { result } = renderHook(() =>
      useAccountsTable({ name: "User 2" })
    );

    await waitFor(() => {
      expect(result.current.load).toBe(false);
    });

    expect(result.current.tableData).toHaveLength(1);
    expect(result.current.tableData[0].accountName).toBe("User 2");
  });

  it("lọc đúng theo minLikes", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnap([makeImport(1), makeImport(5), makeImport(10)]) as never
    );

    const { result } = renderHook(() =>
      useAccountsTable({ minLikes: 50 })
    );

    await waitFor(() => {
      expect(result.current.load).toBe(false);
    });

    // makeImport(5) = 50 reactions, makeImport(10) = 100 reactions
    expect(result.current.tableData).toHaveLength(2);
  });

  it("lọc đúng theo minComments", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnap([makeImport(1), makeImport(4), makeImport(8)]) as never
    );

    const { result } = renderHook(() =>
      useAccountsTable({ minComments: 20 })
    );

    await waitFor(() => {
      expect(result.current.load).toBe(false);
    });

    // makeImport(4) = 20 comments, makeImport(8) = 40 comments
    expect(result.current.tableData).toHaveLength(2);
  });

  it("expose hàm reloadTable", () => {
    mockGetDocs.mockResolvedValue(makeSnap([]) as never);
    const { result } = renderHook(() => useAccountsTable());
    expect(typeof result.current.reloadTable).toBe("function");
  });

  it("xử lý lỗi Firestore gracefully", async () => {
    mockGetDocs.mockRejectedValue(new Error("Network error") as never);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useAccountsTable());

    await waitFor(() => {
      expect(result.current.load).toBe(false);
    });

    expect(result.current.tableData).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("refetch khi refreshSignal thay đổi", async () => {
    mockGetDocs.mockResolvedValue(makeSnap([makeImport(1)]) as never);

    const { result, rerender } = renderHook(
      ({ signal }: { signal: number }) => useAccountsTable(undefined, signal),
      { initialProps: { signal: 0 } }
    );

    await waitFor(() => expect(result.current.load).toBe(false));
    expect(mockGetDocs).toHaveBeenCalledTimes(1);

    // Thay đổi refreshSignal → trigger refetch
    mockGetDocs.mockResolvedValue(makeSnap([makeImport(1), makeImport(2)]) as never);
    rerender({ signal: 1 });

    await waitFor(() => expect(result.current.tableData).toHaveLength(2));
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});
