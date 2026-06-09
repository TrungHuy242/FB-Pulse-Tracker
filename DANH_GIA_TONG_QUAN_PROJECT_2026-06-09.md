# Đánh giá tổng quan project FB Pulse Tracker

Ngày đánh giá: 2026-06-09  
Repo: `D:\TrungHuy\TTTN\source_read_json_file\json-tool-main-main`  
Mục tiêu đánh giá: xác định project đã hoàn thiện đến đâu, đã có chức năng gì, còn thiếu gì, rủi ro nào cần xử lý trước khi nâng cấp hoặc bàn giao.

## 1. Kết luận nhanh

Project hiện ở mức **MVP nội bộ / beta nâng cao**. Phần frontend chính đã build được, unit test pass, module Seeding đã được test browser end-to-end và pass. Tuy nhiên project **chưa đạt mức production-ready hoàn chỉnh** vì còn các vấn đề quan trọng về bảo mật đăng ký, CI/lint, E2E test, coverage thấp, tài liệu lệch với code, và Firestore rules chưa khớp hết tính năng mới.

Đánh giá mức hoàn thiện hiện tại:

| Nhóm | Mức hoàn thiện | Nhận xét |
| --- | ---: | --- |
| Frontend core | 75% | Nhiều màn hình đã dùng được, build pass, UI đủ rộng cho nghiệp vụ chính |
| Import/Analytics/Comments | 70% | Có luồng xử lý dữ liệu mạnh, nhưng thiếu E2E và coverage UI thấp |
| Seeding Manager | 80% | Đã browser QA 17/17 pass, có export/import GPM và AI fallback |
| Cloud Functions AI | 60% | Build pass, có fallback, nhưng cần kiểm tra deploy/quota/CORS thực tế |
| GPM Bridge Agent | 55% | Build pass, logic có đủ queue/retry/schedule, nhưng chưa chứng minh ổn định với GPM/Facebook thật |
| Security/permission | 45% | Firestore rules có nền tảng, nhưng auto whitelist/admin theo email là rủi ro cao |
| Test/CI | 50% | Unit test pass nhưng lint fail, E2E chưa có test, coverage tổng thể thấp |
| Documentation | 55% | Có nhiều tài liệu, nhưng một số nội dung đã lỗi thời hoặc không khớp code |

Ưu tiên trước khi xem là hoàn thiện:

1. Sửa bảo mật đăng ký và whitelist.
2. Sửa lint để CI pass.
3. Thêm E2E tests thật cho các luồng chính.
4. Đồng bộ Firestore rules với schema hiện tại.
5. Cập nhật README/tài liệu theo code thực tế.
6. Kiểm thử GPM Bridge trên môi trường GPM/Facebook thật.

## 2. Kết quả kiểm tra kỹ thuật

Đã chạy:

```bash
npm run build
```

Kết quả: **PASS**  
Ghi chú: frontend TypeScript + Vite production build thành công.

Đã chạy:

```bash
npm test -- --runInBand
```

Kết quả: **PASS**

- Test files: 24 passed
- Tests: 291 passed

Đã chạy:

```bash
npm run test:coverage -- --runInBand
```

Kết quả: **PASS**, nhưng coverage thấp:

| Metric | Coverage |
| --- | ---: |
| Statements | 13.2% |
| Branches | 11.99% |
| Functions | 9.63% |
| Lines | 13.15% |

Ý nghĩa: unit test đang kiểm tra tốt một số utils/hooks/service thuần, nhưng hầu hết page/component lớn như `SeedingPage`, `ImportFolder`, `CommentsPage`, `AdminPage`, chart components gần như chưa có coverage tự động.

Đã chạy:

```bash
npm run lint
```

Kết quả: **FAIL**

- 56 errors
- 9 warnings

Nhóm lỗi chính:

- Nhiều `any` chưa type rõ.
- Fast Refresh rule: file vừa export component vừa export helper/constant.
- `AdminPage.tsx` có label typo `fillingly:`.
- React hook rule `set-state-in-effect`.
- Unused vars/empty block trong `gpm-bridge`.

Đã chạy:

```bash
npm run test:e2e
```

Kết quả: **FAIL**

Lý do: `Error: No tests found`. Project có cấu hình Playwright nhưng chưa có thư mục/test `e2e`.

Đã chạy:

```bash
cd functions
npm run build
```

Kết quả: **PASS**

Đã chạy:

```bash
cd gpm-bridge
npm run build
```

Kết quả: **PASS**

## 3. Chức năng project đang có

