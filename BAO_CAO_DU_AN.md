# BÁO CÁO DỰ ÁN: FB Pulse Tracker

> **Ngày báo cáo:** 30/05/2026  
> **Phiên bản:** 1.5.0  
> **Branch:** main  
> **Repository:** https://github.com/TrungHuy242/FB-Pulse-Tracker

---

## 1. TỔNG QUAN

**FB Pulse Tracker** là ứng dụng web phân tích dữ liệu engagement từ Facebook dành cho nội bộ. Người dùng import file ZIP từ Facebook Data Export, hệ thống lưu trữ và phân tích dữ liệu theo thời gian thực, bao gồm bình luận, cảm xúc, biểu đồ timeline, phân tích AI sentiment và AI summary.

| Thông tin | Chi tiết |
|-----------|----------|
| Loại ứng dụng | SPA (Single Page Application) — Web nội bộ |
| Người dùng mục tiêu | Admin quản lý, Read-only viewer |
| Dữ liệu xử lý | Comments + Reactions từ Facebook Data Export (ZIP) |
| Truy cập | Chỉ tài khoản Google được whitelist |
| Lưu trữ | Firebase Firestore (cloud) |
| AI tích hợp | Claude Haiku qua Firebase Cloud Functions |

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
| Sentry | 10.54.0 | Error monitoring |

### Backend / Cloud
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Firebase | 12.7.0 | Auth (Google), Firestore DB, Hosting |
| Firebase Cloud Functions | v2 | AI API calls (server-side) |
| Anthropic Claude Haiku | claude-haiku-4-5 | Phân tích sentiment + tóm tắt |

### Testing & CI/CD
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Vitest | 4.1.7 | Unit + integration tests |
| Testing Library | 16.3.2 | React component testing |
| Playwright | 1.60.0 | E2E tests |
| GitHub Actions | — | CI pipeline |

### PWA
- `vite-plugin-pwa` 1.3.0 — Service Worker + Workbox, offline cache, installable

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
│  └── imports/          │     └── Claude Haiku API          │
│      ├── commentChunks └── summarizeComments()             │
│      └── reactionChunks      └── Claude Haiku API          │
│                                                             │
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

### Phân quyền người dùng
| Role | Quyền |
|------|-------|
| **Admin (role=1)** | Đọc + Import + Xóa + Quản lý tài khoản |
| **Read-only (role=0)** | Chỉ đọc dữ liệu, không thể import hay xóa |
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
- **AiSummaryPanel**: Tóm tắt AI bình luận (Claude Haiku qua Cloud Functions)

### 4.4 Bình luận (CommentsPage)
- Tìm kiếm toàn văn theo nội dung
- Lọc theo: tác giả, tài khoản, nhóm, cảm xúc, khoảng thời gian
- **AI Sentiment Analysis**: Phân tích cảm xúc bằng Claude (tối đa 200 bình luận/lần)
- Export: CSV (UTF-8 BOM), JSON, Excel (.xlsx)
- **SentimentChart**: Phân bố cảm xúc (rule-based + AI)
- **KeywordFreqChart**: Tần suất từ khóa top 20

### 4.5 Imports (ImportsPage)
- Quản lý danh sách imports với real-time updates
- Phát hiện import mới từ tab/thiết bị khác (banner "Có dữ liệu mới")
- Bulk delete với confirmation 2 bước
- Export tất cả hoặc theo lựa chọn: Excel, CSV, JSON

### 4.6 Admin (AdminPage)
- Quản lý whitelist tài khoản (thêm/sửa/xóa)
- Tìm kiếm theo email/tên
- Xóa toàn bộ Import data (double confirmation)
- Bảo vệ: không thể xóa/sửa role của chính mình

