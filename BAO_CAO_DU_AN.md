# BÁO CÁO DỰ ÁN: FB Pulse Tracker

> **Ngày báo cáo:** 05/06/2026  
> **Phiên bản:** 1.6.0  
> **Branch:** main  
> **Repository:** https://github.com/TrungHuy242/FB-Pulse-Tracker

---

## 1. TỔNG QUAN

**FB Pulse Tracker** là ứng dụng web phân tích dữ liệu engagement từ Facebook dành cho nội bộ. Người dùng import file ZIP từ Facebook Data Export, hệ thống lưu trữ và phân tích dữ liệu theo thời gian thực, bao gồm bình luận, cảm xúc, biểu đồ timeline, phân tích AI sentiment và AI summary. Ngoài ra còn có module **Seeding** để quản lý chiến dịch tương tác Facebook tự động qua GPM Automate.

| Thông tin | Chi tiết |
|-----------|----------|
| Loại ứng dụng | SPA (Single Page Application) — Web nội bộ |
| Người dùng mục tiêu | Admin quản lý, Read-only viewer |
| Dữ liệu xử lý | Comments + Reactions từ Facebook Data Export (ZIP) |
| Truy cập | Chỉ tài khoản Google được whitelist |
| Lưu trữ | Firebase Firestore (cloud) |
| AI tích hợp | Google Gemini (`gemini-2.0-flash`) qua Firebase Cloud Functions |

---

## 2. TECH STACK

### Frontend
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| React | 19.2.6 | UI framework |
| TypeScript | 5.9.3 (strict) | Type safety, zero `any` |
| Vite | 7.2.4 | Build tool, HMR |
| Ant Design | 6.1.3 | UI component library |
| ECharts | 6.0.0 | Biểu đồ (timeline, heatmap, pie, bar) |
| SCSS | 1.97.1 | Styling với design tokens |
| React Router DOM | 7.11.0 | Client-side routing |
| Day.js | 1.11.13 | Date formatting |
| JSZip | 3.10.1 | Parse file ZIP phía client |
| xlsx | 0.18.5 | Export Excel |
| Lodash | 4.17.21 | Utility functions |
| Sentry | (devDep) | Error monitoring |
| @google/generative-ai | 0.24.1 | Gemini client (client-side, optional) |

### Backend / Cloud
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Firebase | 12.7.0 | Auth (Google), Firestore DB, Hosting |
| Firebase Cloud Functions | v2 (Node 20) | AI API calls (server-side) |
| Google Gemini | `gemini-2.0-flash` | Phân tích sentiment, tóm tắt, SEO, leads, intent, seeding ideas |

### Testing & CI/CD
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Vitest | 4.1.7 | Unit + integration tests |
| Testing Library | 16.3.2 | React component testing |
| Playwright | 1.60.0 | E2E tests |
| GitHub Actions | — | CI pipeline |

### PWA
- `vite-plugin-pwa` — Service Worker + Workbox, offline cache, installable

---

## 3. KIẾN TRÚC HỆ THỐNG

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (SPA)                        │
│                                                             │
│  React 19 + TypeScript  ←→  Ant Design 6 + ECharts 6       │
│        ↓                                                    │
│  Firebase SDK 12                                            │
│    ├── Auth (Google OAuth)                                  │
│    └── Firestore (real-time onSnapshot)                     │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTPS (Firebase SDK)
┌───────────────────▼─────────────────────────────────────────┐
│                  FIREBASE CLOUD PLATFORM                    │
│                                                             │
│  Firestore DB          Cloud Functions (Node 20)           │
│  ├── allowedAccounts   ├── analyzeSentiment()              │
│  ├── imports/          │     └── Gemini API               │
│  │   ├── commentChunks ├── summarizeComments()            │
│  │   └── reactionChunks│     └── Gemini API               │
│  ├── seedingProfiles   ├── extractSeoKeywords()           │
│  ├── seedingCampaigns  ├── scoreLeads()                   │
│  ├── seedingTasks      ├── classifyIntent()               │
│  └── seedingComments   └── generateSeedingIdeas()         │
│                               └── Gemini API (tất cả)     │
│  Hosting (Firebase)    Security Rules (Firestore)          │
└─────────────────────────────────────────────────────────────┘
```

### Luồng dữ liệu Import
```
User chọn ZIP → JSZip parse client-side → Detect single/multi-profile
    → Tạo ZipJobs (1 job / profile)
    → Preview table (user review + chỉnh tên)
    → Firebase: createImport() → addCommentChunk() × N → addReactionChunk() × M
    → finalizeImport() → Dashboard cập nhật real-time (onSnapshot)
