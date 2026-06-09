# Hướng Phát Triển – FB Pulse Tracker

## 1. Tình trạng project hiện tại

### ✅ Đã làm tốt
- Import ZIP → parse → lưu Firestore hoàn chỉnh
- Dashboard + 6 biểu đồ Analytics hoạt động
- Xác thực Google + phân quyền Admin/Viewer
- 274 unit tests + CI/CD GitHub Actions
- Seeding Manager cơ bản: CRUD chiến dịch, profiles, thư viện bình luận, export/import Excel

### ⚠️ Điểm yếu hiện tại của Seeding Manager
| Vấn đề | Chi tiết |
|--------|----------|
| **Chưa có AI** | Có 4 Cloud Functions AI cho seeding (`generateSeedingIdeas`, `classifyIntent`, `scoreLeads`, `extractSeoKeywords`) nhưng chưa được tích hợp vào SeedingPage |
| **Thủ công 100%** | Người dùng phải tự tạo từng task, tự chọn profile, tự viết comment |
| **Không có gợi ý** | Không có gợi ý nội dung, không chấm điểm profile hiệu quả |
| **Không có phân tích** | Sau khi campaign xong, không có báo cáo kết quả chi tiết |
| **Thư viện bình luận** | Chưa được AI hỗ trợ sinh nội dung, chỉ nhập tay |

---

## 2. Hướng phát triển trọng tâm – AI Agent cho Seeding Manager

### Ý tưởng cốt lõi
Biến Seeding Manager từ **công cụ quản lý thủ công** thành **AI Agent tự động hóa** toàn bộ quy trình seeding:

> Người dùng chỉ cần nhập **mục tiêu + URL** → AI tự đề xuất nội dung → người dùng chọn → hệ thống tạo task tự động

---

### Tính năng cần phát triển (theo thứ tự ưu tiên)

#### 🔴 Ưu tiên cao – Làm trước

**Tính năng 1: AI Gợi ý nội dung bình luận thông minh**
- Khi tạo campaign, bấm nút "AI gợi ý" → Gemini đề xuất 5-8 nội dung bình luận phù hợp với URL target
- Source: Cloud Function `generateSeedingIdeas` đã có sẵn, chỉ cần nối vào UI
- File cần thêm code: `SeedingPage.tsx` → tab Chiến dịch → modal tạo task
- Có nút "Thêm vào thư viện" để lưu comment hay vào `seedingComments`

**Tính năng 2: Phân loại ý định từ bình luận thực tế**
- Sau khi import dữ liệu Facebook, tại CommentsPage có thể "Phân tích ý định" → AI phân loại buy/inquiry/complaint/compliment
- Source: Cloud Function `classifyIntent` đã có sẵn
- Kết quả hiện thị badge màu trên từng bình luận

**Tính năng 3: Chấm điểm profile hiệu quả**
- Dựa trên lịch sử task (success/failed), tự động tính điểm profile từ 0-100
- Profile điểm cao được ưu tiên gợi ý khi tạo bulk tasks mới
- File cần sửa: `seedingService.ts` + `SeedingPage.tsx` tab Profiles

---

#### 🟡 Ưu tiên trung bình – Làm sau

**Tính năng 4: AI Agent lập kế hoạch chiến dịch**
- Người dùng nhập: *"Tôi muốn tăng tương tác cho page X, URL: ..."*
- AI tự đề xuất: số lượng task, loại hành động (like/comment/share), nội dung, thời gian delay phù hợp
- Cần xây dựng Cloud Function mới: `planCampaign`

**Tính năng 5: Báo cáo chiến dịch sau khi hoàn thành**
- Sau khi import report từ GPM, AI tóm tắt kết quả: tỷ lệ thành công, profile nào hiệu quả, gợi ý cải thiện
- Hiện tại chỉ có bảng số liệu thô, chưa có phân tích

**Tính năng 6: Lên lịch và nhắc nhở**
- Thêm trường `scheduledAt` vào Campaign, hệ thống nhắc khi đến giờ export task
- Hiển thị campaign timeline trực quan

---

#### 🟢 Ưu tiên thấp – Dài hạn

**Tính năng 7: Dashboard Seeding riêng**
- Trang thống kê riêng cho Seeding: tổng task, tỷ lệ thành công theo ngày, top profile
- Biểu đồ xu hướng chiến dịch theo thời gian

