<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.9_strict-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Ant_Design-6-0170FE?logo=antdesign&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Tests-274_passed-3ecf8e" />
  <img src="https://img.shields.io/badge/PWA-enabled-5A0FC8?logo=pwa&logoColor=white" />
</p>

<h1 align="center">📊 FB Pulse Tracker</h1>

<p align="center">
  Ứng dụng web nội bộ phân tích tương tác Facebook — bình luận, cảm xúc, xu hướng theo thời gian.<br/>
  Dữ liệu từ file ZIP của Facebook · Lưu trữ Firebase Firestore · Phân tích AI bằng Gemini.
</p>

---

## Tính năng

### Import & Quản lý dữ liệu
- **Batch import ZIP**: Chọn nhiều file ZIP cùng lúc, xem preview trước khi upload
- **Re-import detection**: Phát hiện tài khoản trùng lặp, toggle chế độ **Thêm mới** hoặc **Ghi đè**
- **Chunk upload progress**: Thanh tiến trình % chính xác theo từng chunk Firestore
- **Real-time sync**: `onSnapshot` — cập nhật tức thì khi có import mới từ tab/thiết bị khác
- **Excel / CSV / JSON export**: Xuất bình luận với cột sentiment AI

### Dashboard & Phân tích
- **StatsCards**: Tổng lượt thích, bình luận, imports — có delta so sánh kỳ trước
- **EngagementChart**: Biểu đồ bar + line kết hợp theo tài khoản (ECharts)
- **Date Presets**: Nhanh — Hôm nay, 7 ngày, 30 ngày, Tháng này, Năm nay
- **Bộ lọc**: Khoảng thời gian + nhiều tài khoản cùng lúc

### Analytics sâu
- **Timeline Chart**: Xu hướng engagement theo ngày/tuần
- **Pie Chart**: Phân bổ loại cảm xúc (Like / Love / Haha / Sad / Wow / Care)
- **Activity Heatmap**: Mật độ tương tác theo giờ × ngày trong tuần
- **Top Commenters**: Ranking người dùng tương tác nhiều nhất
- **Keyword Frequency**: Từ khóa xuất hiện nhiều nhất trong bình luận
- **Auto Insights**: 7 insight tự động — peak hour, top commenter, spike detection, v.v.

### AI (Gemini · Cloud Functions)
- **AI Sentiment**: Phân loại cảm xúc từng bình luận (positive / neutral / negative) + score + keywords
- **AI Summary**: Tóm tắt toàn bộ bình luận thành highlights, action items, keywords, sentiment overview
- **Performance Score**: Điểm 0–100 + xếp hạng A–F cho từng import (engagement rate + volume)

### Quản trị
- **AdminPage**: CRUD tài khoản whitelist, đổi role Read-only ↔ Admin
- **Firestore Rules**: `isAllowedUser()` cho reads, `isAdmin()` cho writes + data validation
- **Onboarding**: WelcomeEmptyState hướng dẫn 3 bước khi chưa có dữ liệu

### Trải nghiệm người dùng
- **Dark / Light mode**: Toggle toàn ứng dụng
- **PWA**: Service Worker, offline assets, installable
- **Responsive**: Sidebar collapse ở 900px, wrap ở 600px
- **Error boundaries**: Sentry integration, inline fallback per chart section
- **Runtime type guards**: `isImportRecord`, `isCommentItem`, `isReactionItem`, v.v.

---

## Công nghệ

| Công nghệ | Ver | Vai trò |
|---|---|---|
| React | 19 | UI framework (Concurrent mode) |
| TypeScript | 5.9 | strict, noUnusedLocals, zero `any` |
| Vite | 7 | Build + HMR + code splitting |
| Ant Design | 6 | UI components (Supabase-inspired tokens) |
| Firebase | 12 | Auth (Google) + Firestore + Cloud Functions |
| ECharts | 6 | Interactive charts (lazy loaded) |
| Google Generative AI SDK | 0.21 | Gemini — server-side only (Cloud Functions) |
| XLSX / SheetJS | 0.18 | Excel export |
| JSZip | 3.10 | Đọc + giải nén ZIP (nested support) |
| Day.js | 1.11 | Date handling |
| Sass | 1.97 | CSS + responsive breakpoints |
| vite-plugin-pwa | — | PWA + Workbox |
| Sentry | 10 | Error monitoring |
| Vitest | — | 24 files / 274 tests |
| Playwright | — | E2E test setup |

