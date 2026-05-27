# Đánh giá Dự án — FB Pulse Tracker

> Phiên bản được đánh giá: **1.5.0 (Day 15)**  
> Thời điểm: Tháng 5/2026  
> Số dòng code: ~8.500 (src/) + ~600 (functions/)  
> Test: **24 files / 274 tests — 100% pass**

---

## 1. Tổng quan

FB Pulse Tracker là ứng dụng web nội bộ phân tích dữ liệu tương tác Facebook (bình luận, cảm xúc). Dự án được phát triển trong 15 ngày liên tục theo quy trình daily commit, mỗi ngày thêm một tầng tính năng mới. Kết quả là một ứng dụng hoàn chỉnh với kiến trúc rõ ràng, test coverage tốt, và tích hợp AI thực sự qua Firebase Cloud Functions.

---

## 2. Kiến trúc (Architecture)

### 2.1 Phân lớp

```
┌─────────────────────────────────────────────────────┐
│  Pages (8)         Routing + page-level state       │
├─────────────────────────────────────────────────────┤
│  Components (18)   UI thuần, nhận props, no Firestore│
├─────────────────────────────────────────────────────┤
│  Hooks (6)         useXxx — business logic + data   │
├─────────────────────────────────────────────────────┤
│  Contexts (4)      Auth / ImportData / Loading / Theme │
├─────────────────────────────────────────────────────┤
│  Service (8)       Toàn bộ Firestore calls tập trung │
├─────────────────────────────────────────────────────┤
│  Utils (5)         Pure functions, zero side effects │
├─────────────────────────────────────────────────────┤
│  Types (2)         Interfaces + runtime type guards  │
└─────────────────────────────────────────────────────┘
        ↕
┌─────────────────────────────────────────────────────┐
│  Firebase Cloud Functions                           │
│  analyzeSentiment / summarizeComments               │
│  (Claude Haiku — ANTHROPIC_API_KEY server-side only)│
└─────────────────────────────────────────────────────┘
```

**Nhận xét:**
- ✅ Tách biệt rõ ràng UI / logic / data layer
- ✅ Components không gọi Firestore trực tiếp — tất cả qua service layer
- ✅ AI API key hoàn toàn server-side, không bao giờ lọt ra frontend bundle
- ✅ Context providers chỉ ở App level, không nest rối
- ⚠️ `HomePage.tsx` và `ImportsPage.tsx` có chức năng gần giống nhau (cùng dùng AccountsTable), nhưng đây là thiết kế có chủ ý (Home = dashboard overview, Imports = quản lý chi tiết)

### 2.2 Data Flow

```
Firestore onSnapshot
      ↓
ImportDataContext  ──→  StatsCards, AccountsTable, PerformanceScoreTable
      ↓
useAllEngagement  ──→  InsightsPanel, SentimentChart, AI Summary
      ↓
useStats          ──→  StatsCards delta comparison
```

**Nhận xét:**
- ✅ Real-time sync qua `onSnapshot` — không cần polling hay manual reload
- ✅ Shared context tránh double-fetch từ nhiều component
- ✅ Cache layer (`queryCache`) cho các query không cần real-time
- ✅ `effectiveFilter` dùng `useMemo` với primitive dependencies — tránh re-render không cần thiết

### 2.3 Import Flow

```
ZIP file → JSZip parse → decodeFacebookObject (UTF-8 fix)
         → computePreviewCounts → duplicate detection (onSnapshot)
         → Preview table (editable name, mode toggle append/replace)
         → handleConfirm → [replace: deleteImport] → createImport
         → chunk upload (700 cmt / 2000 rxn) → finalizeImport
```

**Nhận xét:**
- ✅ Batch import nhiều ZIP cùng lúc
- ✅ Re-import detection với mode toggle ghi đè / thêm mới
- ✅ Chunk upload progress % chính xác (pre-computed total chunks)
- ✅ Nested ZIP support, __MACOSX filter, UTF-8 auto-decode
- ✅ Browser notification khi import hoàn tất

---

## 3. Chất lượng Code

### 3.1 TypeScript

| Tiêu chí | Trạng thái |
|---|---|
| `strict: true` | ✅ Bật |
| `noUnusedLocals/Parameters` | ✅ Bật |
| `as any` casts | ✅ 0 instances |
| `@ts-ignore` | ✅ 0 instances |
| Runtime type guards | ✅ Có (`src/types/guards.ts`) |
| Generic function signatures | ✅ Dùng đúng chỗ |

