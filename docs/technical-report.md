# BÁO CÁO KỸ THUẬT PROJECT FB PULSE TRACKER

---

## 1. TỔNG QUAN DỰ ÁN

### Tên Project
**FB Pulse Tracker** (json-tool-main)

### Mô tả
Hệ thống quản lý và phân tích dữ liệu Facebook cho cộng đồng học tiếng Trung, bao gồm:
- Import dữ liệu bình luận/reactions từ Facebook
- Dashboard thống kê và biểu đồ
- Phân tích cảm xúc bình luận
- Seeding Campaign Manager với AI

### Công nghệ sử dụng (từ package.json)

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|-----------|
| react | ^19.2.6 | UI Framework |
| react-dom | ^19.2.6 | React DOM |
| react-router-dom | ^7.11.0 | Routing |
| typescript | ~5.9.3 | Type safety |
| firebase | ^12.7.0 | Backend (Auth + Firestore) |
| antd | ^6.1.3 | UI Component Library |
| @ant-design/icons | ^6.1.0 | Icons |
| echarts | ^6.0.0 | Charts |
| echarts-for-react | ^3.0.5 | ECharts React wrapper |
| xlsx | ^0.18.5 | Export Excel |
| jszip | ^3.10.1 | ZIP file parsing |
| lodash | ^4.17.21 | Utility functions |
| dayjs | ^1.11.13 | Date manipulation |
| @google/generative-ai | ^0.24.1 | Gemini AI API |
| vite | ^7.2.4 | Build tool |
| sass | ^1.97.1 | SCSS styling |

### Cấu trúc thư mục

```
src/
├── components/
│   ├── AccountsTable/
│   │   └── hooks/
│   │       ├── useAccountsTable.tsx
│   │       ├── useImportComments.tsx
│   │       └── useImportReactions.tsx
│   ├── charts/
│   │   ├── TimelineChart.tsx
│   │   ├── ReactionPieChart.tsx
│   │   └── SentimentChart.tsx
│   ├── AccountsTable.tsx
│   ├── AiSummaryPanel.tsx
│   ├── AiCampaignReportModal.tsx
│   ├── CommentDetails.tsx
│   ├── DatePresets.tsx
│   ├── EngagementChart.tsx
│   ├── ErrorBoundary.tsx
│   ├── ImportFolder.tsx
│   ├── LoadingOverlay.tsx
│   ├── PrintReportButton.tsx
│   ├── ReactionDetails.tsx
│   ├── SafeECharts.tsx
│   ├── SeedingDashboard.tsx
│   ├── StatsCards.tsx
│   ├── SentimentEfficiency.tsx
│   ├── TopProfiles.tsx
│   └── WelcomeEmptyState.tsx
├── contexts/
│   ├── AuthContext.tsx
│   ├── ImportDataContext.tsx
│   ├── LoadingContext.tsx
│   └── ThemeContext.tsx
├── hooks/
│   ├── useAllComments.tsx
│   ├── useAllEngagement.tsx
│   ├── useRealtimeImports.tsx
│   └── useStats.tsx
├── layouts/
│   └── AppLayout.tsx
├── pages/
│   ├── AdminPage.tsx
│   ├── AnalyticsPage.tsx
│   ├── CommentsPage.tsx
│   ├── HomePage.tsx
│   ├── ImportsPage.tsx
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── SeedingPage.tsx
│   └── SettingsPage.tsx
├── services/
│   ├── accountService.ts
│   ├── aiSeedingService.ts
│   ├── aiSentimentService.ts
│   ├── aiSummaryService.ts
│   ├── authService.ts
│   ├── firebase.ts
│   ├── importService.ts
│   └── seedingService.ts
├── styles/
│   ├── admin.scss
│   ├── header.scss
│   └── layout.scss
├── types/
│   ├── guards.ts
│   ├── gpm.ts
│   ├── index.ts
│   └── seeding.ts
├── utils/
│   ├── array.ts
│   ├── commentExport.ts
│   ├── encoding.ts
│   ├── geminiClient.ts
│   ├── importUtils.ts
│   ├── notification.ts
│   └── sentiment.ts
├── App.tsx
└── main.tsx
```

