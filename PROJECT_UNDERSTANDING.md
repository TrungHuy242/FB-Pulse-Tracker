# FB Pulse Tracker - Project Understanding Document

> Document này là tài liệu nền để tiếp tục phát triển mà không cần đọc lại toàn bộ codebase.
> Generated: 2026-06-19 | Confidence: 91%

---

## 1. Project Overview

### Tên dự án
**FB Pulse Tracker** - Nền tảng quản trị và phân tích dữ liệu Facebook nội bộ kết hợp với hệ thống Seeding Manager tự động hóa.

### Mục tiêu
- Import và phân tích dữ liệu bình luận/cảm xúc từ Facebook (ZIP files)
- Dùng AI (Gemini) để phân tích Sentiment và Intent của bình luận
- Tự động seeding (like/comment/share) trên Facebook qua GPM Login
- Quản lý campaigns, tasks, profiles GPM, và thư viện bình luận mẫu

### MVP Features
1. **Authentication** - Firebase Auth với whitelist nội bộ
2. **Import Facebook ZIP** - Upload, parse, chunk, lưu lên Firestore
3. **AI Analysis** - Sentiment, Intent, SEO keywords, Lead scoring, Seeding ideas
4. **Seeding Manager** - Campaign, Task, Profile management
5. **GPM Integration** - Browser automation qua Puppeteer

### Người dùng mục tiêu
- Nhóm marketing nội bộ (seeding campaigns)
- Admin quản trị hệ thống

---

## 2. Architecture

### 3-Thành Phần Core

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                            │
│   React 19 + Vite + TypeScript + Ant Design 6 + ECharts        │
│   Firebase Client SDK | Gemini AI Client | GPM Bridge HTTP API   │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       ┌───────────┐ ┌───────────┐ ┌───────────────────┐
       │ Firebase  │ │ Gemini API│ │ GPM Bridge        │
       │ Cloud     │ │ (Client) │ │ (localhost:3001)  │
       │ Firestore │ └───────────┘ └────────┬──────────┘
       │ + Auth    │                        │ node-fetch
       └───────────┘                        ▼
                                 ┌───────────────────┐
                                 │ GPM Login API    │
                                 │ (localhost:9495) │
                                 │ Chrome Profiles  │
                                 └─────────┬─────────┘
                                           │
                               puppeteer-core │
                                           ▼
                                 ┌───────────────────┐
                                 │ GPM Bridge Agent │
                                 │ Node.js Backend  │
                                 │ - Express       │
                                 │ - Puppeteer     │
                                 │ - Firebase Admin│
                                 │ - Firestore     │
                                 └─────────────────┘
```

### Ports
| Service | Port | Protocol |
|---------|------|----------|
| Frontend (Vite) | 5173 | HTTP |
| GPM Bridge Agent | 3001 | HTTP |
| GPM Login API | 9495 | HTTP |

---

## 3. Data Flow

### 3.1 Import Flow

```
[User upload ZIP]
       │
       ▼
[ImportFolder.tsx] ── JSZip parse
       │
       ├── Detect multi-profile (folder structure)
       ├── decodeFacebookObject() (encoding)
       ├── Build comments (comments_v2, group_comments_v2)
       ├── Build reactions (reaction items)
       │
       ▼
[Firestore]
  ├── imports/{id} ── metadata (accountName, counts, status)
  ├── imports/{id}/commentChunks/{id} ── comments (700 items/chunk)
  └── imports/{id}/reactionChunks/{id} ── reactions (2000 items/chunk)
```

### 3.2 AI Analysis Flow

```
[Trigger AI Analysis]
       │
       ▼
[aiSentimentService.ts] ── Rule-based (dictionary)
       │
[aiExtendedService.ts] ── Cloud Functions → Gemini
       │
       ▼ (fallback chain)
[aiClientFallback.ts] ── Client-side Gemini (VITE_GEMINI_API_KEY)
       │
       ▼
