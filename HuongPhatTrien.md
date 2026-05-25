# 🚀 HƯỚNG PHÁT TRIỂN DỰ ÁN: FB Pulse Tracker

> **Phiên bản tài liệu:** 1.0  
> **Ngày soạn:** 23/05/2026  
> **Mục tiêu:** Phát triển từ tool nội bộ → Nền tảng SaaS Analytics chuyên nghiệp  
> **Đối tượng đọc:** Developer, Product Manager, Stakeholders

---

## 🧭 TẦM NHÌN SẢN PHẨM (PRODUCT VISION)

> *"Biến mọi dữ liệu Facebook thành insight có giá trị — cho cá nhân, doanh nghiệp và agency một cách nhanh chóng, trực quan và thông minh."*

**FB Pulse Tracker** hiện tại là một **data import & viewing tool** đơn giản. Hướng phát triển sẽ đưa nó trở thành một **Social Media Analytics Platform** hoàn chỉnh, phục vụ:

| Đối tượng | Nhu cầu |
|-----------|---------|
| **Content Creator** | Hiểu ai đang tương tác, nội dung nào hiệu quả |
| **Doanh nghiệp vừa/nhỏ** | Theo dõi hiệu quả marketing Facebook, báo cáo định kỳ |
| **Social Media Manager** | Quản lý nhiều tài khoản, so sánh hiệu suất, export báo cáo |
| **Marketing Agency** | Phân tích data client, white-label report, multi-workspace |
| **Nhà nghiên cứu** | Phân tích xu hướng, sentiment, keyword từ bình luận |

---

## 📐 KIẾN TRÚC HỆ THỐNG TƯƠNG LAI (TARGET ARCHITECTURE)

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19 + Vite)                  │
│  Dashboard │ Analytics │ Reports │ Admin │ Settings │ Workspace  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                    BACKEND LAYER                                 │
│                                                                  │
│   ┌─────────────────┐    ┌──────────────────┐                   │
│   │  Firebase        │    │  Cloud Functions  │                   │
│   │  - Firestore     │    │  - AI/NLP Tasks   │                   │
│   │  - Auth          │    │  - Scheduled Jobs │                   │
│   │  - Storage       │    │  - Email Service  │                   │
│   │  - Security Rules│    │  - PDF Generation │                   │
│   └─────────────────┘    └──────────────────┘                   │
│                                                                  │
│   ┌─────────────────┐    ┌──────────────────┐                   │
│   │  Algolia/        │    │  Claude API       │                   │
│   │  Typesense       │    │  (AI Insights)    │                   │
│   │  (Full-text      │    │  - Sentiment      │                   │
│   │   search)        │    │  - Summarize      │                   │
│   └─────────────────┘    └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│   SendGrid (Email) │ Stripe (Payment) │ Sentry (Monitoring)     │
│   Cloudinary (Media) │ Vercel (Hosting) │ GitHub Actions (CI/CD)│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ LỘ TRÌNH PHÁT TRIỂN (ROADMAP)

---

### ⚡ GIAI ĐOẠN 0 — STABILIZE (2-3 Tuần)
> *Sửa những vấn đề cốt lõi trước khi thêm tính năng mới. Không thể xây nhà trên nền móng yếu.*

#### 0.1 Codebase Foundation
- [ ] Định nghĩa đầy đủ TypeScript types — loại bỏ toàn bộ `any` và `@ts-ignore`
- [ ] Tách `checkAllowedAccount()` thành service function — xóa code trùng lặp trong AuthContext
- [ ] Thêm `dayjs` vào `package.json` dependencies (hiện đang dùng ngầm qua antd)
- [ ] Thay `lodash.get` bằng optional chaining native
- [ ] Xóa code comment chết `// const [loading, setLoading] = useState(false)`
- [ ] Đồng nhất ngôn ngữ UI — chọn 100% tiếng Việt hoặc 100% tiếng Anh

#### 0.2 Security
- [ ] Triển khai **Firestore Security Rules** đúng chuẩn (rule dựa trên `request.auth`)
- [ ] Ẩn nút "Xóa tất cả" với `role: 0` (read-only users)
- [ ] Kiểm tra `.env` có trong `.gitignore` chưa — không commit credentials
- [ ] Cấu hình Firebase App Check để ngăn abuse

