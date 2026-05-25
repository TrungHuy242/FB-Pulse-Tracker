import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import type { ReactionItem } from "@/types";

export const useImportReactions = (
  importId?: string,
  enabled: boolean = false,
  from?: Date | null,
  to?: Date | null
) => {
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fromTs = from?.getTime() ?? null;
  const toTs = to?.getTime() ?? null;

  useEffect(() => {
    if (!enabled || !importId) {
      setReactions([]);
      return;
    }

    const fetchReactions = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "imports", importId, "reactionChunks"),
          orderBy("index", "asc")
        );
        const snap = await getDocs(q);
        let all = snap.docs.flatMap(
          (doc) => (doc.data().items ?? []) as ReactionItem[]
        );

        if (fromTs !== null && toTs !== null) {
          all = all.filter((r) => {
            const rt = (r.reactionTime ?? 0) * 1000;
            return rt >= fromTs && rt <= toTs;
          });
        }

        setReactions(all);
      } catch (err) {
        console.error("Fetch reactions failed:", err);
        setReactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReactions();
  }, [importId, enabled, fromTs, toTs]);

  return { reactions, loading };
};