[importService.updateCommentsIntent()] ── Update Firestore
```

### 3.3 Seeding Automation Flow

```
[Admin creates Campaign + Tasks] ── status: "pending"
       │
       │ (Firestore onSnapshot)
       ▼
[GPM Bridge Agent]
       │
       ├── Update task → "running"
       ├── GpmClient.startProfile() → GPM API → Chrome opens
       ├── facebookScraper.ts → Puppeteer → Get FB info
       ├── taskRunner.ts → Puppeteer → Execute action
       │   ├── like ── click [aria-label="Thích"]
       │   ├── comment ── focus → type → Enter
       │   └── share ── click → click "Chia sẻ ngay"
       ├── Update task → "success" / "failed"
       └── GpmClient.closeProfile() → Close Chrome
```

### 3.4 Scheduled Campaign Flow

```
[Admin creates Campaign with scheduledAt]
       │
       │ (checkAndRunScheduledCampaigns() every 30s)
       ▼
[GPM Bridge Agent]
       │
       ├── Query: status=="scheduled" AND scheduledAt<=now
       ├── Update campaign → "active"
       └── Update non-success tasks → "pending"
              │
              ▼ (triggered into task queue)
              Normal automation flow...
```

---

## 4. Folder Structure

```
json-tool-main/
├── src/                          # React Frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Router + Theme + Auth guards
│   │
│   ├── pages/                    # Route pages
│   │   ├── HomePage.tsx         # Dashboard (StatsCards, Charts, AccountsTable)
│   │   ├── ImportsPage.tsx       # Import management
│   │   ├── AnalyticsPage.tsx     # Analytics & AI
│   │   ├── CommentsPage.tsx      # Comment browser
│   │   ├── SeedingPage.tsx      # Seeding Manager (5 tabs)
│   │   ├── AdminPage.tsx       # User management
│   │   ├── SettingsPage.tsx     # Settings
│   │   ├── LoginPage.tsx        # Login
│   │   └── LandingPage.tsx       # Marketing landing
│   │
│   ├── components/               # React components
│   │   ├── AppLayout.tsx        # Shell (sidebar + topbar)
│   │   ├── ImportFolder.tsx     # ZIP upload + preview + confirm
│   │   ├── GpmProfilesTab.tsx   # GPM profiles management
│   │   ├── SeedingDashboardPanel.tsx
│   │   ├── AccountsTable.tsx     # Import records table
│   │   ├── StatsCards.tsx        # Dashboard stats
│   │   ├── charts/              # ECharts components
│   │   │   ├── EngagementChart.tsx
│   │   │   ├── SentimentChart.tsx
│   │   │   ├── TimelineChart.tsx
│   │   │   ├── KeywordFreqChart.tsx
│   │   │   ├── ActivityHeatmap.tsx
│   │   │   ├── TopCommentersChart.tsx
│   │   │   └── ReactionPieChart.tsx
│   │   └── ...
│   │
│   ├── services/                 # Data layer (Firestore, API)
│   │   ├── firebase.ts          # Firebase init
│   │   ├── authService.ts       # Whitelist check
│   │   ├── importService.ts     # Import CRUD
│   │   ├── seedingService.ts    # Seeding CRUD
│   │   ├── gpmApiService.ts     # Bridge HTTP API client
│   │   ├── aiSentimentService.ts  # Rule-based sentiment
│   │   └── aiExtendedService.ts   # Cloud Functions wrappers
│   │
│   ├── utils/                   # Pure helpers
│   │   ├── importUtils.ts       # Import flow helpers
│   │   ├── encoding.ts         # Facebook JSON decoder
│   │   ├── array.ts            # chunkArray
│   │   ├── aiClientFallback.ts  # Client-side Gemini
│   │   ├── geminiClient.ts     # Gemini factory
│   │   ├── sentiment.ts        # Rule-based sentiment dictionary
│   │   ├── seedingExport.ts    # Excel/CSV export
│   │   ├── notification.ts    # Browser notifications
│   │   └── typeGuards.ts       # Type predicates
│   │
│   ├── contexts/               # React contexts
│   │   ├── AuthContext.tsx      # Auth state + login/logout
│   │   ├── ImportDataContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── LoadingContext.tsx
│   │
│   ├── hooks/                  # Custom hooks
│   │   ├── useStats.tsx
│   │   ├── useInsights.ts
│   │   ├── useAllComments.tsx
│   │   ├── useAllEngagement.tsx
│   │   ├── useRealtimeImports.tsx
│   │   ├── useSeedingStats.ts
│   │   └── usePerformanceScore.ts
│   │
│   ├── types/                  # TypeScript types
│   │   ├── index.ts            # Core (ImportRecord, CommentItem, ReactionItem)
│   │   ├── seeding.ts          # Seeding types
│   │   ├── gpm.ts             # GPM API types
│   │   └── guards.ts           # Type predicates
│   │
│   └── styles/                 # SCSS styles
│       ├── layout.scss
│       ├── responsive.scss
│       ├── header.scss
│       ├── accounts-table.scss
│       ├── loading-overlay.scss
│       └── print.scss
│
├── gpm-bridge/                  # Node.js Backend Agent
│   ├── src/
│   │   ├── index.ts           # Main entry - Firestore listener + task queue
│   │   ├── apiServer.ts       # Express HTTP proxy (CORS bypass)
│   │   ├── gpmClient.ts       # GPM Login API wrapper
│   │   ├── gpmProcess.ts      # GPM process manager (auto-start)
│   │   ├── taskRunner.ts       # Puppeteer automation (like/comment/share)
│   │   ├── browserAgent.ts    # Puppeteer Chrome connection
│   │   └── facebookScraper.ts  # FB info scraper
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── functions/                   # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts          # Gemini AI Cloud Functions
│   │                           # Regions: asia-southeast1
│   └── .env                    # GEMINI_API_KEY, GEMINI_MODEL
│
├── firestore.rules             # Firestore Security Rules
├── firebase.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env                       # VITE_FIREBASE_*, VITE_GEMINI_*
└── .env.example
```

---

## 5. Important Files

### Critical (Hệ thống không thể thiếu)

| File | Vai trò |
|------|---------|
| `src/main.tsx` | React entry - khởi tạo tất cả providers |
| `src/App.tsx` | Router, Auth guards, Ant Design theme (Supabase-inspired) |
| `src/service/firebase.ts` | Firebase client init |
| `src/types/index.ts` | Core types |
| `src/types/seeding.ts` | Seeding types |
| `src/types/gpm.ts` | GPM API types |
| `gpm-bridge/src/index.ts` | Bridge main - Firestore listener + task queue |
| `gpm-bridge/src/apiServer.ts` | Express proxy server |
| `gpm-bridge/src/taskRunner.ts` | Puppeteer seeding automation |
| `firestore.rules` | Security rules |
| `src/service/authService.ts` | Whitelist logic |

### High Priority (Tính năng core)

| File | Vai trò |
|------|---------|
| `src/contexts/AuthContext.tsx` | Auth state management |
| `src/service/importService.ts` | Import Firestore CRUD |
| `src/service/seedingService.ts` | Seeding Firestore CRUD (4 collections) |
| `src/service/gpmApiService.ts` | Frontend Bridge HTTP API client |
| `gpm-bridge/src/gpmClient.ts` | GPM Login API wrapper |
| `gpm-bridge/src/browserAgent.ts` | Puppeteer Chrome connection |
| `gpm-bridge/src/facebookScraper.ts` | FB info scraper |
| `gpm-bridge/src/gpmProcess.ts` | GPM process management |
| `src/components/ImportFolder.tsx` | ZIP upload + parsing |
| `src/components/GpmProfilesTab.tsx` | GPM profiles UI |
| `src/pages/SeedingPage.tsx` | Seeding Manager page (5 tabs) |
| `src/pages/HomePage.tsx` | Dashboard |
| `functions/src/index.ts` | Cloud Functions (6 AI functions) |

### Medium Priority (Hỗ trợ)

| File | Vai trò |
|------|---------|
| `src/service/aiSentimentService.ts` | Rule-based sentiment |
| `src/service/aiExtendedService.ts` | AI Cloud Functions wrappers |
| `src/utils/aiClientFallback.ts` | Client-side Gemini fallback |
| `src/utils/importUtils.ts` | Import pure helpers |
| `src/utils/encoding.ts` | Facebook decoder |
| `src/layouts/AppLayout.tsx` | App shell |

---

## 6. API Endpoints

### 6.1 GPM Bridge HTTP API (localhost:3001)

**Health**
- `GET /health` → `GpmBridgeHealth` - Kiểm tra Bridge + GPM status

**Profiles**
- `GET /gpm/profiles` → `GpmProfile[]` - Danh sách profiles (pagination)
- `GET /gpm/profiles/running` → `string[]` - IDs đang chạy
- `POST /gpm/profiles/create` → `GpmProfile` - Tạo profile
- `POST /gpm/profiles/update/:id` → `GpmProfile` - Cập nhật
- `GET /gpm/profiles/start/:id` → `GpmStartResult` - Mở profile
- `GET /gpm/profiles/stop/:id` → void - Đóng profile

**Groups**
- `GET /gpm/groups` → `GpmGroup[]`
- `POST /gpm/groups/create` → `GpmGroup`
- `POST /gpm/groups/update/:id` → `GpmGroup`
- `GET /gpm/groups/delete/:id` → void

**Proxies**
- `GET /gpm/proxies` → `GpmProxy[]`
- `POST /gpm/proxies/create` → `GpmProxy`
- `POST /gpm/proxies/update/:id` → `GpmProxy`
- `GET /gpm/proxies/delete/:id` → void
- `GET /gpm/proxies/check?raw_proxy=xxx` → `GpmProxyCheckResult`

### 6.2 GPM Login Local API (localhost:9495)

> Proxy qua Bridge để tránh CORS. Các endpoints theo official GPM Login API docs.

### 6.3 Firebase Cloud Functions

**Region:** `asia-southeast1`

| Function | Params | Returns | Timeout |
|----------|--------|---------|---------|
| `analyzeSentiment` | `{comments: CommentInput[]}` | `{results: SentimentResult[]}` | 60s |
| `summarizeComments` | `{comments, accountName?}` | `SummaryResult` | 120s |
| `extractSeoKeywords` | `{comments, accountName?}` | `{keywords: SeoKeyword[]}` | 60s |
| `scoreLeads` | `{comments: RichCommentInput[]}` | `{leads: LeadScore[]}` | 60s |
| `classifyIntent` | `{comments: CommentInput[]}` | `{results: IntentResult[]}` | 60s |
| `generateSeedingIdeas` | `{comments, accountName?}` | `{ideas: SeedingIdea[]}` | 90s |

---

## 7. Database Schema (Firestore)

### Collections

```
allowedAccounts/{uid}
  email: string
  displayName: string
  role: 0 | 1