### 3.1 Authentication và phân quyền

Đã có:

- Đăng nhập bằng email/password qua Firebase Auth.
- Đăng ký tài khoản mới.
- Context auth quản lý user, loading, role.
- Route guard `RequireAuth` bảo vệ các trang nội bộ.
- Sidebar ẩn menu Admin nếu user không có role admin.
- Role hiện dùng:
  - `role = 1`: Admin
  - `role = 0`: Read-only

Chưa hoàn thiện / rủi ro:

- Nút "Đăng nhập bằng Google" đang là placeholder, chưa có logic login Google.
- Nút "Quên mật khẩu" chưa có logic reset password.
- Luồng đăng ký tự cấp admin nếu email chứa chữ `admin`. Đây là rủi ro cao.
- `checkAllowedAccount` tự tạo document `allowedAccounts/{uid}` nếu chưa tồn tại, làm whitelist không còn đúng nghĩa whitelist.
- Firestore rules cho phép user tự tạo account document của chính mình với `role` hợp lệ 0 hoặc 1, nhưng chưa ép role self-create phải là 0.

Khuyến nghị:

- Tắt public register nếu đây là app nội bộ.
- Chỉ admin hoặc backend trusted mới được tạo `allowedAccounts`.
- Self-register nếu giữ lại thì chỉ tạo role `0`, trạng thái `pending`, cần admin approve.
- Không dùng rule "email chứa admin là admin".
- Implement Google login thật hoặc bỏ nút để tránh gây hiểu nhầm.

### 3.2 Landing và Login

Đã có:

- Landing page cho user chưa đăng nhập.
- Login page có tab đăng nhập/đăng ký.
- Dark/light style.
- Panel demo account.

Chưa hoàn thiện:

- Một số text/demo credential không phù hợp production.
- Google login và forgot password chưa hoạt động.
- Tài liệu/UI vẫn thiên về demo đồ án, chưa phải bản vận hành thực tế.

### 3.3 Layout, theme, navigation

Đã có:

- `AppLayout` với sidebar, topbar, responsive mobile overlay.
- Menu: Overview, Imports, Analytics, Bình luận, Seeding Manager, Admin, Settings.
- Toggle dark/light mode.
- Lazy load route-level bằng `React.lazy`.
- `ErrorBoundary` bọc app và một số chart section.

Chưa hoàn thiện:

- Lint báo Fast Refresh ở một số file context/component.
- Một số warning Ant Design static `message.*` chưa chuyển sang `App.useApp()`.
- Chưa có audit accessibility tổng thể.

### 3.4 Import dữ liệu Facebook ZIP

Đã có:

- Import một hoặc nhiều file ZIP.
- Hỗ trợ nested ZIP.
- Bỏ qua `__MACOSX`.
- Decode lỗi encoding tiếng Việt từ Facebook.
- Preview trước khi upload.
- Phát hiện multi-profile trong ZIP.
- Phát hiện account trùng và cho chọn append hoặc replace.
- Chunk upload lên Firestore:
  - comment chunk size: 700
  - reaction chunk size: 2000
- Progress bar theo bước và theo chunk.
- Lưu metadata import vào collection `imports`.
- Lưu comments vào `imports/{id}/commentChunks`.
- Lưu reactions vào `imports/{id}/reactionChunks`.
- Browser notification khi import xong.

Chưa hoàn thiện / rủi ro:

- Chưa có E2E test cho import ZIP thật.
- Nếu import fail giữa chừng, có thể còn document/chunk dang dở cần cleanup thủ công hoặc job recovery.
- Parser phụ thuộc format Facebook export hiện tại; nếu Facebook đổi JSON format cần update.
- Chưa thấy cơ chế giới hạn dung lượng ZIP rõ ràng ở UI.
- Chưa có queue/background worker cho import cực lớn.

### 3.5 Imports Management

Đã có:

- Danh sách imports.
- Filter theo ngày và account.
- Realtime banner khi có import mới.
- Xem chi tiết comments/reactions từng import.
- Delete từng import với cascade delete chunk.
- Bulk delete selected imports.
- Delete all imports cho admin.
- Export tất cả hoặc selected ra Excel/CSV/JSON.
- Print report.
- Load more/pagination logic trong accounts table.

Chưa hoàn thiện:

- Chưa có E2E cho delete/export/detail modal.
- Export module còn lint `any`.
- Delete all là thao tác nguy hiểm, nên thêm nhập confirm text hoặc backup cảnh báo rõ hơn.