---

## Cấu trúc dự án

```
fb-pulse-tracker/
├── functions/                        # Firebase Cloud Functions
│   └── src/
│       └── index.ts                  # analyzeSentiment + summarizeComments
│                                       + extractSeoKeywords + scoreLeads
│                                       + classifyIntent + generateSeedingIdeas
│                                       (Gemini — GEMINI_API_KEY server-side)
│
├── src/
│   ├── components/
│   │   ├── charts/                   # 6 chart components (lazy loaded)
│   │   │   ├── ActivityHeatmap.tsx
│   │   │   ├── KeywordFreqChart.tsx
│   │   │   ├── ReactionPieChart.tsx
│   │   │   ├── SentimentChart.tsx
│   │   │   ├── TimelineChart.tsx
│   │   │   └── TopCommentersChart.tsx
│   │   ├── AccountsTable.tsx         # Bảng import + bulk delete
│   │   ├── AiSummaryPanel.tsx        # Panel tóm tắt AI (loading/error/result)
│   │   ├── CommentDetails.tsx        # Modal xem bình luận chi tiết
│   │   ├── DatePresets.tsx           # Nút preset khoảng thời gian
│   │   ├── EngagementChart.tsx       # Bar+line chart tổng quan
│   │   ├── ErrorBoundary.tsx         # React error boundary + Sentry
│   │   ├── exportAllImportsToCSV.ts  # Export CSV
│   │   ├── exportAllImportsToExcel.ts # Export Excel (.xlsx)
│   │   ├── exportAllImportsToJSON.ts # Export JSON
│   │   ├── ImportFolder.tsx          # Modal import ZIP (batch, re-import, progress)
│   │   ├── InsightsPanel.tsx         # Auto insights (7 loại)
│   │   ├── LoadingOverlay.tsx        # Global loading overlay
│   │   ├── PerformanceScoreTable.tsx # Bảng điểm A–F + score bar
│   │   ├── PrintReportButton.tsx     # In báo cáo (window.print)
│   │   ├── ReactionDetails.tsx       # Modal xem cảm xúc chi tiết
│   │   ├── StatsCards.tsx            # 4 thẻ thống kê + delta
│   │   └── WelcomeEmptyState.tsx     # Onboarding khi chưa có dữ liệu
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx           # Google Auth, role, whitelist check
│   │   ├── ImportDataContext.tsx     # onSnapshot real-time cache
│   │   ├── LoadingContext.tsx        # Global loading state
│   │   └── ThemeContext.tsx          # Dark / Light mode
│   │
│   ├── hooks/
│   │   ├── useAllComments.tsx        # Load tất cả commentChunks
│   │   ├── useAllEngagement.tsx      # Comments + Reactions song song
│   │   ├── useInsights.ts            # computeInsights() pure + hook
│   │   ├── usePerformanceScore.ts    # computePerformanceScores() + grade
│   │   ├── useRealtimeImports.tsx    # Real-time banner khi có import mới
│   │   └── useStats.tsx              # Tính toán thống kê tổng hợp
│   │
│   ├── layouts/
│   │   └── AppLayout.tsx             # Sidebar nav + topbar + content
│   │
│   ├── pages/
│   │   ├── AdminPage.tsx             # Quản lý tài khoản whitelist
│   │   ├── AnalyticsPage.tsx         # Charts sâu + AI Summary
│   │   ├── CommentsPage.tsx          # Danh sách bình luận + AI badge + export
│   │   ├── HomePage.tsx              # Dashboard tổng quan (hoặc WelcomeEmptyState)
│   │   ├── ImportsPage.tsx           # Quản lý imports + real-time banner
│   │   ├── LandingPage.tsx           # Trang giới thiệu (unauthenticated)
│   │   ├── LoginPage.tsx             # Đăng nhập Google
│   │   └── SettingsPage.tsx          # Cài đặt + thông tin ứng dụng
│   │
│   ├── service/
│   │   ├── accountService.ts         # CRUD allowedAccounts
│   │   ├── aiSentimentService.ts     # Gọi analyzeSentiment Cloud Function
│   │   ├── aiSummaryService.ts       # Gọi summarizeComments Cloud Function
│   │   ├── aiExtendedService.ts      # SEO keywords, lead scoring, intent, seeding ideas
│   │   ├── authService.ts            # Kiểm tra whitelist khi login
│   │   ├── firebase.ts               # Firebase SDK init (app, db, auth)
│   │   ├── importService.ts          # CRUD imports + findByAccountName
│   │   ├── queryCache.ts             # TTL in-memory cache
│   │   └── sentry.ts                 # Sentry init
│   │
│   ├── test/                         # 24 test files (Vitest + RTL)
│   │
│   ├── types/
│   │   ├── index.ts                  # ImportRecord, CommentItem, ReactionItem...
│   │   └── guards.ts                 # Runtime type guards + array filters
│   │
│   └── utils/
│       ├── array.ts                  # chunkArray
│       ├── encoding.ts               # Facebook UTF-8 mojibake decode
│       ├── importUtils.ts            # computeTotalChunks, detectModeConflicts...
│       ├── notification.ts           # Browser notification helpers
│       └── sentiment.ts             # Rule-based sentiment scoring
│
├── firestore.rules                   # isAllowedUser (read) + isAdmin (write)
├── firebase.json                     # Cloud Functions + Firestore + Emulators
├── DESIGN.md                         # Design system (Supabase-inspired)
├── PROJECT_EVALUATION.md             # Đánh giá toàn diện dự án
├── .env                              # VITE_FIREBASE_* (không commit)
├── vercel.json                       # SPA rewrite
└── vite.config.ts                    # Vite + PWA + path aliases
```

