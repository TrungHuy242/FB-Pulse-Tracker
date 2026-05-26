/**
 * useRealtimeImports — Lắng nghe thay đổi imports qua onSnapshot.
 *
 * Không thay thế cursor-pagination của useAccountsTable.
 * Chỉ phát hiện khi có import MỚI được tạo (so sánh với lần load đầu),
 * rồi phát ra `hasNewData = true` để UI hiện badge "Tải lại".
 *
 * Khi user click "Tải lại" → gọi `onRefresh()` + reset flag.
 */
import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/service/firebase";

interface UseRealtimeImportsReturn {
  /** true khi có import mới xuất hiện sau lần mount đầu tiên */
  hasNewData: boolean;
  /** Gọi để reset flag (sau khi user refresh table) */
  clearNewData: () => void;
}

export const useRealtimeImports = (
  enabled: boolean,
  onNewData?: () => void
): UseRealtimeImportsReturn => {
  const [hasNewData, setHasNewData] = useState(false);
  // ID set của imports đã biết lúc mount lần đầu
  const knownIdsRef = useRef<Set<string> | null>(null);
  // Tránh fire ngay khi subscribe lần đầu
  const initializedRef = useRef(false);
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Lắng nghe 20 imports mới nhất (đủ để phát hiện thêm mới)
    const q = query(
      collection(db, "imports"),
      orderBy("importedAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      const currentIds = new Set(snap.docs.map((d) => d.id));

      if (!initializedRef.current) {
        // Lần đầu: ghi nhớ IDs hiện tại
        knownIdsRef.current = currentIds;
        initializedRef.current = true;
        return;
      }

      // Kiểm tra có ID nào mới không
      const known = knownIdsRef.current;
      if (!known) return;

      let foundNew = false;
      for (const id of currentIds) {
        if (!known.has(id)) {
          foundNew = true;
          break;
        }
      }

      if (foundNew) {
        // Cập nhật known set
        knownIdsRef.current = currentIds;
        setHasNewData(true);
        onNewData?.();
      }
    }, (err) => {
      console.warn("useRealtimeImports snapshot error:", err);
    });

    unsubRef.current = unsub;
    return () => {
      unsub();
      initializedRef.current = false;
      knownIdsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const clearNewData = () => setHasNewData(false);

  return { hasNewData, clearNewData };
};
