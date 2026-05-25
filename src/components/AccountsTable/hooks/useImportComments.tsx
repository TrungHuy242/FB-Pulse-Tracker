import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import type { CommentItem } from "@/types";

export const useImportComments = (
  importId?: string,
  enabled: boolean = false,
  from?: Date | null,
  to?: Date | null
) => {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fromTs = from?.getTime() ?? null;
  const toTs = to?.getTime() ?? null;

  useEffect(() => {
    if (!enabled || !importId) {
      setComments([]);
      return;
    }

    const fetchComments = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "imports", importId, "commentChunks"),
          orderBy("index", "asc")
        );
        const snap = await getDocs(q);
        let all = snap.docs.flatMap(
          (doc) => (doc.data().items ?? []) as CommentItem[]
        );

        if (fromTs !== null && toTs !== null) {
          all = all.filter((c) => {
            const ct = (c.commentTime ?? 0) * 1000;
            return ct >= fromTs && ct <= toTs;
          });
        }

        setComments(all);
      } catch (err) {
        console.error("Fetch comments failed:", err);
        setComments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [importId, enabled, fromTs, toTs]);

  return { comments, loading };
};
