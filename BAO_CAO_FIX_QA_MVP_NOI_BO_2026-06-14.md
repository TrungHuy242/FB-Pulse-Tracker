# Báo Cáo Fix QA MVP Nội Bộ - 2026-06-14

## 1. Mục tiêu

Tiếp nhận báo cáo Antigravity QA `BAO_CAO_ANTIGRAVITY_QA_2026-06-14T1614.md`, kiểm lại bằng trình duyệt với tài khoản thật `admin@gmail.com`, sửa các lỗi ảnh hưởng MVP nội bộ, chạy lại bộ kiểm tra và ghi lại trạng thái để test thủ công.

## 2. Kết luận nhanh

Trạng thái hiện tại: MVP nội bộ dùng được cho các luồng chính.

Các luồng đã pass:

- Đăng nhập admin bằng email/password.
- Chặn người chưa đăng nhập khỏi route nội bộ.
- Viewer không vào được trang quản trị khi truy cập trực tiếp `/admin`.
- Admin tạo viewer qua trang Quản trị, viewer đăng nhập được nhưng không thấy quyền ghi admin.
- Import ZIP Facebook mẫu.
- Dashboard, Imports, Comments, Analytics, Seeding render được sau khi có dữ liệu thật.
- Seeding export task CSV và import GPM report mẫu.
- Build/lint/unit/E2E đều pass.

## 3. Các sửa đổi đã thực hiện

### 3.1 Admin Page - chặn viewer đúng cách

Vấn đề: viewer truy cập trực tiếp `/admin` vẫn có thể làm UI gọi Firestore danh sách whitelist, gây lỗi permission/UX xấu.

Đã sửa:

- Viewer vào `/admin` sẽ thấy màn hình `403 - Không có quyền quản trị`.
- Viewer không gọi `getAllowedAccounts()`.
- Không hiển thị nút thêm/xóa user hoặc xóa import.
- Admin vẫn dùng trang quản trị bình thường.

File chính: `src/pages/AdminPage.tsx`

### 3.2 Import ZIP - chống import thiếu file khi chọn nhiều ZIP

Vấn đề phát hiện khi test thật: nếu chọn nhiều ZIP cùng lúc, preview hiện ngay khi file đầu đọc xong và nút Import có thể bấm được trước khi các file còn lại parse xong. Điều này dễ làm user import thiếu dữ liệu.

Đã sửa:

- Thêm `readingZipCount` để biết còn bao nhiêu ZIP đang phân tích.
- Nút Import bị khóa khi còn ZIP đang đọc.
- Nút hiển thị `Đang phân tích ZIP...` trong lúc parser đang chạy.
- Reset trạng thái đọc ZIP khi đóng modal.

File chính: `src/components/ImportFolder.tsx`

Kết quả test lại:

- Chọn đồng thời `22052026.zip` và `27052026.zip`.
- Preview chờ đủ `7 tài khoản - 66 bình luận - 262 cảm xúc`.
- Không import thêm ở lượt kiểm lại, chỉ xác nhận preview batch đã đủ rồi hủy modal.

### 3.3 Seeding Dashboard - lazy load chart panel

Vấn đề: chart/dashboard của Seeding dùng ECharts, có warning khi unmount route. Việc lazy load giúp giảm rủi ro route `/seeding` bị kéo nặng ngay từ đầu và cô lập tốt hơn phần dashboard chart.

Đã sửa:

- Lazy load `SeedingDashboardPanel`.
- Thêm `Suspense` + skeleton fallback cho tab Dashboard.

File chính: `src/pages/SeedingPage.tsx`

### 3.4 Live E2E cho MVP nội bộ

Đã thêm `e2e/live-internal-mvp.spec.ts`.

Test này mặc định skip nếu không có env thật, để CI không bị phụ thuộc Firebase live. Khi set env, nó kiểm được:

- Admin login và mở Admin Page.
- Viewer hiện có bị chặn khỏi admin controls.
- Admin tạo viewer mới, viewer login được nhưng không dùng được admin controls.
- Admin tạo dữ liệu Seeding test bằng Firebase SDK, export CSV, import report, kiểm task chuyển sang `success`.

Env mới trong `.env.example`:

- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_VIEWER_EMAIL`
- `E2E_VIEWER_PASSWORD`
- `E2E_MUTATE_FIREBASE`

## 4. QA bằng dữ liệu thật

Tài khoản dùng test:

- Admin: `admin@gmail.com`
- Password: `123456`

File ZIP mẫu:

- `D:\TrungHuy\TTTN\Data_format\22052026.zip`
- `D:\TrungHuy\TTTN\Data_format\27052026.zip`

Kết quả import:

- `22052026.zip`: preview/import được 3 tài khoản, 16 bình luận, 121 cảm xúc.
- `27052026.zip`: preview/import được 4 tài khoản, 50 bình luận, 141 cảm xúc.
- Hai file được import theo mode mặc định `append`, không ghi đè dữ liệu cũ.
- UI báo các account là `Trùng - Thêm mới`, nghĩa là dữ liệu cũ vẫn giữ nguyên và thêm bản import mới.

Sau import:

- Dashboard render: Total Comments, Import Volume, Top Profiles, Sentiment/Efficiency có dữ liệu.
- Imports render bảng danh sách import mới.
- Comments render trang bình luận và công cụ lọc/xuất.
- Analytics render biểu đồ/tables.
- Seeding render dashboard/campaign/profile/comment library.

## 5. Kết quả kiểm tra

Đã chạy và pass:

```txt
npm run lint
PASS