imports/{importId}
  accountName: string
  commentsCount: number
  reactionsCount: number
  totalFiles: number
  status: "processing" | "completed"
  importedAt: timestamp

  commentChunks/{chunkId}
    index: number
    items: CommentItem[]
    count: number

  reactionChunks/{chunkId}
    index: number
    items: ReactionItem[]
    count: number

seedingProfiles/{profileId}
  profileId: string (GPM profile ID)
  profileName: string
  status: "active" | "inactive" | "banned"
  note: string
  fbUid?: string
  fbName?: string
  fbAvatar?: string
  fbUrl?: string
  fbIsLoggedIn?: boolean
  fbSyncedAt?: timestamp
  createdAt: timestamp

seedingCampaigns/{campaignId}
  name: string
  description?: string
  status: "draft" | "active" | "paused" | "completed" | "scheduled"
  targetUrl?: string
  scheduledAt?: timestamp
  isTemplate?: boolean
  createdAt: timestamp
  updatedAt: timestamp

seedingTasks/{taskId}
  campaignId: string
  profileId: string
  profileName: string
  action: "like" | "comment" | "share"
  targetUrl: string
  commentText?: string
  shareCaption?: string
  delayMin: number
  delayMax: number
  totalFiles?: number
  status: "scheduled" | "pending" | "running" | "success" | "failed" | "skipped"
  retryCount?: number
  errorMessage?: string
  finishedAt?: timestamp
  exportedAt?: timestamp
  createdAt: timestamp

