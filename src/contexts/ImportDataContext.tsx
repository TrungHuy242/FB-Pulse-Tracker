/**
 * ImportDataContext — Shared real-time cache cho danh sách import.
 *
 * Day 11: Chuyển từ getDocs (one-shot) + TTL → onSnapshot (real-time).
 * Lợi ích:
 *   - Import mới từ tab khác / user khác được phản ánh ngay lập tức
 *   - Không cần polling hay manual reload
 *   - Listener tự unsubscribe khi Provider unmount
 *
 * Cách dùng:
 *   const { imports, loading, totalComments, totalReactions } = useImportData();
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/service/firebase";
import type { ImportRecord } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportDataValue {
  /** Toàn bộ danh sách import (chưa filter theo ngày) — real-time */
  imports: ImportRecord[];
  loading: boolean;
  /** Tổng comments từ metadata (không scan chunks) */
  totalComments: number;
  /** Tổng reactions từ metadata (không scan chunks) */
  totalReactions: number;
  /** Timestamp lần nhận snapshot gần nhất */
  fetchedAt: number | null;
  /**
   * Compatibility shim — với onSnapshot data luôn fresh, không cần gọi.
   * Giữ lại để không phá API hiện có.
   */
  reload: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ImportDataContext = createContext<ImportDataValue>({
  imports: [],
  loading: false,
  totalComments: 0,
  totalReactions: 0,
  fetchedAt: null,
  reload: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export const ImportDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true); // true until first snapshot
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  // ── onSnapshot listener ──────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ImportRecord[];
        setImports(data);
        setFetchedAt(Date.now());
        setLoading(false);
      },
      (err) => {
        console.error("[ImportDataContext] onSnapshot error:", err);
        setLoading(false);
      },
    );

    // Cleanup: unsubscribe when Provider unmounts
    return () => unsubscribe();
  }, []); // run once on mount — onSnapshot stays active

  /** Compatibility shim — data is always fresh via onSnapshot. */
  const reload = useCallback(async () => {
    // No-op: the onSnapshot listener keeps data current automatically.
  }, []);

  // Tính totals từ metadata (không cần scan sub-collections)
  const totalComments = useMemo(
    () => imports.reduce((sum, imp) => sum + (imp.commentsCount ?? 0), 0),
    [imports],
  );
  const totalReactions = useMemo(
    () => imports.reduce((sum, imp) => sum + (imp.reactionsCount ?? 0), 0),
    [imports],
  );

  const value = useMemo<ImportDataValue>(
    () => ({ imports, loading, totalComments, totalReactions, fetchedAt, reload }),
    [imports, loading, totalComments, totalReactions, fetchedAt, reload],
  );

  return (
    <ImportDataContext.Provider value={value}>
      {children}
    </ImportDataContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Dùng trong HomePage, StatsCards, AccountsTable để tránh double-fetch. */
export const useImportData = (): ImportDataValue => {
  return useContext(ImportDataContext);
};
