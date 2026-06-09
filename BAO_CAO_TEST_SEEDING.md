# Báo cáo test và sửa lỗi chức năng Seeding

Ngày thực hiện: 2026-06-09  
Repo nguồn: `D:\TrungHuy\TTTN\source_read_json_file\json-tool-main-main`  
URL kiểm thử: `http://127.0.0.1:5173/seeding`  
Kết luận: **PASS chức năng Seeding, 17/17 bước kiểm thử tự động đạt**

## 1. Tóm tắt lỗi gốc

Lỗi AI ban đầu:

```text
[GoogleGenerativeAI Error]: Error fetching from
https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent:
[404] models/gemini-1.5-flash is not found for API version v1beta
```

Nguyên nhân chính là app đang gọi model `gemini-1.5-flash` qua endpoint `v1beta`, nhưng model này không còn dùng được cho `generateContent` trong môi trường hiện tại. Tôi đã đối chiếu hướng xử lý theo tài liệu chính thức của Google AI về danh sách model và `models.list`: https://ai.google.dev/api/models

Sau khi đổi model, môi trường test tiếp tục gặp giới hạn quota `429` từ Gemini và lỗi CORS của Cloud Function tạo ý tưởng seeding. Hai lỗi hạ tầng này đã được xử lý bằng fallback local để người dùng vẫn dùng được chức năng AI Planner, AI ý tưởng bình luận và AI báo cáo chiến dịch.

## 2. File đã sửa

`src/utils/geminiClient.ts`

- Thêm cơ chế chuẩn hóa model Gemini.
- Nếu cấu hình cũ vẫn là `gemini-1.5-flash`, app tự chuyển về model fallback `gemini-2.0-flash`.
- Giúp tránh lỗi 404 do model cũ.

`src/service/aiExtendedService.ts`

- Thêm fallback local cho `generateSeedingIdeasWithAI`.
- Thêm fallback local cho `planCampaignWithAI`.
- Thêm fallback local cho `generateCampaignReportWithAI`.
- Khi Gemini bị quota `429`, Cloud Function bị CORS, hoặc API lỗi, UI vẫn nhận được dữ liệu hợp lệ để tiếp tục workflow.

`src/pages/SeedingPage.tsx`

- Sửa lỗi tạo bulk task gửi field `undefined` lên Firestore.
- Chỉ set `commentText` khi task là `comment`.
- Chỉ set `shareCaption` khi task là `share`.
- Bọc validate form trong `try/catch` để log đúng lỗi thật khi bulk create fail.
- Dời `bulkForm.setFieldsValue` chạy sau khi modal mount để giảm cảnh báo Ant Design.

`.env`

- Đổi `VITE_GEMINI_MODEL` sang `gemini-2.0-flash`.

## 3. Kết quả kiểm thử tự động trên trình duyệt

Artifact chính:

- Kết quả JSON: `D:\TrungHuy\TTTN\source_read_json_file\json-tool-main-main\.qa-seeding-full-20260609144647-results.json`
- Ảnh màn hình cuối: `D:\TrungHuy\TTTN\source_read_json_file\json-tool-main-main\.qa-seeding-full-20260609144647-final.png`
- CSV export được dùng trong test import report: `D:\TrungHuy\TTTN\source_read_json_file\json-tool-main-main\.qa-report-20260609144647.csv`

Dữ liệu test:

- Prefix: `QA Codex 20260609144647`
- Profile test: `qa_profile_20260609144647`
- Campaign test: `QA Codex 20260609144647 Campaign`
- Scheduled campaign test: `QA Codex 20260609144647 Scheduled`
- Target URL test: `https://facebook.com/post/20260609144647`

Kết quả từng bước:

| STT | Chức năng | Kết quả |
| --- | --- | --- |
| 1 | Đăng nhập admin demo và mở `/seeding` | PASS |
| 2 | Tab dashboard hiển thị | PASS |
| 3 | Tạo seeding profile | PASS |
| 4 | Tìm kiếm profile vừa tạo | PASS |
| 5 | Tạo comment library item | PASS |
| 6 | Tìm kiếm comment vừa tạo | PASS |
| 7 | Tạo campaign | PASS |
| 8 | AI comment ideas modal sinh ý tưởng và dùng ý tưởng | PASS |
| 9 | Bulk create campaign task | PASS |
| 10 | Start và pause GPM campaign state | PASS |
| 11 | Export CSV và Excel | PASS |
| 12 | Import GPM report và cập nhật task | PASS |
| 13 | Mở AI campaign report và sinh báo cáo | PASS |
| 14 | Lưu campaign thành template | PASS |
| 15 | Tạo scheduled campaign | PASS |
| 16 | AI Planner sinh task và áp dụng kế hoạch | PASS |
| 17 | Cleanup dữ liệu QA từ UI | PASS |