**Tính năng 8: Template chiến dịch**
- Lưu lại cấu hình chiến dịch thành công thành template, tái sử dụng cho lần sau

---

## 3. Kế hoạch thực hiện cụ thể

### Bước 1 – Nối AI vào UI (1-2 ngày)
```
SeedingPage.tsx
  → Tab "Chiến dịch" → Modal tạo task
  → Thêm nút "✨ AI gợi ý nội dung"
  → Gọi generateSeedingIdeasWithAI() (đã có trong aiExtendedService.ts)
  → Hiển thị danh sách gợi ý → cho phép chọn và thêm vào thư viện
```

### Bước 2 – Chấm điểm profile (1 ngày)
```
seedingService.ts
  → Thêm hàm getProfileStats(profileId) đọc lịch sử task
  → Tính successRate = success / (success + failed)
SeedingPage.tsx Tab Profiles
  → Hiển thị cột "Hiệu quả %" với thanh progress bar
  → Sort profile theo hiệu quả mặc định
```

### Bước 3 – Báo cáo campaign AI (2 ngày)
```
functions/src/index.ts
  → Thêm Cloud Function: summarizeCampaignResult(tasks[])
  → Trả về: tỷ lệ thành công, profile tốt nhất, gợi ý cải thiện

SeedingPage.tsx Tab Chiến dịch
  → Sau khi import report xong
  → Nút "Xem phân tích AI" → gọi Cloud Function → hiển thị trong modal
```

### Bước 4 – AI lập kế hoạch (3-5 ngày)
```
functions/src/index.ts
  → Cloud Function mới: planCampaign(goal, targetUrl, profileCount)
  → Gemini đề xuất: action mix, số lượng, delay, nội dung mẫu

SeedingPage.tsx
  → Thêm tab "🤖 AI Planner"
  → Form nhập: mục tiêu, URL, số profiles
  → Hiển thị kế hoạch → nút "Áp dụng" để tạo campaign + tasks tự động
```

---

## 4. Cấu trúc file cần tạo/sửa

```
src/
├── service/
│   └── aiSeedingService.ts        ← [MỚI] Wrapper gọi AI cho Seeding
├── pages/
│   └── SeedingPage.tsx            ← [SỬA] Thêm AI features vào 3 tab
├── components/
│   └── AiCampaignPlanner.tsx      ← [MỚI] Component AI Planner
│   └── SeedingStatsPanel.tsx      ← [MỚI] Báo cáo chiến dịch
functions/
└── src/
    └── index.ts                   ← [SỬA] Thêm planCampaign, summarizeCampaignResult
```

---

## 5. Tóm tắt nhanh (Phần AI Agent)

| Thứ tự | Tính năng | Độ khó | Thời gian ước tính |
|--------|-----------|--------|-------------------|
| 1 | AI gợi ý nội dung bình luận | Dễ (Cloud Function có sẵn) | 1 ngày |
| 2 | Chấm điểm profile hiệu quả | Dễ | 1 ngày |
| 3 | Phân loại ý định bình luận | Dễ (Cloud Function có sẵn) | 1 ngày |
| 4 | Báo cáo campaign AI | Trung bình | 2 ngày |
| 5 | AI Planner lập kế hoạch | Khó | 3-5 ngày |
| 6 | Dashboard Seeding | Trung bình | 2 ngày |

---

## 6. Tích hợp GPM Login API – Tự động hóa hoàn toàn

### 6.1. GPM hiện đang kết nối như thế nào?

Hiện tại project dùng **bridge thủ công qua Excel/CSV**:

```
Web → Export Excel → [Người dùng tự] → GPM Automate → [Chạy] → Export report → [Người dùng tự] → Web import
```

Đây là điểm bottleneck lớn nhất — con người phải làm thủ công 4 bước giữa chừng.

---

### 6.2. GPM Login có REST API không?

**Có.** GPM Login cung cấp REST API chạy cục bộ tại `http://127.0.0.1:19995`.

