/**
 * Tests for useRealtimeImports — onSnapshot-based new-data detector.
 *
 * Firebase Firestore is fully mocked:
 *  - onSnapshot triggers immediately with a fake snapshot.
 *  - Subsequent calls simulate new documents arriving.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeImports } from "@/hooks/useRealtimeImports";

// ── Firebase mock ─────────────────────────────────────────────────────────

// We intercept the module before it's imported by the hook
vi.mock("firebase/firestore", () => {
  return {
    collection: vi.fn(() => ({})),
    onSnapshot: vi.fn(),
    orderBy: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
  };
});

vi.mock("@/service/firebase", () => ({
  db: {},
}));

// Helper to get the mocked onSnapshot
const getOnSnapshot = async () => {
  const mod = await import("firebase/firestore");
  return mod.onSnapshot as Mock;
};

// Build a fake QuerySnapshot with given document IDs
const makeSnap = (ids: string[]) => ({
  docs: ids.map((id) => ({ id })),
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useRealtimeImports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hasNewData=false initially", async () => {
    const onSnapshot = await getOnSnapshot();
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      // Fire initial snapshot with 2 docs
      cb(makeSnap(["doc1", "doc2"]));
      return vi.fn(); // unsubscribe
    });

    const { result } = renderHook(() => useRealtimeImports(true));
    expect(result.current.hasNewData).toBe(false);
  });

  it("sets hasNewData=true when a new ID appears after init", async () => {
    const onSnapshot = await getOnSnapshot();

    let capturedCb: ((snap: unknown) => void) | null = null;
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      capturedCb = cb;
      // Fire initial snapshot
      cb(makeSnap(["doc1", "doc2"]));
      return vi.fn();
    });

    const { result } = renderHook(() => useRealtimeImports(true));
    expect(result.current.hasNewData).toBe(false);

    // New document "doc3" arrives
    act(() => {
      capturedCb!(makeSnap(["doc1", "doc2", "doc3"]));
    });

    expect(result.current.hasNewData).toBe(true);
  });

  it("does NOT set hasNewData when same IDs arrive again", async () => {
    const onSnapshot = await getOnSnapshot();

    let capturedCb: ((snap: unknown) => void) | null = null;
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      capturedCb = cb;
      cb(makeSnap(["doc1", "doc2"]));
      return vi.fn();
    });

    const { result } = renderHook(() => useRealtimeImports(true));

    // Same docs again (e.g. an update to existing doc)
    act(() => {
      capturedCb!(makeSnap(["doc1", "doc2"]));
    });

    expect(result.current.hasNewData).toBe(false);
  });

  it("clearNewData resets hasNewData to false", async () => {
    const onSnapshot = await getOnSnapshot();

    let capturedCb: ((snap: unknown) => void) | null = null;
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      capturedCb = cb;
      cb(makeSnap(["doc1"]));
      return vi.fn();
    });

    const { result } = renderHook(() => useRealtimeImports(true));

    act(() => {
      capturedCb!(makeSnap(["doc1", "doc2"]));
    });
    expect(result.current.hasNewData).toBe(true);

    act(() => {
      result.current.clearNewData();
    });
    expect(result.current.hasNewData).toBe(false);
  });

  it("calls onNewData callback when new document detected", async () => {
    const onSnapshot = await getOnSnapshot();
    const onNewData = vi.fn();

    let capturedCb: ((snap: unknown) => void) | null = null;
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      capturedCb = cb;
      cb(makeSnap(["doc1"]));
      return vi.fn();
    });

    renderHook(() => useRealtimeImports(true, onNewData));

    act(() => {
      capturedCb!(makeSnap(["doc1", "doc2"]));
    });

    expect(onNewData).toHaveBeenCalledTimes(1);
  });

  it("does NOT subscribe when enabled=false", async () => {
    const onSnapshot = await getOnSnapshot();

    renderHook(() => useRealtimeImports(false));

    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", async () => {
    const onSnapshot = await getOnSnapshot();
    const unsubscribe = vi.fn();

    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb(makeSnap(["doc1"]));
      return unsubscribe;
    });

    const { unmount } = renderHook(() => useRealtimeImports(true));
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
