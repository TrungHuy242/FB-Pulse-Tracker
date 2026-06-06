/**
 * useAllComments — tải bình luận từ mọi import.
 * Hỗ trợ filter theo: từ khóa, tác giả, nhóm, tài khoản, khoảng thời gian.
 *
 * FIX #1: Giới hạn tối đa MAX_COMMENTS để tránh tải toàn bộ data không kiểm soát.
 * Khi vượt giới hạn → expose hasMore = true để UI hiển thị cảnh báo.
 */
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import { withCache } from "@/service/queryCache";
import type { CommentItem } from "@/types";

export interface CommentFilter {
  keyword?: string;
  author?: string;
  group?: string;
  account?: string;
  from?: Date | null;
  to?: Date | null;
}

export interface RichComment extends CommentItem {
  importId: string;
  accountName: string;
}

/** Giới hạn số bình luận tải một lần để bảo vệ RAM và performance */
const MAX_COMMENTS = 5000;

export const useAllComments = (filter: CommentFilter, refreshSignal?: number) => {
  const [comments, setComments] = useState<RichComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
      const importsSnap = await withCache("imports:list:raw", async () => {
        return getDocs(q);
      }, 60_000);

      const fromTs = filter.from?.getTime() ?? null;
      const toTs = filter.to?.getTime() ?? null;
      const keyword = filter.keyword?.toLowerCase().trim() ?? "";
      const author = filter.author?.toLowerCase().trim() ?? "";
      const group = filter.group?.toLowerCase().trim() ?? "";
      const account = filter.account?.toLowerCase().trim() ?? "";

      const all: RichComment[] = [];
      let limitReached = false;

      outer:
      for (const imp of importsSnap.docs) {
        const accountName = (imp.data().accountName ?? "Unknown") as string;

        // Account filter
        if (account && !accountName.toLowerCase().includes(account)) continue;

        try {
          const commentItems = await withCache(`imports:${imp.id}:comments`, async () => {
            const chunksSnap = await getDocs(
              collection(db, "imports", imp.id, "commentChunks")
            );
            const items: CommentItem[] = [];
            for (const chunk of chunksSnap.docs) {
              items.push(...((chunk.data().items ?? []) as CommentItem[]));
            }
            return items;
          }, 120_000);

          for (const item of commentItems) {
            // Date filter
            if (fromTs || toTs) {
              const ct = (item.commentTime ?? 0) * 1000;
              if (fromTs && ct < fromTs) continue;
              if (toTs && ct > toTs) continue;
            }
            // Keyword filter (searches content)
            if (keyword && !item.content?.toLowerCase().includes(keyword)) continue;
            // Author filter
            if (author && !item.authorName?.toLowerCase().includes(author)) continue;
            // Group filter
            if (group && !item.group?.toLowerCase().includes(group)) continue;

            all.push({ ...item, importId: imp.id, accountName });

            // Check limit
            if (all.length >= MAX_COMMENTS) {
              limitReached = true;
              break outer;
            }
          }
        } catch {
          // skip failed import
        }
      }

      // Sort by time descending
      all.sort((a, b) => (b.commentTime ?? 0) - (a.commentTime ?? 0));
      setTotal(all.length);
      setHasMore(limitReached);
      setComments(all);
    } catch (err) {
      console.error("useAllComments failed:", err);
    } finally {
      setLoading(false);
    }
  }, [
    filter.keyword,
    filter.author,
    filter.group,
    filter.account,
    filter.from?.getTime(),
    filter.to?.getTime(),
    refreshSignal,
  ]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filter.keyword,
    filter.author,
    filter.group,
    filter.account,
    filter.from?.getTime(),
    filter.to?.getTime(),
    refreshSignal,
  ]);

  return { comments, loading, total, hasMore, reload: load };
};
