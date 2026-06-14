# Bao cao GPM Profiles Module - 2026-06-14

## Muc tieu
Redo/hoan thien module Profiles GPM trong Seeding Manager theo huong MVP noi bo:
- doc du lieu tu GPM Login local API
- hien thi profile, group, proxy, browser version
- xem chi tiet profile
- start/stop profile
- sync profile ve Firebase cho seeding
- giu fallback API v1/v3 de tuong thich moi ban GPM

## Da lam
- Chuan hoa `src/types/gpm.ts` theo response thuc te cua GPM local API.
- Sua `src/service/gpmApiService.ts` de goi qua bridge, ho tro list/paginate, browser versions, groups, proxies, start/stop.
- Sua `gpm-bridge/src/apiServer.ts`:
  - `/health` kiem tra ca bridge va GPM local API
  - forward `/api/v1/...`
  - fallback `/api/v1//browsers/versions`
  - pass `page_size`, `sort`, `group_id`
- Sua `gpm-bridge/src/gpmClient.ts`:
  - uu tien API v1
  - fallback v3 neu may chay GPM cu hon
- Sua `src/components/GpmProfilesTab.tsx`:
  - bo error build `Title` thua
  - doc browser/os raw tu GPM
  - viewer chi xem, admin moi duoc write
  - modal detail hien dung browser/OS/version
  - start/stop profile hoat dong
- Sua `src/pages/SeedingPage.tsx` de giu fallback tab Firebase cu sau env flag.
- Cap nhat `gpm-bridge/.env.example` va default port ve `9495`.

## Test da chay
- `npm run build` - pass
- `npm run lint` - pass
- `npm test -- --runInBand` - 291 passed
- `npm run test:e2e` - 6 passed, 4 skipped
- `npm run build` trong `gpm-bridge` - pass

## Browser smoke da kiem tra
- Dang nhap admin: `admin@gmail.com / 123456`
- Mo `Seeding Manager -> Profiles GPM`
- Danh sach load duoc du lieu that tu GPM local: 569 profiles
- Modal chi tiet hien dung `Browser` va `OS`
- Start profile `Meta 199` va `Meta 200` thanh cong
- Stop profile qua popconfirm va gui ve trang thai cu thanh cong

## Ghi chu
- Console con mot warning san co cua app: `antd message static function can not consume context`.
- Console con co warning ECharts/Spin o cac page khac, khong phat sinh tu module GPM Profiles.

## Prompt cho Antigravity
Dung prompt trong file `PROMPT_ANTIGRAVITY_TEST_GPM_PROFILES_2026-06-14.md`.