seedingComments/{commentId}
  text: string
  tags: string[]
  usageCount: number
  createdAt: timestamp
```

### Firestore Security Rules Summary

| Collection | Read | Write |
|------------|------|-------|
| `allowedAccounts` | Authenticated + in whitelist | Admin only (no self-delete, no self-demote) |
| `imports` | Allowed user | Admin + schema validation |
| `imports/*/commentChunks` | Allowed user | Admin |
| `imports/*/reactionChunks` | Allowed user | Admin |
| `seedingProfiles` | Allowed user | Admin + schema validation |
| `seedingCampaigns` | Allowed user | Admin + schema validation |
| `seedingTasks` | Allowed user | Admin + schema validation |
| `seedingComments` | Allowed user | Admin + schema validation |

---

## 8. Business Logic

### 8.1 Authentication Flow

```
1. User login (Firebase Auth - Email/Password)
2. AuthContext → onAuthStateChanged
3. authService.checkAllowedAccount(uid, email)
   → Check allowedAccounts/{uid} exists
   → Get role (0=viewer, 1=admin)
4. If not in whitelist → signOut() + error message
5. If role=0 (Viewer) → read-only UI
6. If role=1 (Admin) → full CRUD UI
```

### 8.2 Import Flow

```
1. User upload ZIP file(s)
2. JSZip parse → nested ZIP support
3. Detect multi-profile (folder depth >= 4 or distinct roots > 1)
4. For each profile:
   a. Parse JSON files (decodeFacebookObject)
   b. Extract comments (comments_v2, group_comments_v2)
   c. Extract reactions (reaction items)
   d. Group by inner folder
