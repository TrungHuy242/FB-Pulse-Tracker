# Seeding Manager - Hieu nhanh

Seeding Manager la khu vuc trong FB Pulse Tracker dung de quan ly ket hoach seeding noi bo: tao profile, tao campaign, sinh task, export file cho GPM Automate, roi import report quay ve web.

Chi admin moi duoc tao/sua/xoa du lieu; viewer chi xem dashboard, danh sach va bao cao.

## 1. Seeding Manager lam gi?

No khong chay Facebook truc tiep tren web. Luong chinh la:

`Web -> Export Excel/CSV -> GPM Automate chay -> Export report -> Import report ve web`

Day la cach lam MVP an toan hon cho noi bo: web giu du lieu, GPM xu ly hanh dong, report quay lai de cap nhat trang thai.

## 2. 3 khu vuc chinh

| Khu vuc | Dung de lam gi |
| --- | --- |
| Campaigns | Tao chien dich, them task, export/import report, bat/dung chay, luu template |
| Profiles | Quan ly profile GPM dung de chay seeding |
| Thu vien binh luan | Luu cac mau comment de tai su dung |
| AI Planner | Goi y ke hoach seeding va sinh task bang AI |

## 3. Du lieu quan trong

### Campaign status

- `draft`: ban thao
- `active`: dang chay
- `paused`: tam dung
- `completed`: da xong
- `scheduled`: da hen gio

### Task status

- `scheduled`: da len lich
- `pending`: cho chay
- `running`: dang chay
- `success`: thanh cong
- `failed`: loi
- `skipped`: bo qua

### Profile status

- `active`: dung duoc
- `inactive`: tam dung
- `banned`: khoa

## 4. Luong dung chuan

1. Tao hoac import `Profiles`.
2. Tao `Campaign`.
3. Them task thu cong, bulk, hoac dung `AI Planner`.
4. Export task ra `.xlsx` hoac `.csv`.
5. Dua file do sang `GPM Automate` de chay.
6. Export report tu GPM.
7. Import report ve web de cap nhat task.

## 5. Giải thích từng chức năng

### 5.1 Campaigns

Campaign la lop quan ly cao nhat. Mot campaign gom nhieu task va gan voi mot muc tieu ro rang, vi du:

- like mot bai viet
- comment theo kieu noi dung co san
- share mot bai viet

Campaign co the:

- tao moi
- sua
- xoa
- luu thanh template
- chay ngay qua GPM Bridge
- tam dung
- hen gio chay

### 5.2 Profiles

Profile la danh sach account GPM se dung de chay task. Muc nay quan trong vi moi task can 1 profile cu the.

Web ho tro:

- them profile moi
- sua/xoa profile
- import CSV/Excel
- export template mau

### 5.3 Thu vien binh luan

Day la noi luu cac comment mau de tai su dung khi tao task comment. No giup:

- tranh phai nhap lai tung comment
- luu mau comment hay dung
- phan loai theo tag

### 5.4 Bulk task

Bulk task la cach tao nhieu task cung luc cho nhieu profile. Moi task se co:

- profile
- action: `like`, `comment`, `share`
- target URL
- comment text hoac share caption neu can
- delay min/max

### 5.5 Export/Import report

Khi export task tu web:

- web sinh file co `task_id`
- `task_id` la khoa doi chieu khi import report ve

Khi import report:

- web doc file report tu GPM
- match theo `task_id`
- cap nhat `status`, `error_message`, `finishedAt`

Day la khau quan trong nhat de dong bo web va GPM.

### 5.6 AI Planner

AI Planner khong phai luc chay Facebook. No chi goi y:

- y tuong seeding
- ke hoach campaign
- danh sach task de ap dung

Neu AI loi, workflow chinh van phai chay duoc. Day la thiet ke dung cho MVP noi bo.

## 6. Uu diem

- Khong can viet code moi moi khi can seeding.
- Co the lam viec bang Excel/CSV, de huan luyen nguoi van hanh.
- Co template, report, va task ID ro rang nen de doi chieu.
- AI co the ho tro lap ke hoach, nhung khong phu thuoc bat buoc.
- Phan quyen ro: viewer chi xem, admin moi duoc tao/sua/xoa.

## 7. Nhuoc diem

- Khong tu dong 100% tu web sang Facebook.
- Con phu thuoc GPM va quy trinh export/import thu cong.
- Phai giu dung `task_id`, neu sai report se khong match duoc.
- Chat luong report phu thuoc file GPM nguoi dung export.
- AI co the bi loi quota, API key, hoac model, nen can fallback.

## 8. Can cai thien them

- Validate file import ro hon truoc khi ghi du lieu.
- Hien canh bao khi report khong co `task_id` hop le.
- Them mau campaign/profile/task san hon cho user moi.
- Giam canh bao UI tu thu vien ngoai.
- Lam man hinh tom tat campaign de doc nhanh hon.
- Tao huong dan ngay trong UI cho nguoi moi dung.

## 9. Cach dung de de hieu nhat

Neu ban moi dung Seeding Manager, thu theo thu tu nay:

1. Mo `Profiles` va dam bao co it nhat 1 profile `active`.
2. Qua `Campaigns` tao mot campaign moi.
3. Bam `Them` de tao task cho campaign do.
4. Export task ra Excel hoac CSV.
5. Dua file do sang GPM de chay.
6. Sau khi GPM chay xong, export report.
7. Import report ve web.
8. Kiem tra task da doi sang `success`, `failed`, hoac `skipped`.

## 10. Ket luan ngan

Seeding Manager la bo dieu khien trung tam cho quy trinh seeding noi bo. No giup web giu quan ly, GPM giu phan chay thuc te, con report giup dong bo ket qua. Day la cach lam hop ly cho MVP vi vua de dung, vua de kiem soat, vua khong phu thuoc hoan toan vao AI hay automation phuc tap.
