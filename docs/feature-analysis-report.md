# BÁO CÁO PHÂN TÍCH CHỨC NĂNG HỆ THỐNG

**Ngày:** 21/06/2026  
**Người thực hiện:** Claude Code

---

## 1. TỔNG QUAN CẤU TRÚC HỆ THỐNG

### 1.1 Navigation (Sidebar)

```
├── Tổng quan (/)          ← Trang HomePage
├── Imports (/imports)      ← Trang ImportsPage
├── Analytics (/analytics)   ← Trang AnalyticsPage  
├── Bình luận (/comments)   ← Trang CommentsPage
├── Seeding Manager (/seeding)
│   ├── Chiến dịch
│   ├── AI Planner
│   ├── Profiles GPM
│   └── Thư viện bình luận
├── Quản trị (/admin)       ← Admin only
└── Cài đặt (/settings)
```

### 1.2 Các Trang chính

| Trang | File | Lines | Mô tả |
|-------|------|-------|--------|
| HomePage | `src/pages/HomePage.tsx` | ~275 | Dashboard tổng quan |
| ImportsPage | `src/pages/ImportsPage.tsx` | ? | Quản lý imports |
| AnalyticsPage | `src/pages/AnalyticsPage.tsx` | ~369 | Phân tích sâu |
| CommentsPage | `src/pages/CommentsPage.tsx` | ~1261 | Quản lý bình luận |
| SeedingPage | `src/pages/SeedingPage.tsx` | ? | Seeding Manager |

---

## 2. PHÂN TÍCH CHI TIẾT TỪNG TRANG

### 2.1 TRANG TỔNG QUAN (HomePage) ✅ CÓ GIÁ TRỊ

**Components trong trang:**
| Component | Giá trị | Nhận xét |
|-----------|---------|----------|
| `StatsCards` | ✅ Cao | Hiển thị tổng quan số liệu |
| `EngagementChart` | ✅ Cao | Biểu đồ timeline tương tác |
| `AccountsTable` | ✅ Cao | Bảng danh sách tài khoản |
| `ImportZip` | ✅ Cao | Chức năng import ZIP |
| `TopProfiles` | ⚠️ Trung bình | Hiển thị top 3 profiles |
| `SentimentEfficiency` | ⚠️ Trung bình | Phân tích sentiment cơ bản |
| `WelcomeEmptyState` | ✅ Cao | Onboarding state |

**Đề xuất:**
- **Giữ nguyên** - Đây là dashboard cần thiết
- `TopProfiles` có thể cải thiện hoặc gộp vào `StatsCards`

---

### 2.2 TRANG ANALYTICS (AnalyticsPage) ⚠️ NÊN CẮT GIẢM

**Components trong trang:**
| Component | Giá trị | Nhận xét |
|-----------|---------|----------|
| `InsightsPanel` | ⚠️ Thấp | Auto-insights đơn giản |
| `PerformanceScoreTable` | ⚠️ Thấp | Score tính không rõ công thức |
| `AiSummaryPanel` | ⚠️ Phụ thuộc AI | Cần Gemini API |
| `TimelineChart` | ✅ Trung bình | Biểu đồ timeline |
| `ReactionPieChart` | ✅ Trung bình | Phân bố reaction types |
| `ActivityHeatmap` | ⚠️ Thấp | Heatmap hoạt động |
| `TopCommentersChart` | ⚠️ Thấp | Top commenters |
| `SentimentChart` | ⚠️ Thấp | Biểu đồ sentiment |
| `KeywordFreqChart` | ⚠️ Thấp | Tần suất từ khóa |

#### Các component NÊN XÓA:

| Component | Lý do |
|-----------|--------|
| `InsightsPanel` | Insights đơn giản, chỉ hiển thị peak time, top author - không có action value |
| `PerformanceScoreTable` | Công thức tính score không rõ ràng, Grade A-F không có context |
| `ActivityHeatmap` | Ít ai xài, dữ liệu Facebook group không đủ dense để heatmap |
| `TopCommentersChart` | Trùng lặp với data có sẵn trong bảng |
| `SentimentChart` | Trùng lặp với `SentimentEfficiency` trong HomePage |

#### Các component NÊN GIỮ:

| Component | Lý do |
|-----------|--------|
| `TimelineChart` | Quan trọng cho trend analysis |
| `ReactionPieChart` | Giúp hiểu phân bố reaction types |
| `AiSummaryPanel` | Nếu có AI budget, giữ lại |

---

### 2.3 TRANG BÌNH LUẬN (CommentsPage) ✅ CÓ GIÁ TRỊ

**Components trong trang:**
| Component | Giá trị | Nhận xét |
|-----------|---------|----------|
| Search & Filter | ✅ Cao | Tìm kiếm toàn văn, lọc theo nhiều tiêu chí |
| Table Pagination | ✅ Cao | Xem comments phân trang |
| Export (CSV/JSON/Excel) | ✅ Cao | Xuất dữ liệu |
| AI Analysis | ⚠️ Phụ thuộc AI | Phân tích sentiment/batch |
| `KeywordFreqChart` | ⚠️ Thấp | Tần suất từ khóa |
| `SentimentChart` | ⚠️ Thấp | Biểu đồ sentiment |

**Đề xuất:**
- **Giữ nguyên** chức năng core
- **Xóa bỏ** `KeywordFreqChart` và `SentimentChart` nếu trùng lặp với Analytics

---

### 2.4 TRANG IMPORTS (ImportsPage) ✅ CÓ GIÁ TRỊ

**Chức năng:**
- Quản lý danh sách imports đã import
- Delete individual/bulk imports
- Xem chi tiết từng import

**Đề xuất:**
- **Giữ nguyên** - Core functionality

---

### 2.5 TRANG SEEDING MANAGER ✅ GIỮ NGUYÊN

Như yêu cầu - **GIỮ NGUYÊN**

---

## 3. BẢNG TỔNG HỢP ĐỀ XUẤT

### 3.1 XÓA (Có thể xóa ngay)

| File | Lý do |
|------|--------|
| `src/components/InsightsPanel.tsx` | Auto-insights quá đơn giản, không có action value |
| `src/components/PerformanceScoreTable.tsx` | Score formula không rõ, Grade không có context |
| `src/components/charts/ActivityHeatmap.tsx` | Dữ liệu không đủ dense |
| `src/components/charts/TopCommentersChart.tsx` | Trùng lặp data |
| `src/components/charts/SentimentChart.tsx` | Trùng lặp SentimentEfficiency |

### 3.2 CẢI TIẾN HOẶC GỘP

| File | Đề xuất |
|------|---------|
| `src/components/TopProfiles.tsx` | Gộp vào StatsCards hoặc cải thiện UX |
| `src/components/SentimentEfficiency.tsx` | Gộp vào StatsCards |
| `src/components/charts/KeywordFreqChart.tsx` | Giữ trong CommentsPage, xóa khỏi Analytics |

### 3.3 Cần AI API (Quyết định sau)

| File | Điều kiện |
|------|------------|
| `src/components/AiSummaryPanel.tsx` | Nếu có Gemini API key |
| `src/service/aiSummaryService.ts` | Nếu có AI budget |
| AI features trong CommentsPage | Nếu có AI budget |

---

## 4. CẤU TRÚC SAU KHI CẮT GIẢM (ĐỀ XUẤT)

### 4.1 Navigation mới

```
├── Tổng quan (/)              ← HomePage (đã cắt bớt)
├── Imports (/imports)           ← ImportsPage
├── Analytics (/analytics)       ← AnalyticsPage (đã cắt bớt)
├── Bình luận (/comments)        ← CommentsPage (cắt chart)
└── Seeding Manager (/seeding)   ← GIỮ NGUYÊN
    ├── Chiến dịch
    ├── AI Planner
    ├── Profiles GPM
    └── Thư viện bình luận
```

### 4.2 AnalyticsPage sau cắt giảm

```
AnalyticsPage
├── Filters: Date range, Account filter
├── TimelineChart          ← Giữ
├── ReactionPieChart       ← Giữ
├── AiSummaryPanel         ← Giữ (nếu có AI)
└── PrintReportButton      ← Giữ
```

**XÓA:**
- ❌ InsightsPanel
- ❌ PerformanceScoreTable
- ❌ ActivityHeatmap
- ❌ TopCommentersChart
- ❌ SentimentChart
- ❌ KeywordFreqChart