5. Preview with counts
6. User confirms:
   a. Create import document (status: "processing")
   b. Chunk comments (700 items/chunk) → addCommentChunk()
   c. Chunk reactions (2000 items/chunk) → addReactionChunk()
   d. Finalize import (accountName, counts, status: "completed")
7. Notification on completion
```

### 8.3 AI Analysis Flow

```
Sentiment Analysis:
  aiSentimentService.analyzeCommentsWithAI()
    → Rule-based classifySentiment() (dictionary)
    → Update Firestore commentChunks

Intent/SEO/Lead/Ideas:
  aiExtendedService.{function}()
    → Try Cloud Function (asia-southeast1)
    → Catch error → Try aiClientFallback (client-side VITE_GEMINI_API_KEY)
    → Catch error → Rule-based fallback
    → Update Firestore if applicable
```

### 8.4 Seeding Automation Flow

```
1. Admin creates Campaign + Tasks
2. Admin clicks "Chạy GPM"
   → Tasks status → "pending"
   → Campaign status → "active"
3. GPM Bridge (always running):
   a. Firestore onSnapshot listener: where("status", "==", "pending")
   b. Push taskId to taskQueue
   c. processQueue() (sequential):
      - Update task → "running"
      - GpmClient.startProfile(profileId) → Chrome opens
      - facebookScraper → get FB info → update seedingProfiles
      - taskRunner.runSeedingTask():
         * like: find [aria-label="Thích"] → click
         * comment: focus textbox → type → Enter
         * share: click share → click "Chia sẻ ngay"
         * random delay (5-20s) after each action
      - Update task → "success" / "failed"
      - GpmClient.closeProfile(profileId) → Chrome closes
   d. If failed → retry 3 times (10s interval) → "failed"
```

### 8.5 GPM Profile Sync

```
Bridge startup:
  1. syncGpmProfiles() immediately
  2. Every 120 seconds thereafter