---

## 2. XÁC THỰC VÀ PHÂN QUYỀN

### 2.1 Hệ thống đăng nhập

**Phương thức**: Email/Password qua Firebase Authentication

**File**: `src/contexts/AuthContext.tsx` (dòng 108-127)

```typescript
// Login flow
await signInWithEmailAndPassword(auth, email, pass);
```

**Đặc điểm**:
- Chỉ sử dụng Email/Password (không có Google Auth)
- Closed membership model - không có self-registration
- User phải có trong whitelist `allowedAccounts` mới được đăng nhập

### 2.2 Cơ chế kiểm tra quyền truy cập

**File**: `src/service/authService.ts`

```typescript
export const checkAllowedAccount = async (uid: string, email: string) => {
  const docRef = doc(db, "allowedAccounts", uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new AccountNotAllowedError(email);
  }
  const data = snap.data() as { role?: unknown };
  const role = data.role === 1 ? 1 : 0;
  return { id: snap.id, role };
};
```

- Document ID trong `allowedAccounts` phải trùng với Firebase Auth UID
- Nếu UID không tồn tại trong whitelist → `AccountNotAllowedError` → force logout

### 2.3 Vai trò (Roles)

| Role ID | Tên | Quyền hạn |
|---------|-----|------------|
| 1 | Admin | Toàn quyền CRUD, quản lý users, xóa dữ liệu |
| 0 | Viewer | Chỉ đọc dữ liệu, xuất báo cáo, sử dụng seeding tools |

### 2.4 Firestore Security Rules

**File**: `firestore.rules`

```javascript
function isAuthenticated() {
  return request.auth != null;
}

function isAllowedUser() {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/allowedAccounts/$(request.auth.uid));
}

function isAdmin() {
  return isAllowedUser() &&
    get(/databases/$(database)/documents/allowedAccounts/$(request.auth.uid)).data.role == 1;
}
```

**Quyền theo collection**:
- `allowedAccounts`: Read (self + admin), Write (admin only)
- `imports`: Read (allowed), Write (admin only)
- Seeding collections: Read (allowed), Write (admin only)

---

## 3. CẤU TRÚC DỮ LIỆU FIREBASE FIRESTORE

### 3.1 Collections Overview

| Collection | Type | Mục đích |
|------------|------|-----------|
| `allowedAccounts` | Root | Whitelist tài khoản |
| `imports` | Root | Dữ liệu Facebook import |
| `imports/{id}/commentChunks` | Sub | Bình luận (chunk 700 items) |
| `imports/{id}/reactionChunks` | Sub | Reactions (chunk 2000 items) |
| `seedingProfiles` | Root | Facebook profiles |
| `seedingCampaigns` | Root | Chiến dịch seeding |
| `seedingTasks` | Root | Tasks cho campaign |
| `seedingComments` | Root | Comments seeding |

### 3.2 Chi tiết từng Collection

#### allowedAccounts

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | string | ✓ | Email người dùng |
| `displayName` | string | ✓ | Tên hiển thị |
| `role` | number | ✓ | `0` = viewer, `1` = admin |

#### imports

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `accountName` | string | ✓ | Tên tài khoản Facebook |
| `commentsCount` | number | ✓ | Số bình luận |
| `reactionsCount` | number | ✓ | Số reactions |
| `totalFiles` | number | ✓ | Tổng số files |
| `status` | string | ✓ | `"processing"` \| `"completed"` |
| `importedAt` | timestamp | ✓ | Thời gian import |

#### imports/{id}/commentChunks

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `index` | number | ✓ | Thứ tự chunk |
| `items` | array | ✓ | Array of CommentItem (max 700) |
| `count` | number | ✓ | Số items |