### 4.3 HomePage sau cắt giảm

```
HomePage
├── StatsCards             ← Giữ
├── EngagementChart        ← Giữ
├── AccountsTable          ← Giữ
├── ImportZip              ← Giữ
└── (Có thể gộp TopProfiles + SentimentEfficiency vào StatsCards)
```

**CẢI THIỆN:**
- ⚠️ TopProfiles → Gộp vào StatsCards hoặc xóa
- ⚠️ SentimentEfficiency → Gộp vào StatsCards hoặc xóa

---

## 5. FILES CẦN XÓA (DANH SÁCH CHI TIẾT)

### 5.1 Components xóa hoàn toàn

```
src/components/InsightsPanel.tsx
src/components/PerformanceScoreTable.tsx
src/components/charts/ActivityHeatmap.tsx
src/components/charts/TopCommentersChart.tsx
src/components/charts/SentimentChart.tsx
src/components/charts/KeywordFreqChart.tsx (nếu chỉ dùng trong Analytics)
```

### 5.2 Hooks liên quan (kiểm tra trước khi xóa)

```
src/hooks/useInsights.ts           ← Chỉ dùng bởi InsightsPanel
src/hooks/usePerformanceScore.ts   ← Chỉ dùng bởi PerformanceScoreTable
```

### 5.3 Imports cần cập nhật

```
src/pages/AnalyticsPage.tsx        ← Xóa import các component đã xóa
src/pages/HomePage.tsx             ← Xóa import TopProfiles, SentimentEfficiency
src/pages/CommentsPage.tsx          ← Giữ KeywordFreqChart (có thể)
```

---

## 6. MỘT SỐ CHỨC NĂNG CẦN CẢI THIỆN THAY VÌ XÓA

### 6.1 Performance Score - Cải thiện thay vì xóa

**Vấn đề hiện tại:**
- Công thức tính không rõ ràng
- Grade A-F không có context

**Đề xuất:**
- Nếu giữ lại, cần document rõ công thức
- Hoặc thay thế bằng metrics đơn giản hơn (total comments, total reactions)

### 6.2 Auto Insights - Cải thiện

**Vấn đề hiện tại:**
- Chỉ hiển thị peak time, top author - không có action value

**Đề xuất:**
- Biến thành "Quick Stats" cards
- Hoặc tích hợp vào StatsCards

### 6.3 Activity Heatmap - Xóa

- Dữ liệu Facebook group không đủ dense cho heatmap
- Không có use case rõ ràng

---

## 7. KẾT LUẬN

### 7.1 Hành động khuyến nghị

| Ưu tiên | Hành động | Files |
|----------|-----------|-------|
| Cao | Xóa InsightsPanel, PerformanceScoreTable | 2 files |
| Cao | Xóa ActivityHeatmap, TopCommentersChart | 2 files |
| Cao | Xóa SentimentChart, KeywordFreqChart (Analytics) | 2 files |
| Trung bình | Cải thiện/gộp TopProfiles, SentimentEfficiency | 2 files |
| Thấp | Cập nhật imports trong pages | 2-3 files |

### 7.2 Tổng cộng

- **Xóa:** ~6 components
- **Cải thiện:** ~2-4 components
- **Giữ nguyên:** Phần lớn core functionality

### 7.3 Lợi ích

- Giảm code complexity
- Giảm bundle size
- UI đơn giản hơn, dễ maintain
- Tập trung vào core features

---

## 8. PROMPT CHO CODEX

Nếu muốn tôi thực hiện cắt giảm:

```
Thực hiện các thay đổi sau trong project:

1. XÓA files:
   - src/components/InsightsPanel.tsx
   - src/components/PerformanceScoreTable.tsx  
   - src/components/charts/ActivityHeatmap.tsx
   - src/components/charts/TopCommentersChart.tsx
   - src/components/charts/SentimentChart.tsx

2. CẬP NHẬT imports trong:
   - src/pages/AnalyticsPage.tsx (xóa các import đã xóa)
   - src/pages/HomePage.tsx (xóa TopProfiles, SentimentEfficiency nếu cần)

3. Cập nhật type exports nếu có

4. Kiểm tra không có import broken sau khi xóa
```

Bạn muốn tôi thực hiện việc cắt giảm này không?
