/**
 * CSV Export — xuất toàn bộ comments + reactions ra file CSV.
 * Encoding UTF-8 BOM để Excel Windows mở đúng tiếng Việt.
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
  [key: string]: unknown;
}

interface CommentChunkItem {
  authorName?: string;
  content?: string;
  commentTime?: number;
  title?: string;
  group?: string;
}

interface ReactionChunkItem {
  commentAuthorName?: string;
  reaction?: string;
  reactionTime?: number;
  linkPost?: string;
}

/** Escape a CSV field value — wrap in quotes, double internal quotes. */
function csvField(value: string | number | undefined | null): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number | undefined | null)[]): string {
  return fields.map(csvField).join(",");
}

/** Xuất imports ra CSV. selectedIds = undefined → xuất tất cả. */
export const exportAllImportsToCSV = async (
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

    const lines: string[] = [];

    // Header row
    lines.push(csvRow([
      "Loại",
      "Tài khoản",
      "Tên người dùng",
      "Nội dung / Cảm xúc",
      "Ngày giờ",
      "Tiêu đề / Bài đăng",
      "Nhóm",
    ]));

    for (const importEntry of importsList) {
      const importId = importEntry.id;
      const accountName = importEntry.data.accountName ?? "Unknown";

      // Comments
      try {
        const commentChunksSnap = await getDocs(
          collection(db, "imports", importId, "commentChunks")
        );
        for (const chunkDoc of commentChunksSnap.docs) {
          const items = (chunkDoc.data().items ?? []) as CommentChunkItem[];
          for (const cmt of items) {
            if (filter?.from && filter?.to) {
              const ct = (cmt.commentTime ?? 0) * 1000;
              if (ct < filter.from.getTime() || ct > filter.to.getTime()) continue;
            }
            lines.push(csvRow([
              "Comment",
              accountName,
              cmt.authorName ?? "",
              cmt.content ?? "",
              cmt.commentTime
                ? new Date(cmt.commentTime * 1000).toLocaleString("vi-VN")
                : "",
              cmt.title ?? "",
              cmt.group ?? "",
            ]));
          }
        }
      } catch {
        // skip failed chunks
      }

      // Reactions
      try {
        const reactionChunksSnap = await getDocs(
          collection(db, "imports", importId, "reactionChunks")
        );
        for (const chunkDoc of reactionChunksSnap.docs) {
          const items = (chunkDoc.data().items ?? []) as ReactionChunkItem[];
          for (const r of items) {
            if (filter?.from && filter?.to) {
              const rt = (r.reactionTime ?? 0) * 1000;
              if (rt < filter.from.getTime() || rt > filter.to.getTime()) continue;
            }
            lines.push(csvRow([
              "Reaction",
              accountName,
              r.commentAuthorName ?? "",
              r.reaction ?? "",
              r.reactionTime
                ? new Date(r.reactionTime * 1000).toLocaleString("vi-VN")
                : "",
              r.linkPost ?? "",
              "",
            ]));
          }
        }
      } catch {
        // skip failed chunks
      }
    }

    // UTF-8 BOM for Excel Windows compatibility
    const BOM = "﻿";
    const csvContent = BOM + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "accounts-comments-reactions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success("Export CSV thành công");
  } catch (err) {
    message.error("Export CSV thất bại");
    console.error("Export CSV thất bại", err);
  }
};