#### 0.3 Testing & CI/CD
- [ ] Setup **Vitest** + **@testing-library/react**
- [ ] Unit tests cho: `decodeFacebookText`, `chunkArray`, `mapReactionItem`, `useStats`
- [ ] GitHub Actions workflow: lint → test → build → deploy

#### 0.4 Performance Quick Wins
- [ ] Thêm `limit()` vào Firestore queries (không load vô tận)
- [ ] Lazy load các Modal components (`React.lazy + Suspense`)
- [ ] Error Boundary bọc toàn bộ app

---

### 🏗️ GIAI ĐOẠN 1 — CORE ENHANCEMENT (Tháng 1-2)
> *Nâng cấp các tính năng hiện có lên mức hoàn chỉnh và professional.*

#### 1.1 Dashboard Nâng Cấp

**Thêm Metrics Cards mới:**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  👍 Total    │  │  💬 Total    │  │  📥 Imports  │  │  📈 Avg/    │
│  Reactions   │  │  Comments    │  │  Count       │  │  Import      │
│  128,540     │  │  45,230      │  │  23          │  │  7,534       │
│  ↑ 12% vs   │  │  ↑ 8% vs    │  │              │  │              │
│  tuần trước  │  │  tuần trước  │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

**Thêm Date Comparison:**
- So sánh khoảng thời gian này với khoảng trước (tuần này vs tuần trước)
- Hiển thị % tăng/giảm với mũi tên màu xanh/đỏ

#### 1.2 Biểu Đồ Phong Phú Hơn

**Thêm các loại chart:**
```typescript
// Heatmap — hoạt động theo giờ/ngày trong tuần
// (giúp biết khi nào followers active nhất)
const heatmapData = buildHeatmap(allComments, "commentTime");
// Output: { "Mon-09:00": 45, "Tue-14:00": 123, ... }

// Pie chart — phân bổ reaction types (Like/Love/Haha/Wow/Sad/Angry)
// Timeline chart — xu hướng theo ngày/tuần/tháng
// Bar chart — Top 10 tài khoản có nhiều tương tác nhất
```

**Chart types cần thêm:**
| Chart | Mục đích |
|-------|---------|
| **Heatmap Calendar** | Xem ngày nào nhiều tương tác nhất trong năm |
| **Pie/Donut** | Phân loại loại reaction (Like, Love, Haha...) |
| **Area Timeline** | Xu hướng tăng/giảm theo thời gian |
| **Scatter Plot** | Tương quan giữa comments và likes |
| **Ranking Bar** | Top tài khoản/bài viết hiệu quả nhất |

#### 1.3 Phân Tích Comments Sâu Hơn

**Word Cloud từ nội dung bình luận:**
```typescript
// Sử dụng wordcloud2.js hoặc d3-cloud
// Extract keywords → loại stopwords tiếng Việt → generate cloud
import { wordCloud } from "@/utils/textAnalysis";

const keywords = extractKeywords(allComments.map(c => c.content));
// ["đẹp quá", "ủng hộ", "chất lượng", "giá tốt", ...]
```

**Top Commenters:**
```typescript
// Tổng hợp ai comment nhiều nhất
interface TopCommenter {
  authorName: string;
  commentCount: number;
  avgCommentLength: number;
  firstComment: Date;
  lastComment: Date;
}
```

**Comment Timeline:**
- Xem bình luận được post vào giờ nào trong ngày
- Giờ cao điểm tương tác (Peak Hours)

#### 1.4 Tính Năng Import Nâng Cấp

**Import Progress Chi Tiết:**
```
Step 1: 📦 Giải nén ZIP...           ✅ (23 files)
Step 2: 🔍 Phân tích JSON...         ✅ (5,234 comments | 12,890 reactions)
Step 3: ☁️ Upload lên database...    ⏳ 67% (8/12 chunks)
Step 4: ✅ Hoàn tất                  —
```

**Hỗ trợ thêm định dạng:**
- Import nhiều ZIP cùng lúc (batch import)
- Re-import để cập nhật dữ liệu (update mode vs. append mode)
- Import Preview — xem trước sẽ import bao nhiêu records trước khi confirm
- Tự động phát hiện tên tài khoản từ cấu trúc folder

