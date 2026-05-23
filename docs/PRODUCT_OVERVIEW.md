# PRODUCT OVERVIEW — Tài liệu Nghiệp vụ & Tính năng

> Tài liệu này mô tả **bối cảnh, người dùng, và các module nghiệp vụ** của WorkFlow Portal. Không nói về quy chuẩn code (xem [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)) hay schema DB (xem [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)).

## Mục lục

1. [Business Context](#1-business-context-bối-cảnh)
2. [User Roles & Phân quyền](#2-user-roles--ma-trận-phân-quyền)
3. [Core Modules](#3-core-modules-các-phân-hệ-chính)
   - 3.1 [⭐ Hồ sơ vật lý (Sổ giao nhận điện tử)](#31--module-hồ-sơ--luân-chuyển--truy-vết-hồ-sơ-vật-lý)
   - 3.2 [Dashboard chính (Home)](#32-module-dashboard-chính-home)
   - 3.3 [Công việc (Tasks)](#33-module-công-việc-tasks)
   - 3.4 [Lịch trình (Schedule)](#34-module-lịch-trình-schedule)
   - 3.5 [Cán bộ (Team)](#35-module-cán-bộ-team)
   - 3.6 [Cá nhân (Profile)](#36-module-cá-nhân-profile)
   - 3.7 [Admin](#37-module-admin)
   - 3.8 [Settings](#38-module-settings)
4. [Auth Flow (Đăng ký → Đăng nhập → Vào dashboard)](#4-auth-flow)
5. [Tính năng xuyên suốt (Cross-cutting)](#5-tính-năng-xuyên-suốt)
6. [Cronjobs & Background jobs](#6-cronjobs--background-jobs)
7. [Roadmap quan sát được trong code](#7-roadmap-quan-sát-được-trong-code)

---

## 1. Business Context (Bối cảnh)

### 1.1 Vấn đề thực tế ở chi nhánh

Chi nhánh ngân hàng đã có **Core Banking** quản lý đầy đủ giao dịch, tài khoản, sổ sách kế toán. Nhưng **vận hành nội bộ hằng ngày** vẫn vướng những "vùng xám" mà Core Banking không chạm tới:

| Pain point | Hiện trạng nếu không có app | Hậu quả |
|------------|----------------------------|---------|
| **Hồ sơ giấy thất lạc** | Một bộ hồ sơ tín dụng đi qua RM → KSV → Trưởng phòng → PGĐ → GĐ → Quỹ. Mỗi chặng có thể nằm trên bàn ai đó 1–3 ngày, **không có log**. | Khi mất, không truy được "đứt mạch" ở đâu. Bị nhắc khách hàng, đẩy trễ tiến độ giải ngân. Có khi mất luôn. |
| **Phòng họp / xe bị "đặt chồng"** | Thư ký không có công cụ điều phối, nhân viên gọi điện đặt chỗ thủ công. | Trùng giờ → cãi nhau → lãnh đạo chờ phòng. |
| **Công việc giao miệng** | Lãnh đạo giao task qua Zalo/họp giao ban, không có nơi tổng hợp deadline. | Quên việc, không theo dõi được SLA, không có dữ liệu đánh giá nhân viên. |
| **Đơn nghỉ phép viết tay** | Trưởng phòng duyệt rồi nhét vào file Excel. | Ban Giám đốc không biết hôm nay phòng nào nghỉ ai. Không tổng hợp được ngày phép. |
| **Danh bạ rời rạc** | Số máy, ảnh, sinh nhật của cán bộ nằm rải rác trong sổ tay/Outlook/group Zalo. | Tân binh mất 1 tháng mới quen được tên các phòng. Quên chúc sinh nhật. |
| **Lái xe không có lịch chạy rõ ràng** | Gọi điện cho thư ký nhận chuyến, ghi tay sổ tay. | Không có lịch sử Km, xăng xe, chuyến đi. |

### 1.2 Triết lý sản phẩm

- **PWA-first**: cán bộ chi nhánh phần lớn dùng điện thoại. App phải cài được như native (iOS/Android), có push notification, chạy được offline-tolerant cho các tác vụ đọc.
- **"Single source of truth" cho vận hành nội bộ**: 1 app duy nhất thay 5–7 group Zalo + 3–4 file Excel chia sẻ qua mail.
- **Truy vết > Tự động hoá**: ưu tiên log đầy đủ "ai làm gì lúc nào" để khi có sự cố lãnh đạo có dữ liệu xử lý — chứ không cố thay thế hoàn toàn quy trình con người.
- **Tôn trọng cấu trúc tổ chức**: phân quyền chi tiết theo Phòng + Role + cờ `is_department_head`, không "ai cũng thấy tất cả".

### 1.3 Mục tiêu chính của bản hiện tại

> **Module trọng tâm — chiếm phần lớn effort của dự án — là LUÂN CHUYỂN & TRUY VẾT HỒ SƠ VẬT LÝ** (`/dashboard/handover`).
> Các module khác (Tasks, Schedule, Team, Admin) là **phụ trợ** để vận hành chi nhánh khép kín trong 1 ứng dụng.

---

## 2. User Roles — Ma trận phân quyền

Hệ thống có **7 role** khai báo ở enum `user_role` (Postgres) + type `UserRole` (TypeScript trong [`src/types/profile.ts`](src/types/profile.ts)).

> ⚠️ **KHÔNG có role "RM" hay "Kiểm soát viên" riêng**. RM, GDV, KSV, Pháp chế, IT, Kho quỹ… đều thuộc role `staff`, phân biệt nhau qua `department_id` + `title` + `is_department_head`.

### 2.1 Bảng 7 role

| Role enum | Vai trò thực tế | Tóm tắt quyền |
|-----------|----------------|---------------|
| `admin` | Quản trị viên (IT) | Toàn quyền: duyệt account_requests, CRUD `document_categories` (kèm SLA), quản lý phòng họp/xe, reset password, set `is_active`, xem mọi hồ sơ/task/lịch. |
| `director` | Giám đốc / Phó Giám đốc | Xem **toàn bộ hồ sơ** chi nhánh (read-only truy vết), xem mọi task, duyệt đơn nghỉ phép của cấp Trưởng phòng / lãnh đạo cùng cấp. Lịch trình của BGĐ public toàn chi nhánh. |
| `manager` | Trưởng phòng / Phó phòng | Xem & update task của phòng. Duyệt đơn nghỉ phép nhân viên cùng phòng (chỉ khi `is_department_head = true` HOẶC creator không phải lãnh đạo cùng cấp). Nếu thuộc phòng **Tổ chức Tổng hợp** (code `13602`) → có quyền điều phối phòng họp/xe như `secretary`. |
| `staff` | Nhân viên (RM, GDV, KSV, Kho quỹ, Pháp chế, IT, TCTH…) | Tạo & luân chuyển hồ sơ vật lý, xem task được giao hoặc do mình tạo, đăng ký lịch họp/đặt xe, tạo đơn nghỉ phép. Phân biệt nhau qua `department_id`. |
| `secretary` | Thư ký Ban Giám đốc | Điều phối phòng họp + xe ô tô (CRUD `rooms`, `vehicles`, duyệt/sửa `schedules` toàn chi nhánh, gán tài xế). |
| `hr_officer` | Cán bộ Nhân sự | Workspace riêng (`HRDashboardView`), **read-only** đơn nghỉ phép toàn chi nhánh, xem danh bạ, xem mọi profile (tổng hợp data nhân sự). |
| `driver` | Lái xe | Workspace riêng (`DriverDashboard`) chỉ xem chuyến đi được giao. **Bị chặn** khỏi module Hồ sơ vật lý, Công việc, Cán bộ. Có `start_km`/`end_km` workflow cho mỗi chuyến. |

### 2.2 Bảng 2 flag bổ sung trên `profiles`

| Flag | Kiểu | Tác dụng |
|------|------|----------|
| `is_active` | boolean | Middleware đọc cờ này. Nếu `false` → `signOut` ngay + redirect `/login?pending=1` (chờ admin duyệt). |
| `is_department_head` | boolean | Phân biệt "Trưởng phòng chính thức" với "Phó phòng" trong luồng duyệt nghỉ phép. |
| `must_change_password` | boolean | Khi admin reset password → set `true`. Hiển thị `MustChangePasswordBanner` ép user đổi mật khẩu ở `/dashboard/profile#change-password`. |

### 2.3 Ma trận "ai làm được gì" (rút từ permissions + RLS + navigation `hideFor`)

| Hành động | admin | director | manager | staff | secretary | hr_officer | driver |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Xem sidebar **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Xem sidebar **Công việc** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Xem sidebar **Lịch trình** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (workspace lái xe) |
| Xem sidebar **Hồ sơ** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Xem sidebar **Cán bộ** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Tạo hồ sơ vật lý | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Tab "Toàn chi nhánh" (xem mọi hồ sơ) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CRUD `document_categories` (nhóm hồ sơ + SLA) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CRUD `rooms` + `vehicles` | ✅ | ❌ | ✅ (chỉ TCTH) | ❌ | ✅ | ❌ | ❌ |
| Duyệt đơn nghỉ phép | ✅ | ✅ (cấp manager↑) | ✅ (cùng phòng, có điều kiện) | ❌ | ❌ | ❌ (chỉ read) | ❌ |
| Gán tài xế cho chuyến | ✅ | ❌ | ✅ (chỉ TCTH) | ❌ | ✅ | ❌ | ❌ |
| Duyệt `account_requests` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gửi `recognitions` (vinh danh) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> Helper chính thức: [`src/lib/permissions.ts`](src/lib/permissions.ts). Mọi check role/department phải đi qua helper, **cấm inline `profile.role === 'admin'` trong component** (xem `ARCHITECTURE.md §6.4`).

### 2.4 Phòng ban (`departments`)

Seed mặc định trong `schema.sql`:

| Code | Tên | Đặc biệt |
|------|-----|----------|
| — | Tín dụng | RM tạo hồ sơ tín dụng (loại hồ sơ phổ biến nhất) |
| — | Giao dịch viên | |
| — | Kho quỹ | Là chặng cuối trong nhiều luồng hồ sơ |
| — | Pháp chế | |
| — | Công nghệ thông tin | Admin thường thuộc phòng này |
| `13602` | **Tổ chức Tổng hợp (TCTH)** | ⭐ Phòng đặc biệt. Manager TCTH có quyền điều phối phòng họp/xe ngang `secretary` (helper `isTcthDepartment`). |

---

## 3. Core Modules (Các phân hệ chính)

Sidebar (`src/components/layout/dashboard-layout.tsx`) hiện có **5 entry chính**: Dashboard, Công việc, Lịch trình, Hồ sơ, Cán bộ — kèm flag `hideFor` ẩn theo role. Ngoài ra có 3 module phụ truy cập qua menu dropdown / direct URL: Profile, Admin, Settings.

---

### 3.1 ⭐ Module Hồ sơ — Luân chuyển & Truy vết Hồ sơ Vật lý

> **Module trọng tâm của dự án — được xây kỹ nhất, là mẫu chuẩn về RLS + RPC + Realtime + JSONB clean architecture.**
> URL: `/dashboard/handover` · Migration: [`supabase/migration_handover_module.sql`](supabase/migration_handover_module.sql) · Code: [`src/app/dashboard/handover/`](src/app/dashboard/handover/)

#### 3.1.1 Mô hình "Sổ giao nhận điện tử"

Mỗi bộ hồ sơ giấy được "khai sinh" trên app, **sinh mã ngắn `HS-YYYYMMDD-NNN` viết tay lên bìa**, sau đó chạy theo đời thật qua các bàn. Mỗi lần đổi chủ (chuyển/nhận) được log thành 1 row trong `document_handovers` để vẽ timeline truy vết realtime cho Ban Giám đốc.

#### 3.1.2 Luồng nghiệp vụ end-to-end (6 bước)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 1 — RM (staff) khởi tạo hồ sơ trên app                           │
│  • Tab "Đang giữ" → nút "Tạo hồ sơ" (CreateDocumentDialog)             │
│  • Nhập: Tiêu đề, Khách hàng, chọn Nhóm hồ sơ (kèm SLA giờ)            │
│  • Đính ảnh tối đa 10 ảnh, đã nén client (≤1MB, ≤1920px)               │
│  • Submit → INSERT vào documents (creator_id = mình)                   │
│  • Trigger `generate_document_short_code()` sinh `HS-YYYYMMDD-NNN`     │
│  • Trạng thái khởi đầu: DRAFT, current_assignee_id = NULL              │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 2 — RM ghi tay mã `HS-...` lên bìa hồ sơ giấy                    │
│  • Đây là bước OFFLINE — ý nghĩa: 1 mã trên app ↔ 1 bìa thực           │
│  • Mã ngắn (12 ký tự), có ngày, dễ đọc lại trên kệ                     │
│  • Khi tìm thấy hồ sơ vô chủ → tra mã trong app ra ngay người tạo      │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 3 — RM bấm "Chuyển" trên app                                     │
│  • TransferDialog → chọn người nhận (ví dụ Kiểm soát viên)             │
│  • Ghi note (tuỳ chọn — "Hồ sơ vay tiêu dùng KH XYZ, vui lòng KS")     │
│  • Gọi RPC `transfer_document(p_document_id, p_receiver_id, p_note)`   │
│  • RPC SECURITY DEFINER:                                               │
│      - INSERT document_handovers (status = PENDING)                    │
│      - UPDATE documents.status = PENDING_RECEIPT                       │
│      - INSERT notifications cho người nhận                             │
│      - (KHÔNG đổi current_assignee_id ngay — pattern transit state)    │
│  • Webhook DB → edge function push-notification → gửi PWA push        │
│  • Sender mất ngay nút "Chuyển tiếp" (chống 2 người cùng giữ hồ sơ)   │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 4 — Người nhận (KSV/TP/PGĐ) cầm bìa hồ sơ, mở app                │
│  • Tab "Đang giữ" → thấy hồ sơ ở Inbox (incoming PENDING)              │
│  • Mở DocumentDetailDialog → đọc note, xem ảnh đính kèm                │
│  • 2 lựa chọn:                                                         │
│    ├─ "Đã nhận" → RPC `acknowledge_document(p_handover_id)`            │
│    │   • UPDATE handover.status = ACCEPTED, received_at = NOW()        │
│    │   • UPDATE documents.current_assignee_id = receiver               │
│    │   • UPDATE documents.status = IN_REVIEW                           │
│    │   • Notification cho sender ("Đã nhận")                           │
│    │   → Hồ sơ chính thức "trên bàn" người nhận, SLA bắt đầu chạy      │
│    │                                                                    │
│    └─ "Trả về" + lý do → RPC `reject_document(p_handover_id, p_reason)`│
│        • UPDATE handover.status = REJECTED, note = reason              │
│        • UPDATE documents.current_assignee_id = sender (revert)        │
│        • UPDATE documents.status = RETURNED                            │
│        • Notification cho sender ("Bị trả về với lý do: …")            │
│        → Sender phải bổ sung & chuyển lại                              │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 5 — Người đang giữ tiếp tục "Chuyển" cho người tiếp theo         │
│  • Lặp lại Bước 3-4 qua các bàn (KSV → TP → PGĐ → GĐ → Quỹ)            │
│  • Mỗi chặng tạo thêm 1 row document_handovers                         │
│  • Tab "Đã chuyển" của sender hiển thị outgoing PENDING                 │
│  • Component HandoverTimeline.tsx render dọc đầy đủ chặng              │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 6 — Người cuối cùng đóng luồng                                   │
│  • Khi hồ sơ đã hoàn tất nghiệp vụ (hạch toán xong / cất kho quỹ)      │
│  • DocumentDetailDialog → nút "Hoàn thành"                             │
│  • RPC `complete_document(p_document_id)`                              │
│    • Check: chỉ current_assignee mới được đóng                         │
│    • UPDATE status = COMPLETED, completed_at = NOW()                   │
│    • Notification cho creator                                          │
│  • Hồ sơ vẫn còn metadata + timeline cho truy vết                      │
│  • Ảnh đính kèm tự xoá sau 30 ngày qua edge function cleanup           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.1.3 Trạng thái hồ sơ (`documents.status`)

| Status | Ý nghĩa | Hành động cho phép |
|--------|---------|--------------------|
| `DRAFT` | Vừa tạo, chưa chuyển lần nào | Creator: Chuyển / Sửa ảnh / Xoá |
| `PENDING_RECEIPT` | ⭐ **Transit state** — đã chuyển, chờ người nhận xác nhận | Sender: **MẤT** quyền chuyển tiếp (chờ). Receiver: Nhận hoặc Trả về |
| `IN_REVIEW` | Người nhận đã xác nhận, đang xử lý trên bàn họ | Current assignee: Chuyển tiếp / Hoàn thành / Sửa ảnh |
| `RETURNED` | Bị từ chối, trả về sender | Sender: Sửa ảnh, chuyển lại |
| `COMPLETED` | Đã đóng luồng | Read-only. Ảnh sẽ bị cleanup sau 30 ngày |

> Pattern `PENDING_RECEIPT` là **transit state** — quan trọng để tránh 2 người cùng giữ 1 hồ sơ. Xem chi tiết `ARCHITECTURE.md §6.8`.

#### 3.1.4 SLA — "thời gian giữ hồ sơ trên bàn"

Mỗi nhóm hồ sơ (`document_categories`) có cấu hình `sla_hours`:

| Nhóm hồ sơ (seed) | SLA mặc định |
|-------------------|--------------|
| Hồ sơ tín dụng | 24h |
| Hồ sơ kế toán | 8h |
| Hồ sơ tổng hợp | 48h |
| Hồ sơ nhân sự | 24h |

Logic SLA ([`_lib/sla.ts`](src/app/dashboard/handover/_lib/sla.ts)):
- **Reset mỗi lần đổi bàn**: khi người mới `acknowledge_document`, đồng hồ SLA của họ chạy lại từ 0.
- 3 mức màu badge: `safe` (<70%), `warn` (70–100% — amber), `danger` (≥100% — đỏ pulse).
- Áp dụng cho status `IN_REVIEW` và `PENDING_RECEIPT`. `COMPLETED` / `RETURNED` / `DRAFT` không tính.

#### 3.1.5 UI chính (xem `_components/`)

| Component | Vai trò |
|-----------|---------|
| `page.tsx` | 3 tab: **Đang giữ** / **Đã chuyển** / **Toàn chi nhánh** (chỉ admin+director) |
| `MyDeskInbox.tsx` | List hồ sơ tôi đang giữ + incoming PENDING (chờ tôi nhận) |
| `MyDeskOutbox.tsx` | List hồ sơ tôi đã chuyển (outgoing PENDING / ACCEPTED) |
| `AllDocumentsTab.tsx` | View truy vết toàn chi nhánh (chỉ BGĐ + admin) |
| `DocumentCard.tsx` | Card hồ sơ với badge status + SLA + người đang giữ |
| `CreateDocumentDialog.tsx` | Form tạo mới (title, customer, category, ảnh) |
| `DocumentDetailDialog.tsx` | Modal chi tiết — timeline + nút Chuyển/Nhận/Trả về/Hoàn thành |
| `HandoverTimeline.tsx` | Render dọc các chặng handover với dấu thời gian |
| `TransferDialog.tsx` | Chọn receiver + note để chuyển |
| `ReturnReasonDialog.tsx` | Nhập lý do trả về |
| `CategoryManagerDialog.tsx` | **Chỉ admin** — CRUD nhóm hồ sơ + SLA + màu badge |
| `ImageUploader.tsx` | Upload nén client tối đa 10 ảnh, drag-drop |
| `ImageLightbox.tsx` | Xem ảnh fullscreen có zoom |
| `SLABadge.tsx` | Badge SLA: safe/warn/danger với thời gian còn lại |

#### 3.1.6 Notification trigger

Mỗi RPC handover tự INSERT vào bảng `notifications`. Webhook DB → edge function `push-notification` → push PWA tới mọi device đã subscribe của user:

| Sự kiện | Người nhận thông báo | Title |
|---------|---------------------|-------|
| Chuyển hồ sơ | Receiver | "Có hồ sơ mới chờ nhận" |
| Receiver bấm "Đã nhận" | Sender | "Hồ sơ đã được nhận" |
| Receiver bấm "Trả về" | Sender | "Hồ sơ bị trả về" |
| Người cuối "Hoàn thành" | Creator (nếu khác current assignee) | "Hồ sơ đã hoàn thành" |

---

### 3.2 Module Dashboard chính (Home)

> URL: `/dashboard` · Code: [`src/app/dashboard/page.tsx`](src/app/dashboard/page.tsx) + [`_components/`](src/app/dashboard/_components/)

Trang đích sau login. **Hiển thị view khác nhau theo role**:

| Role | View |
|------|------|
| `driver` | `DriverDashboardView` — list chuyến đi sắp tới + lịch sử Km |
| `hr_officer` | `HRDashboardView` — tổng quan nhân sự, danh sách đơn nghỉ phép pending |
| `manager` TCTH | `TCTHDashboardView` — bảng điều phối tài nguyên |
| Còn lại | `QuickStats` + `TaskOverview` + Timeline lịch hôm nay |

**Block hiển thị mặc định** (cho staff/manager/admin/director thông thường):

- **QuickStats** — 3 thẻ KPI cá nhân:
  - "Năng suất tuần" (productivity, có TrendingUp/Down so với tuần trước).
  - "Đang xử lý" — số task active + số task khẩn.
  - "Nhiệm vụ" — `completed/assigned` + số quá hạn.
- **Câu trích dẫn động lực** — random từ array 7 câu (`INSPIRATIONAL_QUOTES`).
- **Timeline lịch hôm nay** — block giờ 8h–17h với marker hiện tại.
- **Hồ sơ chờ xử lý** — preview các hồ sơ đang trên bàn / đang chờ nhận.
- **Task gần đây** — recent tasks + comment activity.

**Realtime**: subscribe channel `dashboard_sync` lắng nghe insert/update trên 9 bảng (tasks, recognitions, task_comments, schedules, schedule_participants, vehicles, rooms, documents, document_handovers). Debounce 600ms.

---

### 3.3 Module Công việc (Tasks)

> URL: `/dashboard/tasks` · Detail: `/dashboard/tasks/[id]` · Create: `/dashboard/tasks/new` · Code: [`src/app/dashboard/tasks/`](src/app/dashboard/tasks/)

#### 3.3.1 Hai loại bản ghi

Cùng bảng `tasks` nhưng phân biệt qua `task_type`:

| `task_type` | Tên hiển thị | Đặc trưng | Folder |
|-------------|--------------|-----------|--------|
| `'task'` | **Công việc** | Có deadline, assignee, status `todo`/`doing`/`done`/`late`/`closed` | `_components/todos/` (NewTodoForm, TodoList, TodoDetail) |
| `'report'` | **Báo cáo** | Có chỉ tiêu định lượng (`target_value`, `current_value`, `unit`, `progress` %) — dùng để theo dõi KPI nội bộ phòng | `_components/reports/` (NewReportForm, ReportList, ReportDetail) |

#### 3.3.2 Tính năng đặc trưng

- **Multi-assignee qua `metadata.assigned_line`** — mảng UUID profile dạng "dây chuyền". RLS đọc trực tiếp:
  ```sql
  OR (metadata->>'assigned_line' IS NOT NULL
      AND auth.uid()::text = ANY(...))
  ```
  → mọi người trong line nhìn thấy task chung mà không cần bảng N-N riêng.
- **Comment** — bảng `task_comments`, public read, mỗi user post được comment riêng.
- **Auto-archive**: cron daily 8:00 ICT gọi RPC `auto_archive_and_cleanup()`:
  - Task `done`/`closed` quá 60 ngày → `is_archived = true`.
  - Notifications quá 30 ngày → DELETE.
- **Báo task quá hạn**: cron quét `due_date < now AND status NOT IN ('done', 'closed', 'late')` → insert notifications "Task quá hạn".

#### 3.3.3 Phân quyền tầm nhìn

- `admin`/`director`: thấy mọi task.
- `manager`: thấy task của phòng (`department_id`).
- `staff`: thấy task được giao (`assignee_id`) + tạo (`created_by`) + có trong `metadata.assigned_line`.
- Sidebar ẩn module này với `driver` / `secretary` / `hr_officer`.

---

### 3.4 Module Lịch trình (Schedule)

> URL: `/dashboard/schedule` · Code: [`src/app/dashboard/schedule/`](src/app/dashboard/schedule/) — **module chuẩn mẫu** theo `ARCHITECTURE.md §2.4`.

#### 3.4.1 "4-in-1" — Bảng `schedules` lưu cả

| `type` | Mục đích | Resource liên quan |
|--------|----------|--------------------|
| `meeting` | Họp nội bộ | `room_id` (phòng họp) |
| `trip` | Công tác / đi địa bàn | `vehicle_id` + `driver_id` + `requested_vehicle_type` |
| `leave` | Đơn nghỉ phép | Có luồng duyệt riêng (`LeaveApprovalDashboard`) |
| `event` | Sự kiện chung chi nhánh | — |

#### 3.4.2 Views chính

`page.tsx` hiển thị **adaptive theo role**:

- **Driver** → `DriverDashboard` (workspace lái xe — xem 3.4.4).
- **Còn lại** → `CalendarView` với:
  - **`DateNavigator`** — chọn ngày, hiển thị 7 ngày nổi bật ngày được chọn.
  - **3 phạm vi filter**: "Toàn chi nhánh" / "BGĐ" / "Phòng của tôi".
  - **Sub-dashboard nhúng**:
    - `ResourcesManagerDashboard` (chỉ TCTH/secretary/admin) — bảng điều phối phòng họp + xe.
    - `LeaveApprovalDashboard` (chỉ user có quyền `canApproveLeave`) — list đơn pending + duyệt 1 click.
    - `DirectorTimeline` — timeline ngày dành cho BGĐ.

#### 3.4.3 Luồng duyệt nghỉ phép

```
Nhân viên (staff/manager) tạo schedule type='leave'  →  status='pending'
   │
   ▼
Helper canApproveLeave(profile, leave) quyết định ai nhìn thấy đơn này:
   │
   ├─ admin → luôn duyệt được
   ├─ director → duyệt được nếu creator là manager / department_head
   ├─ manager → duyệt được nếu cùng phòng + creator KHÔNG phải lãnh đạo cùng cấp
   │            AND (is_department_head=true HOẶC creator không phải manager/head)
   └─ hr_officer → KHÔNG duyệt, chỉ read-only
   │
   ▼
Người duyệt mở LeaveApprovalDashboard → bấm Approve/Reject
   →  UPDATE schedules.status = 'approved' | 'rejected'
   →  Notification cho creator
```

**Quyền riêng tư**: nội dung đơn nghỉ phép (description, title chi tiết) được bảo vệ bởi RPC helper `can_view_leave_detail()` ([`migration_leave_privacy.sql`](supabase/migration_leave_privacy.sql)). Cán bộ khác phòng chỉ thấy "phòng X có người Y nghỉ" chứ không thấy lý do.

#### 3.4.4 Workspace Lái xe (DriverDashboard)

URL vẫn là `/dashboard/schedule` nhưng auto-detect role `driver` → render `DriverDashboard`:

| Hành động | Implementation |
|-----------|----------------|
| Xem chuyến được giao | Filter `schedules WHERE driver_id = auth.uid()` (RLS cho phép) |
| **Bắt đầu chuyến** | `StartTripDialog` → nhập `start_km` → UPDATE `schedules.metadata = {start_km: …}` + status `in_progress` |
| **Kết thúc chuyến** | `EndTripDialog` → nhập `end_km` (validate > start_km) → UPDATE metadata `{start_km, end_km, actual_distance}` + status `completed` |
| **Báo sự cố** | `ReportIssueDialog` → insert notification cho TCTH/secretary |
| Stat cá nhân | `DriverStatsGrid` — tổng số chuyến, tổng Km tháng |
| Card từng chuyến | `MyTripCard` — hiển thị Km xuất phát/về, biển số, người yêu cầu |

#### 3.4.5 Gán xe + tài xế (Resource Coordination)

Secretary / admin / TCTH manager:
1. Mở `ScheduleDetailDialog` của 1 schedule `type='trip'`.
2. Chọn `vehicle_id` + `driver_id` từ list.
3. UPDATE schedule → status `approved` + notification cho driver "Bạn được phân công lịch chạy xe …".

#### 3.4.6 Conflict detection

RPC `check_schedule_participant_conflicts(participants, start, end, ignore_id)` — gọi trước khi tạo/sửa lịch:
- Kiểm tra 1 người không tham gia 2 cuộc cùng giờ.
- Trả về list các schedule conflict + người liên quan.
- UI `CreateScheduleDialog` hiển thị warning đỏ nếu có conflict.

---

### 3.5 Module Cán bộ (Team)

> URL: `/dashboard/team` + detail `/dashboard/team/[id]` · Code: [`src/app/dashboard/team/`](src/app/dashboard/team/)

- **Danh bạ cán bộ** chi nhánh (avatar, số máy, sinh nhật, ngày vào ngành, AD account).
- **Sắp xếp theo phân cấp** (`sortProfilesByHierarchy` từ `lib/utils.ts`) — Giám đốc → Phó GĐ → Trưởng phòng → Phó phòng → nhân viên.
- **Trang chi tiết `[id]`**:
  - Thông tin cá nhân + phòng ban + title.
  - Task đang phụ trách + lịch trình sắp tới.
  - **Recognitions** (vinh danh): admin/director gửi message tôn vinh, hiển thị như feed trên trang cá nhân của người được vinh danh.
- **Helper `canAccessPeopleDirectory`** ẩn module này với `staff` thường — chỉ `admin | director | hr_officer | manager` xem được.

---

### 3.6 Module Cá nhân (Profile)

> URL: `/dashboard/profile` · Code: [`src/app/dashboard/profile/`](src/app/dashboard/profile/)

- **Update thông tin cá nhân**: avatar (upload bucket `avatars`), số điện thoại, sinh nhật, giới tính, AD account, ngày vào ngành.
- **Đổi mật khẩu** (`ChangePasswordSection.tsx`):
  - Nếu `must_change_password = true` → banner đỏ ép đổi.
  - Khi đổi thành công → UPDATE `must_change_password = false`.
- **Subscribe push notification** — hook `use-push-subscription.ts` insert vào `push_subscriptions`.

---

### 3.7 Module Admin

> URL: `/dashboard/admin` · Code: [`src/app/dashboard/admin/`](src/app/dashboard/admin/)

**Chỉ role `admin` truy cập được.** Trang có **3 tab**:

| Tab | Nội dung |
|-----|----------|
| **Users** | List toàn bộ profiles, search, filter theo role/department. Hành động: đổi role, bật/tắt `is_active`, reset password (gọi RPC từ [`migration_reset_passwords.sql`](supabase/migration_reset_passwords.sql), set `must_change_password = true` để ép user đổi). |
| **Rooms** | CRUD phòng họp (name, capacity, location). |
| **Vehicles** | CRUD xe (name, plate_number, type 4/7/16 chỗ, gán `driver_id` chuyên trách). |

Ngoài 3 tab này, admin còn:
- Duyệt **`account_requests`** (form `/register` của người chưa có account).
- Vào `/dashboard/handover` → mở `CategoryManagerDialog` để CRUD nhóm hồ sơ + SLA.

---

### 3.8 Module Settings

> URL: `/dashboard/settings` + sub `/dashboard/settings/users` · Code: [`src/app/dashboard/settings/`](src/app/dashboard/settings/)

- Trang setting cá nhân (theme PWA, manage push subscription).
- Sub-page `/users` cho admin quản lý user (trùng chức năng với admin module — đang trong quá trình thống nhất, xem `ARCHITECTURE.md §9`).

---

## 4. Auth Flow

```
┌──────────────────────────────────────────────────────────────┐
│  1. Người mới truy cập app                                   │
│     • Mọi route `/dashboard/*` bị middleware redirect /login │
│     • Có thể đăng ký /register (form public)                 │
└──────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                            ▼
   ┌───────────────────┐         ┌───────────────────┐
   │  /register        │         │  /login           │
   │  Email + Pass +   │         │  Email + Pass     │
   │  Full name        │         │                   │
   └─────────┬─────────┘         └─────────┬─────────┘
             │                              │
             ▼                              │
   ┌───────────────────┐                    │
   │ supabase.auth     │                    │
   │   .signUp()       │                    │
   │ → trigger         │                    │
   │ `handle_new_user` │                    │
   │ tự tạo profile    │                    │
   │ (role=staff,      │                    │
   │  is_active=true   │                    │
   │  by default)      │                    │
   └─────────┬─────────┘                    │
             │                              │
             ▼                              ▼
   ┌──────────────────────────────────────────────────┐
   │  Middleware (src/middleware.ts) kiểm tra:        │
   │  ├─ Session hợp lệ? → nếu không → /login         │
   │  ├─ profile.is_active = false?                   │
   │  │   → signOut + redirect /login?pending=1       │
   │  │     (admin chưa duyệt)                         │
   │  └─ Đã login mà vào /login? → /dashboard          │
   └──────────────────────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────────┐
   │  /dashboard (RSC layout)                         │
   │  ├─ getProfile() qua server client               │
   │  ├─ Render DashboardLayout (sidebar + topnav)    │
   │  ├─ Nếu profile.must_change_password = true      │
   │  │   → MustChangePasswordBanner đỏ trên top      │
   │  │   → click → /dashboard/profile#change-password│
   │  ├─ Nếu hôm nay là ngày kỷ niệm vào ngành        │
   │  │   → AnniversaryDialog auto popup              │
   │  └─ Render page con (handover/tasks/schedule…)   │
   └──────────────────────────────────────────────────┘
```

> Note: Form `/register` đang gọi `supabase.auth.signUp` trực tiếp, KHÔNG sử dụng bảng `account_requests` (mặc dù bảng này tồn tại trong schema cho luồng tương lai — admin duyệt rồi mới tạo user). Hiện tại để app dùng được, admin phải mở Supabase chạy SQL set `is_active = true` cho user mới đăng ký, hoặc dùng workflow `account_requests` qua admin module nếu được bật.

---

## 5. Tính năng xuyên suốt

### 5.1 PWA + Push Notification

- **Manifest**: [`src/app/manifest.ts`](src/app/manifest.ts) — `display: 'standalone'`, theme color slate, icon 192/512, maskable.
- **Subscribe**: hook [`src/hooks/use-push-subscription.ts`](src/hooks/use-push-subscription.ts) — đăng ký subscription, lưu JSONB vào `push_subscriptions(user_id, subscription, device_info)`.
- **Server push**: edge function `push-notification` (Deno) — trigger qua DB webhook khi INSERT vào `notifications`. Đọc `push_subscriptions` của user → fire Web Push qua VAPID keys tới mọi device.
- **In-app**: `<NotificationsDropdown />` ở topnav — list 10 notification mới nhất, subscribe realtime channel `notifications_realtime_<user_id>`, toast notify khi có event mới.

### 5.2 Realtime sync

Mỗi page chính subscribe 1 channel Supabase Realtime, refetch toàn list khi có event (debounce 250–600ms). Naming convention từ `ARCHITECTURE.md §6.5`:

| Channel | Sub-tables | Vị trí |
|---------|-----------|--------|
| `dashboard_sync` | tasks, recognitions, task_comments, schedules, schedule_participants, vehicles, rooms, documents, document_handovers | `/dashboard` |
| `handover_realtime_sync` | documents, document_handovers, document_categories | `/dashboard/handover` |
| `schedule_realtime_sync` | schedules, schedule_participants, rooms, vehicles | `/dashboard/schedule` |
| `notifications_realtime_<userId>` | notifications (filter user_id) | `<NotificationsDropdown>` |
| `task_<id>` / `report_<id>` | tasks, task_comments | `/dashboard/tasks/[id]` |

### 5.3 Mobile-first UX

- **Bottom navigation** (`MobileBottomNav`) — 5 tab dưới đáy trên mobile.
- **FAB tạo mới** (`MobileCreateFab`) — contextual theo route, chỉ hiện mobile:
  - `/dashboard/tasks` → push `/dashboard/tasks/new`
  - `/dashboard/schedule` → set `?create` query
  - `/dashboard/team` → set `?create`
  - `/dashboard/handover` → set `?create`
- **Touch target 44pt**, safe area iOS notch + home indicator (xem token `globals.css`).
- **PWA installable** — Add to Home Screen trên iOS/Android.

### 5.4 Anniversary auto-popup

`AnniversaryDialog` ở `DashboardLayout` — khi user login và hôm nay trùng `branch_join_date`:
- Modal chúc mừng "Kỷ niệm X năm vào ngành" với confetti.
- Hiển thị 1 lần / ngày (lưu flag localStorage).

### 5.5 Search & Filter top-nav

`dashboard-layout.tsx` có `configMap` định nghĩa search bar contextual:

| Route | Placeholder | Có status filter |
|-------|-------------|------------------|
| `/dashboard/team` | "Tìm kiếm cán bộ, phòng ban..." | — |
| `/dashboard/tasks` | "Tìm kiếm công việc, báo cáo..." | ✅ |
| `/dashboard/handover` | "Tìm mã hồ sơ, tiêu đề, khách hàng..." | ✅ |
| `/dashboard/admin` | "Tìm kiếm tài khoản, dữ liệu..." | — |
| `/dashboard/settings/users` | "Tìm kiếm người dùng..." | — |

Query string `?q=...&status=...` đẩy vào URL → mỗi page tự đọc và filter local.

### 5.6 Storage & Image pipeline

- **Bucket `avatars`** (public) — `<userId>/<file>`, RLS chỉ user upload vào folder của mình.
- **Bucket `documents`** (public) — `<documentId>/<ts>-<n>.<ext>`, ai authenticated upload được.
- **Compress client-side** trước upload: `browser-image-compression` → maxSizeMB=1, maxWidthOrHeight=1920, useWebWorker=true. Giới hạn 10 ảnh/hồ sơ.

---

## 6. Cronjobs & Background jobs

| Job | Lịch | Nơi chạy | Tác dụng |
|-----|------|----------|----------|
| `/api/cron/notifications` | `0 8 * * *` daily 8:00 ICT (`vercel.json`) | Vercel cron — dùng `SUPABASE_SERVICE_ROLE_KEY` | (1) Gọi `auto_archive_and_cleanup()`. (2) Quét task quá hạn → insert notification "Quá hạn". (3) Chúc mừng sinh nhật cán bộ trong ngày. Bảo vệ bằng `CRON_SECRET` nếu được set. |
| Edge `cleanup-document-images` | `0 19 * * *` UTC = 02:00 ICT | Supabase Edge Function | Quét `documents` `COMPLETED > 30 ngày, attached_image_urls ≠ '{}'` → xoá file storage + clear mảng URLs. Giới hạn 200 hồ sơ/lượt. |
| Edge `push-notification` | Trigger qua DB webhook (không phải cron) | Supabase Edge Function | Mỗi INSERT `notifications` → đọc `push_subscriptions` → fire Web Push VAPID tới mọi device. |

---

## 7. Roadmap quan sát được trong code

(Không phải tính năng đã có — là các "khoảng cách" thấy được giữa code hiện tại và `ARCHITECTURE.md`.)

| Hạng mục | Trạng thái | Hướng |
|----------|-----------|-------|
| Migrate form lớn sang `react-hook-form` + `zod` | Deps có sẵn, một số dialog vẫn dùng `useState` thủ công | Áp dụng cho form > 4 field theo lần đụng vào |
| Refactor `team/[id]/page.tsx` (455 dòng), `admin/page.tsx` (461 dòng) | Sát giới hạn 500 dòng | Lần đụng tiếp theo phải tách subcomponent |
| `_components/_hooks/_lib` cho `tasks`, `admin`, `team` | Đang lệch chuẩn (thiếu `_lib` ở `team`, `_components` rỗng ở `admin`) | Module mới bắt buộc đủ 3 folder |
| `database.types.ts` | Đang hand-craft | Gen từ Supabase CLI |
| Bảng `account_requests` | Có schema + RLS nhưng `/register` đang bypass | Hoặc bật luồng admin-duyệt qua bảng này, hoặc xoá bảng để gọn |
| Module KPI cũ | Đã drop (xem `migration_drop_kpi_module.sql`) | — |
| Tab Settings/Users vs Admin module | Trùng chức năng | Thống nhất 1 nơi |

---

## 8. Tham chiếu nhanh

| Tài liệu | Nội dung |
|----------|----------|
| [`README.md`](README.md) | Setup, env vars, deploy, troubleshooting |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Quy chuẩn code, naming, fetch pattern, RPC, workflow thêm module |
| [`docs/TECHNICAL_RULES.md`](docs/TECHNICAL_RULES.md) | UI/UX (Apple HIG), palette, RLS business rules |
| [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) | Entities, RLS strategy, SLA logic, storage, cronjobs |
| [`schema.sql`](schema.sql) | Snapshot DB (truth source) |
| [`supabase/migration_handover_module.sql`](supabase/migration_handover_module.sql) | Migration mẫu chuẩn (RLS + RPC + Trigger) |

---

**Phiên bản:** 1.1 — bổ sung Dashboard Home, Driver workspace, Leave approval flow, Auth flow, Realtime channels, Cronjobs, Roadmap.
