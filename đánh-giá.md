# 📋 BÁO CÁO ĐÁNH GIÁ DỰ ÁN: FB Pulse Tracker

> **Người đánh giá:** Claude Code (AI Code Review)  
> **Ngày đánh giá:** 23/05/2026  
> **Phiên bản được đánh giá:** 0.0.0 (json-tool-main)  
> **Công nghệ chính:** React 19 · TypeScript · Vite 7 · Ant Design 6 · Firebase 12 · ECharts

---

## 🎯 MỤC ĐÍCH DỰ ÁN

**FB Pulse Tracker** là ứng dụng web phân tích dữ liệu engagement từ Facebook. Người dùng có thể:
- Import file ZIP chứa dữ liệu Facebook Data Export (comments, reactions)
- Xem thống kê tổng hợp trên dashboard (likes, comments, số lần import)
- Trực quan hóa dữ liệu qua biểu đồ ECharts
- Lọc dữ liệu theo khoảng ngày và tên tài khoản
- Xuất báo cáo Excel
- Quản lý quyền truy cập qua Admin Panel (Google OAuth + Firestore whitelist)

---

## ✅ ƯU ĐIỂM (STRENGTHS)

### 1. Stack Công Nghệ Hiện Đại
- Sử dụng **React 19**, **Vite 7**, **TypeScript 5.9**, **Ant Design 6** — tất cả đều ở phiên bản mới nhất
- **Firebase 12.7** cho backend serverless, không cần tự quản lý server
- **ECharts 6** cho data visualization chuyên nghiệp
- **Vercel** deployment với cấu hình SPA rewrites đúng chuẩn

### 2. Kiến Trúc Tổ Chức Rõ Ràng
```
src/
├── components/    ← UI components
├── contexts/      ← Global state (Auth, Loading)
├── hooks/         ← Business logic tách biệt
├── pages/         ← Route-level components
├── service/       ← Firebase initialization
└── styles/        ← SCSS modular theo component
```
- Separation of concerns tốt giữa UI và logic
- Custom hooks tách biệt rõ ràng: `useStats`, `useAccountsTable`, `useImportComments`, `useImportReactions`

### 3. Xử Lý Dữ Liệu Thông Minh

#### Chunking Strategy
```typescript
const COMMENT_CHUNK_SIZE = 700;   // Tránh giới hạn 1MB/document của Firestore
const REACTION_CHUNK_SIZE = 2000;
```
Giải pháp tốt để xử lý Firestore document size limit — dữ liệu lớn được phân thành nhiều chunk nhỏ trong subcollections.

#### Nested ZIP & UTF-8 Decoding
- Hỗ trợ ZIP lồng nhau (ZIP chứa ZIP) — rất cần thiết cho Facebook Data Export
- Giải mã chính xác encoding UTF-8 bị hỏng của Facebook
- Bỏ qua thư mục macOS metadata (`__MACOSX`)

### 4. Hệ Thống Xác Thực & Phân Quyền
- **Google OAuth** tích hợp Firebase Auth
- **Whitelist-based**: Chỉ email trong collection `allowedAccounts` được phép truy cập
- **Role-based**: `role: 0` (read-only) vs `role: 1` (admin)
- Admin không thể xóa chính mình hoặc tự hạ quyền — ngăn chặn privilege escalation
- `LoadingContext` quản lý trạng thái loading toàn cục với multiple loading keys

### 5. Tính Năng Hoàn Chỉnh Cho Use Case
- Import → Parse → Store → Visualize → Export — pipeline đầy đủ
- Filter theo ngày, tên tài khoản, min likes/comments
- Export Excel toàn bộ hoặc theo lựa chọn
- Delete với xác nhận và cascade delete subcollections
- Responsive design cho mobile