#### 1.5 Tìm Kiếm & Lọc Nâng Cao

**Full-text search trong comments:**
```
🔍 [Tìm kiếm bình luận...              ]
   Filters: 📅 Ngày | 👤 Tác giả | 😊 Sentiment | 🔖 Nhóm
```

**Bộ lọc nâng cao:**
- Lọc theo nhóm Facebook (field `group` trong comment)
- Lọc theo từ khóa trong nội dung comment
- Lọc theo tác giả bình luận
- Lọc comments có chứa link, hình ảnh, emoji
- Sắp xếp: mới nhất, cũ nhất, nhiều replies nhất

#### 1.6 Export Nâng Cấp

**Nhiều định dạng export:**
```typescript
enum ExportFormat {
  EXCEL = "xlsx",
  CSV = "csv",
  JSON = "json",
  PDF = "pdf",   // Báo cáo có đồ thị, branding
}
```

**PDF Report với template:**
- Logo công ty, tiêu đề báo cáo
- Tổng quan stats (dạng infographic)
- Charts được nhúng vào PDF
- Bảng dữ liệu chi tiết
- Footer với watermark

---

### 🧠 GIAI ĐOẠN 2 — AI & SMART ANALYTICS (Tháng 3-4)
> *Tích hợp AI để tạo ra insights tự động — đây là điểm khác biệt với các tool thông thường.*

#### 2.1 Sentiment Analysis (Phân Tích Cảm Xúc)

**Phân loại tự động bình luận:**
```typescript
type Sentiment = "positive" | "neutral" | "negative" | "question" | "spam";

interface CommentWithSentiment extends CommentItem {
  sentiment: Sentiment;
  sentimentScore: number; // -1.0 đến +1.0
  keywords: string[];
}
```

**Hiển thị:**
```
📊 Phân tích cảm xúc 5,234 bình luận:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
😊 Tích cực:  ████████████████ 68% (3,559)
😐 Trung lập: ████████ 22%         (1,151)
😢 Tiêu cực:  ████ 7%              (366)
❓ Câu hỏi:   █ 3%                 (158)
```

**Công nghệ:**
- Sử dụng **Claude API** (`claude-haiku-4-5`) để phân loại — nhanh và rẻ
- Batch processing trong Cloud Functions để phân tích offline
- Cache kết quả vào Firestore — không phải gọi AI lại mỗi lần

```typescript
// Cloud Function — chạy sau khi import xong
export const analyzeSentiment = onDocumentCreated(
  "imports/{importId}",
  async (event) => {
    const importId = event.params.importId;
    const comments = await fetchAllComments(importId);
    
    // Batch call Claude API (50 comments/request)
    const batches = chunk(comments, 50);
    for (const batch of batches) {
      const results = await callClaudeForSentiment(batch);
      await saveSentimentResults(importId, results);
    }
  }
);
```

#### 2.2 AI Comment Summarizer

**Tóm tắt tự động nội dung bình luận:**
```
🤖 AI Insights cho "Tài khoản ABC" (1,234 bình luận):

📋 TÓM TẮT:
Phần lớn bình luận phản hồi tích cực về chất lượng sản phẩm, 
đặc biệt ca ngợi thiết kế và độ bền. Có 89 câu hỏi về giá và 
chính sách giao hàng chưa được trả lời. 12% bình luận tiêu cực 
tập trung vào thời gian giao hàng chậm.

🔑 TỪ KHÓA HOT: "đẹp" (234), "chất lượng" (189), "giá" (156)

⚠️ CẦN CHÚ Ý:
• 89 câu hỏi chưa được trả lời
• Chủ đề "giao hàng chậm" xuất hiện 67 lần — cần xử lý
• Spike tiêu cực vào 15/01 — có thể liên quan sự kiện gì đó
```

#### 2.3 Automated Insights (Insights Tự Động)

