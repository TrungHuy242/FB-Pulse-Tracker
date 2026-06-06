/**
 * useAllEngagement — tải toàn bộ comments + reactions từ mọi import.
 * Dùng cho InsightsPanel và SentimentChart trên AnalyticsPage.
 * Kết quả được cache trong state, chỉ reload khi filter hoặc signal thay đổi.
 */
import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import type { StatsFilter } from "@/types";

export interface LightComment {
  commentTime?: number;
  authorName?: string;
  content?: string;
}

export interface LightReaction {
  reactionTime?: number;
  reaction?: string;
}

export const useAllEngagement = (filter?: StatsFilter, refreshSignal?: number) => {
  const [comments, setComments] = useState<LightComment[]>([]);
  const [reactions, setReactions] = useState<LightReaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fromTs = filter?.from?.getTime() ?? null;
  const toTs   = filter?.to?.getTime() ?? null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
        const importsSnap = await getDocs(q);

        const allComments: LightComment[] = [];
        const allReactions: LightReaction[] = [];

        for (const imp of importsSnap.docs) {
          // Account filter
          if (filter?.name) {
            const acct = (imp.data().accountName ?? "").toLowerCase();
            if (Array.isArray(filter.name)) {
              if (!filter.name.map((n) => n.toLowerCase()).includes(acct)) continue;
            } else if (!acct.includes(filter.name.toLowerCase())) continue;
          }

          // Comments
          try {
            const cSnap = await getDocs(collection(db, "imports", imp.id, "commentChunks"));
            const commentItems: LightComment[] = [];
            for (const chunk of cSnap.docs) {
              commentItems.push(...((chunk.data().items ?? []) as LightComment[]));
            }

            for (const item of commentItems) {
              if (fromTs || toTs) {
                const ct = (item.commentTime ?? 0) * 1000;
                if (fromTs && ct < fromTs) continue;
                if (toTs && ct > toTs) continue;
              }
              allComments.push(item);
            }
          } catch { /* skip */ }

          // Reactions
          try {
            const rSnap = await getDocs(collection(db, "imports", imp.id, "reactionChunks"));
            const reactionItems: LightReaction[] = [];
            for (const chunk of rSnap.docs) {
              reactionItems.push(...((chunk.data().items ?? []) as LightReaction[]));
            }

            for (const item of reactionItems) {
              if (fromTs || toTs) {
                const rt = (item.reactionTime ?? 0) * 1000;
                if (fromTs && rt < fromTs) continue;
                if (toTs && rt > toTs) continue;
              }
              allReactions.push(item);
            }
          } catch { /* skip */ }
        }

        if (!cancelled) {
          setComments(allComments);
          setReactions(allReactions);
        }
      } catch (err) {
        console.error("useAllEngagement failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTs, toTs, JSON.stringify(filter?.name), refreshSignal]);

  return { comments, reactions, loading };
};
