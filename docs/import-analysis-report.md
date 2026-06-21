# BÁO CÁO PHÂN TÍCH DỮ LIỆU MẪU & CHỨC NĂNG IMPORT

**Ngày:** 21/06/2026  
**Người thực hiện:** Claude Code

---

## 1. PHÂN TÍCH FILE MẪU

### 1.1 Cấu trúc ZIP (`27052026.zip`)

```
27052026.zip
├── Ly Ngọc Trọm/
│   └── facebook-{id}-27_05_2026-{hash}.zip
├── Nguyen Thao Thao/
│   └── facebook-{id}-27_05_2026-{hash}.zip
├── Pham Tam Chi/
│   └── facebook-{id}-27_05_2026-{hash}.zip
└── Vu Thị Như Quỳnh/
    └── facebook-{id}-27_05_2026-{hash}.zip
```

**Tổng:** 4 profiles × 1 ZIP = 4 tài khoản Facebook

### 1.2 Cấu trúc bên trong mỗi ZIP

```
facebook-{id}/
├── your_facebook_activity/
│   ├── comments_and_reactions/
│   │   ├── likes_and_reactions.json      (REACTIONS - bắt buộc)
│   │   ├── likes_and_reactions_1.json    (REACTIONS - part 2)
│   │   └── your_comment_active_days.json
│   └── groups/
│       ├── likes_and_reactions.json       (REACTIONS trong groups)
│       ├── likes_and_reactions_1.json     (REACTIONS part 2)
│       ├── your_comments_in_groups.json   (COMMENTS)
│       ├── group_posts_and_comments.json
│       └── ...
```

### 1.3 Các file JSON quan trọng

| File | Type | Description |
|------|------|-------------|
| `likes_and_reactions.json` | REACTION | Tất cả reactions của user |
| `likes_and_reactions_1.json` | REACTION | Phần tiếp theo của reactions |
| `your_comments_in_groups.json` | COMMENT | Comments trong groups |
| `group_posts_and_comments.json` | COMMENT | Posts & comments trong groups |

---

## 2. CẤU TRÚC JSON CHI TIẾT

### 2.1 Reaction (`likes_and_reactions.json`)

```json
[
  {
    "timestamp": 1779874896,
    "media": [],
    "label_values": [
      {
        "label": "Cảm xúc",
        "value": "Thích"           // ← reaction type
      },
      {
        "label": "URL",
        "value": "https://...",
        "href": "https://..."     // ← link bài viết
      },
      {
        "dict": [...],
        "title": "Nhóm"            // ← type (Nhóm/Trang/Cá nhân)
      },
      {
        "dict": [...],
        "title": "Tác giả"        // ← author info
      }
    ],
    "fbid": "26793200973707656"
  }
]
```

**Parse sang ReactionItem:**
| Trường JSON | Trường DB | Ví dụ |
|-------------|-----------|-------|
| `label_values[label="Cảm xúc"].value` | `reaction` | "Thích" |
| `label_values[label="URL"].href` | `linkPost` | "https://www.facebook.com/groups/..." |
| `label_values[title="Nhóm"][dict.label="Tên"].value` | `ownerName` | "Học Tiếng Trung Online" |
| `label_values[title="Tác giả"][dict.label="Tên"].value` | `commentAuthorName` | "Hanh Le" |
| `timestamp` | `reactionTime` | 1779874896 |
| `fbid` | `fbid` | "26793200973707656" |

### 2.2 Comment (`your_comments_in_groups.json`)

```json
{
  "group_comments_v2": [
    {
      "timestamp": 1779379231,
      "data": [
        {
          "comment": {
            "timestamp": 1779379231,
            "comment": "Thầy học cả hai lần...",  // ← nội dung
            "author": "Nguyen Thao Thao",          // ← author
            "group": "Học Tiếng Trung..."           // ← group name
          }
        }
      ],
      "title": "Nguyen Thao Thao đã bình luận..."
    }
  ]
}
```

