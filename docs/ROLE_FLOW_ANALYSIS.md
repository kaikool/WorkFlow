# Phân tích luồng xử lý cho `secretary`, `hr_officer`, `driver`

Tài liệu này mô tả 3 luồng role chuyên biệt trong WorkFlow Portal sau khi tách dashboard theo vai trò. Mục tiêu là tránh dùng một dashboard chung khiến người dùng nhìn thấy chức năng không liên quan.

## 1. `secretary` - TCTH / Điều phối vận hành

### Mục tiêu nghiệp vụ

`secretary` là vai trò điều phối tài nguyên dùng chung của cơ quan: lịch công tác, xe, tài xế, phòng họp và trạng thái vận hành. Role này không xử lý `tasks` thường ngày và không cần route `/dashboard/tasks`.

### Màn hình chính

Khi vào `/dashboard`, `secretary` nên thấy dashboard điều phối:

- Danh sách lịch cần xử lý: lịch `pending`, lịch có yêu cầu xe nhưng chưa gán xe.
- Tóm tắt tài nguyên hôm nay: xe đang có lịch, phòng đang có lịch, tổng lịch cần theo dõi.
- Timeline Ban Giám đốc để biết lãnh đạo đang ở chi nhánh, đi công tác hoặc có lịch họp.
- Giám sát đội xe và phòng họp qua `TcthDashboard`.

Route phụ vẫn cần:

- `/dashboard/schedule`: thao tác lịch đầy đủ.
- `/dashboard/admin`: quản lý danh mục xe/phòng nếu có quyền.
- `/dashboard/profile`: hồ sơ cá nhân.

Route không nên hiển thị:

- `/dashboard/tasks`
- `/dashboard/kpi`

### Luồng xử lý chính

1. Nhân viên hoặc lãnh đạo tạo lịch có yêu cầu xe/phòng.
2. Lịch có trạng thái `pending`, hoặc chưa có `vehicle_id` nếu cần xe.
3. `secretary` nhận thông báo điều phối.
4. `secretary` mở dashboard hoặc `/dashboard/schedule`.
5. `secretary` kiểm tra xung đột xe/phòng/người tham gia.
6. `secretary` gán xe, gán tài xế, duyệt hoặc từ chối lịch.
7. Người tạo lịch và người tham gia liên quan nhận thông báo kết quả.
8. Nếu tài xế bắt đầu/kết thúc chuyến lệch lịch, hoặc báo sự cố xe, `secretary` nhận thông báo để xử lý vận hành.

### Dữ liệu cần đọc/ghi

- Đọc/ghi `schedules` cho lịch điều phối.
- Đọc/ghi `vehicles`, `rooms` cho tài nguyên dùng chung.
- Đọc `profiles` để chọn tài xế, người tham gia, lãnh đạo.
- Ghi `notifications` khi duyệt, từ chối, gán xe hoặc thay đổi lịch.

## 2. `hr_officer` - Nhân sự / Nghỉ phép

### Mục tiêu nghiệp vụ

`hr_officer` là role nhân sự. Role này chỉ tập trung vào hồ sơ cán bộ và nghỉ phép. Không can thiệp vào điều phối xe/phòng, không xử lý `tasks`, không quản lý KPI.

### Màn hình chính

Khi vào `/dashboard`, `hr_officer` nên thấy dashboard nhân sự:

- Số đơn nghỉ phép chờ duyệt.
- Số cán bộ đang nghỉ hôm nay.
- Tổng số cán bộ.
- Danh sách đơn nghỉ phép cần xử lý qua `LeaveApprovalDashboard`.
- Lối vào danh sách cán bộ `/dashboard/team`.

Route phụ cần:

- `/dashboard/team`: xem hồ sơ nhân sự toàn cơ quan.
- `/dashboard/schedule`: nếu cần vào tab phê duyệt nghỉ phép đầy đủ.
- `/dashboard/profile`: hồ sơ cá nhân.

Route không nên hiển thị:

- `/dashboard/tasks`
- `/dashboard/kpi`
- `/dashboard/admin` nếu admin page chủ yếu là xe/phòng/system.