### 3.6 Overview dashboard

Đã có:

- Stats cards tổng quan.
- Engagement chart.
- Top profiles.
- Accounts table tóm tắt.
- Date presets.
- Filter account/date.
- Welcome empty state khi chưa có dữ liệu.

Chưa hoàn thiện:

- Chưa có E2E/visual regression cho chart.
- Coverage cho page gần như 0%.
- Một số chart dùng ECharts có warning unmount trong browser QA Seeding trước đó.

### 3.7 Analytics

Đã có:

- Timeline chart.
- Reaction pie chart.
- Activity heatmap.
- Top commenters chart.
- Keyword frequency chart.
- Sentiment chart.
- Auto insights.
- Performance score table.
- AI summary panel.
- Date/account filter.
- Print report.

Chưa hoàn thiện:

- AI Summary phụ thuộc Cloud Functions/Gemini hoặc fallback, cần kiểm thử deploy thật.
- Chưa có E2E/visual test cho chart và AI panel.
- README nói có PWA/Sentry nhưng code hiện tại không thấy plugin PWA hoặc Sentry dependency/source tương ứng.

### 3.8 Comments

Đã có:

- Bảng bình luận tổng hợp từ nhiều imports.
- Filter theo keyword, author, account, group, date range, sentiment, intent.
- Export comments ra CSV/JSON/XLSX.
- Rule-based sentiment hiển thị badge.
- AI sentiment tối đa 50 comments.
- AI SEO keywords tối đa 500 comments.
- AI lead scoring tối đa 200 comments.
- AI intent classification tối đa 100 comments.
- AI seeding ideas tối đa 500 comments.
- Lưu intent vào Firestore qua `updateCommentsIntent`.
- Modal kết quả cho SEO, leads, intent, seeding ideas.

Chưa hoàn thiện:

- Nhiều AI feature phụ thuộc Cloud Functions hoặc client-side Gemini key; khi quota/CORS lỗi cần fallback rõ cho từng action.
- Lint còn lỗi trong `CommentsPage.tsx`.
- Coverage UI gần như chưa có.
- Cần đánh giá performance khi comment dataset rất lớn.

### 3.9 Seeding Manager

Đã có:

- Tab Dashboard.
- Tab Chiến dịch.
- Tab AI Planner.
- Tab Profiles.
- Tab Thư viện bình luận.
- CRUD campaign.
- Campaign status: draft, active, paused, completed, scheduled.
- Scheduled campaign với `scheduledAt`.
- Save campaign as template.
- Bulk create tasks theo profiles/action.
- Action task: like/comment/share.
- Export tasks Excel/CSV cho GPM.
- Import report Excel/CSV từ GPM để cập nhật task status.
- Modal quản lý tasks.
- Start campaign auto: chuyển task chưa success sang pending.
- Pause campaign auto: task pending/running chuyển skipped.
- CRUD profiles.
- Import profiles từ Excel/CSV.
- Export profile template.
- CRUD comment library.
- AI comment ideas.
- AI campaign report.
- AI Planner tạo campaign + tasks gợi ý.
- Fallback local khi Gemini/Cloud Function không khả dụng.

Kết quả test riêng:

- Browser QA `/seeding`: 17/17 PASS.
- Báo cáo đã có tại `BAO_CAO_TEST_SEEDING.md`.
- Artifact:
  - `.qa-seeding-full-20260609144647-results.json`
  - `.qa-seeding-full-20260609144647-final.png`

Chưa hoàn thiện / rủi ro:

- Firestore rules local chưa cho phép campaign status `scheduled`.
- `gpm-bridge` thực thi Facebook thật chưa được xác nhận trong lần đánh giá này.
- GPM/Facebook selectors dễ vỡ nếu Facebook đổi UI hoặc ngôn ngữ.
- AI fallback giúp UI không crash nhưng không phải kết quả Gemini thật.
- Chưa có E2E test commit vào repo cho Seeding, hiện mới có artifact QA ngoài test suite.

### 3.10 GPM Bridge Agent

Đã có:

- Project riêng trong `gpm-bridge`.
- Build TypeScript pass.
- Đọc Firebase service account từ `.env`.
- Kết nối GPM Login API local.
- Sync GPM profiles lên Firestore.
- Lắng nghe `seedingTasks` status `pending`.
- Queue xử lý task tránh trùng.
- Mở Chrome profile qua GPM.
- Kết nối Puppeteer qua remote debug port.
- Thực thi like/comment/share.
- Cập nhật task success/failed.
- Retry tối đa 3 lần.
- Đóng profile sau khi chạy.
- Quét scheduled campaigns định kỳ và chuyển task sang pending.