### 6. Một Số Kỹ Thuật React Tốt
- `forwardRef` + `useImperativeHandle` cho `AccountsTable` và `ImportZip` — pattern đúng để expose imperative API
- `useMemo` để stabilize filter objects tránh re-render không cần thiết
- Context Provider pattern chuẩn cho AuthContext và LoadingContext

---

## ❌ NHƯỢC ĐIỂM & VẤN ĐỀ HIỆN TẠI

### 🔴 Nghiêm Trọng (Critical)

#### 1. Mất An Toàn Type — TypeScript Bị "Vô Hiệu Hóa"
File `AccountsTable.tsx` lines 49–63 có nhiều `// @ts-ignore` và ép kiểu `as any`:
```typescript
// @ts-ignore
name: (filter as any).name,
// @ts-ignore
minLikes: (filter as any).minLikes,
```
Trong `useStats.tsx`, `useAccountsTable.tsx`, `ImportFolder.tsx` dùng `any` rất nhiều:
```typescript
const [selectedImport, setSelectedImport] = useState<any>(null);  // AccountsTable
const decodeFacebookObject = (obj: any): any => { ... }  // ImportFolder
```
**Vấn đề:** Toàn bộ giá trị của TypeScript bị mất — lỗi type sẽ chỉ xuất hiện ở runtime.

#### 2. Không Có Test Nào
- 0 file test trong toàn bộ project
- Không có unit test, integration test, hay E2E test
- Mọi thay đổi đều có nguy cơ gây regression mà không phát hiện được

#### 3. Vấn Đề Bảo Mật Phía Client
**Nút "Xóa tất cả dữ liệu" hiển thị với tất cả users:**
```typescript
// Header.tsx - không check role trước khi render nút Delete All
<Button danger icon={<DeleteOutlined />} onClick={handleDeleteAll}>
  Xóa tất cả dữ liệu
</Button>
```
Nút này nên bị ẩn với `role: 0` (read-only users).

**Firestore Security Rules không thấy trong codebase** — nếu rules đang ở chế độ `allow read, write: if true` (mặc định khi test) thì bất kỳ ai có Firebase config cũng có thể đọc/ghi toàn bộ database mà không cần xác thực.

#### 4. Logic Xác Thực Bị Nhân Đôi
`AuthContext.tsx` có cùng một đoạn code kiểm tra Firestore allowedAccounts **hai lần** — một lần trong `onAuthStateChanged` handler và một lần trong `loginWithGoogle`:
```typescript
// Đoạn code này lặp lại y hệt ở cả 2 nơi (lines 70-97 và 121-138)
const q = query(collection(db, "allowedAccounts"), where("email", "==", email));
const snap = await getDocs(q);
if (snap.empty) { ... } else { ... }
```
Nếu logic thay đổi, phải sửa 2 chỗ → dễ bỏ sót.

### 🟠 Quan Trọng (Important)

#### 5. Hiệu Suất Firestore Kém Khi Có Date Filter
Khi lọc theo ngày, `useStats` và `useAccountsTable` đều phải:
1. Fetch **toàn bộ** collection `imports`
2. Với **từng** import → fetch **toàn bộ** `commentChunks` và `reactionChunks`
3. Duyệt từng item để kiểm tra timestamp

Với 100 imports × 10 chunks × 700 items = **700,000 document reads** chỉ để hiển thị stats!

Ngoài ra, **không có pagination** — toàn bộ dữ liệu được load vào bộ nhớ:
```typescript
// useAccountsTable.tsx - lấy ALL documents
const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
const snapshot = await getDocs(q);
```

#### 6. Vấn Đề ESLint Dependencies Bị Suppress
Nhiều chỗ dùng `// eslint-disable-next-line react-hooks/exhaustive-deps` để tắt cảnh báo thay vì sửa đúng:
```typescript
// HomePage.tsx
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  advancedFilter?.from ? advancedFilter.from.getTime() : null,
  ...
]);
```
Đây là dấu hiệu của dependency array chưa được thiết kế đúng.