Các endpoint quan trọng:

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `GET /api/v3/profiles` | GET | Lấy danh sách tất cả profiles |
| `GET /api/v3/profile/{id}` | GET | Lấy thông tin 1 profile |
| `GET /api/v3/profiles/start/{id}` | GET | Mở profile (trả về `remote_debugging_port`) |
| `GET /api/v3/profiles/close/{id}` | GET | Đóng profile |
| `POST /api/v3/profiles/update/{id}` | POST | Cập nhật thông tin profile |

> Tài liệu đầy đủ trong thư mục cài GPM: `<GPM_APP_FOLDER>/docs/api_v2.html`

---

### 6.3. Vấn đề kỹ thuật: Web app không gọi trực tiếp được localhost GPM

**Tại sao?**

Ứng dụng web chạy trên trình duyệt (hoặc Vercel) **không thể gọi `http://127.0.0.1:19995`** vì:
- CORS: trình duyệt chặn cross-origin request đến localhost
- Web app deploy trên cloud không có truy cập vào máy local của bạn
- Bảo mật: không thể expose GPM API ra internet

**Giải pháp:** Cần một **Bridge Service** chạy trên máy local của bạn làm trung gian.

---

### 6.4. Kiến trúc tích hợp GPM API (đề xuất)

```
┌─────────────────────────────────────────────────────────────┐
│  FB Pulse Tracker (Web - Vercel)                            │
│                                                             │
│  SeedingPage → Firebase Firestore (lệnh pending)           │
└────────────────────────┬────────────────────────────────────┘
                         │ onSnapshot (realtime)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  GPM Bridge Agent (chạy trên máy bạn - Node.js)           │
│                                                             │
│  1. Lắng nghe Firestore: task status = "pending"           │
│  2. Gọi GPM Login API: mở profile → lấy debug port        │
│  3. Điều khiển browser (Puppeteer): thực hiện action      │
│  4. Ghi kết quả ngược lại Firestore: status = "success"   │
└──────────────┬──────────────────────────────────────────────┘
               │ REST API localhost:19995
               ▼
┌─────────────────────────────────────────────────────────────┐
│  GPM Login (chạy trên máy bạn)                             │
│  ├── Profile A → Chrome instance (port 9222)               │
│  ├── Profile B → Chrome instance (port 9223)               │
│  └── Profile C → Chrome instance (port 9224)               │
└─────────────────────────────────────────────────────────────┘
```

---

### 6.5. Cách xây dựng GPM Bridge Agent

**Công nghệ:** Node.js + Firebase SDK + Puppeteer

**File cần tạo:** `gpm-bridge/` (thư mục riêng trong project)

```
gpm-bridge/
├── package.json
├── .env                 ← Firebase credentials + GPM config
├── src/
│   ├── index.ts         ← Entry point, lắng nghe Firestore
│   ├── gpmClient.ts     ← Wrapper gọi GPM Login REST API
│   ├── browserAgent.ts  ← Điều khiển browser bằng Puppeteer
│   └── taskRunner.ts    ← Logic chạy từng loại task (like/comment/share)
```

**Luồng hoạt động:**

