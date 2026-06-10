# Báo Cáo MVP Nội Bộ - FB Pulse Tracker

Ngày kiểm tra: 2026-06-10

## Kết Luận

Project đã được chuyển sang hướng MVP nội bộ:
- Login chỉ còn email/password.
- Không còn public register/Google login trên UI.
- User phải có `allowedAccounts/{Firebase Auth UID}` mới vào app.
- Firestore Rules đã siết read/write theo whitelist và role admin.
- Seeding MVP dùng Excel/CSV thủ công; GPM Bridge Agent được giữ là thử nghiệm/nâng cấp.
- CI local đã pass: lint, unit test, build, E2E smoke, functions build, gpm-bridge build.

## Chức Năng Đã Có

### Auth Nội Bộ
- Admin bootstrap thủ công bằng Firebase Console.
- `checkAllowedAccount(uid)` chỉ đọc whitelist, không tự tạo document.
- User không có whitelist bị chặn và buộc sign out.
- Role MVP:
  - `role = 1`: Admin.
  - `role = 0`: Viewer.

### Admin/Whitelist
- Admin Page tạo member nội bộ bằng email/password và tự tạo whitelist.
- Document ID của `allowedAccounts` trùng UID Firebase Auth do app tạo.
- Form thêm member có nút tạo lại mật khẩu và sao chép mật khẩu cho admin gửi cho member mới.
- Firestore Rules chặn admin tự xóa hoặc tự đổi role chính mình.

### Facebook Data
- Admin import Facebook ZIP.
- Dashboard overview.
- Imports page, comments page, analytics page.
- Export CSV/JSON/XLSX.
- Viewer xem được dữ liệu nhưng UI không hiện thao tác ghi chính như import/xóa.

### Seeding
- Dashboard seeding.
- Profiles, campaigns, tasks, comment library.
- Campaign hỗ trợ `scheduled` và validate `scheduledAt`.
- Export task CSV/XLSX.
- Import report CSV/XLSX.
- Viewer không tạo/sửa/xóa seeding data; AI Planner chỉ cho admin.

### AI/Gemini
- Default model: `gemini-2.0-flash`.
- Nếu `.env` cũ còn `gemini-1.5-flash`, client fallback về `gemini-2.0-flash`.
- AI lỗi không làm crash workflow chính.

## Kết Quả Kiểm Tra Tự Động

| Lệnh | Kết quả |
| --- | --- |
| `npm run lint` | Pass, 0 warning |
| `npm test -- --runInBand` | Pass: 24 files, 291 tests |
| `npm run build` | Pass |
| `npm run test:e2e` | Pass: 6 Playwright smoke tests |
| `npm --prefix functions run build` | Pass |
| `npm --prefix gpm-bridge run build` | Pass |

## E2E Đã Tự Động Test

File: `e2e/internal-mvp.spec.ts`

- Login page chỉ hiển thị email/password login nội bộ.
- Không có register/Google/demo account.
- User chưa auth bị redirect từ:
  - `/imports`
  - `/comments`
  - `/analytics`
  - `/seeding`
  - `/admin`
  về `/login`.

## Chưa Tự Động Test Được

Các case sau cần seeded Firebase test accounts thật hoặc emulator đầy đủ:
- Admin login bằng account thật và import ZIP.
- Viewer login thật và xác nhận Firestore Rules từ chối write.
- Outsider login thật và xác nhận bị chặn do thiếu whitelist.
- Admin thêm/sửa/xóa whitelist user test.
- Admin tạo campaign/task, export task, import report.
- Scheduled campaign tạo được sau khi deploy rules.

Checklist thủ công nằm tại:
`docs/MVP_INTERNAL_CHECKLIST.md`

## File Chính Đã Cập Nhật

- `src/service/authService.ts`
- `src/contexts/AuthContext.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/AdminPage.tsx`
- `src/service/accountService.ts`
- `firestore.rules`
- `src/pages/ImportsPage.tsx`
- `src/components/AccountsTable.tsx`
- `src/pages/CommentsPage.tsx`
- `src/pages/SeedingPage.tsx`
- `src/utils/geminiClient.ts`
- `gpm-bridge/src/*`
- `README.md`
- `docs/MVP_INTERNAL_CHECKLIST.md`
- `.gitignore`
- `.env.example`

## Ghi Chú Bàn Giao

- Cần deploy Firestore Rules trước khi test scheduled campaign và phân quyền thật.
- Admin Page tạo Firebase Auth user + whitelist cùng lúc, không cần Firebase Console cho các member sau first admin.
- GPM Bridge Agent build được nhưng chưa phải điều kiện pass MVP đầu tiên.
- Đường MVP an toàn là Excel/CSV bridge thủ công.

## Browser Verification Bổ Sung

Ngày kiểm tra thực tế: 2026-06-10

- Admin login hoạt động với `admin@gmail.com` / `123456`.
- Modal thêm member mới không còn yêu cầu Firebase UID.
- Đã tạo thành công một viewer test qua Admin Page bằng email/password.
- Viewer test login được và vào `/admin` nhưng không còn thấy nút `Thêm thành viên` hoặc `Xóa tất cả Import`.
- Đã import thành công `27052026.zip`.
- Preview import hiển thị 4 tài khoản với 50 bình luận và 141 cảm xúc.

Ghi chú kỹ thuật:
- Cảnh báo dev còn lại chủ yếu từ `echarts-for-react` khi unmount trong môi trường dev; không chặn luồng người dùng.
