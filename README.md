# FB Pulse Tracker

Một nền tảng phân tích dữ liệu Facebook nội bộ với khả năng phân tích bình luận bằng AI, hỗ trợ import dữ liệu từ Facebook ZIP và export báo cáo chi tiết.

---

## Tính năng

### Phân tích dữ liệu
- **Import Facebook ZIP**: Tải lên file ZIP xuất ra từ Facebook (Comments & Reactions)
- **Phân tích Sentiment**: Phân loại bình luận theo cảm xúc (Tích cực, Tiêu cực, Trung lập)
- **Phân tích Intent**: Nhận diện ý định người dùng (Mua hàng, Hỏi thông tin, Feedback, ...)
- **AI Gemini Integration**: Sử dụng Google Gemini API để phân tích. Fallback rule-based tự động kích hoạt khi API lỗi

### Quản lý Seeding
- Tạo và quản lý chiến dịch seeding
- AI Planner hỗ trợ sinh ý tưởng nội dung
- Theo dõi trạng thái và hiệu quả seeding

### Xuất dữ liệu
- Export CSV, JSON, XLSX
- Báo cáo chi tiết theo chiến dịch

---

## Công nghệ

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| UI Library | Ant Design 6 |
| Charts | ECharts |
| Backend | Firebase (Auth + Firestore) |
| AI | Google Gemini API |
| Cloud Functions | Firebase Cloud Functions (Node.js 20) |

---

## Cài đặt

### Yêu cầu
- Node.js 18+
- Firebase project (Auth + Firestore)
- Google Gemini API Key

### 1. Clone và cài đặt dependencies
```bash
git clone <repository-url>
npm install
```

### 2. Cấu hình file `.env`
```bash
cp .env.example .env
```

Cập nhật các biến môi trường:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_key
VITE_GEMINI_MODEL=gemini-2.0-flash
```

### 3. Chạy ứng dụng
```bash
npm run dev
```

Frontend chạy tại: http://localhost:5173

### 4. Deploy Cloud Functions (tùy chọn)
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

---

## Phân quyền

Hệ thống sử dụng cơ chế **whitelist** - chỉ tài khoản được phê duyệt mới truy cập được.

| Role | Mô tả |
|------|--------|
| **Viewer** (role=0) | Xem dashboard, imports, comments, analytics, seeding reports |
| **Admin** (role=1) | Toàn quyền CRUD, quản lý tài khoản, tạo chiến dịch seeding |

### Thiết lập Admin đầu tiên

1. Vào **Firebase Console > Authentication**, bật **Email/Password**
2. Tạo user mới, copy **User UID**
3. Trong **Firestore**, tạo collection `allowedAccounts`
4. Tạo document với ID = User UID:
   ```
   email: admin@example.com
   displayName: Admin
   role: 1
   ```
5. Deploy Firestore rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## Cấu trúc thư mục

```
├── src/
│   ├── components/       # UI components
│   ├── contexts/         # React contexts (Auth, Theme, Loading)
│   ├── hooks/            # Custom hooks
│   ├── pages/            # Page components
│   ├── service/          # Business logic services
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── functions/            # Firebase Cloud Functions
│   └── src/index.ts      # AI functions (sentiment, summarize, keywords...)
├── docs/                 # Documentation
├── public/               # Static assets
└── .env.example          # Environment template
```

---

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Lint code
npm run preview  # Preview production build
```

---

## License

Private - Internal Use Only