Toàn bộ codebase `tsc -b` không có lỗi. Không có `as any` hay `@ts-ignore` nào. Đây là tiêu chuẩn cao so với project React thực tế.

### 3.2 Pure Functions

| Module | Pure functions |
|---|---|
| `src/utils/importUtils.ts` | `computeTotalChunks`, `detectModeConflicts`, `normalizeAccountName`, `buildImportSummaryLabel` |
| `src/utils/sentiment.ts` | `scoreSentiment`, `classifySentiment` |
| `src/hooks/usePerformanceScore.ts` | `computePerformanceScores`, `scoreToGrade` |
| `src/hooks/useInsights.ts` | `computeInsights` |
| `src/components/CommentsPage.tsx` | `buildCommentExportRows` |

Pure functions được tách ra đúng cách, giúp unit test dễ dàng mà không cần mock.

### 3.3 Component Design

- ✅ Components nhỏ, single responsibility (AiSummaryPanel, PerformanceScoreTable, DatePresets, WelcomeEmptyState...)
- ✅ Loading / error / empty states đầy đủ cho mọi component quan trọng
- ✅ `ErrorBoundary` bọc tất cả chart sections (inline fallback, Sentry report)
- ✅ `forwardRef` + `useImperativeHandle` cho ImportZip (clean API)
- ⚠️ `CommentsPage.tsx` (~690 dòng) và `ImportFolder.tsx` (~810 dòng) khá lớn — có thể tách thêm sub-components nhưng logic hiện tại vẫn dễ theo dõi

### 3.4 Code Consistency

- ✅ Naming nhất quán: `useXxx` hooks, `Xxx.tsx` components, `xxxService.ts` services
- ✅ Comments tiếng Anh trong code, UI text tiếng Việt — thống nhất xuyên suốt
- ✅ Section markers (`/* === SECTION === */`) trong file dài
- ✅ JSDoc cho tất cả exported functions
- ✅ Ant Design v6 API dùng đúng (`styles={{ body: ... }}` thay vì deprecated `bodyStyle`)

---

## 4. Test Coverage

### 4.1 Tổng quan

```
24 test files | 274 tests | 100% pass | ~0 flaky
```

| Loại | Files | Tests |
|---|---|---|
| Pure functions (utils/hooks) | 8 | ~120 |
| Service layer (Firebase mock) | 4 | ~35 |
| React components (RTL) | 5 | ~40 |
| Integration (import flow) | 2 | ~25 |
| Other (encoding, cache, notif...) | 5 | ~54 |

### 4.2 Điểm mạnh

- ✅ Timezone-independent test timestamps (dùng `d.setHours(localHour)` thay vì UTC)
- ✅ Firebase mocks đúng cách với `vi.mock('firebase/functions')`
- ✅ Grade threshold tests chính xác (A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, F < 35)
- ✅ Edge cases: divide-by-zero, empty arrays, null/undefined inputs
- ✅ Component tests kiểm tra cả click handlers và render conditions

### 4.3 Điểm thiếu

- ⚠️ Không có tests cho Pages (HomePage, AnalyticsPage...) — phức tạp do nhiều context dependencies
- ⚠️ E2E tests (Playwright) được setup nhưng chưa có test cases thực tế
- ⚠️ Coverage % chưa đo (cần `npm run test:coverage`)

---

## 5. Bảo mật

### 5.1 Firestore Security Rules

```
allowedAccounts:
  read  → isAuthenticated()        ✅ (cần để login flow)
  write → isAdmin() + validation   ✅

imports:
  read   → isAllowedUser()         ✅ (whitelist only)
  create → isAdmin() + validation  ✅
  update → isAdmin() + validation  ✅
  delete → isAdmin()               ✅

commentChunks / reactionChunks:
  read   → isAllowedUser()         ✅
  write  → isAdmin()               ✅

Catch-all deny:
  match /{document=**} → false     ✅
```

**Data validation trong Rules:**
- `isValidImportCreate()`: kiểm tra `totalFiles` (int ≥ 0), `status == "processing"`
- `isValidImportUpdate()`: kiểm tra `accountName` (string > 0), counts (int ≥ 0)
- `isValidAccountData()`: kiểm tra `role in [0, 1]`, email/displayName là string

### 5.2 API Key Management

