# Checklist Test Thủ Công MVP Nội Bộ

Mục tiêu: xác nhận FB Pulse Tracker đủ điều kiện MVP nội bộ trước khi dùng thật.

## Chuẩn Bị

- Firebase Auth có 3 user test:
  - `admin@company.com`: có document `allowedAccounts/{uid}` với `role: 1`.
  - `viewer@company.com`: có document `allowedAccounts/{uid}` với `role: 0`.
  - `outsider@company.com`: có Firebase Auth user nhưng không có whitelist.
- Firestore Rules đã deploy bản mới.
- Có một Facebook ZIP mẫu.
- Có file profile mẫu CSV/XLSX và report seeding mẫu CSV/XLSX.

## Auth Và Phân Quyền

| Case | Kỳ vọng | Kết quả |
| --- | --- | --- |
| Admin login | Vào dashboard thành công | |
| Viewer login | Vào dashboard thành công | |
| Outsider login | Bị chặn, thấy thông báo liên hệ admin | |
| Login page | Không có register, Google login, forgot password, demo account | |
| Viewer mở Admin Page | Không có quyền quản trị hoặc bị rules/UI chặn thao tác ghi | |

## Facebook Data Workflow

| Case | Kỳ vọng | Kết quả |
| --- | --- | --- |
| Admin import Facebook ZIP | Import thành công, import record có status completed | |
| Viewer mở Imports | Xem được danh sách, không thấy nút Import mới/Xóa | |
| Admin xóa import test | Import và chunks liên quan bị xóa | |
| Overview dashboard | Stats/cards/charts render từ dữ liệu import | |
| Comments page | Danh sách comments render, filter hoạt động | |
| Comments export | CSV/JSON/XLSX tải được và mở được | |
| Analytics page | Timeline/reaction/sentiment/keyword charts render | |

## Seeding MVP Excel/CSV

| Case | Kỳ vọng | Kết quả |
| --- | --- | --- |
| Admin tạo profile | Profile xuất hiện realtime | |
| Admin import profiles CSV/XLSX | Profiles hợp lệ được upsert | |
| Viewer mở Profiles | Xem được profiles, không thấy nút tạo/sửa/xóa/import | |
| Admin tạo campaign draft | Campaign lưu thành công | |
| Admin tạo campaign scheduled | `status = scheduled`, có `scheduledAt` timestamp | |
| Admin tạo tasks | Tasks lưu thành công | |
| Admin export tasks CSV/XLSX | File có task_id, profile_id, action, target_url, delay | |
| Admin import report CSV/XLSX | Task status/error/finishedAt cập nhật đúng | |
| Viewer mở Seeding | Xem dashboard/campaign/report, không tạo/sửa/xóa được | |

## Admin Whitelist

| Case | Kỳ vọng | Kết quả |
| --- | --- | --- |
| Admin thêm viewer test bằng UID | Document ID trùng Firebase Auth UID | |
| Admin sửa displayName/email | Cập nhật thành công | |
| Admin đổi role viewer 0 -> 1 -> 0 | Cập nhật thành công cho user khác | |
| Admin tự hạ role chính mình | Bị Firestore Rules từ chối | |
| Admin tự xóa chính mình | Bị Firestore Rules từ chối | |
| Admin xóa user test khác | Xóa thành công, user đó login lại bị chặn | |

## CI/Bàn Giao

Ghi lại kết quả các lệnh:

```bash
npm run lint
npm test -- --runInBand
npm run build
npm run test:e2e
npm --prefix functions run build
npm --prefix gpm-bridge run build
```

## Ghi Chú MVP

- GPM Bridge Agent chưa phải điều kiện pass MVP đầu tiên.
- Đường chính của Seeding MVP là export task Excel/CSV, chạy thủ công qua GPM, rồi import report.
- Nếu Gemini lỗi model/API, workflow vẫn phải chạy bằng fallback hoặc thông báo lỗi không crash UI.