Sync logic:
  - Get profiles from GPM Login API
  - Compare with Firestore seedingProfiles
  - Create new profiles not in Firestore
  - Update names if changed
  - Skip id "00000000-0000-0000-0000-000000000000"
```

---

## 9. Current Limitations

### Critical
1. **Facebook Selectors** - Hardcoded selectors in `taskRunner.ts` are fragile. Facebook DOM changes frequently → automation breaks
2. **No optimistic locking** - Task status race condition between Admin edits and Bridge updates
3. **Import quota risk** - Large imports create many Firestore documents → potential quota spike
4. **No transaction between GPM sync and manual edits** - Overwrite possible

### Medium
5. **Intent matching collision** - Comments matched by (time + author + content) → duplicates possible
6. **Duplicate task prevention is basic** - `taskQueue.includes()` + `activeProcessingIds` not atomic
7. **No retry backoff strategy** - Fixed 10s retry interval
8. **Legacy flag `VITE_USE_LEGACY_SEEDING_PROFILES`** - Two different UI tabs for same feature

### Low
9. **Error classification in Cloud Functions** - String matching `"429"` is fragile
10. **No rate limiting on import** - User can upload unlimited ZIPs

---

## 10. Future Extension Points

### AI Enhancements
- Add more AI functions to Cloud Functions (summarizeComments is deployed but not wired in UI)
- Fine-tune sentiment dictionary with domain-specific Vietnamese words
- Add trend analysis over time
- Add anomaly detection for unusual comment patterns

### Automation Improvements
- Add screenshot capture on task failure
- Implement selector auto-detection / visual matching
- Add support for more Facebook actions (react with specific emoji, reply to comment)
- Implement profile health check before running tasks
- Add webhook integration for task completion notifications

### Data Management
- Add data retention policies (auto-delete old imports)
- Add import deduplication with fuzzy matching
- Add bulk operations (bulk delete, bulk status update)
- Add data export/import between environments

### GPM Integration
- Profile performance analytics (success rate per profile)
- Auto-pause profiles with low success rate
- Proxy rotation strategies
- Multi-browser support (Firefox profiles)

### UI/UX
- Dark mode improvements
- Mobile responsive design
- Real-time collaboration (who's online)
- Dashboard customization (drag-drop widgets)
- Audit log for admin actions

### Security
- Two-factor authentication (2FA)
- IP whitelisting
- Rate limiting on API endpoints
- Audit trail for all data changes

### Testing
- E2E tests for seeding automation flow
- Mock GPM Login API for testing
- Load testing for large imports

---

## Appendix: Environment Variables

### Frontend (.env)
```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
VITE_GEMINI_API_KEY=xxx
VITE_GEMINI_MODEL=gemini-2.0-flash
VITE_GPM_BRIDGE_URL=http://localhost:3001
VITE_USE_LEGACY_SEEDING_PROFILES=true|false  # optional
```

### GPM Bridge (gpm-bridge/.env)
```env
GPM_API_URL=http://127.0.0.1:9495
GPM_EXECUTABLE_PATH=C:\Users\...\GPMLoginGlobal.exe
GPM_AUTO_START=true
GPM_AUTO_START_ON_BRIDGE_START=true
GPM_STARTUP_TIMEOUT_MS=45000
GPM_STARTUP_POLL_INTERVAL_MS=1500
FIREBASE_SERVICE_ACCOUNT_PATH=../firebase-service-account.json
MIN_DELAY_SECONDS=5
MAX_DELAY_SECONDS=20
API_SERVER_PORT=3001
```

### Cloud Functions (functions/.env)
```env
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash  # optional, default
```

---

## Appendix: NPM Scripts

```bash
# Frontend
npm run dev              # Vite dev server
npm run build            # Build for production
npm run lint             # ESLint
npm test                 # Unit tests (Vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E

# GPM Bridge
cd gpm-bridge && npm run dev
npm --prefix gpm-bridge run build

# Bridge background
npm run bridge:start-bg      # Start as background process
npm run bridge:install-startup  # Auto-start on Windows login

# Cloud Functions
cd functions && npm run build
```
