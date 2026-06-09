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
}

interface ReactionChunkItem {
  name?: string;
  reaction?: string;
  reactionTime?: number;
  linkPost?: string;
}

type ExcelCell = {
  t?: "s" | "n" | "b" | "d" | "e" | "z";
  f?: string;
  s?: {
    font?: {
      name?: string;
      sz?: number;
      bold?: boolean;
      color?: { rgb?: string };
    };
    alignment?: {
      horizontal?: string;
      vertical?: string;
    };
  };
};

type ExcelSheet = Record<string, ExcelCell | undefined> & {
  "!cols"?: Array<{ wch: number; hidden?: boolean }>;
  "!merges"?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  "!autofilter"?: { ref: string };
};

// If selectedIds is provided, export only those imports; otherwise export all.
export const exportAllImportsToExcel = async (
  selectedIds?: string[],
  filter?: AccountsTableFilter
) => {
  const XLSX = await import("xlsx");
  try {
    const importsList: Array<{ id: string; data: ImportDoc }> = [];

    if (selectedIds && selectedIds.length > 0) {
      for (const id of selectedIds) {
        const importDocRef = doc(db, "imports", id);
        const importSnap = await getDoc(importDocRef);
        if (importSnap.exists()) {
          importsList.push({ id: importSnap.id, data: importSnap.data() as ImportDoc });
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

    const workbook = XLSX.utils.book_new();

    for (const importEntry of importsList) {
      const importId = importEntry.id;
      const accountName = importEntry.data.accountName ?? "Unknown";

      const rows: (string | number)[][] = [];
      rows.push([
        "Loại",
        "Tên người dùng",
        "Nội dung/Cảm xúc",
        "Ngày",
        "Tiêu đề/Bài đăng",
        "IsComment",
        "IsReaction",
      ]);

      // Comments
      const commentChunksSnap = await getDocs(
        collection(db, "imports", importId, "commentChunks")
      );
      for (const chunkDoc of commentChunksSnap.docs) {
        const items = (chunkDoc.data().items ?? []) as CommentChunkItem[];
        items.forEach((cmt) => {
          if (filter?.from && filter?.to) {
            const ct = (cmt.commentTime ?? 0) * 1000;
            if (ct < filter.from.getTime() || ct > filter.to.getTime()) return;
          }
          rows.push([
            "Comment",
            cmt.authorName ?? "",
            cmt.content ?? "",
            cmt.commentTime
              ? new Date(cmt.commentTime * 1000).toLocaleString("vi-VN")
              : "",
            cmt.title ?? "",
            1,
            0,
          ]);
        });
      }

      // Reactions
      const reactionChunksSnap = await getDocs(
        collection(db, "imports", importId, "reactionChunks")
      );
      for (const chunkDoc of reactionChunksSnap.docs) {
        const items = (chunkDoc.data().items ?? []) as ReactionChunkItem[];
        items.forEach((r) => {
          if (filter?.from && filter?.to) {
            const rt = (r.reactionTime ?? 0) * 1000;
            if (rt < filter.from.getTime() || rt > filter.to.getTime()) return;
          }
          rows.push([
            "Reaction",
            r.name ?? "",
            r.reaction ?? "",
            r.reactionTime
              ? new Date(r.reactionTime * 1000).toLocaleString("vi-VN")
              : "",
            r.linkPost ?? "",
            0,
            1,
          ]);
        });
      }

      rows.push([]);
      const dataStartRow = 2;
      const dataEndRow = rows.length;
      const subtotalComments = `SUBTOTAL(9,F${dataStartRow}:F${dataEndRow})`;
      const subtotalReactions = `SUBTOTAL(9,G${dataStartRow}:G${dataEndRow})`;
      const concatFormula = `="Tổng: Comments: " & ${subtotalComments} & " - Reactions: " & ${subtotalReactions}`;

      rows.push([
        concatFormula,
        "",
        "",
        "",
        "",
        `=${subtotalComments}`,
        `=${subtotalReactions}`,
      ]);

      const sheet = XLSX.utils.aoa_to_sheet(rows) as ExcelSheet;

      try {
        const lastRowIndex = rows.length;
        const XLSXUtils = XLSX.utils;
        const aAddr = XLSXUtils.encode_cell({ r: lastRowIndex - 1, c: 0 });
        const fAddr = XLSXUtils.encode_cell({ r: lastRowIndex - 1, c: 5 });
        const gAddr = XLSXUtils.encode_cell({ r: lastRowIndex - 1, c: 6 });

        const concatF = `CONCATENATE("Tổng: Comments: ",${subtotalComments}," - Reactions: ",${subtotalReactions})`;
        sheet[aAddr] = { t: "s", f: concatF };

        try {
          if (sheet[aAddr]) {
            sheet[aAddr].s = {
            font: { name: "Calibri", sz: 18, bold: true, color: { rgb: "FF000000" } },
            alignment: { horizontal: "center", vertical: "center" },
            };
          }
        } catch {
          // styling unsupported
        }

        sheet[fAddr] = { t: "n", f: subtotalComments };
        sheet[gAddr] = { t: "n", f: subtotalReactions };

        try {
          if (sheet[fAddr]) {
            sheet[fAddr].s = { font: { bold: true } };
          }
          if (sheet[gAddr]) {
            sheet[gAddr].s = { font: { bold: true } };
          }
        } catch {
          // ignore
        }
      } catch (err) {
        console.warn("Could not set formula cells for totals", err);
      }

      try {
        const lastRowIndex = rows.length;
        const merge = { s: { r: lastRowIndex - 1, c: 0 }, e: { r: lastRowIndex - 1, c: 4 } };
        sheet["!merges"] = sheet["!merges"] ?? [];
        sheet["!merges"].push(merge);
      } catch (err) {
        console.warn("Could not apply merge for totals row", err);
      }

      sheet["!cols"] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 60 },
        { wch: 25 },
        { wch: 50 },
        { wch: 8, hidden: true },
        { wch: 8, hidden: true },
      ];

      try {
        const lastRow = rows.length;
        sheet["!autofilter"] = { ref: `A1:G${lastRow}` };
      } catch (err) {
        console.warn("Could not add autofilter to sheet", err);
      }

      const sanitize = (s: string) =>
        s.replace(/[:\\/?*[\]|]/g, "").trim() || "Sheet";

      const maxLen = 31;
      const baseName = sanitize(accountName.toString()).substring(0, maxLen);

      const existing = new Set((workbook.SheetNames ?? []).map((n) => n.toString()));
      let finalName = baseName;
      let counter = 1;
      while (existing.has(finalName)) {
        const suffix = `_${++counter}`;
        const allowedBaseLen = Math.max(1, maxLen - suffix.length);
        finalName = baseName.substring(0, allowedBaseLen) + suffix;
      }
      XLSX.utils.book_append_sheet(workbook, sheet, finalName);
    }

    XLSX.writeFile(workbook, "accounts-comments-reactions.xlsx", { cellStyles: true });
    message.success("Export thành công");
  } catch (err) {
    message.error("Export thất bại");
    console.error("Export thất bại", err);
  }
};