---

## Firestore Schema

### `allowedAccounts/{uid}`
```
email:       string   — Gmail người dùng
displayName: string   — Tên hiển thị
role:        0 | 1   — 0 = Read-only, 1 = Admin
```

### `imports/{id}`
```
accountName:    string     — Tên tài khoản Facebook
commentsCount:  number     — Tổng bình luận
reactionsCount: number     — Tổng cảm xúc
totalFiles:     number     — Số file JSON đã import
importedAt:     Timestamp  — Server timestamp
status:         "processing" | "completed"
```

### `imports/{id}/commentChunks/{cid}` — tối đa **700 items/chunk**
```
index: number     — Chỉ số chunk
count: number     — Số bình luận trong chunk
items: array      — [{ authorName, content, commentTime, title, group }]
```

### `imports/{id}/reactionChunks/{cid}` — tối đa **2000 items/chunk**
```
index: number     — Chỉ số chunk
count: number     — Số cảm xúc trong chunk
items: array      — [{ reaction, linkPost, commentAuthorName, ownerName, reactionTime, fbid }]
```

---

## Cài đặt & chạy

### Yêu cầu
- Node.js ≥ 18 · npm ≥ 9

### 1. Tạo Firebase Project

1. Truy cập [Firebase Console](https://console.firebase.google.com/) → New project.
2. **Authentication** → Sign-in method → Bật **Google**.
3. **Firestore Database** → Create (production mode — rules đã có sẵn trong `firestore.rules`).
4. Tạo collection `allowedAccounts`, thêm document đầu tiên với **document ID = UID của bạn**:
   ```
   email:       your@gmail.com
   displayName: Your Name
   role:        1
   ```
5. **Project Settings → Web App** → Register → copy `firebaseConfig`.

### 2. Biến môi trường

Tạo file `.env` tại thư mục gốc:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

> ⚠️ `.env` đã có trong `.gitignore` — không bao giờ commit lên repository.

### 3. Cài đặt và chạy

```bash
git clone https://github.com/TrungHuy242/FB-Pulse-Tracker.git
cd FB-Pulse-Tracker
npm install
npm run dev
# → http://localhost:5173
```

### 4. Cloud Functions AI (tuỳ chọn)

AI Sentiment, AI Summary và các tính năng AI mở rộng yêu cầu deploy Cloud Functions với **Gemini API**:

```bash
# Cài đặt Firebase CLI
npm install -g firebase-tools
firebase login

# Set Gemini API key AN TOÀN — CHỈ trên server, không bao giờ vào frontend bundle
firebase functions:secrets:set GEMINI_API_KEY
# → Nhập key từ https://aistudio.google.com/app/apikey

# (Tuỳ chọn) Đổi model — mặc định là gemini-2.0-flash
firebase functions:secrets:set GEMINI_MODEL
# → Nhập: gemini-2.0-flash  |  gemini-1.5-flash  |  gemini-2.5-flash  | ...

# Cài dependencies và deploy
cd functions && npm install && cd ..
firebase deploy --only functions
```

> **Biến môi trường Cloud Functions:**
> | Biến | Bắt buộc | Mô tả |
> |------|----------|-------|
> | `GEMINI_API_KEY` | ✓ | Google AI Studio API key |
> | `GEMINI_MODEL` | — | Tên model (mặc định: `gemini-2.0-flash`) |

> Nếu không deploy Cloud Functions, AI Sentiment tự động fallback sang rule-based. Các tính năng khác trả về empty result.

**Cloud Functions đã có:**
- `analyzeSentiment` — Phân tích cảm xúc (tối đa 50 bình luận)
- `summarizeComments` — Tóm tắt tổng quan (tối đa 300 bình luận)
- `extractSeoKeywords` — Trích xuất từ khóa SEO (tối đa 500 bình luận)
- `scoreLeads` — Chấm điểm leads tiềm năng (tối đa 200 bình luận)
- `classifyIntent` — Phân loại ý định (tối đa 100 bình luận)
- `generateSeedingIdeas` — Ý tưởng nội dung seeding (tối đa 500 bình luận)

### 5. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

---

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Dev server với HMR |
| `npm run build` | TypeScript check + Vite build |
| `npm run preview` | Preview bản build production |
| `npm run lint` | ESLint |
| `npm test` | Chạy toàn bộ unit tests (274 tests) |
| `npm run test:watch` | Tests ở chế độ watch |
| `npm run test:coverage` | Tests + HTML coverage report |
| `npm run test:e2e` | Playwright E2E tests |

---

## Routes

| URL | Trang | Quyền | Mô tả |
|---|---|---|---|
| `/` | LandingPage → HomePage | Công khai / Auth | Unauthenticated: giới thiệu; Authenticated: dashboard |
| `/login` | LoginPage | Công khai | Đăng nhập Google |
| `/imports` | ImportsPage | Auth | Danh sách imports + real-time banner |
| `/analytics` | AnalyticsPage | Auth | Charts sâu + AI Summary |
| `/comments` | CommentsPage | Auth | Bình luận + AI badge + export |
| `/settings` | SettingsPage | Auth | Cài đặt hiển thị + thông tin app |
| `/seeding` | SeedingPage | Auth | Quản lý chiến dịch, profiles và thư viện seeding |
| `/admin` | AdminPage | Admin | Quản lý tài khoản whitelist |

---

## Bảo mật

| Lớp bảo vệ | Cách triển khai |
|---|---|
| **Authentication** | Firebase Google OAuth + whitelist UID |
| **Authorization** | Firestore Rules: `isAllowedUser` (read), `isAdmin` (write) |
| **Data validation** | Rules validate field types + value ranges trước khi ghi |
| **AI API key** | Firebase Secret Manager — server-side only, không có trong bundle |
| **Frontend config** | `VITE_FIREBASE_*` là public Firebase config (bảo vệ bởi Rules, không phải secret) |
| **Role check** | Server-side trong Rules (`get(allowedAccounts/uid).role`) — không trust client |

---

## Cấu trúc file ZIP hỗ trợ

```
your_facebook_data.zip
└── AccountName/
    ├── comments/
    │   ├── comments_v2.json           # comments_v2 hoặc group_comments_v2
    │   └── ...
    └── likes_and_reactions/
        ├── posts_and_comments.json    # mảng object với label_values
        └── ...
```

- Hỗ trợ **ZIP lồng nhau** (nested ZIP)
- Tự động **decode UTF-8 mojibake** cho tiếng Việt từ Facebook
- Bỏ qua thư mục `__MACOSX`
- Batch import: chọn nhiều file ZIP cùng lúc

---

## Deploy lên Vercel

1. Push code lên GitHub.
2. Kết nối repository với [Vercel](https://vercel.com/).
3. Thêm các biến môi trường `VITE_FIREBASE_*` trong **Project → Settings → Environment Variables**.
4. Deploy tự động khi push vào `main`.

File `vercel.json` đã cấu hình SPA rewrite — không cần thêm gì.

---

## License

Dự án nội bộ — không chia sẻ công khai khi chưa được phép.