### Luồng xử lý chính

1. Cán bộ tạo đơn nghỉ phép.
2. Hệ thống gửi thông báo cho đúng tuyến duyệt: lãnh đạo phòng, Ban Giám đốc nếu cần, và HR theo quy trình nghỉ phép.
3. `hr_officer` mở dashboard nhân sự.
4. `hr_officer` xem danh sách đơn nghỉ phép chờ duyệt.
5. `hr_officer` phê duyệt hoặc từ chối đơn.
6. Người tạo đơn nhận thông báo kết quả.
7. Lịch nghỉ phép được phản ánh vào timeline/lịch để các role khác biết trạng thái vắng mặt, nhưng HR không nhận các thông báo xe/phòng.

### Dữ liệu cần đọc/ghi

- Đọc `profiles`, `departments` phục vụ hồ sơ nhân sự.
- Đọc/ghi `schedules` với `type = 'leave'`.
- Ghi `notifications` cho kết quả xử lý đơn nghỉ phép.

### Giới hạn bắt buộc

- Không nhận thông báo điều phối xe/phòng.
- Không nhận thông báo quyết toán hành trình xe.
- Không nhận thông báo báo cáo sự cố xe.
- Không nhận quyền duyệt lịch công tác thường.
- Không nhận quyền quản lý xe/phòng.

## 3. `driver` - Tài xế

### Mục tiêu nghiệp vụ

`driver` chỉ cần xử lý lịch chạy xe được phân công. Trải nghiệm phải tối giản, đặc biệt trên mobile.

### Màn hình chính

Khi vào `/dashboard`, `driver` nên thấy dashboard chạy xe:

- Lịch chạy xe của tôi.
- Xe được gán, địa điểm, thời gian đi/về.
- Nút bắt đầu chuyến.
- Nút kết thúc chuyến.
- Nhập km xuất phát và km kết thúc.
- Báo cáo sự cố xe.
- Xem các xe khác đang hoạt động nếu cần phối hợp.

Route phụ cần:

- `/dashboard/schedule`: xem lịch chạy đầy đủ.
- `/dashboard/profile`: hồ sơ cá nhân.

Route không nên hiển thị:

- `/dashboard/tasks`
- `/dashboard/kpi`
- `/dashboard/team`
- `/dashboard/admin`

### Luồng xử lý chính

1. `secretary` gán tài xế vào lịch công tác cần xe.
2. Tài xế nhận thông báo được phân công.
3. Tài xế mở dashboard.
4. Khi bắt đầu chuyến, tài xế nhập km xuất phát.
5. Hệ thống cập nhật lịch sang `in_progress`.
6. Nếu giờ xuất phát lệch ngưỡng, hệ thống thông báo cho TCTH, không thông báo cho HR.
7. Khi kết thúc chuyến, tài xế nhập km kết thúc.
8. Hệ thống tính quãng đường thực tế, cập nhật lịch sang `completed`.
9. Hệ thống gửi thông báo quyết toán hành trình cho TCTH, không gửi HR.
10. Nếu có sự cố xe, tài xế báo cáo sự cố. TCTH nhận thông báo xử lý, HR không nhận.

### Dữ liệu cần đọc/ghi

- Đọc `schedules` được gán `driver_id` hoặc có tài xế trong participants.
- Ghi `schedules.status`, `schedules.metadata.start_km`, `end_km`, `actual_distance`, `vehicle_issue`.
- Có thể ghi `vehicles.status = maintenance` khi báo sự cố nghiêm trọng.
- Ghi `notifications` cho TCTH trong các tình huống vận hành xe.

## Quyết định xử lý permission helper

### Vấn đề hiện tại

Tên `hasTCTHPermission()` quá rộng. Trước đây code dùng hàm này cho nhiều nghĩa khác nhau:

- Có được xem dashboard điều phối không.
- Có được thấy pending queue lịch xe/phòng không.
- Có được duyệt lịch công tác thường không.
- Có được nhận thông báo điều phối xe/phòng không.
- Có được gán xe/tài xế không.

