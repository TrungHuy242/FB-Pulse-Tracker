<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Ant_Design-6-0170FE?logo=antdesign&logoColor=white" alt="Ant Design" />
  <img src="https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Tests-269%20passed-3ecf8e?logo=vitest&logoColor=white" alt="269 tests" />
</p>

# 📊 FB Pulse Tracker

**FB Pulse Tracker** là ứng dụng web nội bộ theo dõi và phân tích chỉ số tương tác (engagement) trên Facebook — bình luận, cảm xúc, và xu hướng theo thời gian. Dữ liệu được nhập từ file ZIP xuất bởi Facebook, lưu trữ trên Firebase Firestore, và phân tích bằng AI (Claude Haiku qua Cloud Functions).

---

## ✨ Tính năng

### Core
| Tính năng | Mô tả |
|---|---|
| 🔐 **Xác thực Google** | Đăng nhập Google, kiểm tra whitelist quyền truy cập theo UID |
| 📦 **Import ZIP** | Batch import nhiều file ZIP, re-import với chế độ append/replace, phát hiện trùng lặp |
| 🔄 **Real-time sync** | `onSnapshot` Firestore — cập nhật tức thì không cần reload |
| 📊 **Dashboard** | Biểu đồ engagement, thẻ thống kê có delta so sánh, bộ lọc nâng cao |
| 🗂️ **Date Presets** | Nhanh: Hôm nay, 7 ngày, 30 ngày, Tháng này, Năm nay |

### Phân tích
| Tính năng | Mô tả |
|---|---|
| 📈 **Analytics Page** | Timeline, Pie chart, Heatmap, Top Commenters, Keyword Frequency |
| 🧠 **AI Sentiment** | Phân tích cảm xúc bình luận (Claude Haiku) theo từng batch, badge per-row |
| 💬 **AI Summary** | Tóm tắt toàn bộ bình luận thành highlights + keywords + action items |
| 🏆 **Performance Score** | Điểm 0–100 + xếp hạng A–F cho từng import (engagement rate, volume) |
| 🔍 **Auto Insights** | 7 loại insight tự động: peak hour, top commenter, spike, v.v. |

### Quản lý dữ liệu
| Tính năng | Mô tả |
|---|---|
| 💬 **Comments Page** | Xem chi tiết bình luận, tìm kiếm, lọc theo cảm xúc AI, xuất CSV/JSON/Excel |
| ❤️ **Reactions Page** | Danh sách cảm xúc (Like/Love/Haha/Sad/Wow/Care) với icon |
| 🗑️ **Bulk delete** | Xóa nhiều import cùng lúc (admin only) |
| 📥 **Export** | CSV, JSON, Excel (.xlsx) với AI sentiment column |

### Hạ tầng
| Tính năng | Mô tả |
|---|---|
| 🔒 **Firestore Rules** | Tách biệt read (isAllowedUser) / write (isAdmin), validation dữ liệu |
| 🛡️ **Type Guards** | Runtime type guards cho tất cả entity (ImportRecord, CommentItem, v.v.) |
| 📱 **PWA** | Offline support qua Service Worker (vite-plugin-pwa + Workbox) |
| 📊 **Sentry** | Error monitoring, performance tracking (production) |
| 🎭 **Playwright E2E** | End-to-end test suite |
| ⚡ **Vitest** | 23 test files, 269 tests pass |

---

