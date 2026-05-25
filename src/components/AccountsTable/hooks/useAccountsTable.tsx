import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
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

export const useAccountsTable = (
  filter?: AccountsTableFilter,
  refreshSignal?: number,
  loadingKey?: string
) => {
  const [tableData, setTableData] = useState<ImportRecord[]>([]);
  const [load, setLoading] = useState(false);
  const { showLoading, closeLoading } = useLoading();

  const getTableData = useCallback(async () => {
    setLoading(true);
    if (loadingKey) {
      showLoading(loadingKey);
    }
    try {
      const q = query(
        collection(db, "imports"),
        orderBy("importedAt", "desc")
      );
      const snapshot = await getDocs(q);
      let imports = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ImportRecord[];

      // Date range filter: recompute counts from chunks
      if (filter?.from && filter?.to) {
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
              // ignore per-import errors
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
              // ignore per-import errors
            }

            return {
              ...imp,
              commentsCount: commentsInRange,
              reactionsCount: reactionsInRange,
            };
          })
        );
      }

      // Client-side filters
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

      setTableData(imports);
    } catch (error) {
      console.error("Fetch tableData failed:", error);
    } finally {
      setLoading(false);
      if (loadingKey) {
        closeLoading(loadingKey);
      }
    }
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getTableData();
  }, [getTableData, refreshSignal]);

  return { tableData, load, reloadTable: getTableData };
};