Khi `hr_officer` từng nằm trong hàm này, hệ quả là HR bị kéo vào luồng TCTH và nhận thông báo xe/phòng, sai nghiệp vụ. Vì vậy không nên giữ helper này, kể cả dưới dạng alias.

### Có cần giữ `hasTCTHPermission()` không?

Không. Nên bỏ hẳn để tránh tái sử dụng sai nghĩa.

Helper thay thế chính:

```ts
canCoordinateSharedResources(profile)
```

Ý nghĩa hẹp của helper này:

- Có quyền điều phối lịch công tác thường.
- Có quyền xử lý xe/phòng.
- Có quyền nhận thông báo xe/phòng.
- Có quyền xem dashboard điều phối TCTH.

Không bao gồm:

- Quyền HR duyệt nghỉ phép.
- Quyền xem hồ sơ nhân sự.
- Quyền tài xế cập nhật chuyến đi.
- Quyền admin kỹ thuật chung.

### Đề xuất tách permission helper

Nên tách `src/lib/permissions.ts` thành các hàm rõ nghĩa:

```ts
export function canCoordinateSharedResources(profile: any): boolean
export function canApproveLeave(profile: any, leave?: any): boolean
export function canUseDriverWorkspace(profile: any): boolean
export function canUseHumanResourcesWorkspace(profile: any): boolean
export function canManageResourceCatalog(profile: any): boolean
export function canAccessPeopleDirectory(profile: any): boolean
```

Mapping đề xuất:

| Helper | Role đúng |
|---|---|
| `canCoordinateSharedResources` | `admin`, `secretary`, hoặc manager thuộc phòng TCTH |
| `canApproveLeave` | `admin`, `hr_officer`, `director`, `manager` theo phân cấp |
| `canUseDriverWorkspace` | `driver` |
| `canUseHumanResourcesWorkspace` | `hr_officer` |
| `canManageResourceCatalog` | `admin`, `secretary` |
| `canAccessPeopleDirectory` | `admin`, `director`, `hr_officer`, manager theo scope phòng |

### Cách chuyển đổi an toàn

1. Xóa `hasTCTHPermission()`.
2. Implement các helper rõ nghĩa trong `src/lib/permissions.ts`.
3. Thay toàn bộ call site theo nghĩa thật:
   - Dashboard TCTH dùng `canCoordinateSharedResources`.
   - Notification xe/phòng dùng `canCoordinateSharedResources`.
   - Duyệt nghỉ phép dùng `canApproveLeave`.
   - Driver dashboard dùng `canUseDriverWorkspace`.
   - HR dashboard dùng `canUseHumanResourcesWorkspace`.
4. Không thêm alias legacy để tránh code mới gọi lại tên cũ.

### Lưu ý backend/RLS

Frontend hiện đã tách `hr_officer` khỏi TCTH, nhưng `schema.sql` vẫn còn một số policy đưa `hr_officer` vào nhóm quyền schedule/TCTH:

- Policy đọc `schedule_participants`.
- Policy đọc `schedules`.
- Policy update `schedules`.

Điểm này nên được migration lại để backend khớp với nghiệp vụ:

- `hr_officer` chỉ có quyền với `schedules.type = 'leave'`.
- `hr_officer` không có quyền update lịch công tác thường, không có quyền điều phối xe/phòng.
- Các quyền xe/phòng vẫn thuộc `admin`, `secretary`, hoặc manager phòng TCTH nếu nghiệp vụ yêu cầu.

### Kết luận

`hasTCTHPermission()` không còn cần thiết. Cách gọn và ít rủi ro nhất là:

1. Dùng `canCoordinateSharedResources()` cho mọi quyền điều phối xe/phòng/lịch công tác.
2. Dùng `canApproveLeave()` cho nghỉ phép.
3. Dùng `canUseHumanResourcesWorkspace()` cho dashboard nhân sự.
4. Dùng `canUseDriverWorkspace()` cho dashboard tài xế.
5. Cập nhật RLS để `hr_officer` không còn quyền schedule thường/xe/phòng ở backend.