**CommentItem structure**:
| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `authorName` | string | ✓ | Tên tác giả |
| `content` | string | ✓ | Nội dung bình luận |
| `commentTime` | number | ✓ | Unix timestamp |
| `title` | string | ✓ | Tiêu đề bài viết |
| `postUrl` | string | | URL bài viết |
| `group` | string | ✓ | Nhóm Facebook |
| `intent` | string | | Intent đã phân tích |
| `intentConfidence` | string | | `"high"` \| `"medium"` \| `"low"` |

#### imports/{id}/reactionChunks

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `index` | number | ✓ | Thứ tự chunk |
| `items` | array | ✓ | Array of ReactionItem (max 2000) |
| `count` | number | ✓ | Số items |

**ReactionItem structure**:
| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reaction` | string | ✓ | Loại reaction |
| `linkPost` | string | ✓ | URL bài viết |
| `commentAuthorName` | string | ✓ | Tên người bình luận |
| `ownerName` | string | ✓ | Tên chủ bài viết |
| `reactionTime` | number | ✓ | Unix timestamp |
| `fbid` | string | ✓ | Facebook ID |
| `accountName` | string | | Tên tài khoản |

#### seedingProfiles

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `profileId` | string | ✓ | ID profile |
| `profileName` | string | ✓ | Tên profile |
| `status` | string | ✓ | `"active"` \| `"inactive"` \| `"banned"` |

#### seedingCampaigns

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | string | ✓ | Tên chiến dịch |
| `status` | string | ✓ | `"draft"` \| `"active"` \| `"paused"` \| `"completed"` \| `"scheduled"` |
| `scheduledAt` | timestamp | * | Thời gian lên lịch (nếu status=scheduled) |

#### seedingTasks

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `campaignId` | string | ✓ | ID chiến dịch |
| `profileId` | string | ✓ | ID profile |
| `action` | string | ✓ | `"like"` \| `"comment"` \| `"share"` |
| `targetUrl` | string | ✓ | URL bài viết target |

#### seedingComments

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `text` | string | ✓ | Nội dung comment |
| `tags` | array | ✓ | Tags cho comment |

---

## 4. CÁC TRANG/ROUTES CỦA HỆ THỐNG

### 4.1 Routes Definition

**File**: `src/App.tsx` (dòng 144-171)

| Route | Page | Access | File |
|-------|------|--------|------|
| `/login` | LoginPage | Public | `src/pages/LoginPage.tsx` |
| `/` | RootRoute → LandingPage/HomePage | Public/Auth | `src/pages/LandingPage.tsx`, `src/pages/HomePage.tsx` |
| `/imports` | ImportsPage | Auth | `src/pages/ImportsPage.tsx` |
| `/analytics` | AnalyticsPage | Auth | `src/pages/AnalyticsPage.tsx` |
| `/comments` | CommentsPage | Auth | `src/pages/CommentsPage.tsx` |
| `/settings` | SettingsPage | Auth | `src/pages/SettingsPage.tsx` |
| `/admin` | AdminPage | Auth + Admin | `src/pages/AdminPage.tsx` |
| `/seeding` | SeedingPage | Auth | `src/pages/SeedingPage.tsx` |

### 4.2 Chi tiết từng Trang

#### LoginPage (`/login`)
- **File**: `src/pages/LoginPage.tsx`
- **Chức năng**: Đăng nhập với email/password
- **Components con**: Form login, error display

#### LandingPage (`/`)
- **File**: `src/pages/LandingPage.tsx`
- **Chức năng**: Trang giới thiệu sản phẩm cho user chưa đăng nhập
- **Components con**: Hero, feature cards, login CTA

#### HomePage (`/`)
- **File**: `src/pages/HomePage.tsx`
- **Chức năng**: Dashboard chính với stats, biểu đồ, bảng imports
- **Components con**: `StatsCards`, `EngagementChart`, `AccountsTable`, `TopProfiles`, `WelcomeEmptyState`, `ImportFolder`, `DatePresets`

#### ImportsPage (`/imports`)
- **File**: `src/pages/ImportsPage.tsx`
- **Chức năng**: Quản lý imports, lọc, xuất Excel, xóa
- **Components con**: `AccountsTable`, `ImportZip`, `PrintReportButton`

#### AnalyticsPage (`/analytics`)
- **File**: `src/pages/AnalyticsPage.tsx`
- **Chức năng**: Biểu đồ timeline, lọc theo thời gian/tài khoản
- **Components con**: `TimelineChart`, `DatePresets`

#### CommentsPage (`/comments`)
- **File**: `src/pages/CommentsPage.tsx`
- **Chức năng**: Tìm kiếm, lọc, xuất bình luận (CSV/JSON/Excel)
- **Components con**: Table, filters, export dropdown

#### SettingsPage (`/settings`)
- **File**: `src/pages/SettingsPage.tsx`
- **Chức năng**: Đổi theme (light/dark), xem profile, đăng xuất

#### AdminPage (`/admin`)
- **File**: `src/pages/AdminPage.tsx`
- **Chức năng**: Quản lý whitelist, CRUD users, xóa dữ liệu
- **Components con**: Table, modal forms, stats cards

#### SeedingPage (`/seeding`)
- **File**: `src/pages/SeedingPage.tsx`
- **Chức năng**: Dashboard seeding, tạo campaign, redirect tool
- **Components con**: `SeedingDashboard`, tabs (Dashboard/Posts/Redirect)

### 4.3 Navigation Menu

**File**: `src/layouts/AppLayout.tsx`

| Label | Icon | Route | Access |
|-------|------|-------|--------|
| Tổng quan | Dashboard | `/` | All authenticated |
| Imports | Upload | `/imports` | All authenticated |
| Analytics | BarChart | `/analytics` | All authenticated |
| Bình luận | Message | `/comments` | All authenticated |
| Seeding Manager | Rocket | `/seeding` | All authenticated |
| Quản trị | UserSwitch | `/admin` | Admin only |
| Cài đặt | Setting | `/settings` | All authenticated |

---

## 5. CHỨC NĂNG IMPORT DỮ LIỆU FACEBOOK

### 5.1 Luồng xử lý Import

**File**: `src/components/ImportFolder.tsx`

```
1. User chọn file ZIP
   ↓