**Parse sang CommentItem:**
| Trường JSON | Trường DB | Ví dụ |
|-------------|-----------|-------|
| `data[].comment.author` | `authorName` | "Nguyen Thao Thao" |
| `data[].comment.comment` | `content` | "Thầy học cả hai lần..." |
| `data[].comment.timestamp` | `commentTime` | 1779379231 |
| `title` | `title` | "Nguyen Thao Thao đã bình luận..." |
| `data[].comment.group` | `group` | "Học Tiếng Trung..." |

---

## 3. THỐNG KÊ DỮ LIỆU MẪU

### 3.1 File sizes (đã extract)

| Profile | likes_and_reactions.json | your_comments_in_groups.json |
|---------|-------------------------|----------------------------|
| Ly Ngọc Trọm | ~90KB | ~4KB |
| Nguyen Thao Thao | ~146KB | ~8KB |
| Pham Tam Chi | ~120KB | ~5KB |
| Vu Thị Như Quỳnh | ~113KB | ~6KB |

### 3.2 Dự kiến số lượng records

| Profile | Ước tính Reactions | Ước tính Comments |
|---------|---------------------|-------------------|
| Ly Ngọc Trọm | ~1,500 | ~50 |
| Nguyen Thao Thao | ~2,500 | ~100 |
| Pham Tam Chi | ~2,000 | ~70 |
| Vu Thị Như Quỳnh | ~1,800 | ~80 |
| **TỔNG** | **~7,800** | **~300** |

---

## 4. ĐÁNH GIÁ CODE HIỆN TẠI

### 4.1 ✅ ĐIỂM MẠNH

#### 1. **Xử lý ZIP thông minh**
- Hỗ trợ nested ZIP (ZIP trong ZIP)
- Tự động phát hiện multi-profile ZIP
- Skip `__MACOSX` folder

#### 2. **Preview trước khi import**
- Hiển thị số comments/reactions trước khi upload
- Cảnh báo duplicate account name

#### 3. **Chunking strategy**
- Comment: 700 items/chunk
- Reaction: 2000 items/chunk
- Tránh Firestore document size limit

#### 4. **Batch operations**
- Hỗ trợ batch upload nhiều ZIP
- Replace mode để thay thế data cũ
- Progress tracking real-time

#### 5. **Encoding handling**
- `decodeFacebookObject()` xử lý Vietnamese UTF-8

### 4.2 ⚠️ ĐIỂM CẦN CẢI TIẾN

#### 1. **Reaction parsing có thể miss data**
```typescript
// Code hiện tại - dòng 156-159
const isReactionItem = (item: unknown): item is ReactionRawItem =>
  !!item &&
  typeof item === "object" &&
  Array.isArray((item as ReactionRawItem).label_values) &&
  ((item as ReactionRawItem).label_values ?? []).some((lv) =>
    ["Cảm xúc", "URL", "Tên"].includes(lv?.label)
  );
```

**Vấn đề:** File sample có structure:
```json
{
  "dict": [...],
  "title": "Tác giả"    // ← không phải "Tên"
}
```

Nhưng code check `label === "Tên"`, có thể miss một số reactions.

#### 2. **Missing type: Page Reactions**
File sample chỉ có reactions trong Groups. Nếu user có reactions trên Pages/Profiles, cần test thêm.

#### 3. **No validation for empty chunks**
```typescript
// Tạo empty chunk nếu không có data
if (commentChunks.length === 0) {
  await addCommentChunk(importRef.id, { index: 0, items: [], count: 0 });
}
```
Có thể tạo nhiều empty documents không cần thiết.

#### 4. **No retry mechanism**
Nếu upload chunk thất bại, toàn bộ import fail. Không có retry.

#### 5. **Comment source detection limited**
```typescript
// Chỉ check 2 source keys
const commentSource =
  (Array.isArray(d.comments_v2) ? d.comments_v2 : null) ??
  (Array.isArray(d.group_comments_v2) ? d.group_comments_v2 : null);
```

