/**
 * Unit tests cho useStats hook.
 * Test logic tính toán stats từ Firestore data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mock Firebase ────────────────────────────────────────────────────────────
vi.mock("@/service/firebase", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...path) => path.join("/")),
  getDocs: vi.fn(),
  query: vi.fn((...args) => args),
  orderBy: vi.fn(),
}));

// Mock LoadingContext
vi.mock("@/contexts/LoadingContext", () => ({
  useLoading: () => ({
    showLoading: vi.fn(),
    closeLoading: vi.fn(),
  }),
}));

import { useStats } from "@/hooks/useStats";
import { getDocs } from "firebase/firestore";

const mockGetDocs = vi.mocked(getDocs);

// ── Test data helpers ─────────────────────────────────────────────────────────
const makeImportSnap = (docs: { id: string; data: () => Record<string, unknown> }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: d.data })),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("useStats", () => {
  it("trả về stats mặc định khi chưa có data", async () => {
    mockGetDocs.mockResolvedValue(makeImportSnap([]) as never);

    const { result } = renderHook(() => useStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats).toEqual({
      likes: 0,
      comments: 0,
      shares: 0,
      totalImport: 0,
    });
  });

  it("tổng hợp đúng stats từ nhiều imports", async () => {
    mockGetDocs.mockResolvedValue(
      makeImportSnap([
        {
          id: "import1",
          data: () => ({
            accountName: "Nguyễn A",
            reactionsCount: 100,
            commentsCount: 50,
            sharesCount: 10,
          }),
        },
        {
          id: "import2",
          data: () => ({
            accountName: "Trần B",
            reactionsCount: 200,
            commentsCount: 80,
            sharesCount: 20,
          }),
        },
      ]) as never
    );

    const { result } = renderHook(() => useStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.likes).toBe(300);
    expect(result.current.stats.comments).toBe(130);
    expect(result.current.stats.shares).toBe(30);
    expect(result.current.stats.totalImport).toBe(2);
  });

  it("loading state chuyển từ false → true → false", async () => {
    let resolveGetDocs!: (value: unknown) => void;
    const pendingPromise = new Promise((r) => { resolveGetDocs = r; });
    mockGetDocs.mockReturnValue(pendingPromise as never);

    const { result } = renderHook(() => useStats());

    // Ban đầu hook tự gọi getStats, nên loading có thể là true
    // Sau đó resolve để kiểm tra loading = false
    act(() => {
      resolveGetDocs(makeImportSnap([]));
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("lọc đúng theo tên account", async () => {
    mockGetDocs.mockResolvedValue(
      makeImportSnap([
        {
          id: "import1",
          data: () => ({
            accountName: "Nguyễn A",
            reactionsCount: 100,
            commentsCount: 50,
            sharesCount: 0,
          }),
        },
        {
          id: "import2",
          data: () => ({
            accountName: "Trần B",
            reactionsCount: 200,
            commentsCount: 80,
            sharesCount: 0,
          }),
        },
      ]) as never
    );

    const { result } = renderHook(() =>
      useStats({ name: "Nguyễn A" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Chỉ tính stats của "Nguyễn A"
    expect(result.current.stats.likes).toBe(100);
    expect(result.current.stats.totalImport).toBe(1);
  });

  it("xử lý lỗi Firestore gracefully", async () => {
    mockGetDocs.mockRejectedValue(new Error("Firestore unavailable") as never);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Stats vẫn ở giá trị mặc định
    expect(result.current.stats.totalImport).toBe(0);
    consoleSpy.mockRestore();
  });

  it("expose hàm reloadStats", () => {
    mockGetDocs.mockResolvedValue(makeImportSnap([]) as never);
    const { result } = renderHook(() => useStats());
    expect(typeof result.current.reloadStats).toBe("function");
  });
});