**Hệ thống tự động phát hiện pattern:**
```typescript
interface AutoInsight {
  type: "spike" | "drop" | "trend" | "anomaly" | "peak_time";
  severity: "info" | "warning" | "alert";
  message: string;
  metric: string;
  value: number;
  date: Date;
}

// Ví dụ insights được sinh ra:
const insights: AutoInsight[] = [
  {
    type: "spike",
    severity: "alert",
    message: "Comments tăng 340% vào ngày 15/01 so với ngày trung bình",
    metric: "comments",
    value: 340,
    date: new Date("2025-01-15"),
  },
  {
    type: "peak_time",
    severity: "info",
    message: "Followers của bạn active nhất vào 20:00-22:00 thứ Ba và thứ Sáu",
    metric: "activity",
    value: 0,
    date: new Date(),
  },
];
```

#### 2.4 Content Performance Scoring

**Chấm điểm hiệu quả từng bài viết:**
```typescript
interface PostScore {
  title: string;
  engagementRate: number;  // (comments + reactions) / followers * 100
  responseRate: number;    // tỷ lệ bình luận được trả lời
  sentimentScore: number;  // -100 đến +100
  overallScore: number;    // 0-100, composite score
  grade: "A" | "B" | "C" | "D" | "F";
}
```

---

### 🏢 GIAI ĐOẠN 3 — MULTI-ACCOUNT & TEAM COLLABORATION (Tháng 5-6)
> *Từ tool cá nhân → nền tảng cho team và doanh nghiệp.*

#### 3.1 Workspace Architecture

**Mô hình Workspace (Multi-tenant):**
```
Organization (Công ty ABC)
├── Workspace: "Facebook Page Chính"
│   ├── Members: [user1, user2, user3]
│   ├── Data: imports, comments, reactions
│   └── Settings: timezone, language, notification
│
├── Workspace: "Facebook Group Cộng Đồng"
│   ├── Members: [user2, user4]
│   └── Data: ...
│
└── Billing: Gói Pro — 3 workspaces, unlimited imports
```

**Firestore Schema mới:**
```
organizations/{orgId}
├── name: string
├── plan: "free" | "pro" | "team" | "agency"
├── ownerId: string
└── members/{userId}
    ├── role: "owner" | "admin" | "editor" | "viewer"
    └── joinedAt: timestamp

workspaces/{workspaceId}
├── orgId: string
├── name: string
└── imports/{importId}  ← data được scope theo workspace
```

#### 3.2 Real-time Collaboration

**Nhiều người cùng xem dashboard:**
- Cursor tracking (ai đang nhìn vào đâu)
- Live comments/annotations trên data
- Notification khi người khác import dữ liệu mới

**Chia sẻ dữ liệu:**
```typescript
// Tạo shared link (public, có expiry)
const shareLink = await createShareLink({
  workspaceId: "ws123",
  importIds: ["imp1", "imp2"],
  expiresAt: addDays(new Date(), 7),
  allowedActions: ["view", "export"],
  password: "optional-password",
});
// https://fbpulse.com/shared/abc123xyz
```

#### 3.3 Comments & Annotations

**Team có thể ghi chú trên data:**
```typescript
interface DataAnnotation {
  id: string;
  importId: string;
  authorId: string;
  content: string;        // "@user2 cần xem xét comment này"
  targetType: "import" | "comment" | "chart_point";
  targetId: string;
  mentions: string[];     // user IDs được mention
  resolved: boolean;
  createdAt: Timestamp;
}
```

#### 3.4 Task Management Tích Hợp

**Tạo task từ dữ liệu phân tích:**
```
[Phân tích phát hiện 89 câu hỏi chưa trả lời]
→ [Tạo Task: "Trả lời 89 câu hỏi về giao hàng"]
   Assign to: @marketing_team
   Due date: 25/01/2025
   Priority: High
```

---

### 📅 GIAI ĐOẠN 4 — REPORTS & AUTOMATION (Tháng 7-8)
> *Tự động hóa công việc báo cáo định kỳ.*

#### 4.1 Scheduled Reports (Báo Cáo Định Kỳ)

**Cấu hình gửi báo cáo tự động:**
```
📧 Báo cáo hàng tuần
━━━━━━━━━━━━━━━━━━━
Workspace: Facebook Page ABC
Tần suất: Mỗi thứ Hai, 8:00 sáng
Định dạng: PDF + Excel
Gửi đến: manager@company.com, team@company.com
Nội dung:
  ✅ Tổng quan tuần qua
  ✅ Top 5 bài viết hiệu quả nhất
  ✅ Phân tích cảm xúc bình luận
  ✅ So sánh với tuần trước
  ✅ Insights và khuyến nghị
```

