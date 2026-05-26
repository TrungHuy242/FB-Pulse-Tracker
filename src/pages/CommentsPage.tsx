/**
 * CommentsPage — Trang phân tích bình luận sâu.
 * TODO (Ngày 2): Word Cloud, full-text search, peak hours, filter by author/group.
 */
import { AppLayout } from "@/layouts/AppLayout";
import { Empty } from "antd";
import { CommentOutlined } from "@ant-design/icons";

export default function CommentsPage() {
  return (
    <AppLayout title="Bình luận">
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        gap: 12,
      }}>
        <CommentOutlined style={{ fontSize: 48, color: "#dfdfdf" }} />
        <Empty
          description={
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 600, color: "#171717", marginBottom: 4 }}>
                Đang phát triển
              </div>
              <div style={{ color: "#8a8a8a", fontSize: 13 }}>
                Tính năng phân tích bình luận sâu sẽ sớm ra mắt:<br />
                Word Cloud · Tìm kiếm toàn văn · Peak Hours · Top tác giả
              </div>
            </div>
          }
        />
      </div>
    </AppLayout>
  );
}
