# FB Pulse Tracker - Use Case Diagram (Implementation-Based)

## Actors Discovered

| Actor | Role ID | Description |
|-------|---------|-------------|
| **Admin** | 1 | Full system access - all CRUD operations, user management, data deletion |
| **Nhân viên Marketing** | 0 | Read-only access - view data, export, use seeding tools |

---

## Use Cases Discovered

### 1. Authentication (All Users)

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC01 | Đăng nhập | Login with email/password via Firebase Auth | All |
| UC02 | Đăng xuất | Logout and clear session | All |
| UC03 | Xác thực quyền truy cập | Check whitelist membership in Firestore | System |

### 2. Dashboard & Overview

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC04 | Xem Dashboard | View main dashboard with stats overview | All |
| UC05 | Xem thống kê tổng quan | View stats cards (comments, imports, efficiency) | All |
| UC06 | Lọc dữ liệu theo thời gian | Filter data by date range (Today, 7 days, 30 days...) | All |
| UC07 | Lọc dữ liệu theo tài khoản | Filter data by Facebook account | All |
| UC08 | Xem biểu đồ tương tác | View engagement chart (comments, likes trends) | All |

### 3. Import Management

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC09 | Nhập dữ liệu Facebook ZIP | Upload and process Facebook data ZIP export | Admin only |
| UC10 | Xem danh sách nhập liệu | View all imported data records | All |
| UC11 | Xóa nhập liệu | Delete individual import record | Admin only |
| UC12 | Xóa tất cả nhập liệu | Delete all import data | Admin only |

### 4. Comment Management

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC13 | Xem bình luận | Browse comments with pagination | All |
| UC14 | Tìm kiếm bình luận | Full-text search in comment content | All |
| UC15 | Lọc bình luận | Filter by author, account, group, date | All |
| UC16 | Xem chi tiết bình luận | View detailed comment with reactions | All |

### 5. Analytics

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC17 | Xem phân tích | View analytics dashboard | All |
| UC18 | Xem biểu đồ xu hướng | View timeline chart (day/week/month) | All |
| UC19 | Phân tích cảm xúc | AI sentiment analysis (positive/neutral/negative) | All |

### 6. Export

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC20 | Xuất CSV | Export data to CSV format | All |
| UC21 | Xuất JSON | Export data to JSON format | All |
| UC22 | Xuất Excel | Export data to XLSX format | All |
| UC23 | In báo cáo | Print/export report | All |

### 7. Seeding Management

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC24 | Xem Dashboard Seeding | View seeding stats and charts | All |
| UC25 | Xem danh sách bài viết | Browse seeding posts with filters | All |
| UC26 | Tạo chiến dịch Seeding | Create new seeding campaign with AI | All |
| UC27 | Tạo 4 bài viết hàng ngày | Generate 4 daily campaigns automatically | All |
| UC28 | Quản lý nhóm Facebook | Add/edit/delete Facebook groups | All |
| UC29 | Xem lịch sử bài viết | View posts by date history | All |
| UC30 | Sử dụng công cụ Redirect | Use redirect content tool | All |
| UC31 | Tạo nội dung Redirect | AI-generate redirect comments | All |
| UC32 | Xóa bài viết Seeding | Delete/Archive seeding post | All |

### 8. Admin Management

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC33 | Xem danh sách người dùng | View all whitelist accounts | Admin only |
| UC34 | Tạo tài khoản người dùng | Create new user (Firebase Auth + whitelist) | Admin only |
| UC35 | Sửa tài khoản người dùng | Edit user email, display name | Admin only |
| UC36 | Xóa tài khoản người dùng | Remove user from whitelist | Admin only |
| UC37 | Thay đổi vai trò người dùng | Change role (Viewer ↔ Admin) | Admin only |

### 9. Settings

| ID | Use Case | Description | Access |
|----|----------|-------------|--------|
| UC38 | Thay đổi giao diện | Toggle light/dark theme | All |
| UC39 | Xem thông tin cá nhân | View own profile (email, role) | All |

---

## Relationships

### Include Relationship

| Base Use Case | Included Use Case | Reason |
|---------------|-------------------|--------|
| UC01. Đăng nhập | UC03. Xác thực quyền truy cập | Login **always** requires whitelist verification before granting access |