**Cloud Function scheduler:**
```typescript
// Firebase Cloud Function - chạy theo lịch
export const sendWeeklyReport = onSchedule("every monday 01:00", async () => {
  const activeReports = await getActiveScheduledReports();
  for (const report of activeReports) {
    const data = await generateReportData(report.workspaceId);
    const pdf = await generatePDF(data, report.template);
    await sendEmail(report.recipients, { pdf, excel: data.excelBuffer });
    await logReportSent(report.id);
  }
});
```

#### 4.2 Alert System (Hệ Thống Cảnh Báo)

**Cấu hình alert tùy chỉnh:**
```typescript
interface AlertRule {
  metric: "comments" | "reactions" | "sentiment" | "engagement_rate";
  condition: "greater_than" | "less_than" | "percent_change";
  threshold: number;
  period: "hourly" | "daily" | "weekly";
  channels: ("email" | "push" | "webhook")[];
  webhookUrl?: string; // Kết nối Slack, Teams, etc.
}

// Ví dụ: Alert khi bình luận tiêu cực tăng > 20%
const alert: AlertRule = {
  metric: "sentiment",
  condition: "percent_change",
  threshold: -20,
  period: "daily",
  channels: ["email", "push"],
};
```

#### 4.3 Webhook Integration

**Kết nối với các công cụ khác:**
```typescript
// Gửi event đến Slack khi có spike bất thường
POST https://hooks.slack.com/services/xxx/yyy/zzz
{
  "text": "⚠️ [FB Pulse Alert] Comments tiêu cực tăng 45% hôm nay",
  "attachments": [{
    "color": "danger",
    "fields": [
      { "title": "Tài khoản", "value": "Facebook ABC", "short": true },
      { "title": "Thay đổi", "value": "+45% tiêu cực", "short": true }
    ]
  }]
}
```

**Webhook outbound hỗ trợ:**
- Slack, Microsoft Teams
- Discord
- Custom endpoint (cho hệ thống nội bộ)
- Zapier / Make.com (no-code automation)

---

### 💰 GIAI ĐOẠN 5 — SAAS MONETIZATION (Tháng 9-10)
> *Chuyển đổi từ tool miễn phí → sản phẩm có doanh thu.*

#### 5.1 Mô Hình Pricing

```
┌─────────────────────────────────────────────────────────────────┐
│  FREE              PRO                TEAM              AGENCY   │
│  0đ/tháng          299k/tháng         699k/tháng        Liên hệ │
├─────────────────────────────────────────────────────────────────┤
│  1 workspace       3 workspaces       10 workspaces    Unlimited │
│  5 imports/tháng   Unlimited          Unlimited        Unlimited │
│  30 ngày lưu trữ  1 năm lưu trữ     2 năm lưu trữ   Unlimited │
│  Basic charts      All charts         All charts       All charts│
│  Export Excel      Export PDF+Excel   Export All       Export All│
│  —                 AI Sentiment       AI Sentiment     AI + Custom│
│  —                 —                  Team features    White-label│
│  —                 —                  Scheduled report  Dedicated│
│  —                 Email support      Priority support  SLA       │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2 Stripe Payment Integration

```typescript
// Sử dụng Stripe cho payment
import Stripe from "stripe";

// Cloud Function: tạo Stripe Checkout Session
export const createCheckout = onRequest(async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_IDS[req.body.plan], quantity: 1 }],
    success_url: `${APP_URL}/settings/billing?success=true`,
    cancel_url: `${APP_URL}/pricing`,
    customer_email: req.body.email,
    metadata: { userId: req.body.userId, plan: req.body.plan },
  });
  res.json({ url: session.url });
});