```typescript
// Bước 1: Bridge lắng nghe Firestore realtime
onSnapshot(query(tasksRef, where("status", "==", "pending")), async (snap) => {
  for (const taskDoc of snap.docs) {
    const task = taskDoc.data();
    
    // Bước 2: Gọi GPM API mở profile
    const res = await fetch(`http://127.0.0.1:19995/api/v3/profiles/start/${task.profileId}`);
    const { remote_debugging_port } = await res.json();
    
    // Bước 3: Puppeteer kết nối vào Chrome đang chạy
    const browser = await puppeteer.connect({
      browserURL: `http://localhost:${remote_debugging_port}`
    });
    
    // Bước 4: Thực hiện action
    await performAction(browser, task); // like / comment / share
    
    // Bước 5: Cập nhật kết quả vào Firestore
    await updateDoc(taskDoc.ref, { status: "success", finishedAt: serverTimestamp() });
    
    // Bước 6: Đóng profile
    await fetch(`http://127.0.0.1:19995/api/v3/profiles/close/${task.profileId}`);
  }
});
```

---

### 6.6. Luồng hoàn chỉnh khi có GPM Bridge

Sau khi tích hợp, quy trình sẽ **hoàn toàn tự động**:

```
1. Web: Tạo campaign + tasks (status = "pending")
2. Web: Nhấn "Bắt đầu chạy" → update campaign status = "active"
3. Bridge (máy local): Tự động phát hiện tasks mới
4. Bridge: Mở profile qua GPM Login API
5. Bridge: Puppeteer thực hiện like/comment/share trên Facebook
6. Bridge: Ghi kết quả ngay vào Firestore
7. Web: Tự động cập nhật real-time (không cần import report thủ công)
```

**Người dùng chỉ cần:** Tạo campaign → nhấn Start → xem kết quả real-time. Không còn export/import Excel nữa.

---

### 6.7. Những điểm cần lưu ý

| Vấn đề | Chi tiết |
|--------|----------|
| **GPM phải đang chạy** | Bridge chỉ hoạt động khi GPM Login đang mở trên máy |
| **Bridge phải chạy liên tục** | Cần giữ `node gpm-bridge` luôn chạy background trên máy |
| **Puppeteer thực hiện action thật** | Cần viết đúng selector Facebook (có thể thay đổi theo phiên bản FB) |
| **Rủi ro bị khóa tài khoản** | Cần delay hợp lý giữa các task, không spam quá nhanh |
| **Không cần deploy** | Bridge chạy local, không cần server, không cần chi phí cloud |

---

### 6.8. Kế hoạch thực hiện GPM Bridge

| Bước | Việc làm | Thời gian |
|------|----------|-----------|
| 1 | Khởi tạo thư mục `gpm-bridge/`, cài `firebase-admin` + `puppeteer` | 0.5 ngày |
| 2 | Viết `gpmClient.ts`: gọi API `/profiles/start` và `/profiles/close` | 0.5 ngày |
| 3 | Viết `browserAgent.ts`: connect Puppeteer vào Chrome của GPM | 1 ngày |
| 4 | Viết `taskRunner.ts`: logic like/comment/share trên Facebook | 2-3 ngày |
| 5 | Lắng nghe Firestore, chạy tasks tuần tự, ghi kết quả | 1 ngày |
| 6 | Test với 3 loại task, xử lý lỗi và edge case | 2 ngày |

**Tổng thời gian ước tính GPM Bridge: 7-8 ngày làm việc**

---

### 6.9. So sánh trước và sau khi tích hợp GPM API

| Tiêu chí | Hiện tại (Excel Bridge) | Sau khi tích hợp GPM API |
|----------|------------------------|--------------------------|
| Số bước thủ công | 4 bước | 1 bước (nhấn Start) |
| Thời gian cập nhật kết quả | Sau khi chạy xong, import thủ công | Real-time ngay khi task hoàn thành |
| Khả năng theo dõi | Không biết đang chạy task nào | Biết chính xác task nào đang chạy |
| Xử lý lỗi | Sau sự thật (đọc report) | Ngay lập tức, có thể retry tự động |
| Mức độ tự động hóa | ~40% | ~95% |

---

## 7. Tổng hợp lộ trình phát triển đầy đủ

| Giai đoạn | Nội dung | Thời gian |
|-----------|----------|-----------|
| **Giai đoạn 1** | Nối AI vào UI Seeding (gợi ý nội dung, chấm điểm profile) | 2-3 ngày |
| **Giai đoạn 2** | Báo cáo AI + AI Planner lập kế hoạch | 5-7 ngày |
| **Giai đoạn 3** | Xây dựng GPM Bridge Agent (Node.js local) | 7-8 ngày |
| **Giai đoạn 4** | Hoàn thiện: Dashboard Seeding, template, retry logic | 3-4 ngày |

**Tổng: ~17-22 ngày → Kết quả: Seeding Manager hoàn toàn tự động với AI + GPM**

---

> **Ghi chú quan trọng:**
> - Giai đoạn 1 & 2 không phụ thuộc vào GPM Bridge, có thể làm song song hoặc trước.
> - GPM Bridge cần GPM Login đang chạy trên máy bạn. Không cần server riêng, không tốn chi phí cloud thêm.
> - Selector Facebook trong Puppeteer cần được kiểm tra và cập nhật định kỳ vì Facebook thường thay đổi DOM.
> - Nên dùng **delay ngẫu nhiên 5-30 giây** giữa các action để tránh bị Facebook phát hiện bot.
