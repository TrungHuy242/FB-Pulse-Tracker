/**
 * Integration tests cho import flow.
 * Test logic parse ZIP data → extract comments/reactions → chunk → save Firestore.
 */
import { describe, it, expect } from "vitest";
import { chunkArray } from "@/utils/array";
import { decodeFacebookText, decodeFacebookObject } from "@/utils/encoding";

// ── Test data types (mirror ImportFolder.tsx interfaces) ─────────────────────
interface CommentRawItem {
  comment?: {
    author?: string;
    comment?: string;
    timestamp?: number;
    group?: string;
  };
}

interface CommentEventItem {
  data?: CommentRawItem[];
  title?: string;
  author?: string;
  comment?: string;
  timestamp?: number;
  group?: string;
}

interface ReactionLabelValue {
  label: string;
  value?: string;
  href?: string;
  dict?: ReactionLabelValue[];
}

interface ReactionRawItem {
  label_values?: ReactionLabelValue[];
  timestamp?: number;
  fbid?: string;
}

// ── Helpers (mirror từ ImportFolder.tsx) ─────────────────────────────────────
const COMMENT_CHUNK_SIZE = 700;
const REACTION_CHUNK_SIZE = 2000;

function buildCommentItems(source: CommentEventItem[]) {
  return source.flatMap((item) => {
    if (Array.isArray(item.data)) {
      return item.data.map((cmt: CommentRawItem) => ({
        authorName: cmt.comment?.author ?? "",
        content: cmt.comment?.comment ?? "",
        commentTime: cmt.comment?.timestamp ?? 0,
        title: (item.title ?? "").replace(/\.+$/, ""),
        group: cmt.comment?.group ?? "",
      }));
    }
    return [
      {
        authorName: item.author ?? "",
        content: item.comment ?? "",
        commentTime: item.timestamp ?? 0,
        title: (item.title ?? "").replace(/\.+$/, ""),
        group: item.group ?? "",
      },
    ];
  });
}

const isReactionItem = (item: unknown): item is ReactionRawItem =>
  !!item &&
  typeof item === "object" &&
  Array.isArray((item as ReactionRawItem).label_values) &&
  ((item as ReactionRawItem).label_values ?? []).some((lv) =>
    ["Cảm xúc", "URL", "Tên"].includes(lv?.label)
  );

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Import flow — comment parsing", () => {
  it("parse đúng comments_v2 format", () => {
    const source: CommentEventItem[] = [
      {
        title: "Đã bình luận về bài viết.",
        data: [
          {
            comment: {
              author: "Nguyễn A",
              comment: "Hay quá!",
              timestamp: 1716796800,
              group: "Nhóm 1",
            },
          },
        ],
      },
    ];

    const comments = buildCommentItems(source);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toEqual({
      authorName: "Nguyễn A",
      content: "Hay quá!",
      commentTime: 1716796800,
      title: "Đã bình luận về bài viết",
      group: "Nhóm 1",
    });
  });

  it("xóa dấu chấm ở cuối title", () => {
    const source: CommentEventItem[] = [
      {
        title: "Bài viết hay lắm...",
        author: "User B",
        comment: "Cảm ơn",
        timestamp: 1716796800,
        group: "",
      },
    ];
    const comments = buildCommentItems(source);
    expect(comments[0].title).toBe("Bài viết hay lắm");
  });

  it("fallback fields khi thiếu data", () => {
    const source: CommentEventItem[] = [{}];
    const comments = buildCommentItems(source);
    expect(comments[0]).toEqual({
      authorName: "",
      content: "",
      commentTime: 0,
      title: "",
      group: "",
    });
  });

  it("xử lý nhiều comment trong một event", () => {
    const source: CommentEventItem[] = [
      {
        title: "Post 1",
        data: [
          { comment: { author: "A", comment: "c1", timestamp: 1000 } },
          { comment: { author: "B", comment: "c2", timestamp: 2000 } },
          { comment: { author: "C", comment: "c3", timestamp: 3000 } },
        ],
      },
    ];
    const comments = buildCommentItems(source);
    expect(comments).toHaveLength(3);
  });
});

describe("Import flow — reaction parsing", () => {
  const validReaction: ReactionRawItem = {
    label_values: [
      { label: "Cảm xúc", value: "Like" },
      { label: "URL", href: "https://fb.com/post/123" },
      { label: "Tên", value: "Nguyễn A" },
    ],
    timestamp: 1716796800,
    fbid: "123456",
  };

  it("nhận diện đúng reaction item hợp lệ", () => {
    expect(isReactionItem(validReaction)).toBe(true);
  });

  it("từ chối item không có label_values", () => {
    expect(isReactionItem({ timestamp: 1716796800 })).toBe(false);
    expect(isReactionItem(null)).toBe(false);
    expect(isReactionItem("string")).toBe(false);
  });

  it("từ chối item có label_values sai format", () => {
    const invalid = { label_values: [{ label: "Other" }] };
    expect(isReactionItem(invalid)).toBe(false);
  });
});

describe("Import flow — chunking strategy", () => {
  it("chia comments thành chunks đúng COMMENT_CHUNK_SIZE", () => {
    const comments = Array.from({ length: 1050 }, (_, i) => ({
      authorName: `user${i}`,
      content: `comment`,
      commentTime: i,
      title: "t",
      group: "g",
    }));
    const chunks = chunkArray(comments, COMMENT_CHUNK_SIZE);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(700);
    expect(chunks[1]).toHaveLength(350);
  });

  it("chia reactions thành chunks đúng REACTION_CHUNK_SIZE", () => {
    const reactions = Array.from({ length: 4500 }, (_, i) => ({
      reaction: "Like",
      linkPost: `https://fb.com/post/${i}`,
      commentAuthorName: "A",
      ownerName: "B",
      reactionTime: i,
      fbid: String(i),
    }));
    const chunks = chunkArray(reactions, REACTION_CHUNK_SIZE);
    expect(chunks).toHaveLength(3);
    expect(chunks[2]).toHaveLength(500);
  });
});

describe("Import flow — encoding integration", () => {
  it("decode và parse comment data từ Facebook encoding", () => {
    // Simulate Facebook-encoded data
    const rawContent = "Bình luận tiếng Việt 🇻🇳";
    const encoded = Array.from(
      new TextEncoder().encode(rawContent)
    )
      .map((b) => String.fromCharCode(b))
      .join("");

    const rawData = {
      comments_v2: [
        {
          title: "Post title",
          data: [
            {
              comment: {
                author: "User",
                comment: encoded,
                timestamp: 1716796800,
              },
            },
          ],
        },
      ],
    };

    // Decode toàn bộ object như ImportFolder làm
    const decoded = decodeFacebookObject(rawData) as {
      comments_v2: CommentEventItem[];
    };

    const comments = buildCommentItems(decoded.comments_v2);
    expect(comments[0].content).toBe("Bình luận tiếng Việt 🇻🇳");
  });

  it("decode tên tác giả tiếng Việt", () => {
    const name = "Trần Thị Xuân";
    const encoded = Array.from(new TextEncoder().encode(name))
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(decodeFacebookText(encoded)).toBe(name);
  });
});