// Webhook: xử lý payment thành công
export const stripeWebhook = onRequest(async (req, res) => {
  const event = stripe.webhooks.constructEvent(...);
  if (event.type === "checkout.session.completed") {
    await upgradePlan(event.data.object.metadata.userId, plan);
  }
});
```

#### 5.3 Usage Metering & Limits

```typescript
// Kiểm tra giới hạn trước khi import
const canImport = async (orgId: string): Promise<boolean> => {
  const org = await getOrg(orgId);
  if (org.plan === "free") {
    const thisMonth = await countImportsThisMonth(orgId);
    return thisMonth < FREE_TIER_IMPORT_LIMIT; // 5
  }
  return true; // Pro và trên: unlimited
};
```

---

### 🌐 GIAI ĐOẠN 6 — PLATFORM EXPANSION (Tháng 11-12)
> *Mở rộng ra ngoài Facebook — trở thành Social Media Analytics Platform.*

#### 6.1 Mở Rộng Nền Tảng

**Hỗ trợ thêm:**

| Platform | Dữ liệu | Phương thức Import |
|----------|---------|-------------------|
| **TikTok** | Comments, Likes, Shares, Views | TikTok Data Export ZIP |
| **YouTube** | Comments, Likes, View count | YouTube Studio Export |
| **Instagram** | Comments, Likes, Followers | Instagram Data Download |
| **Twitter/X** | Tweets, Replies, Likes | Twitter Archive ZIP |

**Unified Dashboard — so sánh giữa các nền tảng:**
```
📊 So sánh Engagement (Tháng 1/2025)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                Facebook  TikTok  YouTube  Instagram
Tổng tương tác: 45,230    89,400   12,300   23,100
Tăng trưởng:    +8%       +23%     +5%      +12%
Engagement rate: 3.2%     8.4%     2.1%     4.5%
Top nền tảng:   ⭐⭐       ⭐⭐⭐⭐   ⭐        ⭐⭐
```

#### 6.2 API Public (Cho Developer)

**REST API để tích hợp với hệ thống khác:**
```
GET  /api/v1/workspaces/{id}/stats
GET  /api/v1/workspaces/{id}/imports
POST /api/v1/workspaces/{id}/imports
GET  /api/v1/workspaces/{id}/comments?sentiment=negative
GET  /api/v1/workspaces/{id}/reports/generate

Authorization: Bearer {api_key}
```

**API Key management:**
```typescript
// Admin tạo API key cho workspace
const apiKey = await createApiKey({
  workspaceId: "ws123",
  name: "Marketing Dashboard Integration",
  scopes: ["read:imports", "read:stats"],
  expiresAt: addMonths(new Date(), 6),
});
```

---

## 🏛️ CẢI TIẾN KỸ THUẬT QUAN TRỌNG

### Thay Đổi Data Architecture

#### Hiện tại (vấn đề)
```
imports/{id}                     ← Tốt
└── commentChunks/{chunkId}      ← Tốt, nhưng không query được
    └── items: CommentItem[]     ← Không thể filter/search/sort
```

#### Đề xuất (scalable)
```
imports/{id}                     ← Giữ nguyên metadata
├── commentChunks/{chunkId}      ← Giữ cho bulk reads
└── commentsIndex/{commentId}    ← THÊM MỚI: 1 doc/comment
    ├── authorName: string       ← Có thể query được
    ├── commentTime: timestamp   ← Index được
    ├── sentiment: string        ← Filter được
    └── importId: string         ← Join được
```

Hoặc chuyển sang **Algolia/Typesense** để full-text search trên comments.

### Real-time Architecture

```typescript
// Thay getDocs() → onSnapshot() cho real-time updates
// Mọi thành viên team thấy data mới ngay lập tức
useEffect(() => {
  const q = query(
    collection(db, "workspaces", workspaceId, "imports"),
    orderBy("importedAt", "desc"),
    limit(20)
  );
  
  const unsub = onSnapshot(q, (snap) => {
    const imports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setImports(imports);
    
    // Thông báo khi có import mới
    snap.docChanges().forEach(change => {
      if (change.type === "added") {
        notification.success({
          message: "Dữ liệu mới",
          description: `Import "${change.doc.data().accountName}" vừa được thêm`,
        });
      }
    });
  });
  
  return () => unsub();
}, [workspaceId]);
```

### State Management Upgrade

```typescript
// Thay Context API thuần → Zustand cho state phức tạp hơn
// npm install zustand

import { create } from "zustand";

interface AppStore {
  currentWorkspace: Workspace | null;
  imports: ImportRecord[];
  filters: FilterState;
  
  setWorkspace: (ws: Workspace) => void;
  setFilter: (f: Partial<FilterState>) => void;
  addImport: (imp: ImportRecord) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentWorkspace: null,
  imports: [],
  filters: {},
  