- ✅ `ANTHROPIC_API_KEY` chỉ tồn tại trong Firebase Secret Manager
- ✅ Frontend không có credential nào nhạy cảm
- ✅ `VITE_FIREBASE_*` là public config — an toàn khi để client (bảo vệ bằng Rules)
- ✅ `.env` trong `.gitignore`

### 5.3 Auth Flow

- ✅ Google OAuth qua Firebase Authentication
- ✅ Whitelist check: mỗi lần login đều verify UID trong `allowedAccounts`
- ✅ Role check: `isAdmin()` dùng `get()` trên server Rules, không trust client
- ✅ `RequireAuth` HOC bảo vệ tất cả routes

### 5.4 Điểm cần chú ý

- ⚠️ Chưa có rate limiting trong Cloud Functions (có thể thêm với `runWith({ maxInstances: 5 })`)
- ⚠️ Firebase App Check chưa được kích hoạt (bảo vệ khỏi abuse API quota)

---

## 6. Hiệu năng

### 6.1 Bundle Size

```
Main bundle:  3,335 kB raw | 1,058 kB gzip
Chart chunks: 2.5 – 3.9 kB mỗi chart (lazy loaded)
CSS:          17 kB
```

**Nhận xét:**
- ✅ Tất cả 6 charts (Timeline, Pie, Heatmap, TopCommenters, Sentiment, Keyword) được lazy load qua `React.lazy` + `Suspense`
- ⚠️ Main bundle 1MB gzip khá lớn — phần lớn do Ant Design (không thể tree-shake hoàn toàn), ECharts core, và Firebase SDK
- 💡 Cải thiện: dùng `antd` modular import hoặc chuyển sang lighter component library cho các phần đơn giản

### 6.2 Firestore Reads

- ✅ Chunk-based reads: comments (700/chunk), reactions (2000/chunk) — tránh document size limit
- ✅ Single `onSnapshot` listener cho imports list — không duplicate listeners
- ✅ `queryCache` với TTL 30s cho `getAccountNames` — tránh re-fetch khi nhiều component mount
- ✅ `useAllEngagement` dùng `Promise.all` để fetch chunks song song
- ⚠️ Không có pagination: load toàn bộ imports vào memory. Với >500 imports có thể chậm

### 6.3 Render Performance

- ✅ `useMemo` cho `effectiveFilter` (primitive deps)
- ✅ `useCallback` cho handlers được truyền vào children
- ✅ `React.memo` chưa được dùng — có thể cần cho `StatsCards` và `AccountsTable`
- ✅ Virtual scroll (`scroll={{ y: 400 }}`) trong các Table lớn

### 6.4 PWA

- ✅ Service Worker với Workbox (GenerateSW mode)
- ✅ Assets cached: js, css, html, svg, png, woff2
- ✅ Google Fonts: CacheFirst, TTL 365 ngày
- ✅ Max cache size: 4MB
- ⚠️ Firestore data không offline (yêu cầu thêm `enableIndexedDbPersistence`)

---

## 7. UX / Giao diện

### 7.1 Design System

