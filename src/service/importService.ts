/**
 * Import Service — tất cả Firestore operations liên quan đến imports.
 *
 * Các component KHÔNG gọi Firestore trực tiếp mà phải dùng các hàm trong file này.
 * Giúp dễ test, dễ thay đổi data layer mà không ảnh hưởng đến UI.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/service/firebase";
import { withCache, clearCacheByPrefix } from "@/service/queryCache";
import type { ImportRecord } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateImportPayload {
  totalFiles: number;
  status: "processing" | "completed";
}

export interface FinalizeImportPayload {
  accountName: string;
  commentsCount: number;
  reactionsCount: number;
  status: "completed";
}

export interface CommentChunkPayload {
  index: number;
  items: unknown[];
  count: number;
}

export interface ReactionChunkPayload {
  index: number;
  items: unknown[];
  count: number;
}

// ── Read operations ──────────────────────────────────────────────────────────

/**
 * Lấy toàn bộ danh sách imports, sắp xếp mới nhất trước.
 * Dùng cho delete-all và các tác vụ cần toàn bộ data.
 */
export const getAllImports = async (): Promise<ImportRecord[]> => {
  const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as ImportRecord[];
};

/**
 * Lấy danh sách tên tài khoản (distinct) từ imports.
 * Dùng cho dropdown filter trong Header.
 * Cached 30s — tránh re-fetch khi nhiều component mount cùng lúc.
 */
export const getAccountNames = async (): Promise<string[]> => {
  return withCache("imports:accountNames", async () => {
    const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => (d.data().accountName ?? "Unknown").toString())
      .filter(Boolean);
  }, 30_000);
};

// ── Write operations ─────────────────────────────────────────────────────────

/**
 * Tạo mới một import document với trạng thái "processing".
 * Trả về document reference để dùng cho các bước tiếp theo.
 */
export const createImport = async (payload: CreateImportPayload) => {
  return addDoc(collection(db, "imports"), {
    ...payload,
    importedAt: serverTimestamp(),
  });
};

/**
 * Cập nhật import sau khi đã xử lý xong (set accountName, counts, status).
 * Invalidate cache accountNames để dropdown cập nhật tên mới.
 */
export const finalizeImport = async (
  importId: string,
  payload: FinalizeImportPayload
): Promise<void> => {
  await updateDoc(doc(db, "imports", importId), payload as unknown as Record<string, unknown>);
  // Xóa cache để dropdown filter cập nhật tên tài khoản mới
  clearCacheByPrefix("imports:");
};

/**
 * Lưu một comment chunk vào sub-collection commentChunks.
 */
export const addCommentChunk = async (
  importId: string,
  payload: CommentChunkPayload
) => {
  return addDoc(
    collection(db, "imports", importId, "commentChunks"),
    payload
  );
};

/**
 * Lưu một reaction chunk vào sub-collection reactionChunks.
 */
export const addReactionChunk = async (
  importId: string,
  payload: ReactionChunkPayload
) => {
  return addDoc(
    collection(db, "imports", importId, "reactionChunks"),
    payload
  );
};

// ── Delete operations ─────────────────────────────────────────────────────────

/**
 * Xóa một import và toàn bộ sub-collections (cascade delete).
 * Thứ tự: commentChunks → reactionChunks → parent document.
 * Invalidate toàn bộ cache imports sau khi xóa.
 */
export const deleteImport = async (importId: string): Promise<void> => {
  // Xóa comment chunks trước
  try {
    const ccSnap = await getDocs(
      collection(db, "imports", importId, "commentChunks")
    );
    for (const c of ccSnap.docs) {
      await deleteDoc(doc(db, "imports", importId, "commentChunks", c.id));
    }
  } catch {
    // Bỏ qua lỗi sub-collection
  }

  // Xóa reaction chunks
  try {
    const rcSnap = await getDocs(
      collection(db, "imports", importId, "reactionChunks")
    );
    for (const r of rcSnap.docs) {
      await deleteDoc(doc(db, "imports", importId, "reactionChunks", r.id));
    }
  } catch {
    // Bỏ qua lỗi sub-collection
  }

  // Xóa parent document
  await deleteDoc(doc(db, "imports", importId));
  // Invalidate cache
  clearCacheByPrefix("imports:");
};

/**
 * Xóa toàn bộ imports (cascade).
 * Chỉ admin mới được gọi hàm này (enforce ở UI layer và Firestore Rules).
 */
export const deleteAllImports = async (): Promise<void> => {
  const imports = await getAllImports();
  for (const imp of imports) {
    await deleteImport(imp.id);
  }
};

/**
 * Tìm tất cả imports theo tên tài khoản (so sánh sau khi trim).
 * Dùng cho tính năng re-import detection ở ImportFolder.
 * Không dùng Firestore where() — client-side filter từ getAllImports()
 * để tránh tạo composite index.
 */
export const findImportsByAccountName = async (
  accountName: string
): Promise<ImportRecord[]> => {
  const normalized = accountName.trim();
  if (!normalized) return [];
  const all = await getAllImports();
  return all.filter((imp) => imp.accountName?.trim() === normalized);
};

/**
 * Xóa tất cả imports của một tài khoản (cascade).
 * Dùng cho replace mode — gọi trước khi upload lại dữ liệu mới.
 */
export const deleteImportsByAccountName = async (
  accountName: string
): Promise<void> => {
  const records = await findImportsByAccountName(accountName);
  for (const r of records) {
    await deleteImport(r.id);
  }
};