  setWorkspace: (ws) => set({ currentWorkspace: ws }),
  setFilter: (f) => set(state => ({ filters: { ...state.filters, ...f } })),
  addImport: (imp) => set(state => ({ imports: [imp, ...state.imports] })),
}));
```

---

## 📱 UX/UI REDESIGN ROADMAP

### Navigation Structure Mới
```
╔══════════════════════════════════════════════════════════╗
║  📊 FB Pulse Tracker          [Workspace ▼]  [User ▼]   ║
╠══════════════╦═══════════════════════════════════════════╣
║              ║                                           ║
║  🏠 Overview ║            MAIN CONTENT AREA             ║
║  📥 Imports  ║                                           ║
║  📈 Analytics║                                           ║
║  💬 Comments ║                                           ║
║  📊 Reports  ║                                           ║
║  🔔 Alerts   ║                                           ║
║  ⚙️ Settings ║                                           ║
║              ║                                           ║
╚══════════════╩═══════════════════════════════════════════╝
```

### Theme System
```typescript
// Hỗ trợ Dark/Light mode
const { setTheme } = useTheme();

// Dark: #0a0e27 background (hiện tại)
// Light: #f5f7fa background (thêm mới)
// System: theo OS preference

// Sử dụng CSS variables:
:root[data-theme="dark"] {
  --bg-primary: #0a0e27;
  --bg-card: #151b3d;
  --text-primary: #ffffff;
}
:root[data-theme="light"] {
  --bg-primary: #f5f7fa;
  --bg-card: #ffffff;
  --text-primary: #1a1a2e;
}
```

### Mobile App (PWA)
```typescript
// vite.config.ts - thêm PWA plugin
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "FB Pulse Tracker",
        short_name: "FBPulse",
        theme_color: "#0a0e27",
        icons: [/* ... */],
      },
    }),
  ],
});
```

---

## 🛠️ TECH STACK NÂNG CẤP ĐỀ XUẤT

| Hạng mục | Hiện tại | Đề xuất Giai Đoạn 1 | Đề xuất Giai Đoạn 3+ |
|----------|---------|---------------------|----------------------|
| **Frontend** | React 19 + Vite | Giữ nguyên | Giữ nguyên |
| **State** | Context API | Zustand | Zustand |
| **Backend** | Firebase only | Firebase + Cloud Functions | Firebase + Cloud Functions + API |
| **Search** | Client-side filter | Client-side | Algolia / Typesense |
| **AI** | — | Claude API (Haiku) | Claude API (Sonnet) |
| **Email** | — | Firebase Ext. (SendGrid) | SendGrid |
| **Payment** | — | Stripe | Stripe |
| **PDF** | — | Puppeteer / jsPDF | Puppeteer (Cloud Function) |
| **Monitoring** | — | Sentry | Sentry + Firebase Analytics |
| **Testing** | — | Vitest + RTL | Vitest + RTL + Playwright E2E |
| **CI/CD** | — | GitHub Actions | GitHub Actions |
| **Hosting** | Vercel | Vercel | Vercel (hoặc Firebase Hosting) |

---

## 📊 KPI THEO DÕI SẢN PHẨM

### Technical KPIs
| Metric | Baseline (hiện tại) | Target Q1 | Target Q2 |
|--------|--------------------|-----------|-----------| 
| Test coverage | 0% | 60% | 80% |
| TypeScript strict errors | Nhiều | 0 | 0 |
| Lighthouse score | ~70 | 85+ | 90+ |
| p95 Page load time | ~3s | <2s | <1.5s |
| Firebase reads/session | ~5000 | <1000 | <500 |

### Business KPIs (Sau khi ra mắt)
| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Users đăng ký | 50 | 200 | 500 |
| Paying users | 0 | 20 | 80 |
| MRR | 0đ | 6M VNĐ | 25M VNĐ |
| Churn rate | — | <10% | <7% |

---

## 🚦 QUYẾT ĐỊNH CHIẾN LƯỢC QUAN TRỌNG

### Câu Hỏi Cần Trả Lời Trước Khi Phát Triển

**1. Ai là khách hàng chính?**
- Cá nhân (content creator) → Tập trung UX đơn giản, giá rẻ
- Doanh nghiệp (SMB) → Tập trung workspace, team features
- Agency → Tập trung white-label, multi-client, API

**2. Chiến lược data privacy?**
- Dữ liệu Facebook của người dùng rất nhạy cảm
- Cần Privacy Policy rõ ràng
- GDPR compliance nếu có user EU
- Tùy chọn Self-hosted cho enterprise

**3. Cạnh tranh với ai?**
- Fanpage Karma, Sprout Social, Hootsuite Analytics → Quá lớn, khác segment
- Điểm khác biệt của FB Pulse: **Import file offline** (không cần API Facebook) → niche market tốt
- Tiếp tục phát triển USP: "Không cần API key Facebook, không cần kết nối app"

**4. Monetization timeline?**
- Nên miễn phí 3-6 tháng đầu → Build user base → Chuyển sang freemium
- Free tier phải đủ hữu ích để users quay lại

---

## 📋 CHECKLIST TRƯỚC KHI DEPLOY PRODUCTION

### Technical Checklist
- [ ] Firestore Security Rules được kiểm tra và test kỹ
- [ ] `.env` files không được commit lên Git
- [ ] Firebase App Check được bật
- [ ] HTTPS enforced (Vercel tự làm)
- [ ] Error reporting (Sentry) được setup
- [ ] Firebase Usage Limits được cấu hình (tránh bill bất ngờ)
- [ ] CDN cho static assets
- [ ] Database backups được setup
- [ ] Monitoring alerts (Firebase > 80% quota)

### Legal & Business Checklist
- [ ] **Terms of Service** — quy định sử dụng
- [ ] **Privacy Policy** — cách xử lý dữ liệu cá nhân
- [ ] **Cookie Policy** (nếu cần)
- [ ] Đăng ký domain `.com` hoặc `.vn` chính thức
- [ ] Business email (hello@fbpulse.vn)
- [ ] Social media accounts cho sản phẩm

### UX Checklist
- [ ] Landing page giới thiệu sản phẩm
- [ ] Onboarding flow cho user mới (guided tour)
- [ ] Empty states có hướng dẫn rõ ràng
- [ ] Error messages thân thiện (không hiện stack trace)
- [ ] Mobile responsive được test trên thực tế
- [ ] Loading states cho mọi async operation

---

## 🎯 NEXT ACTIONS — BẮT ĐẦU TỪ ĐÂU?

```
🔵 Tuần này (Critical Path):
   1. Fix Firestore Security Rules  ← Bảo mật trước tiên
   2. Add TypeScript types           ← Foundation
   3. Fix role-based UI guards       ← Security