2. JSZip.loadAsync() giải nén ZIP
   ↓
3. Parse JSON files bên trong
   ↓
4. Decode Facebook data structure (src/utils/encoding.ts)
   ↓
5. Extract comments & reactions
   ↓
6. Chunk data (700 comments/chunk, 2000 reactions/chunk)
   ↓
7. Upload lên Firestore:
   - createImport() → tạo document
   - addCommentChunk() → upload comment chunks
   - addReactionChunk() → upload reaction chunks
   - finalizeImport() → cập nhật status = "completed"
```

### 5.2 Thư viện giải nén

**Library**: `jszip` (^3.10.1)

**Code tham khảo** (`src/components/ImportFolder.tsx`, dòng 243):
```typescript
const zip = await JSZip.loadAsync(file);
```

**Hỗ trợ nested ZIP**: Có (đệ quy đọc các ZIP bên trong)

### 5.3 Cấu trúc JSON Input

Facebook export JSON structure được decode từ `src/utils/encoding.ts`:

**Comments**:
```json
{
  "comments_v2" hoặc "group_comments_v2": [
    {
      "data": [
        {
          "comment": {
            "author": "Tên tác giả",
            "comment": "Nội dung bình luận",
            "timestamp": 1234567890,
            "group": "Tên nhóm"
          }
        }
      ],
      "title": "Tiêu đề bài viết",
      "postUrl": "https://facebook.com/..."
    }
  ]
}
```

**Reactions**:
```json
[
  {
    "label_values": [
      { "label": "Cảm xúc", "value": "LIKE" },
      { "label": "URL", "href": "https://facebook.com/..." },
      { "label": "Tên", "value": "Tên chủ bài viết" }
    ],
    "timestamp": 1234567890,
    "fbid": "facebook_id"
  }
]
```

### 5.4 Các hàm chính

**File**: `src/service/importService.ts`

| Hàm | Mô tả |
|------|--------|
| `getAllImports()` | Lấy tất cả imports |
| `createImport(payload)` | Tạo import document mới |
| `finalizeImport(id, payload)` | Cập nhật import sau khi upload |
| `addCommentChunk(importId, payload)` | Lưu comment chunk |
| `addReactionChunk(importId, payload)` | Lưu reaction chunk |
| `deleteImport(importId)` | Xóa import (cascade) |
| `deleteAllImports()` | Xóa tất cả imports |
| `findImportsByAccountName(name)` | Tìm imports theo tên |
| `updateCommentsIntent(results)` | Cập nhật intent classification |

### 5.5 Constants

```typescript
const COMMENT_CHUNK_SIZE = 700;
const REACTION_CHUNK_SIZE = 2000;
```

---

## 6. DASHBOARD VÀ THỐNG KÊ

### 6.1 Thông tin hiển thị

**File**: `src/components/StatsCards.tsx`

| Metric | Description |
|--------|-------------|
| Total Comments | Tổng số bình luận |
| Total Imports | Tổng số lần import |
| Avg Efficiency Score | Điểm hiệu quả trung bình |

Mỗi metric có delta badge so sánh với kỳ trước.

### 6.2 Thư viện biểu đồ

**Library**: `echarts` (^6.0.0) + `echarts-for-react` (^3.0.5)

### 6.3 Loại biểu đồ

| Chart | File | Type |
|-------|------|------|
| EngagementChart | `src/components/EngagementChart.tsx` | Line chart (comments + likes) |
| TimelineChart | `src/components/charts/TimelineChart.tsx` | Line chart (theo thời gian) |
| ReactionPieChart | `src/components/charts/ReactionPieChart.tsx` | Pie chart |
| SentimentChart | `src/components/charts/SentimentChart.tsx` | Bar/Pie chart |

### 6.4 Bộ lọc

**File**: `src/pages/HomePage.tsx`

- **Date presets**: Today, 7 days, 30 days, This month, This year
- **Date range picker**: Custom date range
- **Account filter**: Multi-select dropdown

### 6.5 Hook thống kê

**File**: `src/hooks/useStats.tsx`

```typescript
interface StatsResult {
  likes: number;
  comments: number;
  shares: number;
  totalImport: number;
}
```

---

## 7. QUẢN LÝ VÀ LỌC BÌNH LUẬN

### 7.1 Trang Comments

**File**: `src/pages/CommentsPage.tsx`

**Thông tin hiển thị**:
- Tác giả (authorName)
- Nội dung (content)
- Bài viết (postUrl - link)
- Nhóm (group)
- Tài khoản (accountName)
- Thời gian (commentTime)

### 7.2 Bộ lọc/Tìm kiếm

| Filter | Type | Description |
|--------|------|-------------|
| Keyword | Text input | Tìm trong nội dung bình luận |
| Author | Text input | Tên tác giả |
| Account | Select | Dropdown tài khoản |
| Group | Select | Dropdown nhóm (động từ data) |
| Date range | DatePicker | Khoảng thời gian |

### 7.3 Dữ liệu từ Collection

**Source**: `imports/{id}/commentChunks`

**Hook**: `src/hooks/useAllComments.tsx`

**Giới hạn**: 5,000 bình luận (MAX_COMMENTS)

---

## 8. TÍCH HỢP AI - GOOGLE GEMINI API

### 8.1 Cách gọi API

**Trực tiếp từ Frontend** - Không qua Cloud Functions

**File**: `src/service/aiSeedingService.ts`

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: "..."
});
```

