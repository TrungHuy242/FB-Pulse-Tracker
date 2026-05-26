/**
 * JSON Export — xuất toàn bộ imports + comments + reactions ra JSON.
 * Format: array of import objects, mỗi object có comments[] và reactions[].
 */
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  getDoc,
} from "firebase/firestore";
import { message } from "antd";
import { db } from "@/service/firebase";
import type { AccountsTableFilter } from "./AccountsTable/hooks/useAccountsTable";

interface ImportDoc {
  accountName?: string;
  commentsCount?: number;
  reactionsCount?: number;
  importedAt?: unknown;
  [key: string]: unknown;
}

interface ExportEntry {
  importId: string;
  accountName: string;
  commentsCount: number;
  reactionsCount: number;
  comments: unknown[];
  reactions: unknown[];
}

export const exportAllImportsToJSON = async (
  selectedIds?: string[],
  filter?: AccountsTableFilter
) => {
  try {
    const importsList: Array<{ id: string; data: ImportDoc }> = [];

    if (selectedIds && selectedIds.length > 0) {
      for (const id of selectedIds) {
        const snap = await getDoc(doc(db, "imports", id));
        if (snap.exists()) {
          importsList.push({ id: snap.id, data: snap.data() as ImportDoc });
        }
      }
    } else {
      const importsSnap = await getDocs(
        query(collection(db, "imports"), orderBy("importedAt", "desc"))
      );
      if (importsSnap.empty) {
        message.info("Không có imports để export");
        return;
      }
      for (const importDoc of importsSnap.docs) {
        const data = importDoc.data() as ImportDoc;
        if (filter?.name) {
          const nm = (data.accountName ?? "").toString();
          if (Array.isArray(filter.name)) {
            if (!filter.name.includes(nm)) continue;
          } else {
            if (!nm.includes(filter.name)) continue;
          }
        }
        importsList.push({ id: importDoc.id, data });
      }
    }

    if (importsList.length === 0) {
      message.info("Không có imports khớp để export");
      return;
    }

    const result: ExportEntry[] = [];

    for (const importEntry of importsList) {
      const importId = importEntry.id;
      const data = importEntry.data;
      const allComments: unknown[] = [];
      const allReactions: unknown[] = [];

      // Comments
      try {
        const ccSnap = await getDocs(
          collection(db, "imports", importId, "commentChunks")
        );
        for (const chunk of ccSnap.docs) {
          const items = (chunk.data().items ?? []) as Record<string, unknown>[];
          for (const item of items) {
            if (filter?.from && filter?.to) {
              const ct = ((item.commentTime as number) ?? 0) * 1000;
              if (ct < filter.from.getTime() || ct > filter.to.getTime()) continue;
            }
            allComments.push(item);
          }
        }
      } catch { /* skip */ }

      // Reactions
      try {
        const rcSnap = await getDocs(
          collection(db, "imports", importId, "reactionChunks")
        );
        for (const chunk of rcSnap.docs) {
          const items = (chunk.data().items ?? []) as Record<string, unknown>[];
          for (const item of items) {
            if (filter?.from && filter?.to) {
              const rt = ((item.reactionTime as number) ?? 0) * 1000;
              if (rt < filter.from.getTime() || rt > filter.to.getTime()) continue;
            }
            allReactions.push(item);
          }
        }
      } catch { /* skip */ }

      result.push({
        importId,
        accountName: (data.accountName ?? "Unknown") as string,
        commentsCount: allComments.length,
        reactionsCount: allReactions.length,
        comments: allComments,
        reactions: allReactions,
      });
    }

    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "fb-pulse-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success("Export JSON thành công");
  } catch (err) {
    message.error("Export JSON thất bại");
    console.error("Export JSON thất bại", err);
  }
};