## 🛠️ Công nghệ

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| [React](https://react.dev/) | 19 | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | 5.9 strict | Ngôn ngữ (strict mode, noUnusedLocals) |
| [Vite](https://vite.dev/) | 7 | Build tool + HMR |
| [Ant Design](https://ant.design/) | 6 | UI components |
| [Firebase](https://firebase.google.com/) | 12 | Auth + Firestore + Cloud Functions |
| [ECharts](https://echarts.apache.org/) | 6 | Interactive charts |
| [Anthropic SDK](https://docs.anthropic.com/) | — | Claude Haiku (Cloud Functions only) |
| [XLSX / SheetJS](https://sheetjs.com/) | 0.18 | Excel export |
| [JSZip](https://stuk.github.io/jszip/) | 3.10 | Đọc/giải nén ZIP |
| [Day.js](https://day.js.org/) | 1.11 | Date handling |
| [Sass](https://sass-lang.com/) | 1.97 | CSS preprocessor |
| [Vitest](https://vitest.dev/) | — | Unit tests |
| [Playwright](https://playwright.dev/) | — | E2E tests |
| [Sentry](https://sentry.io/) | 10 | Error tracking |

---

## 📁 Cấu trúc dự án

```
fb-pulse-tracker/
├── functions/                     # Firebase Cloud Functions
│   └── src/index.ts               # analyzeSentiment + summarizeComments
│                                    (Claude Haiku, server-side only)
├── public/                        # Static assets
├── src/
│   ├── components/                # UI components
│   │   ├── charts/                # ECharts: Timeline, Pie, Heatmap,
│   │   │                            TopCommenters, Sentiment, KeywordFreq
│   │   ├── AccountsTable.tsx      # Bảng import với bulk delete
│   │   ├── AiSummaryPanel.tsx     # Panel tóm tắt AI
│   │   ├── DatePresets.tsx        # Nút preset thời gian
│   │   ├── ErrorBoundary.tsx      # React error boundary (Sentry)
│   │   ├── ImportFolder.tsx       # Modal import ZIP + re-import detection
│   │   ├── InsightsPanel.tsx      # Auto insights panel
│   │   ├── PerformanceScoreTable.tsx  # Bảng điểm A–F
│   │   ├── PrintReportButton.tsx  # In báo cáo
│   │   ├── StatsCards.tsx         # 4 thẻ thống kê + delta
│   │   └── WelcomeEmptyState.tsx  # Onboarding khi chưa có dữ liệu
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Google Auth + role
│   │   ├── ImportDataContext.tsx  # Real-time onSnapshot cache
│   │   ├── LoadingContext.tsx     # Global loading overlay
│   │   └── ThemeContext.tsx       # Dark/Light mode
│   ├── hooks/
│   │   ├── useAllEngagement.ts    # Load comments + reactions
│   │   ├── useInsights.ts         # 7 loại auto insight
│   │   ├── usePerformanceScore.ts # Tính điểm A–F
│   │   └── useStats.ts            # Thống kê tổng hợp
│   ├── layouts/
│   │   └── AppLayout.tsx          # Sidebar + topbar layout
│   ├── pages/
│   │   ├── AdminPage.tsx          # Quản lý tài khoản
│   │   ├── AnalyticsPage.tsx      # Biểu đồ sâu + AI Summary
│   │   ├── CommentsPage.tsx       # Chi tiết bình luận + AI badge
│   │   ├── HomePage.tsx           # Dashboard tổng quan
│   │   ├── LandingPage.tsx        # Trang giới thiệu
│   │   ├── LoginPage.tsx          # Đăng nhập Google
│   │   ├── ReactionsPage.tsx      # Chi tiết cảm xúc
│   │   └── SettingsPage.tsx       # Cài đặt + thông tin ứng dụng
│   ├── service/
│   │   ├── aiSentimentService.ts  # Gọi analyzeSentiment Cloud Function
│   │   ├── aiSummaryService.ts    # Gọi summarizeComments Cloud Function
│   │   ├── firebase.ts            # Firebase SDK init
│   │   ├── importService.ts       # Firestore CRUD + findByAccountName
│   │   └── queryCache.ts          # TTL cache cho queries
│   ├── test/                      # 23 test files (Vitest)
│   ├── types/
│   │   ├── index.ts               # Core interfaces
│   │   └── guards.ts              # Runtime type guards
│   └── utils/
│       ├── array.ts               # chunkArray
│       ├── encoding.ts            # Facebook UTF-8 decode
│       ├── importUtils.ts         # computeTotalChunks, detectModeConflicts
│       ├── notification.ts        # Browser notifications
│       └── sentiment.ts           # Rule-based sentiment scoring
├── firestore.rules                # Security rules (isAllowedUser + isAdmin)
├── .env                           # Firebase config (không commit)
├── firebase.json                  # Cloud Functions + Firestore + Emulators
├── vercel.json                    # SPA rewrite cho Vercel
├── vite.config.ts                 # Vite + PWA + path aliases
└── package.json
```

---

## 🗄️ Cấu trúc Firestore

### `allowedAccounts/{uid}`
| Field | Type | Mô tả |
|---|---|---|
| `email` | string | Gmail người dùng |
| `displayName` | string | Tên hiển thị |
| `role` | 0 \| 1 | `1` = Admin, `0` = Read-only |

### `imports/{id}`
| Field | Type | Mô tả |
|---|---|---|
| `accountName` | string | Tên tài khoản Facebook |
| `commentsCount` | number | Tổng bình luận |
| `reactionsCount` | number | Tổng cảm xúc |
| `totalFiles` | number | Số file JSON đã import |
| `importedAt` | Timestamp | Server timestamp |
| `status` | "processing" \| "completed" | Trạng thái |

### `imports/{id}/commentChunks/{cid}` — tối đa 700 items/chunk
### `imports/{id}/reactionChunks/{cid}` — tối đa 2000 items/chunk

---

## 🚀 Cài đặt & chạy

### Yêu cầu
- Node.js ≥ 18, npm ≥ 9

### Bước 1 — Firebase Project

1. Vào [Firebase Console](https://console.firebase.google.com/), tạo project mới.
2. Bật **Authentication → Google**.
3. Tạo **Firestore Database** (production mode — rules đã có sẵn).
4. Tạo collection `allowedAccounts`, thêm document đầu tiên (dùng UID làm document ID):
   ```
   email: "your@gmail.com"
   displayName: "Your Name"
   role: 1
   ```
5. **Project Settings → Web App** → copy `firebaseConfig`.

### Bước 2 — Biến môi trường

Tạo `.env` tại thư mục gốc:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

> ⚠️ `.env` đã có trong `.gitignore` — không bao giờ commit.

### Bước 3 — AI (Cloud Functions — tuỳ chọn)

Để dùng tính năng AI Sentiment + AI Summary, cần deploy Cloud Functions:

```bash
cd functions
npm install
# Set API key — CHỈ trên server, không bao giờ để trong frontend
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions
```

### Bước 4 — Chạy

```bash
npm install
npm run dev        # http://localhost:5173
```

---

## 📋 Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Dev server với HMR |
| `npm run build` | TypeScript check + Vite build |
| `npm run preview` | Preview bản build |
| `npm run lint` | ESLint |
| `npm test` | Chạy toàn bộ unit tests (Vitest) |
| `npm run test:watch` | Tests ở chế độ watch |
| `npm run test:coverage` | Tests + coverage report |
| `npm run test:e2e` | Playwright E2E tests |

---

## 🗺️ Routes

| Đường dẫn | Trang | Quyền |
|---|---|---|
| `/landing` | Giới thiệu ứng dụng | Công khai |
| `/login` | Đăng nhập Google | Công khai |
| `/` | Dashboard tổng quan | Auth |
| `/analytics` | Biểu đồ sâu + AI | Auth |
| `/comments` | Chi tiết bình luận | Auth |
| `/reactions` | Chi tiết cảm xúc | Auth |
| `/settings` | Cài đặt ứng dụng | Auth |
| `/admin` | Quản lý tài khoản | Admin |

---

## 🔒 Bảo mật

- **Firestore Rules**: read yêu cầu `isAllowedUser()`, write yêu cầu `isAdmin()`
- **API key AI**: chỉ tồn tại trong Firebase Secret Manager (server-side)
- **Frontend**: không có credentials nhạy cảm, chỉ có `VITE_FIREBASE_*` (public config)
- **Role enforcement**: cả UI layer và Firestore Rules

---

## 🌐 Deploy

Cấu hình sẵn cho **Vercel** (file `vercel.json`):

1. Push lên GitHub.
2. Kết nối repo với [Vercel](https://vercel.com/).
3. Thêm `VITE_FIREBASE_*` vào Environment Variables.
4. Deploy tự động khi push.

---

## 📄 License

Dự án nội bộ — không chia sẻ công khai khi chưa được phép.
