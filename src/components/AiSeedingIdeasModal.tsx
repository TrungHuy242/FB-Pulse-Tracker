/**
 * AiSeedingIdeasModal — Modal phụ hiển thị gợi ý nội dung bình luận từ AI.
 *
 * Luồng: Người dùng nhập chủ đề → nhấn "Tạo gợi ý" → AI trả về 5-8 idea cards
 *   → [Dùng ngay] điền vào ô commentText
 *   → [+ Thư viện] lưu vào seedingComments
 *
 * Props:
 *   open          — mở/đóng modal
 *   onClose       — callback đóng modal
 *   topic         — giá trị ô nhập chủ đề
 *   onTopicChange — cập nhật topic state bên ngoài
 *   loading       — đang gọi AI
 *   ideas         — danh sách idea từ AI
 *   savedIds      — set index đã lưu thư viện (để disable nút)
 *   onGenerate    — gọi AI
 *   onUse         — dùng idea này (điền commentText)
 *   onSave        — lưu idea vào thư viện
 *   campaignName  — tên campaign hiện tại (hiển thị context)
 */
import { Modal, Input, Button, Tag, Spin, Empty, Typography } from "antd";
import { BulbOutlined, CheckOutlined, BookOutlined } from "@ant-design/icons";
import { theme as antdTheme } from "antd";
import type { SeedingIdea, ContentFormat } from "@/service/aiExtendedService";

const { Text, Paragraph } = Typography;

// ── Format badge colour ────────────────────────────────────────────────────────

const FORMAT_COLOR: Record<ContentFormat, string> = {
  post:  "#3ecf8e",
  video: "#7c3aed",
  story: "#db2777",
  reel:  "#ea580c",
};

const FORMAT_LABEL: Record<ContentFormat, string> = {
  post:  "Bài viết",
  video: "Video",
  story: "Story",
  reel:  "Reel",
};

// ── IdeaCard ──────────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  index,
  saved,
  onUse,
  onSave,
}: {
  idea: SeedingIdea;
  index: number;
  saved: boolean;
  onUse: (idea: SeedingIdea) => void;
  onSave: (idea: SeedingIdea, index: number) => void;
}) {
  const { token } = antdTheme.useToken();

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderLeft: `3px solid ${FORMAT_COLOR[idea.format] ?? "#3ecf8e"}`,
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 10,
        background: token.colorBgContainer,
        transition: "box-shadow 0.15s",
      }}
    >
      {/* Header: title + format tag */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13, lineHeight: 1.4, flex: 1 }}>
          {idea.title}
        </Text>
        <Tag
          color={FORMAT_COLOR[idea.format]}
          style={{ fontSize: 11, borderRadius: 4, margin: 0, flexShrink: 0 }}
        >
          {FORMAT_LABEL[idea.format] ?? idea.format}
        </Tag>
      </div>

      {/* Description */}
      <Paragraph
        style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6, lineHeight: 1.5 }}
        ellipsis={{ rows: 2, expandable: true, symbol: "xem thêm" }}
      >
        {idea.description}
      </Paragraph>

      {/* Angle */}
      {idea.angle && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
          <BulbOutlined style={{ fontSize: 11, color: "#f59e0b" }} />
          <Text style={{ fontSize: 11, color: token.colorTextSecondary, fontStyle: "italic" }}>
            {idea.angle}
          </Text>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          size="small"
          type="primary"
          onClick={() => onUse(idea)}
          style={{ background: "#3ecf8e", borderColor: "#3ecf8e", fontSize: 12, fontWeight: 600 }}
        >
          Dùng ngay
        </Button>
        <Button
          size="small"
          icon={saved ? <CheckOutlined /> : <BookOutlined />}
          onClick={() => !saved && onSave(idea, index)}
          disabled={saved}
          style={{ fontSize: 12, color: saved ? "#3ecf8e" : undefined }}
        >
          {saved ? "Đã lưu" : "+ Thư viện"}
        </Button>
      </div>
    </div>
  );
}

// ── AiSeedingIdeasModal ────────────────────────────────────────────────────────

interface AiSeedingIdeasModalProps {
  open: boolean;
  onClose: () => void;
  topic: string;
  onTopicChange: (v: string) => void;
  loading: boolean;
  ideas: SeedingIdea[];
  savedIds: Set<string>;
  onGenerate: () => void;
  onUse: (idea: SeedingIdea) => void;
  onSave: (idea: SeedingIdea, index: number) => void;
  campaignName?: string;
}

export function AiSeedingIdeasModal({
  open, onClose,
  topic, onTopicChange,
  loading, ideas, savedIds,
  onGenerate, onUse, onSave,
  campaignName,
}: AiSeedingIdeasModalProps) {
  const { token } = antdTheme.useToken();

  return (
    <Modal
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <span>AI Gợi ý Nội dung Bình luận</span>
          {campaignName && (
            <Tag color="geekblue" style={{ fontWeight: 400, fontSize: 11 }}>
              {campaignName}
            </Tag>
          )}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={600}
      styles={{ body: { paddingTop: 8 } }}
    >
      {/* Input chủ đề */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>
          Mô tả sản phẩm / chủ đề để AI tạo nội dung phù hợp:
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            placeholder='VD: "bán son môi, target nữ 18-35, giá 150k, khuyến mãi mua 2 tặng 1"'
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            onPressEnter={onGenerate}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            onClick={onGenerate}
            loading={loading}
            style={{ background: "#3ecf8e", borderColor: "#3ecf8e", fontWeight: 600 }}
          >
            Tạo gợi ý
          </Button>
        </div>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 4 }}>
          Để trống để AI tự sáng tạo, hoặc nhập URL sẽ được dùng làm context.
        </div>
      </div>

      {/* Kết quả */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: 12 }}>
          <Spin size="large" />
          <Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>
            AI đang tạo gợi ý nội dung...
          </Text>
        </div>
      ) : ideas.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
              Nhập mô tả chủ đề và nhấn <strong>Tạo gợi ý</strong> để bắt đầu
            </span>
          }
          style={{ padding: "32px 0" }}
        />
      ) : (
        <div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 10 }}>
            AI đề xuất <strong>{ideas.length}</strong> ý tưởng nội dung:
          </div>
          <div style={{ maxHeight: 440, overflowY: "auto", paddingRight: 4 }}>
            {ideas.map((idea, i) => (
              <IdeaCard
                key={i}
                idea={idea}
                index={i}
                saved={savedIds.has(String(i))}
                onUse={onUse}
                onSave={onSave}
              />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