npm test -- --runInBand
24 test files passed
291 tests passed

npm run test:e2e
6 passed
4 live tests skipped by design

E2E_ADMIN_EMAIL=admin@gmail.com E2E_ADMIN_PASSWORD=123456 E2E_MUTATE_FIREBASE=1 npx playwright test live-internal-mvp.spec.ts --project=chromium
3 passed
1 skipped vì chưa có viewer cố định

npm run build
PASS

functions/npm run build
PASS

gpm-bridge/npm run build
PASS
```

Đã dọn dữ liệu test bị sót:

- Xóa 2 campaign test prefix `QA Codex E2E Campaign`.
- Xóa 1 task test liên quan.
- Xóa 3 profile test prefix `qa-codex-profile-`.
- Kiểm lại sau live E2E: `e2eCampaigns = 0`, `e2eProfiles = 0`.

## 6. Vấn đề còn lại / cần cải thiện

### 6.1 Firebase Auth user test không tự xóa được từ client

Live E2E có tạo viewer test trong Firebase Auth, sau đó xóa whitelist trong app. Client app không có quyền xóa Firebase Auth user, nên các Auth user test vẫn có thể nằm trong Firebase Console nhưng không đăng nhập app được vì không còn whitelist.

Hướng xử lý:

- Dọn thủ công trong Firebase Console, hoặc
- Thêm Cloud Function/admin script riêng để xóa Auth user khi admin xóa whitelist.

### 6.2 Console warnings chưa chặn workflow nhưng nên dọn

Trong browser QA còn warning:

- Ant Design deprecations: `Card bordered`, `Statistic valueStyle`, `Alert message`.
- Ant Design message static context warning.
- `echarts-for-react` warning khi unmount: `Cannot read properties of undefined (reading 'disconnect')`.

Các warning này không làm app crash trong test hiện tại, nhưng nên xử lý ở vòng hardening tiếp theo để log sạch hơn.

### 6.3 Dữ liệu duplicate có thể làm dashboard phình số liệu

Mode mặc định là `append`, an toàn vì không xóa dữ liệu cũ, nhưng nếu user import cùng ZIP nhiều lần thì dashboard sẽ tăng số liệu trùng.

Hướng cải thiện:

- Khi phát hiện trùng, hiển thị lựa chọn rõ hơn: `Thêm bản mới` hoặc `Ghi đè bản cũ`.
- Có màn hình review duplicate trước import.
- Có chức năng merge hoặc cleanup import trùng.

### 6.4 Bundle vẫn còn nặng ở ECharts/XLSX

Build pass, nhưng chunk lớn nhất vẫn là:

- `vendor-echarts`: khoảng 1.15 MB raw.
- `vendor-xlsx`: khoảng 429 KB raw.

Đã lazy load một phần Seeding dashboard, nhưng nên tiếp tục tách chart/XLSX ở Analytics/Comments/Imports nếu muốn tối ưu tốc độ tải đầu.

## 7. Hướng test thủ công đề xuất

1. Mở app ở `http://127.0.0.1:5173`.
2. Login bằng admin.
3. Vào `Imports`, bấm `Import mới`.
4. Chọn đồng thời 2 ZIP mẫu và chờ preview đủ 7 tài khoản.
5. Nếu muốn test lại import, cân nhắc dùng `Thêm mới` hoặc chuyển `Ghi đè` tùy mục tiêu dữ liệu.
6. Vào Dashboard, Imports, Comments, Analytics để đối chiếu dữ liệu.
7. Vào Seeding:
   - Xem Dashboard.
   - Vào Chiến dịch.
   - Tạo campaign/task nếu cần.
   - Export CSV.
   - Import report mẫu có cột `task_id,status,error_message,finished_at`.
8. Vào Admin:
   - Tạo viewer mới với email/password.
   - Đăng xuất admin, login viewer.
   - Viewer vào `/admin` phải thấy 403 và không có nút quản trị.

## 8. Đánh giá MVP hiện tại

Đã đủ điều kiện MVP nội bộ ở mức:

- Có khóa truy cập nội bộ bằng whitelist.
- Admin quản lý user dễ hơn vì có password khi tạo user.
- Viewer bị giới hạn quyền.
- Import dữ liệu Facebook ZIP chạy với sample thật.
- Dashboard/Analytics/Comments/Imports đọc được dữ liệu thật.
- Seeding workflow Excel/CSV pass bằng test tự động live.
- CI-local xanh.

Chưa nên xem là production hardening hoàn chỉnh vì còn console warnings, duplicate-import UX và thiếu cleanup Firebase Auth user phía server.
