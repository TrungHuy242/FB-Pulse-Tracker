/**
 * ImportDataContext — Shared cache cho danh sách import (không có filter).
 *
 * Mục đích: tránh useStats và useAccountsTable fetch cùng imports collection
 * hai lần độc lập khi mở HomePage.
 *
 * Cách dùng:
 *   const { imports, loading, totalComments, totalReactions, reload } = useImportData();
 *
 * Cache TTL: 60 giây — đủ để tránh double-fetch khi component mount cùng lúc.
 * Sau 60s hoặc khi gọi reload(), data được fresh lại.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/service/firebase";
import type { ImportRecord } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportDataValue {
  /** Toàn bộ danh sách import (chưa filter theo ngày) */
  imports: ImportRecord[];
  loading: boolean;
  /** Tổng comments từ metadata (không scan chunks) */
  totalComments: number;
  /** Tổng reactions từ metadata (không scan chunks) */
  totalReactions: number;
  /** Timestamp lần fetch gần nhất (để debug) */
  fetchedAt: number | null;
  /** Tải lại dữ liệu ngay lập tức, bỏ qua cache */
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

/** TTL cho cache nội bộ (60 giây) */
const CACHE_TTL_MS = 60_000;

export const ImportDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const fetchingRef = useRef(false); // tránh concurrent fetches

  const fetchImports = useCallback(async (force = false) => {
    // Không fetch nếu cache còn hiệu lực
    if (!force && fetchedAt !== null && Date.now() - fetchedAt < CACHE_TTL_MS) {
      return;
    }
    // Không fetch nếu đang fetch
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);
    try {
      const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ImportRecord[];
      setImports(data);
      setFetchedAt(Date.now());
    } catch (err) {
      console.error("[ImportDataContext] fetch lỗi:", err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [fetchedAt]);

  // Fetch lần đầu khi Provider mount
  useEffect(() => {
    fetchImports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reload công khai — force = true bỏ qua cache TTL */
  const reload = useCallback(async () => {
    await fetchImports(true);
  }, [fetchImports]);

  // Tính totals từ metadata (không cần scan sub-collections)
  const totalComments = useMemo(
    () => imports.reduce((sum, imp) => sum + (imp.commentsCount ?? 0), 0),
    [imports]
  );
  const totalReactions = useMemo(
    () => imports.reduce((sum, imp) => sum + (imp.reactionsCount ?? 0), 0),
    [imports]
  );

  const value = useMemo<ImportDataValue>(
    () => ({ imports, loading, totalComments, totalReactions, fetchedAt, reload }),
    [imports, loading, totalComments, totalReactions, fetchedAt, reload]
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