🟢 Tháng 1:
   4. Setup Vitest + 1st tests
   5. Implement cursor pagination
   6. Add Heatmap + Timeline charts
   7. Add Word Cloud component

🟡 Tháng 2-3:
   8. Integrate Claude API for sentiment
   9. Add scheduled PDF reports
   10. Setup GitHub Actions CI/CD

🟠 Tháng 4-6:
   11. Workspace multi-tenant architecture
   12. Stripe payment integration
   13. Landing page + SEO
   14. Beta launch với 50 users
```

---

## 💡 TÀI NGUYÊN THAM KHẢO

### Documentation
- [Firebase Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firebase Security Rules Guide](https://firebase.google.com/docs/rules)
- [Ant Design 6 Components](https://ant.design/components/overview)
- [ECharts Documentation](https://echarts.apache.org/en/api.html)
- [Claude API Reference](https://docs.anthropic.com/en/api/getting-started)

### Tools hỗ trợ phát triển
- **Figma** — UI/UX Design & Prototyping
- **Postman** — API testing
- **Firebase Emulator** — Local development không tốn phí
- **Playwright** — E2E testing
- **Stripe CLI** — Test payment locally

### Inspiration Products
- **Sprout Social** — UI/UX reference cho analytics dashboard
- **Mixpanel** — Cách hiển thị behavioral analytics
- **Notion** — Workspace & collaboration patterns
- **Linear** — Modern SaaS UX patterns

---

*Tài liệu này được soạn thảo ngày 23/05/2026 dựa trên phân tích toàn diện codebase hiện tại.*  
*Cập nhật lại sau mỗi milestone hoặc khi có thay đổi chiến lược sản phẩm.*