#### 7. Code Bị Comment Trong Production
```typescript
// ImportFolder.tsx, line 41
// const [loading, setLoading] = useState(false);
```
Code chết nên được xóa, không giữ lại dưới dạng comment.

#### 8. Logic Lỗi Trong `handleFilterClick`
```typescript
// Header.tsx
const handleFilterClick = () => {
  try {
    showLoading("apply-advanced-filter");
    // ... xử lý filter ...
  } finally {
    closeLoading("apply-advanced-filter"); // closeLoading gọi TRƯỚC khi thực sự fetch
  }
  if (!range && !selectedAccounts?.length) {
    return; // Early return ở đây không có tác dụng gì vì closeLoading đã chạy rồi
  }
};
```
`closeLoading` được gọi ngay lập tức sau khi `showLoading`, không có async operation nào ở giữa — overlay loading sẽ chỉ hiện trong tích tắc.

#### 9. Header.tsx Quá Nhiều Trách Nhiệm (God Component)
Header.tsx (310 dòng) đang làm quá nhiều:
- Hiển thị logo/title
- Filter controls (date, account select)
- Import ZIP
- Delete All functionality
- User dropdown (auth)
- Fetch account names từ Firestore

Nên được tách thành các components nhỏ hơn.

### 🟡 Cần Cải Thiện (Should Fix)

#### 10. Dependency `dayjs` Không Được Khai Báo
`dayjs` được dùng trong `Header.tsx` và `HomePage.tsx` nhưng **không có trong `package.json`**:
```typescript
import dayjs from "dayjs"; // Header.tsx, HomePage.tsx
```
Hiện tại hoạt động vì `antd` bundle dayjs bên trong, nhưng đây là implicit dependency — có thể break nếu antd thay đổi.

#### 11. `lodash` Import Toàn Bộ Cho 1 Function
```typescript
import { get } from "lodash"; // ImportFolder.tsx
```
Dùng native optional chaining thay thế:
```typescript
// Thay vì: get(cmt, "comment.author", "")
// Dùng:    cmt?.comment?.author ?? ""
```

#### 12. Mixed Language Trong UI
```typescript
// AccountsTable.tsx — tiếng Anh
<Tooltip title={disabled ? "No likes" : "View reactions"}>
// Nhưng các chỗ khác dùng tiếng Việt
message.success("Import thành công 🎉");
```
Cần nhất quán một ngôn ngữ trong toàn bộ UI.

#### 13. Prop Type Quá Lỏng
```typescript
// AccountsTable.tsx
refreshSignal?: any;  // Nên là: refreshSignal?: number

// AdminPage.tsx
const arr: AllowedAccount[] = snap.docs.map((d) => ({
  id: d.id,
  ...(d.data() as any), // Nên định nghĩa Firestore document type
}));
```

#### 14. Không Có Error Boundary
Nếu một component bị lỗi runtime, toàn bộ app sẽ crash với màn hình trắng. Không có `<ErrorBoundary>` để catch và hiển thị fallback UI.

---

## 🚀 NHỮNG NÂNG CẤP CẦN THIẾT ĐỂ XÂY DỰNG CHUYÊN NGHIỆP HƠN

### Giai Đoạn 1 — Nền Tảng Vững Chắc (Ưu tiên cao)

#### 1.1 Định Nghĩa TypeScript Types Đầy Đủ
Tạo file `src/types/index.ts` với toàn bộ business types:
```typescript
// src/types/index.ts
export interface ImportRecord {
  id: string;
  accountName: string;
  commentsCount: number;
  reactionsCount: number;
  totalFiles: number;
  status: "processing" | "completed";
  importedAt: Timestamp;
}

export interface CommentItem {
  authorName: string;
  content: string;
  commentTime: number; // Unix timestamp
  title: string;
  group: string;
}

export interface ReactionItem {
  reaction: string;
  linkPost: string;
  commentAuthorName: string;
  ownerName: string;
  reactionTime: number;
  fbid: string;
}

export interface AllowedAccount {
  id: string;
  email: string;
  displayName: string;
  role: 0 | 1; // 0 = read-only, 1 = admin
}

export interface ChunkDocument<T> {
  index: number;
  items: T[];
  count: number;
}
```