### Extend Relationship

| Base Use Case | Extended Use Case | Reason |
|---------------|-------------------|--------|
| UC31. Tạo nội dung Redirect | AI Generation | AI generation is an **optional enhancement** to the redirect workflow |

### Generalization

| Parent Actor | Child Actor | Reason |
|--------------|-------------|--------|
| Viewer | Admin | Admin **inherits** all Viewer permissions plus additional admin features |

---

## Permission Matrix

| Feature | Viewer | Admin |
|---------|--------|-------|
| View Dashboard | ✓ | ✓ |
| View Imports | ✓ | ✓ |
| Create Import | ✗ | ✓ |
| Delete Import | ✗ | ✓ |
| Delete All Imports | ✗ | ✓ |
| Search/Filter Comments | ✓ | ✓ |
| Export Data | ✓ | ✓ |
| View Analytics | ✓ | ✓ |
| Seeding Management | ✓ | ✓ |
| View Admin Page | ✗ | ✓ |
| Manage Users | ✗ | ✓ |
| Theme Settings | ✓ | ✓ |

---

## Mermaid Diagram

```mermaid
graph TB
    subgraph "Actors"
        Admin["Admin (role=1)"]
        Viewer["Nhân viên Marketing (role=0)"]
    end

    subgraph "Authentication"
        UC01["UC01. Đăng nhập"]
        UC02["UC02. Đăng xuất"]
        UC03["UC03. Xác thực quyền truy cập"]
    end

    subgraph "Dashboard"
        UC04["UC04. Xem Dashboard"]
        UC05["UC05. Xem thống kê"]
        UC06["UC06. Lọc theo thời gian"]
        UC07["UC07. Lọc theo tài khoản"]
        UC08["UC08. Biểu đồ tương tác"]
    end

    subgraph "Import Management"
        UC09["UC09. Nhập dữ liệu ZIP"]
        UC10["UC10. Xem danh sách"]
        UC11["UC11. Xóa nhập liệu"]
        UC12["UC12. Xóa tất cả"]
    end

    subgraph "Comment Management"
        UC13["UC13. Xem bình luận"]
        UC14["UC14. Tìm kiếm"]
        UC15["UC15. Lọc bình luận"]
        UC16["UC16. Chi tiết bình luận"]
    end

    subgraph "Analytics"
        UC17["UC17. Xem phân tích"]
        UC18["UC18. Biểu đồ xu hướng"]
        UC19["UC19. Phân tích cảm xúc"]
    end

    subgraph "Export"
        UC20["UC20. Xuất CSV"]
        UC21["UC21. Xuất JSON"]
        UC22["UC22. Xuất Excel"]
        UC23["UC23. In báo cáo"]
    end

    subgraph "Seeding Management"
        UC24["UC24. Dashboard Seeding"]
        UC25["UC25. Danh sách bài viết"]
        UC26["UC26. Tạo chiến dịch"]
        UC27["UC27. Tạo 4 bài hàng ngày"]
        UC28["UC28. Quản lý nhóm"]
        UC29["UC29. Lịch sử bài viết"]
        UC30["UC30. Công cụ Redirect"]
        UC31["UC31. Tạo nội dung Redirect"]
        UC32["UC32. Xóa bài viết"]
    end

    subgraph "Admin Management"
        UC33["UC33. Xem danh sách users"]
        UC34["UC34. Tạo tài khoản"]
        UC35["UC35. Sửa tài khoản"]
        UC36["UC36. Xóa tài khoản"]
        UC37["UC37. Thay đổi vai trò"]
    end

    subgraph "Settings"
        UC38["UC38. Thay đổi giao diện"]
        UC39["UC39. Xem thông tin cá nhân"]
    end

    %% Admin -> All
    Admin --> UC01
    Admin --> UC02
    Admin --> UC04
    Admin --> UC05
    Admin --> UC06
    Admin --> UC07
    Admin --> UC08
    Admin --> UC09
    Admin --> UC10
    Admin --> UC11
    Admin --> UC12
    Admin --> UC13
    Admin --> UC14
    Admin --> UC15
    Admin --> UC16
    Admin --> UC17
    Admin --> UC18
    Admin --> UC19
    Admin --> UC20
    Admin --> UC21
    Admin --> UC22
    Admin --> UC23
    Admin --> UC24
    Admin --> UC25
    Admin --> UC26
    Admin --> UC27
    Admin --> UC28
    Admin --> UC29
    Admin --> UC30
    Admin --> UC31
    Admin --> UC32
    Admin --> UC33
    Admin --> UC34
    Admin --> UC35
    Admin --> UC36
    Admin --> UC37
    Admin --> UC38
    Admin --> UC39

    %% Viewer -> Shared Use Cases
    Viewer --> UC01
    Viewer --> UC02
    Viewer --> UC04
    Viewer --> UC05
    Viewer --> UC06
    Viewer --> UC07
    Viewer --> UC08
    Viewer --> UC10
    Viewer --> UC13
    Viewer --> UC14
    Viewer --> UC15
    Viewer --> UC16
    Viewer --> UC17
    Viewer --> UC18
    Viewer --> UC19
    Viewer --> UC20
    Viewer --> UC21
    Viewer --> UC22
    Viewer --> UC23
    Viewer --> UC24
    Viewer --> UC25
    Viewer --> UC26
    Viewer --> UC27
    Viewer --> UC28
    Viewer --> UC29
    Viewer --> UC30
    Viewer --> UC31
    Viewer --> UC32
    Viewer --> UC38
    Viewer --> UC39

    %% Include Relationship
    UC01 ..> UC03 : <<include>>

    %% Generalization
    Admin -.->|<<extends>>| Viewer

    %% Styling
    classDef actor fill:#000,stroke:#000,color:#fff
    classDef usecase fill:#fff,stroke:#000
    classDef include stroke:#000,stroke-width:2px
    classDef admin_only fill:#fff,stroke:#000,stroke-dasharray:5

    class Admin,Viewer actor
```

