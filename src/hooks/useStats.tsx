import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import { useLoading } from "@/contexts/LoadingContext";
import type { StatsFilter } from "@/types";

interface ImportData {
  accountName?: string;
  reactionsCount?: number;
  commentsCount?: number;
  sharesCount?: number;
}

interface ChunkItemComment {
  commentTime?: number;
}

interface ChunkItemReaction {
  reactionTime?: number;
}

export const useStats = (dateFilter?: StatsFilter) => {
  const [stats, setStats] = useState({
    likes: 0,
    comments: 0,
    shares: 0,
    totalImport: 0,
  });
  const [loading, setLoading] = useState(false);
  const { showLoading, closeLoading } = useLoading();

  const getStats = async () => {
    setLoading(true);
    showLoading("filter-stats");
    try {
      const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
      const snapshot = await getDocs(q);

      let likes = 0;
      let comments = 0;
      let shares = 0;
      let totalImport = 0;

      const hasRange = !!(dateFilter?.from && dateFilter?.to);
      const fromTs = hasRange ? dateFilter!.from!.getTime() : 0;
      const toTs = hasRange ? dateFilter!.to!.getTime() : 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as ImportData;

        if (dateFilter?.name) {
          const acct = (data.accountName ?? "").toLowerCase();
          if (Array.isArray(dateFilter.name)) {
            const sel = dateFilter.name.map((n) => n.toLowerCase());
            if (!sel.includes(acct)) continue;
          } else {
            if (!acct.includes(dateFilter.name.toLowerCase())) continue;
          }
        }

        if (!hasRange) {
          likes += data.reactionsCount ?? 0;
          comments += data.commentsCount ?? 0;
          shares += data.sharesCount ?? 0;
          totalImport += 1;
          continue;
        }

        let commentsInRange = 0;
        let reactionsInRange = 0;

        try {
          const commentChunksSnap = await getDocs(
            collection(db, "imports", docSnap.id, "commentChunks")
          );
          for (const c of commentChunksSnap.docs) {
            const items = (c.data().items ?? []) as ChunkItemComment[];
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
            collection(db, "imports", docSnap.id, "reactionChunks")
          );
          for (const r of reactionChunksSnap.docs) {
            const items = (r.data().items ?? []) as ChunkItemReaction[];
            for (const it of items) {
              const rt = (it.reactionTime ?? 0) * 1000;
              if (rt >= fromTs && rt <= toTs) reactionsInRange++;
            }
          }
        } catch {
          // ignore per-import errors
        }

        comments += commentsInRange;
        likes += reactionsInRange;
        if (commentsInRange > 0 || reactionsInRange > 0) totalImport += 1;
      }

      setStats({ likes, comments, shares, totalImport });
    } catch (error) {
      console.error("Fetch stats failed:", error);
    } finally {
      setLoading(false);
      closeLoading("filter-stats");
    }
  };

  const fromTime = dateFilter?.from?.getTime() ?? null;
  const toTime = dateFilter?.to?.getTime() ?? null;
  const filterName = dateFilter?.name ?? null;

  useEffect(() => {
    getStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTime, toTime, filterName]);

  return { stats, loading, reloadStats: getStats };
};