### 8.2 API Key Management

**Location**: File `.env`

```
VITE_GEMINI_API_KEY=your_api_key
VITE_GEMINI_MODEL=gemini-2.0-flash
```

### 8.3 Chức năng AI thực hiện

#### Seeding Content Generation (`aiSeedingService.ts`)
- Tạo bài viết seeding tự nhiên
- Tạo 5 comment mồi chia đều các dạng
- Tạo redirect comment để kéo member
- Tránh trùng lặp với lịch sử đã dùng

#### Redirect Comment Generation (`aiSeedingService.ts`)
- Phân tích nội dung input
- Detect category tự động
- Tạo redirect comment phù hợp với group

#### Sentiment Analysis (`aiSentimentService.ts`)
- **LƯU Ý**: Hiện tại sử dụng **rule-based offline** (từ điển cảm xúc tiếng Việt)
- Không gọi Gemini cho sentiment
- **File**: `src/utils/sentiment.ts`

#### Comment Summary (`aiSummaryService.ts`)
- **LƯU Ý**: Sử dụng **rule-based offline**
- Không gọi Gemini API
- Tóm tắt bằng thuật toán cục bộ

### 8.4 Prompt Template (Seeding)

**File**: `src/service/aiSeedingService.ts` (dòng 20-291)

System instruction dài ~270 dòng bao gồm:
- ROLE: AI Seeding Manager
- Workflow: POST → COMMENTS → REDIRECT
- Style guidelines (tiếng Việt trẻ: mn, b, tui, mk...)
- Category mappings
- JSON output format
- Memory/avoidance rules

