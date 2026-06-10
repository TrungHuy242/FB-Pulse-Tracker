# FB Pulse Tracker

FB Pulse Tracker là ứng dụng web nội bộ để import dữ liệu Facebook ZIP, xem dashboard/analytics, phân tích bình luận và vận hành workflow Seeding qua Excel/CSV.

Trạng thái MVP nội bộ hiện tại:
- Không có đăng ký công khai.
- Chỉ user có document `allowedAccounts/{firebaseAuthUid}` mới vào được app.
- Role MVP chỉ có `0` viewer và `1` admin.
- Seeding MVP dùng Excel/CSV bridge thủ công. `gpm-bridge/` là agent tự động hóa thử nghiệm cho giai đoạn nâng cấp sau.
- AI Gemini không được chặn workflow. Khi Gemini/API lỗi, app dùng fallback nội bộ hoặc hiển thị lỗi rõ ràng.
- Unit test target hiện tại: 291 tests.

## Chức Năng MVP

### Auth Nội Bộ
- Login bằng email/password Firebase Auth.
- Không hiển thị register, Google login, forgot password hoặc demo account.
- User đã đăng nhập nhưng chưa được whitelist sẽ bị sign out và thấy thông báo liên hệ admin.
- First admin bootstrap làm thủ công bằng Firebase Console.

### Phân Quyền
| Role | Quyền |
| --- | --- |
| `role = 1` Admin | Import ZIP, xóa/import dữ liệu, quản lý whitelist, tạo/sửa/xóa seeding profile/campaign/task/comment, export/import report |
| `role = 0` Viewer | Xem dashboard, imports, comments, analytics, seeding dashboard/report; không thấy thao tác ghi chính |

### Workflow Dữ Liệu Facebook
- Import Facebook ZIP.
- Quản lý imports, xem chi tiết comments/reactions.
- Export dữ liệu comments/imports sang CSV/JSON/XLSX.
- Dashboard overview và analytics theo thời gian, account, sentiment, reaction.

### Workflow Seeding MVP
- Quản lý GPM profiles.
- Quản lý campaign, task và thư viện comment.
- Tạo task thủ công hoặc từ AI Planner cho admin.
- Export task CSV/XLSX để chạy thủ công qua GPM.
- Import report CSV/XLSX sau khi chạy để cập nhật trạng thái task.
- Campaign hỗ trợ trạng thái `draft`, `active`, `paused`, `completed`, `scheduled`.

### Admin
- Danh sách whitelist `allowedAccounts`.
- Tạo member nội bộ bằng email/password và tự tạo whitelist.
- Có nút tạo lại và sao chép mật khẩu khi thêm member mới.
- Sửa email/displayName/role.
- Không cho admin tự xóa hoặc tự hạ quyền chính mình ở Firestore Rules.

## Bootstrap First Admin

1. Vào Firebase Console.
2. Bật Authentication provider `Email/Password`.
3. Tạo user admin đầu tiên trong Firebase Auth.
4. Copy UID của user đó.
5. Tạo document Firestore:

```text
collection: allowedAccounts
document id: <Firebase Auth UID>

email: admin@company.com
displayName: Admin
role: 1
```

6. Deploy Firestore Rules:

```bash
firebase deploy --only firestore:rules
```

Sau khi admin đầu tiên đăng nhập, admin có thể tạo member nội bộ ngay trong Admin Page bằng email/password. App sẽ tạo Firebase Auth user và whitelist cùng lúc. First admin vẫn phải bootstrap thủ công.

## Firestore Rules

Rules chính:
- `allowedAccounts`: user chỉ đọc document của chính mình; admin đọc list và CRUD user.
- Không cho self-create account từ client.
- Không cho admin tự xóa hoặc tự đổi role chính mình.
- `imports`, `commentChunks`, `reactionChunks`, `seedingProfiles`, `seedingCampaigns`, `seedingTasks`, `seedingComments`: whitelisted user được đọc, chỉ admin được ghi.
- Collection chưa khai báo bị default deny.

## Cài Đặt

```bash
npm install
npm run dev
```

App chạy tại [http://localhost:5173](http://localhost:5173).

`.env` cần các biến Vite Firebase:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
VITE_GEMINI_MODEL=gemini-2.0-flash
```

## Kiểm Tra Bắt Buộc Trước Bàn Giao

```bash
npm run lint
npm test -- --runInBand
npm run build
npm run test:e2e
npm --prefix functions run build
npm --prefix gpm-bridge run build
```

Playwright E2E hiện có smoke tests không phụ thuộc credential thật:
- Login page là internal-only.
- User chưa auth bị redirect từ `/imports`, `/comments`, `/analytics`, `/seeding`, `/admin` về `/login`.

Các flow admin/viewer có ghi dữ liệu cần seeded Firebase test accounts và được test theo checklist thủ công tại [docs/MVP_INTERNAL_CHECKLIST.md](docs/MVP_INTERNAL_CHECKLIST.md).

## Tài Liệu Liên Quan

- [BAO_CAO_TEST_SEEDING.md](BAO_CAO_TEST_SEEDING.md)
- [DANH_GIA_TONG_QUAN_PROJECT_2026-06-09.md](DANH_GIA_TONG_QUAN_PROJECT_2026-06-09.md)
- [docs/GPM_EXCEL_BRIDGE.md](docs/GPM_EXCEL_BRIDGE.md)
- [docs/SEEDING_MANAGER_GUIDE.md](docs/SEEDING_MANAGER_GUIDE.md)
- [docs/MVP_INTERNAL_CHECKLIST.md](docs/MVP_INTERNAL_CHECKLIST.md)
