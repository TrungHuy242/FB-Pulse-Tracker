# GPM Excel Bridge — Hướng dẫn vận hành

> **Module:** Seeding Manager (`/seeding`)  
> **Phiên bản:** 1.0  
> **Cập nhật:** 31/05/2026  
> **Nguyên tắc:** Không gọi Facebook API từ web · Không kết nối GPM Login trực tiếp · Bridge qua Excel/CSV

---

## Tổng quan luồng

```
┌──────────────────────────────────────────────────────────────────┐
│  FB Pulse Tracker (Web)                                          │
│                                                                  │
│  1. Tạo Profiles → Tạo Campaign → Tạo Tasks                     │
│  2. Export Tasks Excel ──────────────────────────────────────┐   │
│                                                              │   │
│  5. Import Report Excel ◄────────────────────────────────┐   │   │
│  6. Update task status + stats                           │   │   │
└──────────────────────────────────────────────────────────┼───┼───┘
                                                           │   │
┌──────────────────────────────────────────────────────────┼───┼───┐
│  GPM Automate                                            │   │   │
│                                                          │   │   │
│  3. Load file Excel tasks ◄──────────────────────────────┘   │   │
│  4. Chạy task (like/comment/share) → Xuất report ────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Bước 1 — Tạo Profiles

### Cách 1: Import từ Excel/CSV (khuyến nghị)

1. Vào **Seeding Manager → Tab Profiles**
2. Nhấn **"Template"** để tải file mẫu `gpm_profiles_template.xlsx`
3. Điền thông tin profiles:

| profile_id | profile_name | status | note |
|------------|--------------|--------|------|
| `profile_001` | Nguyễn Văn A | `active` | Tài khoản chính |
| `profile_002` | Trần Thị B | `active` |  |
| `profile_003` | Lê Văn C | `inactive` | Tạm nghỉ |

4. Nhấn **"Import CSV/Excel"** → chọn file → **Import**
5. Hệ thống upsert: tạo mới nếu `profile_id` chưa có, cập nhật nếu đã có

> **Profile status:**
> - `active` — dùng bình thường
> - `inactive` — tạm không dùng
> - `banned` — bị khóa/vô hiệu, không xuất hiện khi chọn tạo tasks

### Cách 2: Thêm thủ công

Nhấn **"Thêm profile"** → điền Profile ID (GPM), Tên, Status → Lưu.

---

## Bước 2 — Tạo Campaign

1. Vào **Tab Chiến dịch** → nhấn **"Tạo chiến dịch"**
2. Điền:
   - **Tên chiến dịch**: VD `Like bài tháng 6 - Fanpage ABC`
   - **Mô tả** (tuỳ chọn)
   - **Trạng thái**: chọn `Nháp` khi mới tạo
   - **Target URL mặc định**: URL bài post sẽ seeding (có thể ghi đè per-task)

---

## Bước 3 — Tạo Tasks

1. Trong bảng campaigns, nhấn **"Thêm"** bên cạnh campaign
2. Modal **"Thêm tasks hàng loạt"**:
   - **Chọn profiles**: chọn 1 hoặc nhiều profiles (chỉ hiện `active`)
   - **Hành động**: `like` / `comment` / `share`
   - **Target URL**: URL cụ thể (điền lại nếu khác default)
   - **Nội dung comment** (chỉ khi action = comment)
   - **Share caption** (chỉ khi action = share)
   - **Delay min/max (giây)**: khoảng delay random giữa các task trong GPM
3. Nhấn **"Tạo tasks"** → hệ thống tạo 1 task per profile

> **Ví dụ:** Chọn 10 profiles + action `like` → tạo 10 tasks, mỗi task cho 1 profile.

---

## Bước 4 — Export Excel cho GPM

1. Trong bảng campaigns, nhấn **"Export"** → chọn **Excel (.xlsx)** hoặc **CSV (.csv)**
2. File tải về có tên: `gpm_tasks_<campaign_name>_<date>.xlsx`
3. Hệ thống tự ghi `exportedAt` cho các tasks đã export

### Cấu trúc file tasks (input cho GPM)

| Column | Type | Mô tả |
|--------|------|-------|
| `task_id` | string | ID task trong Firestore — **bắt buộc giữ nguyên** khi viết report |
| `profile_id` | string | ID profile trong GPM |
| `profile_name` | string | Tên hiển thị |
| `action` | `like` / `comment` / `share` | Loại hành động |
| `target_url` | string | URL bài post cần seeding |
| `comment_text` | string | Nội dung comment (trống nếu không phải action comment) |
| `share_caption` | string | Caption khi share (trống nếu không phải action share) |
| `delay_min` | number | Delay tối thiểu (giây) |
| `delay_max` | number | Delay tối đa (giây) |

> **Lưu ý cho GPM Automate:**
> - `task_id` phải được **giữ nguyên** trong report — đây là khoá để web match kết quả
> - `delay_min` / `delay_max` là gợi ý — GPM tự randomize trong khoảng này
> - `comment_text` và `share_caption` để trống cho các hành động không liên quan

---

## Bước 5 — GPM Automate chạy tasks

1. Trong GPM Automate, load file Excel tasks vừa export
2. Map các cột vào các trường tương ứng của GPM script
3. Chạy batch — GPM tự xử lý delay và ghi log kết quả
4. Sau khi hoàn thành, **Export report** từ GPM

### Cấu trúc file report (output từ GPM)

| Column | Type | Bắt buộc | Mô tả |
|--------|------|----------|-------|
| `task_id` | string | ✅ | ID task — phải khớp với file tasks đã export |
| `status` | string | ✅ | Kết quả thực thi (xem bảng status bên dưới) |
| `profile_id` | string | — | ID profile (để đối chiếu) |
| `action` | string | — | Hành động đã thực hiện |
| `target_url` | string | — | URL đã thực hiện |
| `error_message` | string | — | Mô tả lỗi nếu failed |
| `finished_at` | string | — | Thời gian hoàn thành (ISO 8601 hoặc `YYYY-MM-DD HH:mm:ss`) |

### Giá trị status hợp lệ

| GPM xuất | Web nhận là |
|----------|------------|
| `success`, `done`, `completed`, `ok` | `success` |
| `failed`, `error`, `fail` | `failed` |
| `running`, `processing`, `in_progress` | `running` |
| `skipped`, `skip`, `ignored` | `skipped` |
| Giá trị khác | `failed` (mặc định) |

> **Tên cột linh hoạt:** Web hỗ trợ cả `task_id` và `Task ID`, `status` và `Status`, v.v.

---

## Bước 6 — Import Report vào Web

1. Vào **Tab Chiến dịch** → nhấn **"Report"** bên cạnh campaign tương ứng
2. Chọn file report Excel/CSV từ GPM → nhấn **"Import"**
3. Web tự động:
   - Parse file → match từng row theo `task_id`
   - Cập nhật `status`, `error_message`, `finishedAt` cho từng task
   - Refresh dashboard stats

### Xem kết quả

- Nhấn **"Tasks"** bên cạnh campaign để xem danh sách task với status mới
- Stats cards cập nhật: Pending / Success / Failed / Success Rate %
- Progress bar hiển thị tỉ lệ thành công

---

## Cấu trúc Firestore

```
seedingProfiles/{id}
  profileId:   string       — GPM profile identifier
  profileName: string
  status:      active | inactive | banned
  note?:       string
  createdAt:   Timestamp