#### 1.2 Triển Khai Firebase Security Rules
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Kiểm tra user có trong allowedAccounts không
    function isAllowed() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/allowedAccounts/$(request.auth.token.email));
    }

    // Kiểm tra user có role admin không
    function isAdmin() {
      return isAllowed() &&
        get(/databases/$(database)/documents/allowedAccounts/$(request.auth.token.email)).data.role == 1;
    }

    match /imports/{importId} {
      allow read: if isAllowed();
      allow write: if isAdmin();

      match /commentChunks/{chunkId} {
        allow read: if isAllowed();
        allow write: if isAdmin();
      }

      match /reactionChunks/{chunkId} {
        allow read: if isAllowed();
        allow write: if isAdmin();
      }
    }

    match /allowedAccounts/{accountId} {
      allow read: if isAllowed();
      allow write: if isAdmin();
    }
  }
}
```

#### 1.3 Tách Logic Auth Không Bị Nhân Đôi
```typescript
// src/service/authService.ts
export const checkAllowedAccount = async (email: string) => {
  const q = query(collection(db, "allowedAccounts"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as { role?: number }) };
};
```

#### 1.4 Thêm Testing với Vitest
```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom
```
```typescript
// src/utils/__tests__/decodeText.test.ts
import { describe, it, expect } from "vitest";
import { decodeFacebookText } from "../decodeText";

describe("decodeFacebookText", () => {
  it("giải mã đúng UTF-8 của Facebook", () => {
    const encoded = "Phát biểu";
    expect(decodeFacebookText(encoded)).toBe("Phát biểu");
  });
});
```

#### 1.5 Ẩn Nút Nguy Hiểm Theo Role
```typescript
// Header.tsx - thêm role check
{user?.role === 1 && (
  <Button danger icon={<DeleteOutlined />} onClick={handleDeleteAll}>
    Xóa tất cả dữ liệu
  </Button>
)}
```

---

### Giai Đoạn 2 — Hiệu Suất & Khả Năng Mở Rộng

#### 2.1 Pagination Firestore với Cursor-Based

```typescript
// src/hooks/useImportsPaginated.ts
import { query, collection, orderBy, limit, startAfter, getDocs } from "firebase/firestore";

const PAGE_SIZE = 20;

export const useImportsPaginated = () => {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = async (cursor?: any) => {
    const q = cursor
      ? query(collection(db, "imports"), orderBy("importedAt", "desc"), startAfter(cursor), limit(PAGE_SIZE))
      : query(collection(db, "imports"), orderBy("importedAt", "desc"), limit(PAGE_SIZE));
    
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportRecord));
    
    setLastDoc(snap.docs[snap.docs.length - 1]);
    setHasMore(snap.docs.length === PAGE_SIZE);
    return docs;
  };

  // ...
};
```

#### 2.2 Real-time Updates với `onSnapshot`
Thay vì phải bấm reload thủ công, dùng Firestore real-time listener:
```typescript
// Thay getDocs() bằng onSnapshot() trong useAccountsTable
import { onSnapshot } from "firebase/firestore";