### 4.7 Settings
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
│   │   └── SettingsPage.tsx
│   ├── service/
│   │   ├── accountService.ts          # CRUD allowedAccounts
│   │   ├── aiSentimentService.ts      # Gọi Cloud Function analyzeSentiment
│   │   ├── aiSummaryService.ts        # Gọi Cloud Function summarizeComments
│   │   ├── authService.ts             # Google OAuth wrapper
│   │   ├── firebase.ts                # Firebase app init
│   │   ├── importService.ts           # CRUD imports + chunks
│   │   ├── queryCache.ts              # In-memory cache layer
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
│   ├── test/                          # 24 test files — 274 tests
│   ├── types/
│   │   ├── guards.ts                  # Runtime type guards (isImportRecord, ...)
│   │   └── index.ts                   # Type definitions
│   └── utils/
│       ├── array.ts                   # chunkArray()
│       ├── encoding.ts                # Facebook encoding decode
│       ├── importUtils.ts             # Import helper functions
│       ├── notification.ts            # Web Push notification
│       └── sentiment.ts               # Rule-based sentiment analysis
├── functions/
│   └── src/index.ts                   # Cloud Functions: analyzeSentiment, summarizeComments
├── e2e/                               # Playwright E2E tests
├── public/
│   ├── icon-192.svg
│   └── icon-512.svg
├── .github/workflows/ci.yml           # GitHub Actions CI
├── .env.example                       # Template biến môi trường
├── CLAUDE.md                          # Hướng dẫn cho Claude Code
├── DESIGN.md                          # Design system tokens
├── PROJECT_EVALUATION.md              # Đánh giá dự án (8.4/10)
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

---

## 7. BẢO MẬT

### Firebase Security Rules
- `allowedAccounts`: Read = `isAuthenticated()`, Write = `isAdmin()` + validate schema
- `imports`: Read = `isAllowedUser()` (phải trong whitelist), Write = `isAdmin()`
- `commentChunks/reactionChunks`: Read = `isAllowedUser()`, Write = `isAdmin()`
- Catch-all cuối: `allow read, write: if false` — từ chối mọi collection chưa khai báo

### API Key
- `ANTHROPIC_API_KEY` **chỉ** tồn tại trong Firebase Cloud Functions environment
- Không bao giờ expose ra frontend bundle
- `.env` trong `.gitignore` — không commit

### Validation
- Runtime type guards (`src/types/guards.ts`) tại tất cả boundaries nhận data từ Firestore
- Schema validation trong Firestore Rules (`isValidImportCreate`, `isValidImportUpdate`, `isValidAccountData`)

---

## 8. TESTING

| Loại | Số lượng | Coverage |
|------|----------|---------|
| Unit tests (Vitest) | 274 tests / 24 files | Logic + Utils + Hooks |
| Component tests | WelcomeEmptyState, StatsCards, DatePresets, ThemeContext | Render + Interaction |
| Service tests | Auth, AI Sentiment, AI Summary, Import, Cache | API + Fallback |
| E2E tests (Playwright) | smoke.spec.ts, navigation.spec.ts | Happy path |

**Test files chính:**
- `importUtils.test.ts` — 22 tests: chunk calculation, mode detection, normalization
- `typeGuards.test.ts` — 28 tests: runtime guards cho mọi data type
- `useInsights.test.ts` — Insights logic: peak time, spike detection
- `usePerformanceScore.test.ts` — Grade calculation A–F
- `aiSentimentService.test.ts` — Cloud Function call + rule-based fallback
- `sentiment.test.ts` — Rule-based sentiment scoring

---

## 9. ROUTES

| Route | Component | Auth |
|-------|-----------|------|
| `/` | `LandingPage` (unauthenticated) hoặc `HomePage` | — |
| `/imports` | `ImportsPage` | Require auth |
| `/analytics` | `AnalyticsPage` | Require auth |
| `/comments` | `CommentsPage` | Require auth |
| `/settings` | `SettingsPage` | Require auth |
| `/admin` | `AdminPage` | Require auth |
| `/login` | `LoginPage` | — |