Chưa hoàn thiện / rủi ro:

- Lint fail trong `gpm-bridge`.
- Chưa có integration test với GPM Login thật.
- Chưa có healthcheck/log dashboard.
- Chưa có hướng dẫn service deployment dạng Windows service/PM2 rõ trong root README.
- Facebook selector automation rất dễ bị hỏng theo giao diện/ngôn ngữ/account state/checkpoint.
- Cần cơ chế rate limit, concurrency config, kill browser khi treo, và alert lỗi.

### 3.11 Cloud Functions AI

Đã có:

- `analyzeSentiment`
- `summarizeComments`
- `extractSeoKeywords`
- `scoreLeads`
- `classifyIntent`
- `generateSeedingIdeas`
- Gemini model mặc định `gemini-2.0-flash`.
- Fallback cho một số lỗi parse/quota.
- Functions build pass.

Chưa hoàn thiện:

- Chưa có automated tests cho functions.
- Cần xác nhận deploy region `asia-southeast1` đồng bộ với frontend.
- Cần xử lý CORS/quota thực tế nếu gọi từ localhost/prod bị lỗi.
- Cần quản lý secret `GEMINI_API_KEY`, `GEMINI_MODEL` rõ ràng theo môi trường.
- Các AI planner/report hiện chạy client fallback/local chứ không có Cloud Function riêng.

### 3.12 Admin

Đã có:

- CRUD allowed accounts.
- Search/filter users theo role.
- Không cho user tự xóa chính mình ở UI.
- Không cho tự hạ role chính mình ở UI.
- Delete all imports trong admin.

Chưa hoàn thiện / rủi ro:

- `AdminPage.tsx` có typo `fillingly:` làm lint fail.
- Security tier/active now đang có vẻ là dữ liệu giả lập dựa vào hash, không phải hoạt động thật.
- Nếu Firestore rules giữ self-create role 1, admin panel không đủ bảo vệ hệ thống.
- Cần audit lại toàn bộ quyền write ở rules theo từng collection.

### 3.13 Settings

Đã có:

- Hiển thị thông tin user/current role.
- Một số UI cài đặt và thông tin app.
- Theme context hỗ trợ dark/light.

Chưa hoàn thiện:

- Chưa rõ có setting nào được lưu persist ngoài theme.
- Chưa có cấu hình runtime thật cho AI/import/GPM.
- Nút Upgrade Plan trong sidebar đang điều hướng settings nhưng chưa có logic billing/plan.

## 4. Những vấn đề cần sửa trước khi bàn giao

### P0 - Bảo mật whitelist/admin

Vấn đề:

- `checkAllowedAccount` tự tạo allowed account cho user chưa tồn tại.
- Email chứa `admin` được tự cấp role admin.
- Firestore rules cho phép self-create `allowedAccounts/{uid}` với role 0 hoặc 1 nếu payload hợp lệ.

Tác động:

- Người lạ có thể đăng ký tài khoản và có khả năng tự cấp quyền admin nếu Firebase Auth public.
- Whitelist mất ý nghĩa bảo vệ app nội bộ.

Khuyến nghị:

- Bỏ auto-create allowed account trong client.
- Bỏ rule email chứa `admin`.
- Firestore rules self-create chỉ cho `role == 0` hoặc tốt hơn là không cho self-create.
- Tài khoản mới cần trạng thái `pending` và admin approve.
- Tạo admin đầu tiên bằng Firebase Console/Admin SDK/seed script riêng.

### P0 - CI hiện không pass

Vấn đề:

- `.github/workflows/ci.yml` chạy `npm run lint` trước test/build.
- `npm run lint` hiện fail 56 errors.
- Job E2E chạy `npm run test:e2e`, nhưng repo không có test nên fail `No tests found`.

Tác động:

- Pull request/push vào CI sẽ fail.
- Không thể xem pipeline xanh là điều kiện bàn giao.

Khuyến nghị:

- Sửa lint hoặc tạm scope lint exclude `gpm-bridge`/tests theo quyết định rõ ràng.
- Thêm ít nhất smoke E2E cho login, overview, imports empty state, comments, analytics, seeding.
- Nếu chưa muốn E2E, tạm disable E2E job để CI không báo sai.

### P0 - Firestore rules chưa khớp feature scheduled campaign

Vấn đề:

- TypeScript có `CampaignStatus = "scheduled"`.
- Seeding UI tạo/sửa scheduled campaigns.
- `firestore.rules` local chỉ cho campaign status `draft`, `active`, `paused`, `completed`.

Tác động:

- Nếu deploy rules từ repo hiện tại, scheduled campaign có thể bị chặn.

Khuyến nghị:

- Thêm `scheduled` vào `isValidSeedingCampaign`.
- Validate thêm `scheduledAt` khi status là `scheduled`.
- Audit rules cho `seedingTasks.status = scheduled`.

### P1 - Documentation lệch code

Vấn đề:

- README badge nói 274 tests nhưng thực tế 291 tests.
- README nói TypeScript zero `any`, nhưng lint đang báo nhiều `any`.
- README nói PWA enabled, Sentry integration, `queryCache.ts`, `sentry.ts`, nhưng code/package hiện không thấy các phần tương ứng.
- `docs/GPM_EXCEL_BRIDGE.md` mô tả nguyên tắc bridge qua Excel/CSV, trong khi repo đã có `gpm-bridge` agent tự động trực tiếp.

Khuyến nghị:

- Cập nhật README theo trạng thái thật.
- Tách rõ 2 mode Seeding:
  - Excel/CSV bridge thủ công
  - GPM Bridge Agent tự động
- Cập nhật số test, scripts, env, deploy, known limitations.

### P1 - Coverage thấp và thiếu E2E

Vấn đề:

- Coverage toàn repo chỉ khoảng 13%.
- Page/component lớn gần như 0%.
- Không có E2E test trong repo.

Khuyến nghị:

- Thêm Playwright E2E smoke:
  1. login admin demo
  2. import ZIP sample
  3. filter overview/imports
  4. comments export
  5. analytics render charts
  6. seeding create profile/campaign/task/export/import report
  7. admin CRUD user bằng mock/emulator hoặc test env
- Thêm component tests cho `ImportFolder`, `CommentsPage`, `SeedingPage` theo các handler chính.

### P1 - GPM Bridge cần hardening vận hành

Vấn đề:

- Build pass nhưng chưa chứng minh chạy ổn với GPM/Facebook thật.
- Selector Facebook brittle.
- Chưa có healthcheck, dashboard, alert, metrics.

Khuyến nghị:

- Tạo file hướng dẫn vận hành GPM Bridge riêng:
  - `.env`
  - service account
  - GPM Login API URL
  - cách chạy bằng PM2/Windows service
  - log location
  - cách retry/cancel task
- Thêm dry-run mode.
- Thêm screenshot/log artifact khi task fail.
- Thêm concurrency limit config.
- Thêm trạng thái `cancelled` nếu cần hủy task.

### P1 - AI hạ tầng cần chuẩn hóa

Vấn đề:

- Gemini quota/CORS từng xảy ra trong browser QA.
- Một số AI chạy qua Cloud Function, một số chạy client fallback/local.
- Client-side Gemini key nếu dùng production sẽ bị expose.

Khuyến nghị:

- Production chỉ dùng Cloud Functions/secure backend cho Gemini.
- Client fallback chỉ cho local dev.
- Thêm Cloud Function cho AI Planner và Campaign Report nếu muốn AI thật.
- Thêm thông báo UI phân biệt "AI thật" và "fallback nội bộ".
- Thêm retry/backoff và rate-limit message thân thiện.

## 5. Roadmap nâng cấp đề xuất

### Giai đoạn 1 - Ổn định để test thủ công

Mục tiêu: người dùng có thể test app không bị chặn bởi lỗi nền.

Việc cần làm:

- Sửa security self-register/auto-admin.
- Sửa `firestore.rules` cho scheduled campaign.
- Sửa lint lỗi nghiêm trọng.
- Xóa hoặc gom artifact `.qa-*`, `.debug-*` ra thư mục ignored nếu không cần commit.
- Cập nhật README tối thiểu: setup, env, scripts, test status.
- Thêm seed/demo data script rõ ràng.

### Giai đoạn 2 - CI xanh và test tự động

Mục tiêu: mỗi lần sửa code có pipeline tin cậy.

Việc cần làm:

- Sửa hết lint hoặc cấu hình lint theo phạm vi chấp nhận được.
- Thêm E2E smoke thật.
- Chạy E2E bằng Firebase emulator hoặc test project riêng.
- Thêm coverage threshold theo module pure trước, rồi tăng dần.
- Thêm test cho Firestore rules nếu có thời gian.

### Giai đoạn 3 - Hoàn thiện vận hành production