seedingCampaigns/{id}
  name:        string
  description?: string
  status:      draft | active | paused | completed
  targetUrl?:  string
  createdAt:   Timestamp
  updatedAt:   Timestamp

seedingTasks/{id}
  campaignId:   string      — FK → seedingCampaigns
  profileId:    string      — GPM profile ID (string)
  profileName:  string
  action:       like | comment | share
  targetUrl:    string
  commentText?: string
  shareCaption?: string
  delayMin:     number      — giây
  delayMax:     number
  status:       pending | running | success | failed | skipped
  errorMessage?: string
  finishedAt?:  Timestamp
  exportedAt?:  Timestamp
  createdAt:    Timestamp

seedingComments/{id}
  text:       string
  tags:       string[]
  usageCount: number
  createdAt:  Timestamp
```

**Firestore Rules:** Read = `isAllowedUser` · Write = `isAdmin`

---

## Checklist test — 3 task like/comment/share

### Chuẩn bị

- [ ] Tạo ít nhất 3 profiles (profile_001, profile_002, profile_003) — status `active`
- [ ] Tạo 1 campaign: `Test Campaign`
- [ ] Điền Target URL mặc định: `https://www.facebook.com/permalink/12345`

### Tạo tasks

- [ ] Thêm tasks: chọn `profile_001`, action = `like`, target URL = default
- [ ] Thêm tasks: chọn `profile_002`, action = `comment`, comment_text = `Hay lắm anh ơi!`
- [ ] Thêm tasks: chọn `profile_003`, action = `share`, share_caption = `Chia sẻ hay`
- [ ] Kiểm tra tab Tasks: hiển thị đúng 3 tasks, status = `pending`

### Export

- [ ] Nhấn **Export → Excel** cho campaign
- [ ] Mở file Excel → xác nhận 3 rows, đúng columns
- [ ] `task_id` khác nhau cho cả 3 rows
- [ ] `comment_text` chỉ có giá trị ở row comment
- [ ] `share_caption` chỉ có giá trị ở row share

### Tạo report mẫu (giả lập GPM)

Sao chép file tasks vừa export. Thêm các cột sau:

| task_id | status | error_message | finished_at |
|---------|--------|---------------|-------------|
| `<id_like>` | `success` | | `2026-05-31T10:00:00Z` |
| `<id_comment>` | `failed` | `Session expired` | `2026-05-31T10:01:00Z` |
| `<id_share>` | `skipped` | `Already shared` | `2026-05-31T10:02:00Z` |

### Import report

- [ ] Nhấn **Report** cho campaign → upload file report
- [ ] Nhấn Import
- [ ] Kiểm tra Tasks modal:
  - Task like → status = `success` (màu xanh)
  - Task comment → status = `failed` (màu đỏ), error message hiển thị
  - Task share → status = `skipped` (màu vàng)
- [ ] Stats cards cập nhật: Success = 1, Failed = 1, Skipped = 1
- [ ] Success Rate = 33% (1/3 completed tasks)

### Kiểm tra thêm

- [ ] Tạo comment trong **Thư viện bình luận**, copy text hoạt động
- [ ] Profile status `inactive` không xuất hiện khi chọn tạo tasks
- [ ] Xóa campaign → tất cả tasks liên quan bị xóa theo (cascade delete)

---

## Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| Import report không cập nhật task nào | `task_id` trong report không khớp file tasks | Đảm bảo dùng đúng file tasks gốc, không sửa task_id |
| Profile không hiện khi thêm task | Profile có status `inactive` hoặc `banned` | Đổi status về `active` trong tab Profiles |
| Tasks export về 0 rows | Campaign không có tasks | Thêm tasks trước khi export |
| Status không nhận dạng | GPM xuất status không chuẩn | Xem bảng mapping status hợp lệ ở trên |
| File import báo lỗi | File bị corrupt hoặc sai định dạng | Dùng `.xlsx` hoặc `.csv` UTF-8, không dùng `.xls` cũ |