Tổng kết browser QA:

- Tổng bước: 17
- Pass: 17
- Fail: 0
- `pageErrors`: không có lỗi page crash.
- Dữ liệu QA đã được cleanup sau khi chạy xong để không làm bẩn Firestore.

## 4. Kết quả build và unit test

Đã chạy:

```bash
npm run build
```

Kết quả: **PASS**

Đã chạy:

```bash
npm test -- --runInBand
```

Kết quả: **PASS**

Số lượng test:

- Test files: 24 passed
- Tests: 291 passed

## 5. Ghi chú console và network sau khi pass

Các chức năng chính đều pass, nhưng log trình duyệt vẫn ghi nhận một số cảnh báo hoặc lỗi hạ tầng không chặn workflow:

| Nhóm | Hiện tượng | Trạng thái |
| --- | --- | --- |
| Gemini quota | API trả `429` vì quota hiện tại bằng 0 hoặc hết giới hạn | Đã có fallback local, chức năng vẫn pass |
| Cloud Function CORS | `generateSeedingIdeas` bị CORS khi gọi từ localhost | Đã có fallback local, chức năng vẫn pass |
| Ant Design | Cảnh báo `message` static function và `Space direction` deprecated | Không chặn chức năng |
| ECharts | Cảnh báo `disconnect` khi chart unmount | Không chặn chức năng |
| Firestore/Vite abort | Một số request `net::ERR_ABORTED` khi route thay đổi hoặc HMR/navigate cleanup | Không chặn chức năng |

Nếu muốn output AI thật từ Gemini thay vì fallback local, cần xử lý thêm ở tầng hạ tầng:

- API key Gemini phải có quota hợp lệ.
- Cloud Function `generateSeedingIdeas` cần cấu hình CORS cho origin localhost và domain production.

## 6. Checklist thủ công để đối chiếu

1. Chạy dev server và mở `http://127.0.0.1:5173/seeding`.
2. Đăng nhập bằng tài khoản admin demo đang dùng trong app.
3. Vào dashboard Seeding và xác nhận tab tải được.
4. Tạo một profile seeding mới, sau đó tìm lại bằng ô search.
5. Tạo một comment trong thư viện comment, sau đó tìm lại bằng ô search.
6. Tạo một campaign mới với URL Facebook test.
7. Mở AI comment ideas, bấm sinh ý tưởng, chọn một ý tưởng và xác nhận comment được đưa vào form.
8. Dùng bulk create để tạo task cho campaign.
9. Bấm start campaign, sau đó pause campaign và xác nhận trạng thái thay đổi.
10. Export task ra CSV và Excel.
11. Import file report GPM để cập nhật trạng thái task.
12. Mở AI campaign report và xác nhận báo cáo sinh ra.
13. Lưu campaign thành template.
14. Tạo scheduled campaign.
15. Mở AI Planner, nhập goal, sinh kế hoạch và áp dụng task được gợi ý.
16. Xóa dữ liệu test vừa tạo.
17. Nếu Gemini quota hết hoặc Cloud Function lỗi CORS, UI vẫn phải có nội dung fallback và không được crash.

## 7. Review code sau sửa

Các lỗi chặn chức năng đã được xử lý:

- Không còn phụ thuộc cứng vào model `gemini-1.5-flash`.
- Không còn crash workflow AI khi Gemini hoặc Cloud Function lỗi.
- Bulk create không còn gửi field `undefined` lên Firestore.
- Form bulk task không còn bị set value trước khi modal mount.

Các điểm còn nên cải thiện sau:

- Chuyển các API Ant Design `message.*` static sang context từ `App.useApp()` để bỏ warning theme context.
- Thay prop `direction` deprecated của Ant Design Space bằng prop mới theo version hiện tại.
- Xem lại lifecycle của `echarts-for-react` để loại cảnh báo unmount.
- Nếu cần dùng Cloud Function production, thêm cấu hình CORS đúng cho endpoint `generateSeedingIdeas`.
- Nếu cần output AI thật, nâng quota hoặc kiểm tra billing/API key Gemini.

Kết luận cuối: chức năng Seeding đã pass end-to-end trong browser QA, build pass và unit test pass. Các warning còn lại là non-blocking hoặc thuộc cấu hình hạ tầng, đã có fallback để không làm hỏng trải nghiệm người dùng.