### 8.5 Output Structure

```json
{
  "campaign": {
    "title": "...",
    "category": "tìm khóa học",
    "post": "Mn cho em hỏi...",
    "comments": ["...", "...", "...", "...", "..."],
    "redirect": {
      "group_name": "...",
      "group_url": "...",
      "content": "Tui cũng từng..."
    }
  }
}
```

### 8.6 Fallback khi AI fail

**File**: `src/service/aiSeedingService.ts` (dòng 439-558)

Có sẵn template-based fallback với 10 categories:
- tìm khóa học, tìm trung tâm, tìm lớp, tìm gia sư
- học online, hỏi tài liệu, hỏi app/web, hỏi HSK
- hỏi kinh nghiệm học, tự học

---

## 9. QUẢN LÝ SEEDING

### 9.1 Chức năng Seeding

**File**: `src/pages/SeedingPage.tsx`

| Feature | Description |
|---------|-------------|
| Dashboard | Stats, weekly chart, category distribution |
| Post List | Bảng posts với filters |
| Create Campaign | Tạo campaign với topic/category |
| Daily Posts | Generate 4 bài hàng ngày |
| Group Management | CRUD groups |
| History | Posts grouped by date |
| Redirect Tool | Phân tích nội dung → redirect comment |

### 9.2 Data Models

**File**: `src/types/seeding.ts`

```typescript
type SeedingCategory = 
  | "tìm khóa học" | "tìm trung tâm" | "tìm lớp" | "tìm gia sư"
  | "học online" | "hỏi tài liệu" | "hỏi app/web" | "hỏi HSK"
  | "hỏi kinh nghiệm học" | "tự học";

type GroupCategory = "review" | "online" | "hsk" | "tailieu" | "all";
type PostStatus = "draft" | "ready" | "used" | "archived";
type CommentType = "bait" | "redirect";
```

### 9.3 Firestore Collections cho Seeding

| Collection | Purpose |
|------------|---------|
| seedingProfiles | Facebook profiles |
| seedingCampaigns | Chiến dịch seeding |
| seedingTasks | Tasks cho campaign |
| seedingComments | Comments (bait + redirect) |