```

### Luồng Seeding (GPM Bridge)
```
Admin tạo Campaign → Thêm Tasks (profile × action × URL)
    → Export Excel/CSV → GPM Automate thực thi
    → Import Report (Excel/CSV) → Cập nhật task status
    → Thống kê success rate
```

### Phân quyền người dùng
| Role | Quyền |
|------|-------|
| **Admin (role=1)** | Đọc + Import + Xóa + Quản lý tài khoản + Seeding CRUD |
| **Read-only (role=0)** | Chỉ đọc dữ liệu, không thể import, xóa hay tạo seeding |
| **Unauthenticated** | Chỉ xem LandingPage |

---

## 4. TÍNH NĂNG CHI TIẾT

### 4.1 Import dữ liệu
- Upload file ZIP từ Facebook Data Export
- **Multi-profile detection tự động**: ZIP chứa nhiều profile → tách thành ZipJob riêng cho từng profile
- Re-import detection: phát hiện tài khoản trùng tên → toggle mode Append/Replace
- Batch import: chọn nhiều ZIP cùng lúc
- Progress bar theo chunk (700 comments/chunk, 2000 reactions/chunk)
- Notification khi import hoàn tất (Web Push API)

### 4.2 Dashboard (Tổng quan)
- **StatsCards**: Tổng lượt thích, bình luận, số lần import, TB/import — với delta % so với kỳ trước
- **EngagementChart**: Biểu đồ timeline tương tác theo thời gian (ECharts)
- **AccountsTable**: Bảng danh sách imports với filter, sort, export
- **Filter**: Theo khoảng thời gian (DatePresets + DateRangePicker) và tài khoản
- **Onboarding**: WelcomeEmptyState hiển thị khi chưa có dữ liệu

### 4.3 Analytics (Phân tích)
- **TimelineChart**: Biểu đồ tương tác theo thời gian chi tiết
- **ActivityHeatmap**: Heatmap giờ/ngày tương tác trong tuần
- **ReactionPieChart**: Phân bố loại cảm xúc (Like, Love, Haha, Wow, Sad, Angry)
- **TopCommentersChart**: Top người bình luận nhiều nhất
- **InsightsPanel**: Auto-insights (giờ cao điểm, spike, top user...)
- **PerformanceScoreTable**: Điểm hiệu quả 0–100, Grade A–F per account
- **AiSummaryPanel**: Tóm tắt AI bình luận (Gemini qua Cloud Functions, tối đa 300 bình luận)

### 4.4 Bình luận (CommentsPage)
- Tìm kiếm toàn văn theo nội dung
- Lọc theo: tác giả, tài khoản, nhóm, cảm xúc, khoảng thời gian
- **AI Sentiment Analysis**: Phân tích cảm xúc bằng Gemini (tối đa **50 bình luận/lần**)
- Export: CSV (UTF-8 BOM), JSON, Excel (.xlsx)
- **SentimentChart**: Phân bố cảm xúc (rule-based + AI)
- **KeywordFreqChart**: Tần suất từ khóa top 20

### 4.5 Imports (ImportsPage)
- Quản lý danh sách imports với real-time updates
- Phát hiện import mới từ tab/thiết bị khác (banner "Có dữ liệu mới")
- Bulk delete với confirmation 2 bước
- Export tất cả hoặc theo lựa chọn: Excel, CSV, JSON

### 4.6 Seeding (SeedingPage) ← **Tính năng mới**
Quản lý tự động hóa tương tác Facebook qua GPM Automate (bridge Excel/CSV).

**Tab Chiến dịch:**
- CRUD campaigns (draft → active → paused → completed)
- Tạo tasks hàng loạt: chọn profiles + action (Like/Comment/Share) + URL
- Export tasks → Excel/CSV để GPM Automate thực thi
- Import report từ GPM về → cập nhật trạng thái task (pending/running/success/failed/skipped)
- Thống kê success rate per campaign

**Tab Profiles:**
- Quản lý GPM profiles (Active/Inactive/Banned)
- Import hàng loạt từ CSV/Excel (upsert theo profileId)
- Export template Excel

**Tab Thư viện:**
- CRUD comment library với tags
- Theo dõi usageCount

**AI Seeding Features (CommentsPage):**
- **extractSeoKeywords**: Trích xuất từ khóa SEO (tối đa 500 bình luận)
- **scoreLeads**: Chấm điểm leads tiềm năng 0–100 (tối đa 200 bình luận)
- **classifyIntent**: Phân loại ý định buy/inquiry/complaint/compliment/other (tối đa 100 bình luận)
- **generateSeedingIdeas**: Đề xuất ý tưởng content seeding (tối đa 500 bình luận)

### 4.7 Admin (AdminPage)
- Quản lý whitelist tài khoản (thêm/sửa/xóa)
- Tìm kiếm theo email/tên
- Xóa toàn bộ Import data (double confirmation)
- Bảo vệ: không thể xóa/sửa role của chính mình

### 4.8 Settings
- Định dạng ngày giờ (VI/ISO/US)
- Kích thước bảng (Compact/Default/Large)
- Hiển thị số đầy đủ hoặc rút gọn (1.2M)
- Dark/Light mode — persisted localStorage

---

## 5. CẤU TRÚC FILE DỰ ÁN

```
json-tool-main-main/
├── src/
│   ├── App.tsx                         # Root app, ConfigProvider, routes
│   ├── main.tsx                        # Entry point
│   ├── components/
│   │   ├── AccountsTable.tsx           # Bảng imports chính (forwardRef)
│   │   ├── AiSummaryPanel.tsx          # AI summary card
│   │   ├── CommentDetails.tsx          # Modal xem chi tiết bình luận
│   │   ├── DatePresets.tsx             # Quick date presets (7/30/90 ngày)
│   │   ├── EngagementChart.tsx         # Chart tổng quan tương tác
│   │   ├── ErrorBoundary.tsx           # React Error Boundary
│   │   ├── ImportFolder.tsx            # Modal import ZIP (logic chính)
│   │   ├── InsightsPanel.tsx           # Auto insights grid
│   │   ├── LoadingOverlay.tsx          # Global loading overlay
│   │   ├── PerformanceScoreTable.tsx   # Bảng điểm hiệu quả
│   │   ├── PrintReportButton.tsx       # Nút in báo cáo
│   │   ├── ReactionDetails.tsx         # Modal xem chi tiết cảm xúc
│   │   ├── StatsCards.tsx              # 4 stat cards với delta
│   │   ├── WelcomeEmptyState.tsx       # Onboarding (khi chưa có data)
│   │   ├── AccountsTable/
│   │   │   └── hooks/
│   │   │       ├── useAccountsTable.tsx
│   │   │       ├── useImportComments.tsx
│   │   │       └── useImportReactions.tsx
│   │   ├── charts/
│   │   │   ├── ActivityHeatmap.tsx
│   │   │   ├── KeywordFreqChart.tsx
│   │   │   ├── ReactionPieChart.tsx
│   │   │   ├── SentimentChart.tsx
│   │   │   ├── TimelineChart.tsx
│   │   │   └── TopCommentersChart.tsx
│   │   ├── exportAllImportsToCSV.ts
│   │   ├── exportAllImportsToExcel.ts
│   │   └── exportAllImportsToJSON.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx             # Firebase Auth + user profile
│   │   ├── ImportDataContext.tsx       # Real-time imports (onSnapshot)
│   │   ├── LoadingContext.tsx          # Global loading state
│   │   └── ThemeContext.tsx            # Dark/Light mode
│   ├── hooks/
│   │   ├── useAllComments.tsx          # Fetch + filter bình luận
│   │   ├── useAllEngagement.tsx        # Fetch tổng hợp engagement
│   │   ├── useInsights.ts             # Tính toán auto insights
│   │   ├── usePerformanceScore.ts     # Tính điểm hiệu quả
│   │   ├── useRealtimeImports.tsx     # Phát hiện import mới real-time
│   │   ├── useSeedingStats.ts         # Tính thống kê seeding (success rate)
│   │   └── useStats.tsx               # Tính thống kê tổng hợp
│   ├── layouts/
│   │   └── AppLayout.tsx              # Shell: sidebar + topbar + content
│   ├── pages/
│   │   ├── AdminPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   ├── CommentsPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── ImportsPage.tsx
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── SeedingPage.tsx            # ← MỚI: quản lý seeding/chiến dịch
│   │   └── SettingsPage.tsx
│   ├── service/
│   │   ├── accountService.ts          # CRUD allowedAccounts
│   │   ├── aiExtendedService.ts       # SEO/Leads/Intent/Seeding Ideas (Gemini)
│   │   ├── aiSentimentService.ts      # Gọi Cloud Function analyzeSentiment
│   │   ├── aiSummaryService.ts        # Gọi Cloud Function summarizeComments
│   │   ├── authService.ts             # Google OAuth wrapper
│   │   ├── firebase.ts                # Firebase app init
│   │   ├── importService.ts           # CRUD imports + chunks
│   │   ├── queryCache.ts              # In-memory cache layer
│   │   ├── seedingService.ts          # ← MỚI: CRUD seedingProfiles/Campaigns/Tasks/Comments
│   │   └── sentry.ts                  # Sentry init
│   ├── styles/
│   │   ├── accounts-table.scss        # AccountsTable card styles
│   │   ├── admin.scss                 # AdminPage styles
│   │   ├── header.scss                # Import modal upload area
│   │   ├── layout.scss                # Sidebar + topbar (CSS vars + dark mode)
│   │   ├── loading-overlay.scss       # Loading overlay
│   │   ├── print.scss                 # Print report styles
│   │   ├── reaction-details.scss      # Reaction modal
│   │   └── responsive.scss            # Global reset + responsive
│   ├── test/                          # 27 test files
│   ├── types/
│   │   ├── guards.ts                  # Runtime type guards (isImportRecord, ...)
│   │   ├── index.ts                   # Type definitions chính
│   │   └── seeding.ts                 # ← MỚI: Types cho seeding module
│   └── utils/
│       ├── array.ts                   # chunkArray()
│       ├── encoding.ts                # Facebook encoding decode
│       ├── geminiClient.ts            # ← MỚI: Gemini model factory (client-side)
│       ├── importUtils.ts             # Import helper functions
│       ├── notification.ts            # Web Push notification
│       ├── seedingExport.ts           # ← MỚI: Export/Import Excel/CSV seeding
│       └── sentiment.ts               # Rule-based sentiment analysis
├── functions/
│   └── src/index.ts                   # 6 Cloud Functions: AI qua Google Gemini
├── e2e/                               # Playwright E2E tests
├── public/
│   ├── icon-192.svg
│   └── icon-512.svg
├── .github/workflows/ci.yml           # GitHub Actions CI
├── .env.example                       # Template biến môi trường
├── CLAUDE.md                          # Hướng dẫn cho Claude Code
├── DESIGN.md                          # Design system tokens
├── PROJECT_EVALUATION.md              # Đánh giá dự án
├── README.md                          # Tài liệu đầy đủ
├── BAO_CAO_DU_AN.md                   # File này
├── firebase.json                      # Firebase config
├── firestore.rules                    # Firestore Security Rules
├── package.json
├── tsconfig.app.json
├── vite.config.ts
└── playwright.config.ts
```

---

## 6. FIRESTORE SCHEMA

### Collection: `allowedAccounts/{uid}`
```
{
  email:       string          // Google email
  displayName: string          // Tên hiển thị
  role:        0 | 1           // 0=read-only, 1=admin
}
```

### Collection: `imports/{importId}`
```
{
  accountName:    string       // Tên profile Facebook
  commentsCount:  number       // Tổng số bình luận
  reactionsCount: number       // Tổng số cảm xúc
  totalFiles:     number       // Số file JSON đã xử lý
  status:         "processing" | "completed"
  importedAt:     Timestamp
}
```

### Sub-collection: `imports/{id}/commentChunks/{chunkId}`
```
{
  index: number                // Thứ tự chunk (0, 1, 2, ...)
  count: number                // Số items trong chunk
  items: CommentItem[]         // Tối đa 700 items/chunk
}
```

### Sub-collection: `imports/{id}/reactionChunks/{chunkId}`
```
{
  index: number
  count: number
  items: ReactionItem[]        // Tối đa 2000 items/chunk
}
```

### Collection: `seedingProfiles/{id}` ← **Mới**
```
{
  profileId:   string          // GPM Profile ID
  profileName: string          // Tên hiển thị
  status:      "active" | "inactive" | "banned"
  note?:       string
  createdAt:   Timestamp
}
```

### Collection: `seedingCampaigns/{id}` ← **Mới**
```
{
  name:        string
  description?: string
  status:      "draft" | "active" | "paused" | "completed"
  targetUrl?:  string          // URL mặc định cho tasks
  createdAt:   Timestamp
  updatedAt:   Timestamp
}
```

### Collection: `seedingTasks/{id}` ← **Mới**
```
{
  campaignId:   string
  profileId:    string         // GPM Profile ID
  profileName:  string
  action:       "like" | "comment" | "share"
  targetUrl:    string
  commentText?: string
  shareCaption?: string
  delayMin:     number         // Delay giây (min)
  delayMax:     number         // Delay giây (max)
  status:       "pending" | "running" | "success" | "failed" | "skipped"
  exportedAt?:  Timestamp
  finishedAt?:  Timestamp
  errorMessage?: string
  createdAt:    Timestamp
}
```

### Collection: `seedingComments/{id}` ← **Mới**
```
{
  text:       string           // Nội dung comment mẫu
  tags:       string[]         // Nhãn phân loại
  usageCount: number           // Số lần đã dùng
  createdAt:  Timestamp
}
```

---

## 7. CLOUD FUNCTIONS AI

Tất cả 6 functions đều dùng **Google Gemini** (`gemini-2.0-flash`) qua `GEMINI_API_KEY` (server-side secret). Region: `asia-southeast1`.

| Function | Giới hạn | Timeout | Mô tả |
|----------|----------|---------|-------|
| `analyzeSentiment` | 50 bình luận | 60s | Phân tích sentiment (positive/neutral/negative + score + keywords) |
| `summarizeComments` | 300 bình luận | 120s | Tóm tắt + highlights + actionItems + sentimentOverview |
| `extractSeoKeywords` | 500 bình luận | 60s | Trích xuất từ khóa SEO (frequency + relevance) |
| `scoreLeads` | 200 bình luận | 60s | Chấm điểm leads 0–100 + intent + signals |
| `classifyIntent` | 100 bình luận | 60s | Phân loại: buy/inquiry/complaint/compliment/other |
| `generateSeedingIdeas` | 500 bình luận | 90s | Đề xuất ý tưởng content (title + format + angle) |

**Cơ chế fallback:**
- Rate-limit (429) → trả về neutral/empty result (không throw)
- Timeout → throw `resource-exhausted`
- Parse error → trả về fallback rỗng

---

## 8. BẢO MẬT

### Firebase Security Rules
- `allowedAccounts`: Read = `isAuthenticated()`, Write = `isAdmin()` + validate schema
- `imports`: Read = `isAllowedUser()` (phải trong whitelist), Write = `isAdmin()`
- `commentChunks/reactionChunks`: Read = `isAllowedUser()`, Write = `isAdmin()`
- `seedingProfiles/Campaigns/Tasks/Comments`: Read = `isAllowedUser()`, Write = `isAdmin()`
- Catch-all cuối: `allow read, write: if false` — từ chối mọi collection chưa khai báo

### API Keys
- `GEMINI_API_KEY` **chỉ** tồn tại trong Firebase Cloud Functions environment (secret)
- `VITE_GEMINI_API_KEY` (optional) cho `geminiClient.ts` phía client — không bắt buộc
- Không bao giờ commit key vào source code
- `.env` trong `.gitignore` — không commit

### Validation
- Runtime type guards (`src/types/guards.ts`) tại tất cả boundaries nhận data từ Firestore
- Schema validation trong Firestore Rules (`isValidImportCreate`, `isValidImportUpdate`, `isValidAccountData`)

---

## 9. TESTING

| Loại | Số lượng | Coverage |
|------|----------|---------|
| Unit tests (Vitest) | **27 test files** | Logic + Utils + Hooks + Services |
| Component tests | WelcomeEmptyState, StatsCards, DatePresets, ThemeContext | Render + Interaction |
| Service tests | Auth, AI Sentiment, AI Summary, Import, Cache, Sentry | API + Fallback |
| Export tests | commentsExportCSV, commentsExportXLSX, csvExport, seedingExport | Export formats |
| Hook tests | useAccountsTable, useInsights, usePerformanceScore, useSeedingStats, useRealtimeImports, useStats | State logic |
| E2E tests (Playwright) | smoke.spec.ts, navigation.spec.ts | Happy path |

**Test files chính:**
- `importUtils.test.ts` — chunk calculation, mode detection, normalization
- `typeGuards.test.ts` — runtime guards cho mọi data type
- `useInsights.test.ts` — Insights logic: peak time, spike detection
- `usePerformanceScore.test.ts` — Grade calculation A–F
- `aiSentimentService.test.ts` — Cloud Function call + rule-based fallback
- `sentiment.test.ts` — Rule-based sentiment scoring
- `seedingExport.test.ts` — Export/Import Excel/CSV seeding tasks
- `useSeedingStats.test.ts` — Success rate calculation
- `importFlow.test.ts` — End-to-end import flow logic

---

## 10. ROUTES

| Route | Component | Auth |
|-------|-----------|------|
| `/` | `LandingPage` (unauthenticated) hoặc `HomePage` | — |
| `/imports` | `ImportsPage` | Require auth |
| `/analytics` | `AnalyticsPage` | Require auth |
| `/comments` | `CommentsPage` | Require auth |
| `/seeding` | `SeedingPage` ← **Mới** | Require auth |
| `/settings` | `SettingsPage` | Require auth |
| `/admin` | `AdminPage` | Require auth |
| `/login` | `LoginPage` | — |

---

## 11. HIỆU NĂNG

- **Chunk-based upload**: Comments chia 700/chunk, Reactions chia 2000/chunk → tránh Firestore 1MB document limit
- **Lazy loading**: Chart components (`KeywordFreqChart`, `SentimentChart`) load on-demand bằng `React.lazy`
- **In-memory cache**: `queryCache.ts` cache Firestore reads với TTL 5 phút
- **onSnapshot real-time**: `ImportDataContext` dùng Firestore listener thay vì polling
- **PWA + Service Worker**: Workbox precache, hoạt động offline
- **AI limit per call**: Sentiment 50, Summary 300, SEO/Seeding 500, Leads 200, Intent 100 — tránh timeout

---

## 12. SCRIPTS

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Dev server (Vite HMR) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run lint` | ESLint check |
| `npm run test` | Chạy toàn bộ unit tests |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | Playwright E2E |
| `npm run preview` | Preview production build |

