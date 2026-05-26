/**
 * Utility functions cho xử lý array.
 */

/**
 * Chia array thành các chunk có kích thước cố định.
 * Dùng để chia nhỏ comments/reactions trước khi lưu vào Firestore
 * (giới hạn 1MB/document của Firestore).
 *
 * @example
 * chunkArray([1,2,3,4,5], 2) // → [[1,2], [3,4], [5]]
 * chunkArray([], 10)          // → []
 */
export const chunkArray = <T>(arr: T[], size: number): T[][] => {
  if (size <= 0) throw new Error("Chunk size phải là số dương");
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
};
