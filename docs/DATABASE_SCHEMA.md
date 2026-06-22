# DATABASE SCHEMA — Kiến trúc Dữ liệu & Supabase

> Truth source: [`schema.sql`](schema.sql) (snapshot) + các file `supabase/migration_*.sql` áp dụng theo thứ tự. RLS là tầng bảo mật chính, mọi mutation phức tạp đi qua **RPC `SECURITY DEFINER`** chứ không update bảng trực tiếp. Postgres 15 trên Supabase.

## Mục lục

1. [Sơ đồ ERD rút gọn](#1-sơ-đồ-erd-rút-gọn)
2. [Naming convention DB](#2-naming-convention-db)
3. [Enum types](#3-enum-types)
4. [Schema chi tiết từng bảng](#4-schema-chi-tiết-từng-bảng)
   - 4.1 `auth.users` + `profiles`
   - 4.2 `departments`
   - 4.3 `documents` + `document_handovers` + `document_categories` + `document_comments`
   - 4.4 `tasks` + `task_comments`
   - 4.5 `schedules` + `schedule_participants` + `rooms` + `vehicles`
   - 4.6 `notifications` + `push_subscriptions`
   - 4.7 `recognitions` + `out_of_office` + `account_requests`
5. [Index list đầy đủ](#5-index-list-đầy-đủ)
6. [Foreign key behavior](#6-foreign-key-behavior-cascade--set-null--restrict)
7. [Triggers & Functions](#7-triggers--functions)
8. [RPC list đầy đủ](#8-rpc-list-đầy-đủ-các-callable-từ-supabaserpc)
9. [Mô hình luân chuyển & SLA (Hồ sơ vật lý)](#9-mô-hình-luân-chuyển--sla)
10. [Dynamic Form / JSONB — Thực trạng](#10-dynamic-form--jsonb--thực-trạng)
11. [Row Level Security (RLS) Strategy](#11-row-level-security-rls-strategy)
12. [Storage & Cronjobs](#12-storage--cronjobs)
13. [Realtime publication](#13-realtime-publication)
14. [Sample queries thông dụng](#14-sample-queries-thông-dụng-cho-dev)
15. [Migration order + Backup tips](#15-migration-order--backup-tips)

---

## 1. Sơ đồ ERD rút gọn

```
┌──────────────────┐      ┌──────────────────────────────────────────┐
│ auth.users       │ 1──1 │ profiles                                 │
│ (Supabase Auth)  │      │ id (=auth.users.id), full_name, role,    │
└──────────────────┘      │ department_id, avatar_url, phone,        │
                          │ birthday, gender, ad_account,            │
                          │ branch_join_date, title,                 │
                          │ is_department_head, is_active,           │
                          │ must_change_password, updated_at         │
                          └────────┬─────────────────────────────────┘
                                   │ N
                                   ▼ 1
                          ┌──────────────────┐
                          │ departments      │
                          │ id, code, name   │
                          └──────────────────┘

┌─ MODULE HỒ SƠ ──────────────────────────────────────────────┐
│                                                              │
│  ┌──────────────────────┐     ┌──────────────────────────┐  │
│  │ document_categories  │ 1   │ documents                │  │
│  │ id, name(UQ),        │◄────│ id, short_code(UQ),      │  │
│  │ sla_hours,           │  N  │ title, customer_name,    │  │
│  │ color (CHECK ENUM),  │     │ category_id (FK),        │  │
│  │ created_by           │     │ attached_image_urls[],   │  │
│  └──────────────────────┘     │ creator_id (FK),         │  │
│                                │ current_assignee_id(FK), │  │
│                                │ status (document_status),│  │
│                                │ completed_at,            │  │
│                                │ created_at, updated_at   │  │
│                                └──────────┬───────────────┘  │
│                                           │ 1                │
│                                           ▼ N (CASCADE)      │
│                                ┌──────────────────────────┐  │
│                                │ document_handovers       │  │
│                                │ id, document_id (FK),    │  │
│                                │ sender_id (FK RESTRICT), │  │
│                                │ receiver_id(FK RESTRICT),│  │
│                                │ status (handover_status),│  │
│                                │ sent_at, received_at,    │  │
│                                │ note                     │  │
│                                └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

┌─ MODULE CÔNG VIỆC ──┐    ┌─ MODULE LỊCH TRÌNH ───────────────┐
│  tasks              │    │  schedules                        │
│  id, title,         │    │  id, title, description,          │
│  description,       │    │  type (schedule_type),            │
│  status, priority,  │    │  status (schedule_status),        │
│  task_type, progress│    │  start_time, end_time, location,  │
│  assignee_id, dept, │    │  room_id, vehicle_id, driver_id,  │
│  created_by,        │    │  department_id, created_by,       │
│  due_date,          │    │  use_room, use_vehicle,           │
│  target/current_val │    │  requested_vehicle_type,          │
│  unit, metadata     │    │  metadata JSONB                   │
│  is_archived        │    └────────┬──────────────────────────┘
└──┬──────────────────┘             │ N        ▲
   │ 1                              ▼ 1        │ FK
   ▼ N (CASCADE)                ┌──────────────┴──┐
┌──────────────────┐            │ schedule_       │
│  task_comments   │            │ participants    │  ┌─────────┐
│  task_id (FK),   │            │ schedule_id,    │  │ rooms   │
│  user_id (FK),   │            │ profile_id      │  └─────────┘
│  content         │            └─────────────────┘  ┌─────────┐
└──────────────────┘                                 │ vehicles│
                                                     │ driver_id│
                                                     └─────────┘

┌─ XUYÊN SUỐT ──────────────────────────────────────────────────┐
│  notifications (user_id, title, content, type, link, is_read)│
│  push_subscriptions (user_id, subscription JSONB, device)    │
│  recognitions (sender_id, receiver_id, content, type)        │
│  out_of_office (user_id UNIQUE, message, ends_at)            │
│  account_requests (full_name, email, role, dept, status)     │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Naming convention DB

| Đối tượng | Quy ước | Ví dụ |
|-----------|---------|-------|
| Bảng | `snake_case` plural | `documents`, `document_handovers`, `schedule_participants` |
| Cột | `snake_case` | `current_assignee_id`, `attached_image_urls`, `created_at` |
| Foreign key | `<table_singular>_id` | `category_id`, `creator_id`, `receiver_id`, `room_id` |
| Timestamp | luôn `TIMESTAMPTZ` (with timezone), `DEFAULT NOW()` | `created_at`, `updated_at`, `sent_at` |
| Enum type | `snake_case` | `user_role`, `document_status`, `handover_status` |
| Enum value | `UPPER_CASE` (handover) hoặc `lowercase` (cũ, schedule/task) | `'PENDING_RECEIPT'` vs `'pending'` |
| Index | `idx_<table>_<column(s)>` | `idx_documents_current_assignee`, `idx_handovers_doc_sent` |
| Trigger function | động từ tiếng Anh + `_<entity>` | `generate_document_short_code()`, `touch_documents_updated_at()` |
| RPC function | `snake_case` động từ + danh từ | `transfer_document()`, `acknowledge_document()`, `check_schedule_participant_conflicts()` |
| RPC parameter | prefix `p_` (tránh nhầm với column) | `p_document_id`, `p_receiver_id` |

> ⚠️ **Bất nhất legacy**: enum cũ (`task_status`, `schedule_status`, `schedule_type`) dùng `lowercase` (`'pending'`, `'meeting'`), enum mới (`document_status`, `handover_status`) dùng `UPPER_CASE` (`'PENDING_RECEIPT'`). Không hợp nhất để tránh phá vỡ data đã có.

---

## 3. Enum types

| Enum | Values | Migration | Mục đích |
|------|--------|-----------|----------|
| `user_role` | `admin`, `director`, `manager`, `staff`, `secretary`, `hr_officer`, `driver` | `schema.sql §1` (3 giá trị đầu) + `ALTER TYPE ADD VALUE` cho 4 giá trị sau | Vai trò user — quyết định mọi RLS policy |
| `task_status` | `todo`, `doing`, `done`, `late`, `closed` | `schema.sql §1` (4 đầu) + `ADD VALUE 'closed'` | Status cho `tasks` |
| `task_priority` | `low`, `medium`, `high` | `migration_tasks_revamp.sql` | Mức ưu tiên task — cột `tasks.priority` DEFAULT `'medium'` |
| `schedule_type` | `meeting`, `trip`, `event`, `leave` | `schema.sql` (3 đầu) + `ADD VALUE 'leave'` ở `fix_security_and_logic_patch.sql` | Loại lịch trình |
| `schedule_status` | `pending`, `approved`, `rejected`, `in_progress`, `completed` | `schema.sql` | Status lịch trình |
| `document_status` | `DRAFT`, `PENDING_RECEIPT`, `IN_REVIEW`, `RETURNED`, `COMPLETED` | `migration_handover_module.sql §1` | Status hồ sơ vật lý |
| `handover_status` | `PENDING`, `ACCEPTED`, `REJECTED` | `migration_handover_module.sql §1` | Status mỗi lượt giao nhận |

**Pattern thêm value an toàn** (tránh lỗi `duplicate_object`):

```sql
DO $$ BEGIN
    CREATE TYPE foo_status AS ENUM ('a', 'b');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE foo_status ADD VALUE IF NOT EXISTS 'c';
```

---

## 4. Schema chi tiết từng bảng

### 4.1 `profiles` (extension của `auth.users`)

```sql
CREATE TABLE profiles (
    id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name               TEXT,
    department_id           UUID REFERENCES departments(id),
    role                    user_role DEFAULT 'staff',
    avatar_url              TEXT,
    phone                   TEXT,
    birthday                DATE,
    gender                  TEXT,
    ad_account              TEXT UNIQUE,         -- Tài khoản AD Windows
    branch_join_date        DATE,                -- Ngày vào ngành — dùng cho AnniversaryDialog
    title                   TEXT,                -- "RM", "Trưởng phòng", "Kiểm soát viên"...
    is_department_head      BOOLEAN DEFAULT false,  -- Trưởng phòng chính thức (≠ Phó phòng)
    is_active               BOOLEAN DEFAULT true,   -- false → middleware signOut
    must_change_password    BOOLEAN DEFAULT false,  -- true → banner ép đổi mật khẩu
    -- Phase 2 (migration_team_phase2.sql) — module Cán bộ
    extension               TEXT,                -- Số nội bộ (3-6 chữ số)
    seat_location           TEXT,                -- Vị trí chỗ ngồi vật lý (vd "Tầng 2 - Quầy 5")
    employee_code           TEXT,                -- Mã nhân viên — nhạy cảm (chỉ self + admin/hr_officer/director xem)
    birthday_notify_optout  BOOLEAN NOT NULL DEFAULT false, -- Tắt thông báo sinh nhật cho đồng nghiệp
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

- **Tạo tự động**: trigger `handle_new_user()` (xem §7) bắn khi user signup vào `auth.users` → insert row tương ứng với `role = 'staff'`, `is_active = FALSE` (chờ admin duyệt — theo migration mới).
- **`ad_account UNIQUE`** — đảm bảo 1 tài khoản AD chỉ map 1 profile.
- **Không có `created_at`** trong bảng này (vì PK đã là FK tới `auth.users.id`, dùng `auth.users.created_at` nếu cần).
- **Field nhạy cảm** (chỉ self + admin + hr_officer + director xem): `birthday`, `gender`, `ad_account`, `employee_code`. Kiểm tra qua `canViewSensitiveProfileFields(viewer, target)` ở client.

### 4.2 `departments`

```sql
CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE,            -- ⭐ "13602" cho phòng điều phối Tổ chức Tổng hợp (dùng trong RLS)
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Seed mặc định: Tín dụng, Giao dịch viên, Kho quỹ, Pháp chế, Công nghệ thông tin, Tổ chức Tổng hợp.

### 4.3 Module Hồ sơ vật lý

#### `document_categories`

```sql
CREATE TABLE document_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    sla_hours   INTEGER NOT NULL DEFAULT 24 CHECK (sla_hours > 0),
    color       TEXT NOT NULL DEFAULT 'slate'
                CHECK (color IN ('slate', 'blue', 'amber', 'emerald', 'red')),
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Seed: 4 nhóm (Tín dụng 24h, Kế toán 8h, Tổng hợp 48h, Nhân sự 24h).

#### `documents`

```sql
CREATE TABLE documents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_code              TEXT UNIQUE,         -- HS-YYYYMMDD-NNN (auto-gen trigger)
    title                   TEXT NOT NULL,
    customer_name           TEXT,
    category_id             UUID REFERENCES document_categories(id) ON DELETE SET NULL,
    attached_image_urls     TEXT[] NOT NULL DEFAULT '{}',
    creator_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    current_assignee_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status                  document_status NOT NULL DEFAULT 'DRAFT',
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Constraints quan trọng:
- `creator_id ... ON DELETE RESTRICT` — không cho xoá user khi user đó còn là creator của hồ sơ.
- `attached_image_urls TEXT[]` — mảng URL public của bucket `documents`, max 10 phần tử (validate client-side).

#### `document_handovers`

```sql
CREATE TABLE document_handovers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    receiver_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    status          handover_status NOT NULL DEFAULT 'PENDING',
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at     TIMESTAMPTZ,                 -- NULL khi PENDING
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **`ON DELETE CASCADE`** từ `documents` — xoá hồ sơ → xoá toàn bộ lịch sử handover của nó.
- **`ON DELETE RESTRICT`** từ `profiles` — không cho xoá user còn lịch sử handover (bảo toàn dấu vết).

#### `document_comments` (Ý kiến & Thảo luận hồ sơ)

```sql
CREATE TABLE document_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **`ON DELETE CASCADE`** — xoá hồ sơ hoặc xoá người dùng bình luận thì xoá bình luận đi kèm.
- **Bảo mật RLS**: Kế thừa trực tiếp từ bảng `documents`. Chỉ cho phép những người được quyền xem hồ sơ (creator, current assignee, admin, director, hoặc người có trong luồng handover) được xem và viết bình luận.

### 4.4 Module Công việc

> ⚠️ Đã được redesign trong `migration_tasks_revamp.sql` (drop KPI columns, add status `submitted`/`canceled`). Schema ở đây phản ánh trạng thái sau migration.

#### `tasks`

```sql
CREATE TABLE tasks (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title              TEXT NOT NULL,
    description        TEXT,
    status             task_status DEFAULT 'todo',     -- todo|doing|submitted|done|canceled
    priority           task_priority DEFAULT 'medium', -- low|medium|high
    task_type          TEXT DEFAULT 'task',            -- 'task' | 'report'
    assignee_id        UUID REFERENCES profiles(id),   -- "primary" assignee (denormalized)
    created_by         UUID REFERENCES profiles(id),
    department_id      UUID REFERENCES departments(id),
    due_date           TIMESTAMPTZ,
    metadata           JSONB DEFAULT '{}'::jsonb,
    is_archived        BOOLEAN DEFAULT FALSE,
    requires_approval  BOOLEAN DEFAULT FALSE,          -- Luồng B: TRUE → cần TP duyệt submitted→done
    batch_id           UUID,                           -- gộp nhiều phòng/người trong 1 lần tạo (cho counter)
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes:
-- idx_tasks_status_due (status, due_date)
-- idx_tasks_dept_status (department_id, status)
-- idx_tasks_assignee (assignee_id)
-- idx_tasks_created_by (created_by)
-- idx_tasks_updated (updated_at DESC) WHERE is_archived = FALSE
-- idx_tasks_batch (batch_id) WHERE batch_id IS NOT NULL
```

**LƯU Ý**:
- 4 cột KPI cũ (`target_value`, `current_value`, `unit`, `progress`) đã **DROP**.
- Status `late`/`closed` legacy vẫn tồn tại trong enum (Postgres không cho drop value) nhưng UI map về `doing`/`done+archived`.
- `requires_approval`: chỉ áp cho `task_type='report'`. Default FALSE → submitted = done luôn; TRUE → cần `task_update_status` của TP.
- `batch_id`: dùng để counter dashboard gom chính xác (1 lần gửi "cho 3 phòng" hiện trên dashboard là 1 batch, không phải 3 task rời). Xem `migration_dashboard_counters_batch_aware.sql`.
- RLS: DENY direct INSERT/UPDATE/DELETE — buộc qua RPC SECURITY DEFINER.

#### `task_assignees` (junction multi-assignee)

```sql
CREATE TABLE task_assignees (
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);
```

Trigger `_auto_cancel_orphaned_task`: khi assignee cuối bị xoá (do user bị xoá → CASCADE) và task chưa done/canceled → tự `canceled`.

#### `task_comments`

```sql
CREATE TABLE task_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Comment có prefix `[Hệ thống]` được render ở Timeline (không phải Comments list).

#### `task_extension_requests` (xin gia hạn deadline)

```sql
CREATE TABLE task_extension_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    requested_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason          TEXT,
    old_due_date    TIMESTAMPTZ,
    new_due_date    TIMESTAMPTZ NOT NULL,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    review_comment  TEXT,
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `task_attachments`

```sql
CREATE TABLE task_attachments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    comment_id    UUID REFERENCES task_comments(id) ON DELETE SET NULL,
    uploaded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    storage_path  TEXT NOT NULL,
    filename      TEXT NOT NULL,
    mime_type     TEXT,
    size_bytes    INTEGER,
    is_deleted    BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

Storage bucket `task-attachments` (PRIVATE) — download qua `createSignedUrl(path, 3600)`. Tối đa 20MB, mime allowlist: `xlsx/xls/docx/doc/pdf/jpg/png`.

#### `task_recurring_templates`

```sql
CREATE TABLE task_recurring_templates (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                 TEXT NOT NULL,
    description           TEXT,
    task_type             TEXT NOT NULL DEFAULT 'report',
    priority              task_priority DEFAULT 'medium',
    target_department_ids UUID[] DEFAULT '{}',
    target_user_ids       UUID[] DEFAULT '{}',
    default_assignee_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    schedule_kind         TEXT CHECK (schedule_kind IN ('weekly','monthly')),
    weekly_dow            SMALLINT,        -- 0=Sunday..6=Saturday
    weekly_time           TIME,
    monthly_dom           SMALLINT,        -- 1..31
    monthly_time          TIME,
    timezone              TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    due_days_after_fire   INT DEFAULT 7,
    created_by            UUID REFERENCES profiles(id),
    is_active             BOOLEAN DEFAULT TRUE,
    last_fired_at         TIMESTAMPTZ,
    next_run_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

`default_assignee_id` — override TP mặc định khi giao qua phòng (`target_department_ids` non-empty). NULL → fallback Trưởng phòng đang active của phòng đích (xem RPC `_resolve_default_assignee`). Tránh case "TP phải chia lại task mỗi kỳ".

Engine fire: `recurring_fire_due()` quét `WHERE is_active AND next_run_at <= now()` → sinh task + cập `next_run_at`. Schedule qua **pg_cron** (`*/15 * * * *`) nếu enabled, fallback Vercel cron `/api/cron/notifications` daily 8h ICT.

#### Vòng đời migration Tasks

1. `migration_tasks_standardize.sql` — schema cốt lõi + 5-state status + Luồng A/B + `task_create`/`task_update_status`/`task_delegate`/`tasks_analytics`.
2. `migration_tasks_default_assignee.sql` — helper `_resolve_default_assignee(p_dept_id, p_override)` + `_is_hub_department(p_dept_id)` + auto-fill TP làm assignee mặc định cho cả task ad-hoc lẫn recurring.
3. `migration_tasks_edit_delete.sql` — RPC `task_edit` + cửa sổ xoá nháp 10 phút cho creator.
4. `migration_task_scope.sql` — siết scope quyền giao việc / yêu cầu báo cáo theo phòng đầu mối (hub): cập `task_create` + `recurring_template_upsert`.
5. `migration_tasks_access_workflow_recurring_fix.sql` — chặn `hr_officer` khỏi module Công việc ở backend, chặn `todo → done`, siết reopen `done → doing` cho creator/admin, vá overload `_recurring_next_run(INT/TEXT)`.

> Recurring fire engine + analytics đã gộp trong `migration_tasks_standardize.sql` — không còn file rời.

### 4.5 Module Lịch trình

#### `schedules`

```sql
CREATE TABLE schedules (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                       TEXT NOT NULL,
    description                 TEXT,
    type                        schedule_type DEFAULT 'meeting',
    status                      schedule_status DEFAULT 'pending',
    start_time                  TIMESTAMPTZ NOT NULL,
    end_time                    TIMESTAMPTZ NOT NULL,
    location                    TEXT,                -- địa điểm ngoài hoặc ghi chú
    room_id                     UUID REFERENCES rooms(id),
    vehicle_id                  UUID REFERENCES vehicles(id),
    driver_id                   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    department_id               UUID REFERENCES departments(id),
    created_by                  UUID REFERENCES profiles(id),
    use_room                    BOOLEAN DEFAULT false,
    use_vehicle                 BOOLEAN DEFAULT false,
    requested_vehicle_type      TEXT,                -- Legacy/display: lấy từ vehicles.type khi chọn xe trực tiếp
    metadata                    JSONB DEFAULT '{}'::jsonb,
                                                      --- driver flow: {start_km, end_km, actual_distance, driver_confirmed_at, trip_started_at, trip_ended_at}
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Lifecycle tự hoàn thành

- RPC `complete_finished_schedules()` tự chuyển `approved → completed` cho lịch `meeting` / `event` / `leave` **không dùng xe** khi `end_time < NOW() - interval '15 minutes'`.
- Điều kiện loại trừ lịch xe/công tác: `use_vehicle = false`, `vehicle_id IS NULL`, `driver_id IS NULL`; lịch `trip` / lịch có xe vẫn do lái xe hoặc điều phối xác nhận thực tế.
- Caller: `/api/cron/notifications` (service role) và fallback client `fetchScheduleData()` để dọn trạng thái ngay khi người dùng mở trang lịch trình.

#### `schedule_participants` (N–N)

```sql
CREATE TABLE schedule_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID REFERENCES schedules(id) ON DELETE CASCADE,
    profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `rooms`

```sql
CREATE TABLE rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    capacity    INTEGER,
    location    TEXT,                            -- "Tầng 2 - Khu A"
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `vehicles`

```sql
CREATE TABLE vehicles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,               -- "Toyota Fortuner"
    plate_number    TEXT NOT NULL UNIQUE,        -- "30F-123.45"
    type            TEXT,                        -- "4 chỗ" | "7 chỗ" | "16 chỗ"
    status          TEXT DEFAULT 'available',    -- "available" | "busy" | "maintenance"
    driver_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- tài xế chuyên trách mặc định
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.6 Notification system

#### `notifications`

```sql
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    content     TEXT,
    type        TEXT,                            -- "document_handover" | "task" | "schedule" | ...
    link        TEXT,                            -- "/dashboard/handover?id=..."
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

> Mọi INSERT vào bảng này → DB webhook trigger edge function `push-notification` → fire PWA push tới mọi device của user qua `push_subscriptions`.

#### `push_subscriptions`

```sql
CREATE TABLE push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subscription    JSONB NOT NULL,              -- toàn bộ object Web Push (endpoint, keys)
    device_info     TEXT,                        -- user agent string
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subscription)
);
```

### 4.7 Phụ trợ

#### `recognitions` (vinh danh / khen thưởng)

```sql
CREATE TABLE recognitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID REFERENCES profiles(id),
    receiver_id     UUID REFERENCES profiles(id),
    content         TEXT NOT NULL,
    type            TEXT DEFAULT 'praise',       -- 'great_work' | 'team_player' | 'innovation' | 'mentor' | 'praise'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

- **RLS hiện tại (`schema.sql`)**: SELECT mở (`USING true`), INSERT cho phép mọi cán bộ đang hoạt động ngoại trừ lái xe (`auth.uid() = sender_id AND role != 'driver' AND is_active = true`), khớp hoàn hảo với business intent và hàm `canRecognize()` của client.
- Notification cho receiver được hook `useRecognitions` insert trực tiếp vào `notifications` (không qua trigger DB).

#### `out_of_office` (Phase 2 — vắng mặt tạm thời)

```sql
CREATE TABLE out_of_office (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)                                  -- 1 user — 1 record OOO active
);
CREATE INDEX idx_ooo_ends_at ON out_of_office(ends_at);
```

- **RLS:** `ooo_select_all` — `USING (true)` cho mọi authenticated (để banner OOO hiển thị trên hồ sơ chéo phòng); `ooo_owner_write` — chỉ chính chủ INSERT/UPDATE/DELETE.
- **Cleanup** — RPC `cleanup_expired_ooo()` xoá row có `ends_at < NOW()`. Gọi mỗi sáng bởi `/api/cron/notifications` (xem §12).
- Client render banner `.status-warning-bg` trên `ProfileDetailDialog` khi `ends_at > NOW()` (double-check để phòng cron lệch).

#### `account_requests` (yêu cầu cấp tài khoản)

```sql
CREATE TABLE account_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    role            user_role DEFAULT 'staff',
    department_id   UUID REFERENCES departments(id),
    status          TEXT DEFAULT 'pending',      -- "pending" | "approved" | "rejected"
    created_at      TIMESTAMPTZ DEFAULT NOW()
    -- ⚠️ Cột `password` plaintext đã bị DROP ở migration_security_and_integrity.sql
);
```

INSERT public (form `/register`), SELECT + UPDATE chỉ `admin`.

---

## 5. Index list đầy đủ

| Index | Table | Mục đích |
|-------|-------|----------|
| `idx_documents_current_assignee` | documents (`current_assignee_id`) | Tab "Đang giữ" lọc theo current_assignee |
| `idx_documents_creator` | documents (`creator_id`) | Lọc theo creator |
| `idx_documents_status` | documents (`status`) | Filter theo status |
| `idx_handovers_doc_sent` | document_handovers (`document_id, sent_at DESC`) | Timeline truy vết hồ sơ — query nhanh nhất |
| `idx_handovers_receiver_pending` | document_handovers (`receiver_id`) WHERE status='PENDING' | Inbox "chờ tôi nhận" — partial index |
| `idx_schedules_driver_status` | schedules (`driver_id, type, status`) | Workspace lái xe |
| `idx_schedules_department_start` | schedules (`department_id, start_time`) | Lịch theo phòng theo ngày |
| `idx_schedules_end_time` | schedules (`end_time`) | Conflict detection |
| `idx_schedules_room` | schedules (`room_id, start_time`) | Conflict phòng họp |
| `idx_schedules_vehicle` | schedules (`vehicle_id, start_time`) | Conflict xe |
| `idx_tasks_department_status` | tasks (`department_id, status`) | Tasks theo phòng |
| `idx_tasks_assignee` | tasks (`assignee_id`) | Tasks được giao cho tôi |
| `idx_tasks_created_by` | tasks (`created_by`) | Tasks tôi tạo |
| `idx_notifications_user_created` | notifications (`user_id, created_at DESC`) | Inbox notifications mới nhất |
| `idx_schedule_participants_profile` | schedule_participants (`profile_id`) | Lịch tôi tham gia |
| `idx_tasks_active_status` | tasks (`is_archived, status`) WHERE `is_archived = FALSE` | Dashboard + tasks_dashboard — quét task active nhanh hơn (partial index) |
| `idx_task_assignees_task` | task_assignees (`task_id`) | Dashboard_summary CTE + tasks_dashboard — lookup assignee theo task |
| `idx_handovers_receiver_status` | document_handovers (`receiver_id, status`) | Handover inbox + dashboard_summary pending_docs — lọc theo receiver + status |

---

## 6. Foreign Key behavior (CASCADE / SET NULL / RESTRICT)

| Bảng con → Bảng cha | Behavior | Lý do |
|---------------------|----------|-------|
| `profiles.id → auth.users.id` | `ON DELETE CASCADE` | Xoá auth user → xoá profile (đảm bảo nhất quán Auth ↔ App) |
| `profiles.department_id → departments.id` | mặc định (NO ACTION) | Tránh xoá phòng khi còn nhân viên |
| `documents.creator_id → profiles.id` | `ON DELETE RESTRICT` | **Không cho xoá user còn tạo hồ sơ** (bảo toàn lịch sử) |
| `documents.current_assignee_id → profiles.id` | `ON DELETE SET NULL` | Xoá user → hồ sơ trở thành "vô chủ" để admin reassign |
| `documents.category_id → document_categories.id` | `ON DELETE SET NULL` | Xoá nhóm hồ sơ → hồ sơ giữ lại nhưng mất phân loại |
| `document_handovers.document_id → documents.id` | `ON DELETE CASCADE` | Xoá hồ sơ → xoá toàn bộ lịch sử handover |
| `document_handovers.sender_id/receiver_id → profiles.id` | `ON DELETE RESTRICT` | **Không cho xoá user còn dấu vết handover** |
| `task_comments.task_id → tasks.id` | `ON DELETE CASCADE` | Xoá task → xoá comments |
| `task_comments.user_id → profiles.id` | mặc định | (NB: hơi lệch — nên restrict để giữ history) |
| `schedule_participants.* → schedules/profiles` | `ON DELETE CASCADE` | Xoá schedule hoặc user → xoá row trung gian |
| `schedules.driver_id → profiles.id` | `ON DELETE SET NULL` | Xoá driver → lịch còn nhưng mất phân công |
| `notifications.user_id → profiles.id` | `ON DELETE CASCADE` | Xoá user → xoá inbox của họ |
| `push_subscriptions.user_id → profiles.id` | `ON DELETE CASCADE` | Xoá user → xoá subscription |
| `vehicles.driver_id → profiles.id` | `ON DELETE SET NULL` | Tài xế nghỉ → xe vẫn còn, mất chuyên trách |

> **Quy tắc chung của project**: Bảng log/lịch sử (`document_handovers`, có thể `task_comments`) dùng `RESTRICT` để không mất dấu vết. Bảng trung gian (`schedule_participants`) dùng `CASCADE` để dọn rác. Bảng "ai đang giữ" (`current_assignee_id`, `driver_id`) dùng `SET NULL` để admin còn cơ hội reassign.

---

## 7. Triggers & Functions

### 7.1 Triggers

| Trigger | Bảng | When | Function | Tác dụng |
|---------|------|------|----------|----------|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Auto-create row trong `profiles` (role mặc định `staff`, `is_active = FALSE` theo migration mới) |
| `trg_documents_short_code` | `documents` | BEFORE INSERT | `generate_document_short_code()` | Sinh `short_code = HS-YYYYMMDD-NNN`. Có `pg_advisory_xact_lock` chống race + `SECURITY DEFINER` để bypass RLS đếm chính xác |
| `trg_documents_touch_updated` | `documents` | BEFORE UPDATE | `touch_documents_updated_at()` | Set `updated_at = NOW()` tự động |
| `guard_tasks_update_trigger` | `tasks` | BEFORE UPDATE | `guard_tasks_update()` | **Chặn staff/assignee đổi ownership** (`created_by`, `assignee_id`, `title`, `due_date`, `priority`, `target_value`, `department_id`). Chỉ cho phép họ update `progress`, `status`, `current_value`, `metadata` |

### 7.2 Helper functions (`STABLE SECURITY DEFINER` — cache trong query plan)

Cache role/department của caller để **mọi RLS policy gọi 1 query duy nhất** thay vì lặp `SELECT FROM profiles` — tối ưu performance lớn:

```sql
public.current_user_role()         -- RETURNS text
public.current_user_department()   -- RETURNS uuid
public.current_user_is_head()      -- RETURNS boolean
```

Định nghĩa: `migration_rls_optimize.sql §1`. Granted `EXECUTE` cho role `authenticated`.

### 7.3 RLS helper (`SECURITY DEFINER` — bẻ vòng đệ quy)

`documents` ↔ `document_handovers` có policy chéo nhau → recursion error `42P17`. Bẻ vòng bằng 2 helper bypass RLS:

```sql
user_is_in_document_handovers(p_doc_id, p_user_id)  -- RETURNS BOOLEAN
user_is_document_creator(p_doc_id, p_user_id)        -- RETURNS BOOLEAN
```

Định nghĩa: `migration_handover_module.sql §11a` + `migration_handover_rls_fix.sql`.

Tương tự cho nội dung đơn nghỉ phép:

```sql
public.can_view_leave_detail(p_schedule_id)  -- RETURNS BOOLEAN
public.get_leave_safe(p_schedule_id)         -- RPC client gọi để lấy detail có check quyền
```

Định nghĩa: `migration_leave_privacy.sql`.

### 7.4 Maintenance function

```sql
public.auto_archive_and_cleanup()     -- RETURNS void
public.cleanup_expired_ooo()          -- RETURNS integer (số row bị xoá)
public.complete_finished_schedules()  -- RETURNS integer (số lịch auto-completed)
```

- `auto_archive_and_cleanup()`:
  - Archive task `done`/`closed` quá 60 ngày (`is_archived = true`).
  - DELETE notifications quá 30 ngày.
- `cleanup_expired_ooo()` (Phase 2): DELETE `out_of_office WHERE ends_at < NOW()` — trả về số row đã xoá.
- `complete_finished_schedules()`: UPDATE lịch `meeting/event/leave` không xe từ `approved` sang `completed` sau `end_time + 15 phút`; không đụng lịch `trip`, lịch `use_vehicle`, `vehicle_id` hoặc `driver_id`.
- Các maintenance RPC được cron Vercel `/api/cron/notifications` gọi hằng ngày 8:00 ICT; riêng `complete_finished_schedules()` còn được gọi fallback khi client fetch lịch.

---

## 8. RPC list đầy đủ (các callable từ `supabase.rpc(...)`)

### 8.1 Hồ sơ vật lý (handover)

| RPC | Params | Returns | Caller có thể là | Mục đích |
|-----|--------|---------|------------------|----------|
| `transfer_document` | `p_document_id UUID, p_receiver_id UUID, p_note TEXT` | `UUID` (handover id) | creator (lần đầu) hoặc current_assignee | Chuyển hồ sơ — insert handover PENDING + status `PENDING_RECEIPT` + notification |
| `acknowledge_document` | `p_handover_id UUID` | `VOID` | receiver của handover | Nhận hồ sơ — status `IN_REVIEW`, update `current_assignee_id` |
| `reject_document` | `p_handover_id UUID, p_reason TEXT` | `VOID` | receiver của handover | Trả về sender — status `RETURNED`, revert `current_assignee_id` |
| `complete_document` | `p_document_id UUID` | `VOID` | current_assignee | Đóng luồng — status `COMPLETED` |

### 8.2 Công việc (Tasks — 2 luồng A/B)

| RPC | Params | Returns | Caller có thể là | Mục đích |
|-----|--------|---------|------------------|----------|
| `task_create` | `p_title, p_description, p_task_type, p_priority, p_due_date, p_dept_id, p_assignee_ids UUID[], p_metadata JSONB, p_requires_approval BOOLEAN, p_batch_id UUID` | `UUID` (task id) | admin/director (mọi cán bộ) — manager (phòng mình + qua phòng) — staff hub (Luồng B + qua phòng) — staff non-hub (chỉ tự ghi chú) | Tạo task ad-hoc. Auto-fill TP làm assignee khi giao qua phòng (assignees rỗng + dept non-null). Block hub user khỏi cá nhân cross-dept (phải chọn "Cả phòng ban") |
| `task_update_status` | `p_task_id UUID, p_new_status task_status, p_comment TEXT` | `VOID` | assignee (cho `doing/submitted`); TP cùng phòng + admin/director (cho duyệt); creator + admin (cho reopen `done → doing`) | Chuyển trạng thái + audit comment `[Hệ thống]` vào timeline. Không cho hoàn thành trực tiếp từ `todo`; phải `todo → doing → done` |
| `task_delegate` | `p_task_id UUID, p_new_assignee_ids UUID[]` | `VOID` | TP cùng phòng + admin/director | Phân công lại (Luồng B). Replace `task_assignees` + denote `assignee_id` (primary) + notification |
| `task_edit` | `p_task_id UUID, p_title TEXT, p_description TEXT, p_priority task_priority, p_due_date TIMESTAMPTZ` | `VOID` | creator + admin/director (không cho khi canceled/archived) | Sửa nội dung. Field bất biến (dept/assignee/task_type/requires_approval) phải đi qua RPC chuyên biệt |
| `task_delete_draft` | `p_task_id UUID` | `VOID` | creator (status=todo, 0 comment user, 0 file, ≤10 phút sau tạo) | Escape hatch xoá nháp ngay sau tạo |
| `task_extension_request_create` | `p_task_id UUID, p_new_due_date TIMESTAMPTZ, p_reason TEXT` | `UUID` (request id) | assignee | Xin gia hạn (status=`pending`) |
| `task_extension_request_decide` | `p_request_id UUID, p_approve BOOLEAN, p_comment TEXT` | `VOID` | TP cùng phòng + admin/director + creator task | Duyệt / từ chối + (nếu approve) cập `tasks.due_date` |
| `recurring_template_upsert` | `p_id UUID, p_title, p_description, p_task_type, p_priority, p_target_department_ids UUID[], p_target_user_ids UUID[], p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time, p_timezone, p_due_days_after_fire INT, p_is_active BOOLEAN, p_default_assignee_id UUID` | `UUID` (template id) | cùng matrix `task_create` | Tạo / cập template định kỳ. Tính `next_run_at` từ schedule. `default_assignee_id` override TP mặc định |
| `recurring_template_set_active` | `p_id UUID, p_is_active BOOLEAN` | `VOID` | creator + admin/director | Bật/tắt template |
| `recurring_template_fire_now` | `p_id UUID` | `UUID` (task id sinh ra) | creator + admin/director | Fire thủ công 1 lần (test) — không đụng `next_run_at` |
| `recurring_fire_due` | — | `INTEGER` (số task sinh) | service role (cron) | Worker quét template due → sinh task. Áp đúng matrix scope như ad-hoc qua `_resolve_default_assignee` |
| `tasks_analytics` | `p_from TIMESTAMPTZ, p_to TIMESTAMPTZ, p_department_id UUID` | TABLE(các metric) | admin/director (toàn nhánh) — manager (phòng mình hoặc toàn nhánh nếu Coordinator) — staff Coordinator (toàn nhánh) | Số liệu Analytics: SLA, overdue, breakdown by status/priority/dept |

**Helper nội bộ (SECURITY DEFINER, không expose ra client):**

| Function | Returns | Mục đích |
|---|---|---|
| `_is_hub_department(p_dept_id UUID)` | `BOOLEAN` | True nếu dept thuộc 5 mã hub (13618/13602/13605/13609/13603). Single source cho cả backend và `isHubDepartment(profile)` ở client |
| `_resolve_default_assignee(p_dept_id UUID, p_override UUID)` | `UUID` | Resolve assignee mặc định: override > TP `is_department_head=true` > manager active đầu tiên. Dùng chung bởi `task_create` (auto-fill TP) và `recurring_fire_due` |
| `_recurring_next_run(p_kind TEXT, p_weekly_dow INT, p_weekly_time TEXT, p_monthly_dom INT, p_monthly_time TEXT, p_tz TEXT, p_now TIMESTAMPTZ)` | `TIMESTAMPTZ` | Tính `next_run_at` cho template — Asia/Ho_Chi_Minh anchored |

### 8.3 Lịch trình + nghỉ phép + danh bạ

| RPC | Params | Returns | Caller có thể là | Mục đích |
|-----|--------|---------|------------------|----------|
| `check_schedule_participant_conflicts` | `p_participant_ids UUID[], p_start TIMESTAMPTZ, p_end TIMESTAMPTZ, p_ignore_schedule_id UUID` | TABLE(`schedule_id, title, start_time, end_time, status, profile_id, full_name`) | bất kỳ authenticated | Kiểm tra xung đột lịch trước khi tạo |
| `get_leave_safe` | `p_schedule_id UUID` | TABLE(schedule + creator info) hoặc empty | bất kỳ authenticated | Lấy detail đơn nghỉ phép với check quyền nội dung (kết hợp `can_view_leave_detail`) |
| `current_user_role` | — | `TEXT` | bất kỳ authenticated | Helper cached cho RLS (cũng gọi được từ client) |
| `current_user_department` | — | `UUID` | bất kỳ authenticated | Helper cached cho RLS |
| `current_user_is_head` | — | `BOOLEAN` | bất kỳ authenticated | Helper cached cho RLS |
| `complete_finished_schedules` | — | `INTEGER` | authenticated hoặc service role | Auto-complete lịch `meeting/event/leave` không xe sau `end_time + 15 phút`; dùng bởi cron + fallback fetch lịch |

### 8.4 Maintenance (cron)

| RPC | Params | Returns | Caller có thể là | Mục đích |
|-----|--------|---------|------------------|----------|
| `auto_archive_and_cleanup` | — | `VOID` | gọi qua cron (service role) | Archive task cũ + xoá notification cũ |
| `cleanup_expired_ooo` | — | `INTEGER` | gọi qua cron (service role) | Xoá row `out_of_office` đã hết hạn — trả về số row đã xoá |
| `complete_finished_schedules` | — | `INTEGER` | cron service role + authenticated fallback | Auto-complete lịch họp/sự kiện/nghỉ phép không xe quá end_time 15 phút |

> **Pattern client gọi RPC** (xem `ARCHITECTURE.md §6.3`):
>
> ```ts
> const { data, error } = await supabase.rpc("transfer_document", {
>   p_document_id: documentId,
>   p_receiver_id: receiverId,
>   p_note: note,
> });
> if (error) return { ok: false, error: error.message };
> return { ok: true, handoverId: data as string };
> ```

---

## 9. Mô hình luân chuyển & SLA

### 9.1 Truy vết qua `document_handovers`

Hồ sơ vật lý không bao giờ "biến mất khỏi DB". Mỗi lần "Chuyển" → "Nhận" tạo ra **1 row** trong `document_handovers`. Đọc theo `sent_at DESC` cho 1 `document_id` ra **toàn bộ timeline truy vết**:

```
HS-20260524-007 — "Hồ sơ vay tiêu dùng KH Nguyễn Văn A"
─────────────────────────────────────────────────────────
▼ 09:15 24/05 — Khởi tạo (creator=RM Lan), status=DRAFT
▼ 09:20 ── Chuyển: Lan → KSV Hùng (handovers[0]: PENDING)
▼ 09:42 ── Nhận: Hùng xác nhận (handovers[0]: ACCEPTED)
            → status=IN_REVIEW, current_assignee=Hùng
▼ 14:30 ── Chuyển: Hùng → TP Nam (handovers[1]: PENDING)
▼ 15:05 ── Trả về: Nam reject "Thiếu CMND" (handovers[1]: REJECTED)
            → status=RETURNED, current_assignee=Hùng (revert)
▼ 16:00 ── Chuyển lại: Hùng → TP Nam (handovers[2]: PENDING)
▼ 16:12 ── Nhận: Nam xác nhận (handovers[2]: ACCEPTED)
            → status=IN_REVIEW, current_assignee=Nam
▼ 17:30 ── Hoàn thành (current_assignee=Nam đóng)
            → status=COMPLETED, completed_at=NOW()
```

Component [`HandoverTimeline.tsx`](src/app/dashboard/handover/_components/HandoverTimeline.tsx) render đúng dòng thời gian này. Index `idx_handovers_doc_sent (document_id, sent_at DESC)` giúp query timeline siêu nhanh.

### 9.2 Tính SLA — "thời gian giữ hồ sơ trên bàn"

Logic ở [`src/app/dashboard/handover/_lib/sla.ts`](src/app/dashboard/handover/_lib/sla.ts):

| Bước | Logic |
|------|-------|
| 1 | Chỉ tính SLA cho `status IN ('IN_REVIEW', 'PENDING_RECEIPT')`. Trạng thái khác → không tính |
| 2 | **Mốc bắt đầu**: `received_at` lớn nhất trong handovers `ACCEPTED`. Nếu chưa có → fallback `documents.created_at` |
| 3 | `elapsedHours = (now - startedAt) / 3600` |
| 4 | `usedPercent = elapsedHours / category.sla_hours` |
| 5 | 3 mức badge: `safe` (<70%) / `warn` (70–100%) / `danger` (≥100%) |
| 6 | `remainingHours = sla_hours - elapsedHours` (âm = quá hạn) |

**Ý nghĩa nghiệp vụ**: SLA **reset mỗi lần đổi bàn**. Người mới nhận có quyền 8h/24h/48h riêng (theo category). Hồ sơ chạy qua 5 bàn → 5 "đồng hồ SLA" riêng, không cộng dồn.

### 9.3 Mã ngắn `HS-YYYYMMDD-NNN`

Sinh tự động bằng trigger `BEFORE INSERT ON documents`:

- Sequence reset mỗi ngày.
- **`pg_advisory_xact_lock(hashtext('document_short_code_' || YYYYMMDD))`** — chống race khi nhiều người tạo cùng giây.
- **`SECURITY DEFINER`** (`migration_handover_short_code_fix_2.sql`) — bypass RLS để `MAX()` thấy hồ sơ của người khác cùng ngày. Nếu thiếu cờ này → tất cả cùng sinh `-001` → duplicate key.

---

## 10. Dynamic Form / JSONB — Thực trạng

> **Trung thực**: dự án **KHÔNG có** bảng `ticket_templates` hay cột `form_data` để build Dynamic Form Engine. Mọi form đều render từ React component tĩnh, lưu vào cột Postgres có schema cố định.

Có **2 cột `metadata JSONB`** đóng vai trò "extension point":

### 10.1 `tasks.metadata`

Use case chính: **multi-assignee theo dây chuyền**.

```jsonc
{
  "assigned_line": [
    "uuid-RM",
    "uuid-KSV",
    "uuid-TP",
    "uuid-PGD"
  ]
}
```

RLS đọc trực tiếp cờ này:

```sql
OR (
  metadata->>'assigned_line' IS NOT NULL
  AND auth.uid()::text = ANY(
    ARRAY(SELECT jsonb_array_elements_text(metadata->'assigned_line'))
  )
)
```

### 10.2 `schedules.metadata`

Use case chính: **driver trip workflow**.

```jsonc
{
  "start_km": 12050,
  "end_km": 12180,
  "actual_distance": 130
}
```

Workspace lái xe (`DriverDashboard.tsx`) update trực tiếp các field này khi user bấm "Bắt đầu chuyến" / "Kết thúc chuyến".

### 10.3 Khi nào nên dùng JSONB vs cột riêng

| JSONB phù hợp | Cột riêng phù hợp |
|---------------|-------------------|
| Field sparse (chỉ 5% record có) | Field dày (≥50% record có) |
| Schema thay đổi nhanh khi explore | Schema ổn định |
| Không cần index B-tree, query ít | Cần index, sort, filter mạnh |
| Mảng/object lồng nhau | Scalar đơn giản |

**Kết luận**: dự án dùng JSONB **đúng mức**. Nếu cần thật sự "Dynamic Form Engine" trong tương lai → thêm bảng `ticket_templates(id, name, schema JSONB)` + `tickets(template_id, form_data JSONB)`. Hiện chưa có.

---

## 11. Row Level Security (RLS) Strategy

### 11.1 Bảng phân loại

| Loại bảng | Strategy SELECT | Strategy mutation |
|-----------|----------------|-------------------|
| **Public read** (`departments`, `rooms`, `vehicles`, `recognitions`, `task_comments`, `schedule_participants`) | `USING (true)` cho mọi authenticated | Write: theo role (admin/secretary/bộ phận điều phối) |
| **Owner-only** (`notifications`, `push_subscriptions`) | `USING (auth.uid() = user_id)` | Tương tự — chỉ owner |
| **Quan hệ + role** (`documents`, `document_handovers`, `tasks`, `schedules`) | Phối hợp: creator + assignee + participant + role (admin/director; riêng schedules điều phối chỉ thấy lịch có xe) | INSERT theo role, UPDATE qua RPC |
| **Admin-only** (`account_requests`, `document_categories`) | `current_user_role() = 'admin'` | Toàn quyền chỉ admin |
| **Mutation chỉ qua RPC** (`document_handovers`, cột `status`/`current_assignee_id` của `documents`) | `INSERT WITH CHECK (false)` chặn direct | Buộc đi qua RPC `SECURITY DEFINER` |

### 11.2 Phân quyền tầm nhìn hồ sơ (`documents` SELECT)

```sql
CREATE POLICY "Documents read access" ON documents FOR SELECT
USING (
    creator_id = auth.uid()                              -- (1) Tôi là người tạo
    OR current_assignee_id = auth.uid()                  -- (2) Tôi đang giữ bản cứng
    OR (SELECT role FROM profiles WHERE id = auth.uid())
        IN ('admin', 'director')                         -- (3) Admin / BGĐ
    OR user_is_in_document_handovers(id, auth.uid())     -- (4) Tôi đã từng tham gia
);
```

**Diễn giải**:

- **RM (staff)**: chỉ thấy hồ sơ của mình (creator hoặc current_assignee) + chặng đã tham gia. Không thấy hồ sơ phòng khác.
- **BGĐ (`director`) + admin**: thấy **toàn bộ** hồ sơ chi nhánh (read-only truy vết).
- **Role khác** (`manager`, `secretary`, `hr_officer`, `driver`): chỉ thấy nếu tham gia trực tiếp. `driver` còn bị chặn UI module này.

### 11.3 Phân quyền sửa trạng thái

| Thao tác | Cơ chế |
|----------|--------|
| **INSERT documents** | `WITH CHECK (auth.uid() IS NOT NULL AND creator_id = auth.uid())` — chống mạo danh |
| **UPDATE ảnh** (`attached_image_urls`) | `USING (creator_id = auth.uid() OR current_assignee_id = auth.uid())` |
| **UPDATE status/assignee/completed_at** | RLS không cho phép trực tiếp — buộc gọi RPC `transfer_document`/`acknowledge_document`/`reject_document`/`complete_document` (SECURITY DEFINER tự validate) |
| **INSERT document_handovers** | `WITH CHECK (false)` — chặn hoàn toàn, chỉ qua RPC |

### 11.4 Tasks RLS (sau `migration_rls_optimize.sql`)

```sql
CREATE POLICY "Tasks read access" ON tasks FOR SELECT
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR (metadata->>'assigned_line' IS NOT NULL
      AND auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(metadata->'assigned_line'))))
);
```

Update tương tự, kết hợp với **trigger `guard_tasks_update`** để chặn staff đổi ownership.

### 11.5 Schedules RLS

```sql
-- SELECT: creator + cùng phòng + participant + admin + lịch có BGĐ public + điều phối nếu use_vehicle=true + driver_id được gán
-- UPDATE: creator + admin + điều phối nếu use_vehicle=true + driver_id được gán
-- DELETE: cấm khi status = 'in_progress'; còn lại cho creator + admin/sec/hr/director/điều phối
```

Quy tắc nghiệp vụ hiện hành:
- Nếu lịch không có BGĐ tham gia thì chỉ creator, participant, cùng phòng hoặc admin được xem.
- Nếu lịch có BGĐ tham gia hoặc creator là BGĐ thì public toàn chi nhánh để mọi phòng nắm lịch lãnh đạo.
- Bộ phận điều phối/secretary chỉ xem và cập nhật lịch ngoài scope cá nhân/phòng khi `use_vehicle=true`; nếu lịch không cần xe thì điều phối không được xem chỉ vì role điều phối.
- Nếu `use_vehicle=true` thì lịch ở `pending` để chờ điều phối gán xe. Khi bộ phận điều phối chọn `vehicle_id` từ `vehicles`, `driver_id` lấy theo `vehicles.driver_id`, số điện thoại lái xe lấy từ `profiles.phone`, và schedule chuyển thẳng sang `approved` — không có bước phê duyệt riêng sau điều phối.
- Driver chỉ xem/cập nhật chuyến có `schedules.driver_id = auth.uid()`.

Riêng nội dung đơn nghỉ phép (`type='leave'`): payload có `description`/`title` chỉ trả về cho user pass check `can_view_leave_detail()`:

- Chủ đơn → luôn xem.
- `admin`/`hr_officer`/`director` → luôn xem.
- `manager` cùng phòng (có điều kiện `is_department_head` + cấp tương đương).
- Còn lại → trả empty fields.

### 11.6 Profiles RLS (sau `migration_rls_optimize.sql`)

```sql
CREATE POLICY "Users can view profiles in scope" ON profiles FOR SELECT
USING (
  id = auth.uid()                                          -- (1) Tự xem mình
  OR public.current_user_role() IN ('admin', 'director',
                                     'hr_officer', 'secretary')   -- (2) Role có toàn quyền
  OR department_id = public.current_user_department()       -- (3) Cùng phòng
  OR role = 'director'                                      -- (4) BGĐ public toàn cb
  OR role = 'driver'                                        -- (5) Driver public (để bộ phận điều phối gán)
  OR EXISTS (                                                -- (6) Cùng tham gia ≥ 1 schedule
    SELECT 1 FROM schedule_participants sp1
    JOIN schedule_participants sp2 ON sp1.schedule_id = sp2.schedule_id
    WHERE sp1.profile_id = profiles.id AND sp2.profile_id = auth.uid()
  )
);
```

> **Lưu ý**: trước đó policy là `SELECT USING (true)` cho mọi user — đã siết lại để bảo vệ thông tin nhân sự.

### 11.7 Lỗi đệ quy RLS (`error 42P17`)

`documents` policy gọi EXISTS qua `document_handovers`, mà policy của `document_handovers` lại gọi EXISTS qua `documents` → recursion infinite. Fix:

- Tạo 2 helper `SECURITY DEFINER` (`user_is_in_document_handovers`, `user_is_document_creator`) → các function này bỏ qua RLS → an toàn dùng trong policy.

---

## 12. Storage & Cronjobs

### 12.1 Storage Buckets

| Bucket | Public | Dùng cho | Path convention | Policies |
|--------|--------|----------|-----------------|----------|
| `avatars` | ✅ public read | Ảnh đại diện user | `<auth.uid>/<file>` | Public SELECT; user upload/update vào folder = uuid của mình |
| `documents` | ✅ public read | Ảnh đính kèm hồ sơ vật lý | `<documentId>/<timestamp>-<n>.<ext>` | Public SELECT; authenticated INSERT |

Bảo mật bucket `documents`: dựa vào path có UUID khó đoán + intranet only (không expose URL ra ngoài). Nếu cần private + RLS storage object thì phải thêm policy `bucket_id='documents' AND auth.uid() IS NOT NULL` (xem comment cuối `migration_handover_module.sql §13`).

### 12.2 Image upload pipeline (client-side)

1. User chọn ảnh → input file.
2. **`browser-image-compression`** nén: `maxSizeMB=1`, `maxWidthOrHeight=1920`, `useWebWorker=true`.
3. Upload qua `supabase.storage.from('documents').upload(...)`.
4. `getPublicUrl()` → push URL vào mảng `documents.attached_image_urls`.
5. Giới hạn 10 ảnh/hồ sơ (`MAX_IMAGES_PER_DOCUMENT`).

### 12.3 Cronjobs

| Job | Lịch | Nơi chạy | Tác dụng |
|-----|------|----------|----------|
| `/api/cron/notifications` | `0 8 * * *` daily 8:00 ICT (`vercel.json`) | Vercel cron, dùng `SUPABASE_SERVICE_ROLE_KEY` | (1) `auto_archive_and_cleanup()` + quét task quá hạn → notification. (2) Chúc mừng sinh nhật **toàn chi nhánh** (trừ driver / `birthday_notify_optout=true` / chính chủ). (3) Anniversary 5/10/15/20 năm gắn bó. (4) `cleanup_expired_ooo()`. Bảo vệ bằng `CRON_SECRET` header |
| Edge `cleanup-document-images` | `0 19 * * *` UTC = 02:00 ICT | Supabase Edge (Deno) | Quét `documents` `status=COMPLETED AND completed_at < NOW() - 30 days` → xoá file storage + clear URLs. Giới hạn 200 hồ sơ/lượt |
| Edge `push-notification` | Trigger qua DB webhook (không phải cron) | Supabase Edge | INSERT `notifications` → đọc `push_subscriptions` → fire Web Push qua VAPID |

### 12.4 Vòng đời file ảnh

```
T0:                  User upload → bucket documents/<doc_id>/<ts>-<i>.jpg
T0 → T_complete:     Ảnh hiển thị qua public URL trong app
T_complete:          Bấm "Hoàn thành" → status=COMPLETED, completed_at=NOW()
T_complete + 30d:    Edge function nightly xoá file + clear URLs
                     → Hồ sơ vẫn còn metadata (timeline) để truy vết
```

---

## 13. Realtime publication

Mỗi page module subscribe 1 Supabase Realtime channel, refetch toàn list khi có insert/update — debounce 250–600ms.

| Channel name | Subscribed tables | Vị trí code |
|--------------|-------------------|-------------|
| `dashboard_sync` | tasks, recognitions, task_comments, schedules, schedule_participants, vehicles, rooms, documents, document_handovers | `src/app/dashboard/page.tsx` |
| `handover_realtime_sync` | documents, document_handovers, document_categories | `useHandover.ts` |
| `schedule_realtime_sync` | schedules, schedule_participants, rooms, vehicles | `useSchedule.ts` |
| `notifications_realtime_<userId>` | notifications (filter `user_id=eq.<userId>`) | `NotificationsDropdown` |
| `task_<id>` / `report_<id>` | tasks, task_comments | tasks `[id]` page |

> ⚠️ Cần **enable Realtime** cho từng bảng trong Supabase Dashboard → Database → Replication. Mặc định Supabase bật `supabase_realtime` publication cho 1 số bảng, **phải bật thêm thủ công** cho: `documents`, `document_handovers`, `notifications` nếu chưa thấy realtime.

---

## 14. Sample queries thông dụng (cho dev)

### 14.1 Promote user thành admin lần đầu

```sql
UPDATE profiles
SET role = 'admin', is_active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@yourbank.vn');
```

### 14.2 Đổi email toàn bộ user thành @vietinbank.vn

Migration file đầy đủ: [`supabase/migration_update_all_emails.sql`](supabase/migration_update_all_emails.sql).

Chạy trong Supabase Dashboard → SQL Editor (bản đầy đủ ở file migration):

```sql
-- Cập nhật auth.users.email (dùng để đăng nhập)
UPDATE auth.users
SET email = SPLIT_PART(email, '@', 1) || '@vietinbank.vn'
WHERE email IS NOT NULL
  AND SPLIT_PART(email, '@', 2) IS DISTINCT FROM 'vietinbank.vn';

-- Cập nhật profiles.ad_account — đã có @ thì đổi domain
UPDATE profiles
SET ad_account = SPLIT_PART(ad_account, '@', 1) || '@vietinbank.vn'
WHERE ad_account IS NOT NULL
  AND ad_account LIKE '%@%'
  AND SPLIT_PART(ad_account, '@', 2) IS DISTINCT FROM 'vietinbank.vn';

-- Cập nhật profiles.ad_account — username thuần (không @) → thêm @vietinbank.vn
UPDATE profiles
SET ad_account = ad_account || '@vietinbank.vn'
WHERE ad_account IS NOT NULL
  AND ad_account NOT LIKE '%@%';
```

> ⚠️ **Lưu ý:** Việc đổi `auth.users.email` không ảnh hưởng tới đăng nhập — user vẫn chỉ gõ username, login page tự thêm `@bank.local` hậu trường. Frontend hiển thị dùng `ad_account` trong `profiles`, đã được cập nhật.
>
> Đã cập nhật đồng bộ 3 file code frontend:
> - `profile/page.tsx` — `@agribank.com.vn` → `@vietinbank.vn`
> - `ProfileDetailDialog.tsx` — `@yourbank.com.vn` → `@vietinbank.vn`
> - `EditProfileDialog.tsx` — placeholder `@agribank.com.vn` → `@vietinbank.vn`

### 14.3 Tìm hồ sơ đang chờ tôi nhận (= Inbox PENDING)

```sql
SELECT d.*, dh.id AS handover_id, dh.sent_at, dh.note,
       sender.full_name AS sender_name
FROM documents d
JOIN document_handovers dh ON dh.document_id = d.id
JOIN profiles sender ON sender.id = dh.sender_id
WHERE dh.receiver_id = auth.uid()
  AND dh.status = 'PENDING'
ORDER BY dh.sent_at DESC;
```

→ Đã có **partial index** `idx_handovers_receiver_pending` hỗ trợ query này.

### 14.3 Timeline truy vết 1 hồ sơ

```sql
SELECT dh.sent_at, dh.received_at, dh.status, dh.note,
       sender.full_name AS sender, receiver.full_name AS receiver
FROM document_handovers dh
JOIN profiles sender ON sender.id = dh.sender_id
JOIN profiles receiver ON receiver.id = dh.receiver_id
WHERE dh.document_id = $1
ORDER BY dh.sent_at;
```

### 14.4 Hồ sơ sắp quá hạn SLA (toàn chi nhánh, chỉ admin/director chạy)

```sql
SELECT d.short_code, d.title, c.name AS category, c.sla_hours,
       p.full_name AS holder,
       EXTRACT(EPOCH FROM (NOW() - GREATEST(d.updated_at, COALESCE(
         (SELECT MAX(received_at) FROM document_handovers
          WHERE document_id = d.id AND status = 'ACCEPTED'), d.created_at
       )))) / 3600 AS elapsed_hours
FROM documents d
JOIN document_categories c ON c.id = d.category_id
LEFT JOIN profiles p ON p.id = d.current_assignee_id
WHERE d.status IN ('IN_REVIEW', 'PENDING_RECEIPT')
ORDER BY elapsed_hours / NULLIF(c.sla_hours, 0) DESC
LIMIT 50;
```

### 14.5 Reset mật khẩu hàng loạt (cẩn thận)

Xem [`migration_reset_passwords.sql`](supabase/migration_reset_passwords.sql) — chạy 1 lần, đổi biến `v_default_password` trước khi run.

### 14.6 Sau mọi migration

```sql
NOTIFY pgrst, 'reload schema';
```

→ Buộc PostgREST refresh schema cache để client thấy được bảng/cột/RPC mới ngay.

---

## 15. Migration order + Backup tips

### 15.1 Thứ tự chạy migration cho setup mới

1. `schema.sql` — snapshot core: profiles, departments, schedules, recognitions, notifications, rooms, vehicles, push_subscriptions, account_requests, `out_of_office`, leaves + RLS + helper RPC + chống spoofing. Các migration cũ (security/integrity/leave-privacy/handover-fixes/RLS-optimize/reset-passwords/drop-kpi/schedule-rejection/team-phase2) đã gộp hết vào snapshot này — không còn file rời.
2. `supabase/migration_handover_module.sql` — module hồ sơ vật lý: categories, documents, handovers, 4 RPC (`transfer/acknowledge/reject/complete`), RLS + short_code generator.
3. `supabase/migration_dashboard_summary_fix_pending_docs.sql` — fix `dashboard_summary` RPC đếm sai pending docs.
4. `supabase/migration_dashboard_counters_batch_aware.sql` — counter dashboard gom theo `batch_id` (1 lần gửi cho N phòng = 1 batch, không phải N task rời).
5. `supabase/migration_tasks_standardize.sql` — module Tasks: schema cốt lõi (tasks + task_assignees + task_comments + task_extension_requests + task_attachments + task_recurring_templates) + 5-state status + Luồng A/B + 9 RPC (`task_create/task_update_status/task_delegate/task_edit/task_extension_*/recurring_template_*/recurring_fire_due/tasks_analytics`).
6. `supabase/migration_tasks_default_assignee.sql` — helper `_resolve_default_assignee` + `_is_hub_department` + auto-fill TP làm assignee mặc định cho cả ad-hoc lẫn recurring (`task_assignees` không bao giờ rỗng).
7. `supabase/migration_tasks_edit_delete.sql` — RPC `task_edit` đầy đủ + cửa sổ xoá nháp 10 phút cho creator.
8. `supabase/migration_task_scope.sql` — ⭐ siết scope quyền giao việc / yêu cầu báo cáo theo phòng đầu mối (hub): cập `task_create` + `recurring_template_upsert` với ma trận 6-role × 2-luồng. Hub user cross-dept phải đi qua "Cả phòng ban" toggle.
9. `supabase/migration_tasks_access_workflow_recurring_fix.sql` — vá access/workflow Tasks: `hr_officer` không xem/tạo task, không giao task cho role ngoài module, backend chặn hoàn thành trực tiếp từ `todo`, reopen chỉ creator/admin, thêm overload `_recurring_next_run` nhận `INT/TEXT`.
10. `supabase/migration_tasks_delete_full.sql` — thay thế xoá nháp bằng hard delete cho creator (bất kể thời gian tạo).
11. `supabase/migration_tasks_force_complete.sql` — thêm tính năng cho phép creator/manager/admin chủ động "Ghi nhận hoàn thành" (force complete) task/report dù assignee chưa nộp.
12. `supabase/migration_tasks_staff_private_note.sql` — fix lỗi bảo mật: gỡ `department_id` khỏi Tự ghi chú của Staff để ẩn khỏi Trưởng phòng.

Sau migration cuối: `NOTIFY pgrst, 'reload schema';`

### 15.2 Backup before destructive migration

> ⚠️ Mọi migration có `DROP TABLE`, `DROP COLUMN`, hoặc `DELETE FROM` quy mô lớn — chạy backup trước:
> 1. Supabase Dashboard → Database → Backups → **Manual snapshot**.
> 2. Export data nếu cần (Table Editor → Export CSV).
>
> `migration_task_scope.sql` chỉ `CREATE OR REPLACE FUNCTION` (idempotent) — không destructive, không cần backup riêng.

### 15.3 Verify sau migration

```sql
-- Đếm bảng tồn tại
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Liệt kê RPC còn lại
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY proname;
-- Liệt kê index
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
-- Liệt kê RLS policy
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
```

### 15.4 Generate types sau migration

```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
```

→ Cập nhật type cho frontend khớp schema mới. Hiện tại file `database.types.ts` là **hand-craft** — sẽ migrate sang gen-from-CLI (xem `ARCHITECTURE.md §6.7`).

---

## 16. Tham chiếu nhanh

| Tài liệu | Nội dung |
|----------|----------|
| [`README.md`](README.md) | Setup, env vars, deploy, troubleshooting |
| [`docs/PRODUCT_OVERVIEW.md`](PRODUCT_OVERVIEW.md) | Bối cảnh + nghiệp vụ + luồng module |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Quy chuẩn code, đặc biệt §6 (Supabase), §6.5 (Realtime), §6.8 (transit state); cũng chứa UI/UX + RLS business rules đã gộp từ `TECHNICAL_RULES.md` cũ |
| [`schema.sql`](schema.sql) | Snapshot DB |
| [`supabase/migration_handover_module.sql`](supabase/migration_handover_module.sql) | ⭐ Mẫu chuẩn migration (RLS + RPC + Trigger) |

---

**Phiên bản:** 1.3 — 2026-05-26 (bổ sung Tasks: `requires_approval` + `batch_id` vào `tasks`; `default_assignee_id` vào `task_recurring_templates`; §8 chia nhóm RPC + thêm 12 RPC Tasks; helper nội bộ `_is_hub_department` / `_resolve_default_assignee`; §15 refresh migration order khớp 7 file thực tế trong `supabase/`).
