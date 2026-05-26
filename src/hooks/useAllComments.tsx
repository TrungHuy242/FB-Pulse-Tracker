/**
 * useAllComments — tải toàn bộ bình luận từ mọi import.
 * Hỗ trợ filter theo: từ khóa, tác giả, nhóm, tài khoản, khoảng thời gian.
 */
import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
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

export const useAllComments = (filter: CommentFilter, refreshSignal?: number) => {
  const [comments, setComments] = useState<RichComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
      const importsSnap = await getDocs(q);

      const fromTs = filter.from?.getTime() ?? null;
      const toTs = filter.to?.getTime() ?? null;
      const keyword = filter.keyword?.toLowerCase().trim() ?? "";
      const author = filter.author?.toLowerCase().trim() ?? "";
      const group = filter.group?.toLowerCase().trim() ?? "";
      const account = filter.account?.toLowerCase().trim() ?? "";

      const all: RichComment[] = [];

      for (const imp of importsSnap.docs) {
        const accountName = (imp.data().accountName ?? "Unknown") as string;

        // Account filter
        if (account && !accountName.toLowerCase().includes(account)) continue;

        try {
          const chunksSnap = await getDocs(
            collection(db, "imports", imp.id, "commentChunks")
          );
          for (const chunk of chunksSnap.docs) {
            const items = (chunk.data().items ?? []) as CommentItem[];
            for (const item of items) {
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
            }
          }
        } catch {
          // skip failed import
        }
      }

      // Sort by time descending
      all.sort((a, b) => (b.commentTime ?? 0) - (a.commentTime ?? 0));
      setTotal(all.length);
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

  return { comments, loading, total, reload: load };
};