---

## 10. HIỆU NĂNG

- **Chunk-based upload**: Comments chia 700/chunk, Reactions chia 2000/chunk → tránh Firestore 1MB document limit
- **Lazy loading**: Chart components (`KeywordFreqChart`, `SentimentChart`) load on-demand bằng `React.lazy`
- **In-memory cache**: `queryCache.ts` cache Firestore reads với TTL 5 phút
- **onSnapshot real-time**: `ImportDataContext` dùng Firestore listener thay vì polling
- **PWA + Service Worker**: Workbox precache 17 entries (3.3MB), hoạt động offline

---

## 11. SCRIPTS

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Dev server (Vite HMR) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run lint` | ESLint check |
| `npm run test` | Chạy toàn bộ unit tests (274 tests) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | Playwright E2E |
| `npm run preview` | Preview production build |

---

## 12. ĐÁNH GIÁ TỔNG THỂ

| Tiêu chí | Điểm | Nhận xét |
|----------|------|----------|
| Kiến trúc | 9/10 | Context separation rõ ràng, service layer tách biệt, type guards đầy đủ |
| Code Quality | 9/10 | TypeScript strict, zero `any`, clean component structure |
| Testing | 8/10 | 274 tests, E2E setup sẵn, coverage khá tốt |
| Bảo mật | 9/10 | Firestore Rules chặt, API key server-side, schema validation |
| Hiệu năng | 7/10 | Cache tốt, lazy load, nhưng chưa có Firestore pagination |
| UX/UI | 8/10 | Supabase-inspired design system, dark mode, responsive, PWA |
| Tài liệu | 9/10 | README đầy đủ, DESIGN.md, CLAUDE.md, test coverage |
| **Tổng** | **8.4/10** | **Cấp A — Production-ready** |

---

## 13. CÔNG VIỆC DỌN DẸP ĐÃ THỰC HIỆN (30/05/2026)

Đã xóa **12 file rác** không còn sử dụng:

| File | Lý do xóa |
|------|-----------|
| `src/components/Header.tsx` | Dead code — thay bởi `AppLayout.tsx`, không import ở đâu |
| `src/components/header/BrandLogo.tsx` | Chỉ dùng bởi Header.tsx (đã xóa) |
| `src/components/header/FilterBar.tsx` | Chỉ dùng bởi Header.tsx (đã xóa) |
| `src/components/header/UserMenu.tsx` | Chỉ dùng bởi Header.tsx (đã xóa) |
| `src/styles/table.scss` | Không được import bởi file nào |
| `src/assets/react.svg` | Leftover từ Vite scaffold mặc định |
| `public/vite.svg` | Leftover từ Vite scaffold mặc định |
| `HuongPhatTrien.md` | Tài liệu hướng phát triển cũ, không liên quan source code |
| `đánh-giá.md` | Báo cáo đánh giá cũ, thay bởi `PROJECT_EVALUATION.md` |
| `LOADING_HOOK.md` | Nội dung đã có trong code comments |
| `PROJECT_STRUCTURE.md` | Cấu trúc lỗi thời (còn ghi BarChart.tsx, LineChart.tsx không tồn tại), thay bởi README.md |
| `Log/Accessibility Report — Fb Pulse Tracker.pdf` | PDF audit không thuộc source code |

**Sau khi dọn:** Build OK · 274/274 tests pass · TypeScript clean

---

## 14. HƯỚNG PHÁT TRIỂN TIẾP THEO (P1)

| Task | Lý do |
|------|-------|
| Firestore pagination (cursor-based) | Tránh tải toàn bộ comments/reactions khi data lớn |
| E2E test cases bổ sung | smoke.spec.ts chỉ test login, cần thêm import flow |
| Bundle splitting | main chunk hiện 3.3MB, cần tách vendor/echarts |
| Rate limiting Cloud Functions | Tránh abuse Claude API |