useEffect(() => {
  const q = query(collection(db, "imports"), orderBy("importedAt", "desc"), limit(20));
  const unsub = onSnapshot(q, (snap) => {
    setTableData(snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportRecord)));
  });
  return () => unsub(); // cleanup listener
}, []);
```

#### 2.3 Tách Firebase Service Layer
```typescript
// src/service/importService.ts
export const importService = {
  async getAll(options?: { limit?: number }): Promise<ImportRecord[]> { ... },
  async getById(id: string): Promise<ImportRecord | null> { ... },
  async create(data: Omit<ImportRecord, "id">): Promise<string> { ... },
  async delete(id: string): Promise<void> { ... },
  async deleteAll(): Promise<void> { ... },
  async getCommentChunks(importId: string): Promise<ChunkDocument<CommentItem>[]> { ... },
  async getReactionChunks(importId: string): Promise<ChunkDocument<ReactionItem>[]> { ... },
};
```

#### 2.4 Tối Ưu Stats Calculation
Lưu pre-computed stats theo ngày vào Firestore thay vì scan toàn bộ chunks mỗi lần:
```typescript
// Khi import, lưu daily breakdown
await updateDoc(importRef, {
  dailyStats: {
    "2025-01-15": { comments: 120, reactions: 45 },
    "2025-01-16": { comments: 89, reactions: 33 },
  }
});
```

---

### Giai Đoạn 3 — Chất Lượng Code & Developer Experience

#### 3.1 CI/CD với GitHub Actions
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

#### 3.2 Error Boundary
```typescript
// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from "react";
import { Button, Result } from "antd";

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Gửi lên error tracking service (Sentry, etc.)
    console.error("Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Đã xảy ra lỗi"
          subTitle={this.state.error?.message}
          extra={<Button onClick={() => this.setState({ hasError: false })}>Thử lại</Button>}
        />
      );
    }
    return this.props.children;
  }
}
```

#### 3.3 Skeleton Loading (UX tốt hơn)
```typescript
// Thay vì hiển thị overlay loading toàn màn hình
// Dùng skeleton placeholders trong từng component
import { Skeleton } from "antd";

const StatsCards = ({ loading, stats }) => (
  <Skeleton loading={loading} active>
    <Card>...</Card>
  </Skeleton>
);
```

#### 3.4 Soft Delete Thay Vì Hard Delete
```typescript
// Thay vì xóa hẳn, đánh dấu deleted
await updateDoc(doc(db, "imports", importId), {
  deletedAt: serverTimestamp(),
  deletedBy: currentUser.email,
});

// Query chỉ lấy chưa bị xóa
const q = query(
  collection(db, "imports"),
  where("deletedAt", "==", null),
  orderBy("importedAt", "desc")
);
```

#### 3.5 Audit Logging
```typescript
// Ghi log mọi action destructive
const logAudit = async (action: string, details: object) => {
  await addDoc(collection(db, "auditLogs"), {
    action,
    details,
    performedBy: currentUser.email,
    timestamp: serverTimestamp(),
  });
};

// Sử dụng
await logAudit("DELETE_IMPORT", { importId, accountName });
await logAudit("DELETE_ALL", { count: snap.docs.length });
```

---

### Giai Đoạn 4 — Tính Năng Nâng Cao (Chuyên Nghiệp)

#### 4.1 Error Reporting với Sentry
```bash
npm install @sentry/react
```
```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

#### 4.2 Environment Management
```
.env.local          ← Local development (gitignored)
.env.development    ← Dev environment
.env.staging        ← Staging environment
.env.production     ← Production environment
```

#### 4.3 Internationalization (i18n)
```bash
npm install react-i18next i18next
```
Hỗ trợ đa ngôn ngữ nếu project mở rộng ra ngoài người dùng Việt Nam.

#### 4.4 Progressive Web App (PWA)
```bash
npm install vite-plugin-pwa
```
Cho phép người dùng cài ứng dụng lên desktop/mobile, hoạt động offline một phần.

#### 4.5 Import Progress Chi Tiết Hơn
```typescript
// Thay vì progress bar đơn giản, hiển thị status chi tiết
<Steps current={currentStep}>
  <Steps.Step title="Đọc ZIP" description="Đang giải nén..." />
  <Steps.Step title="Parse JSON" description={`${parsed}/${total} files`} />
  <Steps.Step title="Upload" description="Đang lưu vào database..." />
  <Steps.Step title="Hoàn tất" description="✅ Import thành công" />
</Steps>
```