Mục tiêu: triển khai được cho người dùng nội bộ.

Việc cần làm:

- Deploy Functions với secrets đúng.
- Deploy Firestore rules đã audit.
- Thiết lập Vercel/Firebase env theo môi trường dev/staging/prod.
- Chuẩn hóa log/monitoring.
- GPM Bridge chạy dạng service có restart policy.
- Backup/export Firestore định kỳ.
- Thêm hướng dẫn rollback.

### Giai đoạn 4 - Nâng cấp sản phẩm

Mục tiêu: tăng giá trị sử dụng và giảm thao tác thủ công.

Ý tưởng nâng cấp:

- GPM Bridge dashboard: trạng thái agent online/offline, queue length, task running.
- Task retry/cancel/resume từ UI.
- Campaign calendar cho scheduled campaigns.
- AI content variation manager cho comment/share.
- Profile health score dựa trên tỉ lệ success/failed/checkpoint.
- Rule engine chọn profile tốt nhất theo lịch sử.
- Import job history và retry import.
- Phân quyền chi tiết hơn: viewer, operator, admin.
- Audit log cho hành động xóa/import/export/seeding.
- Export report PDF theo campaign/import/analytics.

## 6. Đánh giá theo tiêu chí bàn giao

| Tiêu chí | Trạng thái | Ghi chú |
| --- | --- | --- |
| Build frontend | Đạt | `npm run build` pass |
| Unit test | Đạt | 291 tests pass |
| Coverage | Chưa đạt | Tổng thể chỉ khoảng 13% |
| Lint | Chưa đạt | 56 errors, 9 warnings |
| E2E | Chưa đạt | Chưa có test, script fail |
| Cloud Functions build | Đạt | `functions/npm run build` pass |
| GPM Bridge build | Đạt | `gpm-bridge/npm run build` pass |
| Seeding browser QA | Đạt phần UI | 17/17 pass, chưa xác nhận GPM/Facebook thật |
| Firestore security | Chưa đạt | Rủi ro auto whitelist/admin |
| Firestore schema/rules | Chưa đồng bộ | Thiếu `scheduled` trong campaign rules |
| Documentation | Cần cập nhật | README/docs có phần lệch code |
| Production readiness | Chưa đạt | Cần sửa P0/P1 trước |

## 7. Checklist thủ công để bạn test lại

Khi bạn có thể test thủ công, nên đi theo thứ tự này:

1. Đăng nhập admin.
2. Đăng nhập read-only và xác nhận không thấy/không dùng được thao tác write.
3. Thử đăng ký email thường, xác nhận không tự thành admin sau khi đã sửa bảo mật.
4. Import ZIP Facebook nhỏ.
5. Xem import trong Overview và Imports.
6. Mở chi tiết comments/reactions.
7. Export Excel/CSV/JSON.
8. Vào Comments, filter keyword/account/date/sentiment.
9. Chạy AI sentiment/SEO/leads/intent/ideas.
10. Vào Analytics, xác nhận tất cả chart render.
11. Chạy AI Summary.
12. Vào Seeding, tạo profile.
13. Import profile từ template.
14. Tạo campaign thường.
15. Tạo scheduled campaign.
16. Bulk create tasks like/comment/share.
17. Export tasks Excel/CSV.
18. Import report GPM sample.
19. Mở AI Campaign Report.
20. Mở AI Planner, tạo plan và apply.
21. Chạy GPM Bridge thật với 1 task like test.
22. Kiểm tra task status tự cập nhật từ GPM Bridge.
23. Test pause/resume/retry scenario.
24. Vào Admin, thêm/sửa/xóa user test.
25. Kiểm tra delete all imports chỉ admin dùng được.

## 8. Kết luận cuối

Project đã có nền tảng tốt và nhiều chức năng thực tế: import dữ liệu Facebook, dashboard phân tích, comments AI tools, Seeding Manager, Cloud Functions AI, và GPM Bridge Agent. Điểm mạnh là scope chức năng rộng, build/test unit pass, và module Seeding đã được kiểm thử browser pass.

Điểm chưa hoàn thiện nằm ở chất lượng bàn giao: security whitelist cần sửa ngay, CI hiện không xanh do lint/E2E, coverage thấp, rules chưa đồng bộ, tài liệu lỗi thời, và GPM Bridge cần kiểm chứng vận hành thật. Sau khi xử lý các P0/P1 trong báo cáo này, project có thể chuyển từ beta nội bộ sang bản staging đáng tin cậy hơn.
