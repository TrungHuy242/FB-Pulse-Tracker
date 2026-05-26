import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  limit,
  startAfter,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/service/firebase";
import { useLoading } from "@/contexts/LoadingContext";
import type { ImportRecord } from "@/types";

export type AccountsTableFilter = {
  from?: Date | null;
  to?: Date | null;
  name?: string | string[];
  minLikes?: number | null;
  minComments?: number | null;
};

/** Số imports tải mỗi lần (cursor-based pagination) */
const PAGE_SIZE = 20;

export const useAccountsTable = (
  filter?: AccountsTableFilter,
  refreshSignal?: number,
  loadingKey?: string
) => {
  const [tableData, setTableData] = useState<ImportRecord[]>([]);
  const [load, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Cursor trỏ đến document cuối cùng đã load — dùng cho "load more"
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const { showLoading, closeLoading } = useLoading();

  /**
   * Fetch dữ liệu với cursor-based pagination.
   * @param cursor - Document Firestore để bắt đầu sau (null = trang đầu)
   * @param append - true = ghép thêm vào tableData, false = thay thế
   */
  const fetchPage = useCallback(
    async (cursor: DocumentSnapshot | null, append: boolean) => {
      setLoading(true);
      if (loadingKey) showLoading(loadingKey);

      try {
        // Khi có date filter → cần scan chunks để đếm lại,
        // phải load tất cả (không pagination) để lọc đúng.
        // Khi không có date filter → dùng pagination limit 20.
        const hasDateFilter = !!(filter?.from && filter?.to);

        let imports: ImportRecord[];

        if (hasDateFilter) {
          // Load toàn bộ để re-count từ chunks
          const q = query(
            collection(db, "imports"),
            orderBy("importedAt", "desc")
          );
          const snapshot = await getDocs(q);
          imports = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as ImportRecord[];
          setHasMore(false);
          lastDocRef.current = null;
        } else {
          // Pagination mode: limit 20 + startAfter cursor
          const constraints = cursor
            ? [orderBy("importedAt", "desc"), startAfter(cursor), limit(PAGE_SIZE)]
            : [orderBy("importedAt", "desc"), limit(PAGE_SIZE)];

          const q = query(collection(db, "imports"), ...constraints);
          const snapshot = await getDocs(q);
          imports = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as ImportRecord[];

          // Cập nhật cursor và hasMore
          const lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
          lastDocRef.current = lastDoc;
          setHasMore(snapshot.docs.length === PAGE_SIZE);
        }

        // Date range filter: recompute counts from chunks
        if (hasDateFilter && filter?.from && filter?.to) {
          const fromTs = filter.from.getTime();
          const toTs = filter.to.getTime();

          imports = await Promise.all(
            imports.map(async (imp) => {
              let commentsInRange = 0;
              let reactionsInRange = 0;

              try {
                const commentChunksSnap = await getDocs(
                  collection(db, "imports", imp.id, "commentChunks")
                );
                for (const docSnap of commentChunksSnap.docs) {
                  const items = (docSnap.data().items ?? []) as { commentTime?: number }[];
                  for (const it of items) {
                    const ct = (it.commentTime ?? 0) * 1000;
                    if (ct >= fromTs && ct <= toTs) commentsInRange++;
                  }
                }
              } catch {
                // bỏ qua lỗi per-import
              }

              try {
                const reactionChunksSnap = await getDocs(
                  collection(db, "imports", imp.id, "reactionChunks")
                );
                for (const docSnap of reactionChunksSnap.docs) {
                  const items = (docSnap.data().items ?? []) as { reactionTime?: number }[];
                  for (const it of items) {
                    const rt = (it.reactionTime ?? 0) * 1000;
                    if (rt >= fromTs && rt <= toTs) reactionsInRange++;
                  }
                }
              } catch {
                // bỏ qua lỗi per-import
              }

              return {
                ...imp,
                commentsCount: commentsInRange,
                reactionsCount: reactionsInRange,
              };
            })
          );
        }

        // Client-side filters (name, minLikes, minComments)
        if (filter) {
          if (filter.name) {
            if (Array.isArray(filter.name)) {
              const selected = filter.name.map((n) => n.toLowerCase());
              imports = imports.filter((it) =>
                selected.includes((it.accountName ?? "").toLowerCase())
              );
            } else {
              const nameLower = filter.name.toLowerCase();
              imports = imports.filter((it) =>
                (it.accountName ?? "").toLowerCase().includes(nameLower)
              );
            }
          }
          if (typeof filter.minLikes === "number") {
            imports = imports.filter(
              (it) => (it.reactionsCount ?? 0) >= (filter.minLikes ?? 0)
            );
          }
          if (typeof filter.minComments === "number") {
            imports = imports.filter(
              (it) => (it.commentsCount ?? 0) >= (filter.minComments ?? 0)
            );
          }
        }

        // Ghép thêm hoặc thay thế dữ liệu
        setTableData((prev) => (append ? [...prev, ...imports] : imports));
      } catch (error) {
        console.error("Fetch tableData failed:", error);
      } finally {
        setLoading(false);
        if (loadingKey) closeLoading(loadingKey);
      }
    },
    [filter] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Load trang đầu (reset cursor) */
  const getTableData = useCallback(async () => {
    lastDocRef.current = null;
    await fetchPage(null, false);
  }, [fetchPage]);

  /** Load thêm trang tiếp theo (append) */
  const loadMore = useCallback(async () => {
    if (!hasMore || load) return;
    await fetchPage(lastDocRef.current, true);
  }, [fetchPage, hasMore, load]);

  useEffect(() => {
    getTableData();
  }, [getTableData, refreshSignal]);

  return { tableData, load, hasMore, reloadTable: getTableData, loadMore };
};