---

## 📊 BẢNG CHẤM ĐIỂM TỔNG HỢP

| Tiêu Chí | Điểm | Nhận Xét |
|----------|------|----------|
| **Chức năng** | 8/10 | Đầy đủ tính năng core, hoạt động tốt |
| **Kiến trúc** | 6/10 | Tốt nhưng một số component quá nặng |
| **Type Safety** | 4/10 | Quá nhiều `any`, `@ts-ignore` |
| **Bảo mật** | 5/10 | Auth logic tốt, nhưng thiếu Firestore Rules và role guards |
| **Hiệu suất** | 4/10 | Không có pagination, scan toàn bộ data khi filter |
| **Khả năng mở rộng** | 5/10 | Sẽ chậm khi có nhiều dữ liệu |
| **Testing** | 0/10 | Không có test nào |
| **Developer Experience** | 6/10 | Cấu trúc rõ ràng, thiếu CI/CD và docs |
| **UI/UX** | 7/10 | Giao diện đẹp, một số UX cần cải thiện |
| **Documentation** | 4/10 | Thiếu README, thiếu JSDoc |
| **Tổng** | **49/100** | Prototype tốt, cần nâng cấp để production-ready |

---

## 🗺️ LỘ TRÌNH NÂNG CẤP ĐỀ XUẤT

```
Tuần 1-2: Nền tảng
├── ✍️ Định nghĩa TypeScript types đầy đủ (loại bỏ any)
├── 🔒 Triển khai Firestore Security Rules
├── 🐛 Sửa role guard cho nút Delete All
└── ♻️ Tách duplicate auth logic

Tuần 3-4: Testing & CI/CD
├── 🧪 Setup Vitest + Testing Library
├── ✅ Viết unit tests cho utils và hooks
├── 🚀 Tạo GitHub Actions workflow
└── 📦 Thêm dayjs vào package.json dependencies

Tuần 5-6: Hiệu Suất
├── 📄 Implement cursor-based pagination
├── ⚡ Chuyển sang onSnapshot real-time listener
├── 🏗️ Tách Firebase service layer
└── 💀 Tối ưu date filter (pre-computed daily stats)

Tuần 7-8: UX & Tính Năng Nâng Cao
├── 💀 Implement soft delete + audit logs
├── 🦴 Thêm Skeleton loading
├── 🚧 Thêm Error Boundary
├── 🌐 Đồng nhất ngôn ngữ UI
└── 📱 Tách Header thành các components nhỏ hơn
```

---

## 💡 KẾT LUẬN

**FB Pulse Tracker** là một **prototype chức năng tốt** với use case rõ ràng, stack hiện đại, và kiến trúc có tổ chức. Đây là một project phù hợp cho mục đích học tập và trình bày (TTTN).

**Điểm mạnh nổi bật:** Chunking strategy cho Firestore rất thông minh, nested ZIP parsing hoàn chỉnh, hệ thống auth có whitelist + role là thiết kế an toàn về mặt ý tưởng.

**Điểm yếu cốt lõi:** Type safety thấp, không có tests, hiệu suất sẽ suy giảm nghiêm trọng khi scale up, và thiếu Firestore Security Rules thực sự là lỗ hổng bảo mật lớn.

Để đưa project từ "prototype/học tập" → **"production-ready professional app"**, cần tập trung vào 3 mảng ưu tiên:

1. 🔴 **Security**: Firestore Rules + Role guards đúng chuẩn
2. 🟠 **Type Safety**: Loại bỏ `any`, định nghĩa types đầy đủ
3. 🟡 **Testing**: Ít nhất unit tests cho business logic

---

*Tài liệu này được tạo tự động bởi Claude Code dựa trên phân tích source code tại: `D:\TrungHuy\TTTN\source_read_json_file\json-tool-main-main`*