---

## System Boundary Summary

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         FB PULSE TRACKER                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─ Authentication ─────────────────────────────────────────────────────┐   │
│  │  UC01. Đăng nhập ──include──► UC03. Xác thực quyền truy cập       │   │
│  │  UC02. Đăng xuất                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Dashboard & Overview ─────────────────────────────────────────────┐   │
│  │  UC04. Xem Dashboard │ UC05. Thống kê │ UC06-07. Lọc dữ liệu     │   │
│  │  UC08. Biểu đồ tương tác                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Import Management ─────────────────────────────────────────────────┐   │
│  │  UC09. Nhập ZIP* │ UC10. Xem danh sách │ UC11. Xóa* │ UC12. Xóa tất*│   │
│  │  (* = Admin only)                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Comment Management ────────────────────────────────────────────────┐   │
│  │  UC13. Xem │ UC14. Tìm kiếm │ UC15. Lọc │ UC16. Chi tiết          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Analytics & Export ─────────────────────────────────────────────────┐   │
│  │  UC17. Phân tích │ UC18. Timeline │ UC19. Cảm xúc                 │   │
│  │  UC20-22. Export (CSV/JSON/XLSX) │ UC23. In báo cáo               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Seeding Management ────────────────────────────────────────────────┐   │
│  │  UC24-25. Dashboard & Danh sách │ UC26-27. Tạo chiến dịch          │   │
│  │  UC28. Quản lý nhóm │ UC29. Lịch sử │ UC30-31. Công cụ Redirect   │   │
│  │  UC32. Xóa bài viết                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Admin Management (Admin only) ─────────────────────────────────────┐   │
│  │  UC33-37. CRUD Users: Xem │ Tạo │ Sửa │ Xóa │ Đổi vai trò        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Settings ──────────────────────────────────────────────────────────┐   │
│  │  UC38. Thay đổi giao diện │ UC39. Thông tin cá nhân                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

Actors (outside boundary):
┌──────────────────┐
│      Admin       │
│   (role = 1)     │
└────────┬─────────┘
         │ <<extends>>
         ▼
┌──────────────────┐
│ Nhân viên       │
│ Marketing        │
│   (role = 0)     │
└──────────────────┘
```