- ✅ Supabase-inspired: 1 màu sắc chính (#3ecf8e), còn lại monochrome
- ✅ Không có random gradients, glassmorphism, hay AI-generic aesthetics
- ✅ Design tokens nhất quán: borderRadius 6/12, spacing 16/20/24
- ✅ Dark/Light mode qua `ThemeContext` + Ant Design algorithm switch
- ✅ Typography: Inter font, letter-spacing chặt chẽ theo DESIGN.md

### 7.2 States

| State | Coverage |
|---|---|
| Loading | ✅ Skeleton, Spin, LoadingOverlay |
| Empty | ✅ WelcomeEmptyState (HomePage), Empty component (CommentsPage) |
| Error | ✅ ErrorBoundary (inline + full-page), message.error |
| Success | ✅ message.success + browser notification |
| Disabled | ✅ Buttons disabled khi chưa đủ điều kiện |

### 7.3 Accessibility

- ✅ `aria-label` cho Select và DatePicker
- ✅ `aria-controls` patch cho Ant Design combobox
- ✅ Semantic HTML trong layouts
- ⚠️ Color contrast một số text `#8a8a8a` trên `#ffffff` = 3.5:1 (chưa đạt AA 4.5:1)
- ⚠️ Keyboard navigation trong custom table actions chưa kiểm tra đầy đủ

### 7.4 Responsive

- ✅ Sidebar collapse ở 900px với hamburger menu
- ✅ Topbar wrap ở 600px
- ✅ Charts responsive theo container width (ECharts)
- ✅ Table với `scroll={{ x: ... }}` tránh layout vỡ
- ⚠️ Analytics topBar có nhiều buttons — có thể overflow trên mobile nhỏ (<375px)
- ⚠️ Import modal 740px — trên điện thoại cần scroll

---

## 8. Tính năng đã hoàn thiện

| Ngày | Tính năng | Trạng thái |
|---|---|---|
| Day 1–2 | Import ZIP, Firestore schema, Auth | ✅ |
| Day 3 | AccountsTable, CommentDetails, ReactionDetails | ✅ |
| Day 4 | EngagementChart (ECharts), StatsCards | ✅ |
| Day 5 | AdminPage CRUD, Role-based access | ✅ |
| Day 6 | Dark/Light mode, KeywordFreqChart | ✅ |
| Day 7 | DatePresets, CSV export, Bulk delete | ✅ |
| Day 8 | Sentry, Playwright E2E setup | ✅ |
| Day 9 | Cloud Functions AI sentiment, LandingPage | ✅ |
| Day 10 | useInsights, AI analysis panel, JSON export | ✅ |
| Day 11 | Excel export, AI per-row badges, onSnapshot | ✅ |
| Day 12 | AI Comment Summarizer, Performance Score | ✅ |
| Day 13 | Re-import detection, chunk progress | ✅ |
| Day 14 | Firestore Rules hardening, Type Guards | ✅ |
| Day 15 | Onboarding empty state, README rewrite | ✅ |

**15/15 days — 100% hoàn thành**

---

## 9. Điểm cần cải thiện (nếu tiếp tục)

### P1 — Quan trọng
1. **Firestore pagination**: Dùng `startAfter` cursor để tránh load toàn bộ imports vào memory khi data set lớn
2. **E2E test cases**: Playwright setup đã có nhưng chưa có test nào thực tế chạy được
3. **Bundle splitting**: Tách Ant Design icons ra thành dynamic import để giảm main bundle

### P2 — Nên làm
4. **Firebase App Check**: Bảo vệ API quota khỏi abuse
5. **Cloud Functions rate limiting**: `runWith({ maxInstances: 3 })` cho AI functions
6. **Offline Firestore**: `enableIndexedDbPersistence()` cho PWA offline-first
7. **React.memo**: Áp dụng cho `StatsCards` và `AccountsTable` để giảm re-render

### P3 — Nice-to-have
8. **Test coverage report**: Chạy `npm run test:coverage` và đặt threshold 70%
9. **Storybook**: Document design system components
10. **Color contrast fix**: Cải thiện `#8a8a8a` → `#6b6b6b` cho text phụ (đạt AA)

---

## 10. Kết luận

### Điểm số

| Hạng mục | Điểm | Ghi chú |
|---|---|---|
| Kiến trúc | **9/10** | Phân lớp rõ, service layer tốt |
| Code Quality | **9/10** | TypeScript strict, zero `any`, pure functions |
| Test Coverage | **8/10** | 274 tests tốt, thiếu page tests và E2E |
| Bảo mật | **9/10** | Rules chặt, AI key server-side; thiếu App Check |
| Hiệu năng | **7/10** | Bundle lớn, thiếu pagination |
| UX / Design | **8/10** | Nhất quán, có states đầy đủ; mobile cần tinh chỉnh |
| Documentation | **9/10** | README, JSDoc, DESIGN.md đầy đủ |
| **Tổng** | **8.4/10** | **Cấp độ A — Production-ready for internal use** |

### Nhận xét chung

Đây là một dự án được thực hiện nghiêm túc với tiêu chuẩn code cao hiếm thấy trong môi trường học thuật. Những điểm nổi bật:

- **Kiến trúc thực tế**: Không phải "CRUD demo" — có real-time sync, AI integration, chunked uploads, role-based access đúng chuẩn production
- **TypeScript discipline**: Zero `any`, strict mode, runtime type guards — nhiều project thực tế không đạt được mức này
- **Security mindset**: API key không bao giờ ra client, Firestore Rules validate data, không trust client-side role check
- **Test-first culture**: 274 tests viết cẩn thận với edge cases, timezone-safe, proper mocking — không phải test cho có
- **Design consistency**: Supabase-inspired, 1 accent color, không có "AI-generated aesthetic" trapezoidal patterns

Nếu mục tiêu là hoàn thiện hơn nữa, P1 items (pagination + E2E) sẽ đưa project lên mức production-grade thực sự cho data set lớn.