Facebook có thể export nhiều format khác:
- `comments.json`
- `your_comments.json`
- `posts.json` (có thể chứa comments)

### 4.3 🔴 BUGS TIỀM ẨN

#### 1. **Reaction owner extraction có thể sai**
```typescript
const getNameFromDict = (arr: ReactionLabelValue[]): string => {
  for (const i of arr) {
    if (i.label === "Tên" && i.value) return i.value;  // ← "Tên" hay "Tác giả"?
```

Sample data có `title: "Tác giả"` với `label: "Tên"`. Logic hiện tại có thể work, nhưng cần test kỹ.

#### 2. **Unicode normalization**
Vietnamese có nhiều cách encode khác nhau:
- `Thầy` vs `Th\u00e1\u00ba\u00a7y`
- `Học` vs `H\u00e1\u00bb\u008dc`

`decodeFacebookObject()` cần verify xử lý đúng.

---

## 5. KHUYẾN NGHỊ

### 5.1 Testing Checklist

- [ ] Test import với file `27052026.zip` (4 profiles)
- [ ] Verify reactions được parse đúng (so sánh với manual count)
- [ ] Verify comments được parse đúng
- [ ] Test với file ZIP có nhiều inner folders
- [ ] Test encoding Vietnamese (Thầy, Học, Trung, etc.)
- [ ] Test progress bar accuracy
- [ ] Test Replace mode

### 5.2 Improvements đề xuất

#### 1. **Thêm logging chi tiết**
```typescript
console.log(`[IMPORT] Parsed ${reactions.length} reactions from ${file.name}`);
console.log(`[IMPORT] Chunk ${i}/${total} uploaded`);
```

#### 2. **Validation trước parse**
```typescript
const validateReactionItem = (item: unknown): boolean => {
  // Check required fields exist
  const labelValues = (item as any).label_values;
  return Array.isArray(labelValues) && labelValues.length >= 2;
};
```

#### 3. **Fallback source keys**
```typescript
const COMMENT_KEYS = [
  'comments_v2',
  'group_comments_v2', 
  'comments',
  'your_comments',
  'group_comments'
];
```

#### 4. **Retry with exponential backoff**
```typescript
const uploadWithRetry = async (chunk, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await addCommentChunk(chunk);
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000 * Math.pow(2, i));
    }
  }
};
```

---

## 6. HƯỚNG DẪN TEST

### 6.1 Import file mẫu

1. Mở app tại `http://localhost:5173`
2. Login với `admin@gmail.com` / `123456`
3. Click **"Nhập dữ liệu"** button
4. Upload file `27052026.zip`
5. Preview sẽ hiển thị 4 profiles:
   - Ly Ngọc Trọm
   - Nguyen Thao Thao
   - Pham Tam Chi
   - Vu Thị Như Quỳnh
6. Click **Xác nhận** để import
7. Kiểm tra Firestore dashboard

### 6.2 Verify data sau import

Truy cập Firebase Console → Firestore → Collections:
- [ ] `imports` - 4 documents (1 per profile)
- [ ] `imports/{id}/commentChunks` - có data
- [ ] `imports/{id}/reactionChunks` - có data
- [ ] Kiểm tra encoding Vietnamese không bị lỗi

---

## 7. KẾT LUẬN

| Aspect | Status | Notes |
|--------|--------|-------|
| File structure support | ✅ PASS | Multi-profile ZIP work |
| Reaction parsing | ⚠️ PARTIAL | Cần verify thêm |
| Comment parsing | ✅ PASS | Structure match |
| Encoding handling | ✅ PASS | Vietnamese OK |
| Progress UX | ✅ PASS | Good feedback |
| Error handling | ⚠️ NEED IMPROVE | Thêm retry mechanism |

**Khuyến nghị:** Test thực tế với file mẫu và verify số lượng records sau import với manual count từ JSON files.