### 9.4 Service Files

| File | Description |
|------|-------------|
| `src/service/seedingService.ts` | High-level AI orchestration |
| `src/service/seedingDb.ts` | Low-level Firestore operations |
| `src/service/aiSeedingService.ts` | Gemini AI integration |

---

## 10. CHỨC NĂNG XUẤT BÁO CÁO

### 10.1 Export Formats

| Format | Library | File |
|--------|--------|------|
| CSV | Native JS (Blob) | `src/utils/commentExport.ts` |
| JSON | Native JS (Blob) | `src/utils/commentExport.ts` |
| Excel (.xlsx) | xlsx | `src/utils/commentExport.ts` |

### 10.2 Export Columns

| Column | Description |
|--------|-------------|
| Tác giả | authorName |
| Nội dung | content |
| Cảm xúc | sentiment label (Tích cực/Trung lập/Tiêu cực) |
| Điểm cảm xúc | sentiment score |
| Bài viết | postUrl |
| Nhóm | group |
| Tài khoản | accountName |
| Thời gian | commentTime (formatted) |

### 10.3 Export Functions

**File**: `src/utils/commentExport.ts`

```typescript
exportCommentsToCSV(data: RichComment[]): void
exportCommentsToJSON(data: RichComment[]): void
exportCommentsToXLSX(data: RichComment[]): void
```

### 10.4 Print Report

**Component**: `src/components/PrintReportButton.tsx`

Sử dụng browser's native print functionality.

---

## 11. CÁC THÔNG TIN BỔ SUNG

### 11.1 UI Library

**Ant Design** (antd ^6.1.3)

Design tokens:
- Primary color: `#3ecf8e` (emerald)
- Border radius: 6px (small), 12px (large)
- Font: Inter, Helvetica Neue, Arial, sans-serif

### 11.2 State Management

**Context API** (React built-in)

| Context | File | Purpose |
|---------|------|---------|
| AuthContext | `src/contexts/AuthContext.tsx` | User auth state |
| ThemeContext | `src/contexts/ThemeContext.tsx` | Light/dark mode |
| ImportDataContext | `src/contexts/ImportDataContext.tsx` | Real-time imports cache |
| LoadingContext | `src/contexts/LoadingContext.tsx` | Multi-key loading state |

### 11.3 Responsive/Mobile

**Có hỗ trợ** - Sử dụng CSS Grid/Flexbox và Ant Design responsive components.

### 11.4 Dark Mode

**Có hỗ trợ** - Toggle trong SettingsPage.

**Implementation**:
```typescript
// Ant Design ConfigProvider
<ConfigProvider
  theme={{
    algorithm: isDark ? antdThemeApi.darkAlgorithm : antdThemeApi.defaultAlgorithm,
    ...
  }}
>
```

Theme được lưu trong localStorage.

### 11.5 Internationalization (i18n)

**Có** - Tiếng Việt (viVN locale)

```typescript
import viVN from "antd/locale/vi_VN";
<ConfigProvider locale={viVN}>
```

### 11.6 Unit Tests

**Không có unit test** trong codebase hiện tại.

### 11.7 Environment Configuration

**File**: `.env`

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
VITE_GEMINI_MODEL=gemini-2.0-flash
```

---

## Summary

| Aspect | Implementation |
|--------|---------------|
| Auth | Firebase Email/Password + Whitelist |
| Database | Firebase Firestore |
| UI Framework | React 19 + Ant Design 6 |
| Charts | ECharts 6 |
| AI | Google Gemini (direct from frontend) |
| Export | CSV, JSON, XLSX (xlsx library) |
| ZIP Processing | JSZip |
| State | React Context API |
| Routing | React Router v7 |
| Styling | SCSS + Ant Design tokens |
| i18n | Vietnamese (viVN) |
| Dark Mode | Supported |
| Responsive | Supported |