---

## 13. ĐÁNH GIÁ TỔNG THỂ

| Tiêu chí | Điểm | Nhận xét |
|----------|------|----------|
| Kiến trúc | 9/10 | Context separation rõ ràng, service layer tách biệt, type guards đầy đủ |
| Code Quality | 9/10 | TypeScript strict, zero `any`, clean component structure |
| Testing | 8/10 | 27 test files, E2E setup sẵn, coverage khá tốt |
| Bảo mật | 9/10 | Firestore Rules chặt, API key server-side, schema validation |
| Hiệu năng | 7/10 | Cache tốt, lazy load, nhưng chưa có Firestore pagination |
| UX/UI | 8/10 | Supabase-inspired design system, dark mode, responsive, PWA |
| Tính năng | 9/10 | Đầy đủ analytics + seeding module + 6 AI functions |
| Tài liệu | 9/10 | README đầy đủ, DESIGN.md, CLAUDE.md, test coverage |
| **Tổng** | **8.5/10** | **Cấp A — Production-ready** |

---

## 14. LỊCH SỬ THAY ĐỔI QUAN TRỌNG

### v1.6.0 (05/06/2026)
- **Đổi AI provider**: Claude Haiku → **Google Gemini** (`gemini-2.0-flash`) cho tất cả Cloud Functions
- **Thêm SeedingPage**: Module quản lý chiến dịch seeding Facebook (Campaigns / Profiles / Comment Library)
- **Thêm 4 Cloud Functions AI mới**: `extractSeoKeywords`, `scoreLeads`, `classifyIntent`, `generateSeedingIdeas`
- **Thêm aiExtendedService.ts**: Client wrapper cho 4 functions AI mới
- **Thêm seedingService.ts**: CRUD Firestore cho 4 collections seeding mới
- **Thêm geminiClient.ts**: Gemini model factory (client-side, optional)
- **Thêm seedingExport.ts**: Export/Import Excel/CSV cho seeding tasks
- **Thêm useSeedingStats.ts**: Hook tính success rate seeding
- **Thêm route `/seeding`**: SeedingPage vào App router
- **Test coverage mở rộng**: 27 test files (thêm seedingExport, useSeedingStats, importFlow, ...)

### v1.5.0 (30/05/2026)
- Dọn dẹp 12 file rác (Header.tsx, header/, table.scss, assets/react.svg, ...)
- Build OK · Tests pass · TypeScript clean

---

## 15. HƯỚNG PHÁT TRIỂN TIẾP THEO (P1)

| Task | Lý do |
|------|-------|
| Firestore pagination (cursor-based) | Tránh tải toàn bộ comments/reactions khi data lớn |
| E2E test cases bổ sung | smoke.spec.ts chỉ test login, cần thêm import flow + seeding flow |
| Bundle splitting | main chunk cần tách vendor/echarts |
| Rate limiting Cloud Functions | Tránh abuse Gemini API |
| Seeding task realtime listener | Hiện tại load on-demand, chưa realtime |
| Tích hợp GPM API trực tiếp | Thay thế bridge Excel/CSV |
