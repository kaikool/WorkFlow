# MA TRẬN PHÂN QUYỀN CHÍNH THỨC (ROLE MATRIX)
> **TÀI LIỆU BẮT BUỘC ĐỌC TRƯỚC KHI PHÁT TRIỂN (MANDATORY READ FOR DEVELOPERS)**
> 
> **Quy định nghiêm ngặt:** Bất kỳ nhà phát triển (developer) nào khi tham gia phát triển dự án ProjectFlow, trước khi chỉnh sửa bất kỳ dòng mã nguồn nào liên quan đến Giao diện (Frontend), API, hoặc Database (SQL Policies / RLS), bắt buộc phải đọc, hiểu rõ và tuân thủ tuyệt đối ma trận phân quyền này. Mọi thay đổi vi phạm chính sách bảo mật dưới đây đều bị coi là lỗi bảo mật nghiêm trọng.

---

## I. ĐỊNH NGHĨA VAI TRÒ (ROLES DEFINITION)

Hệ thống quản lý công việc và lịch trình ProjectFlow vận hành dựa trên các vai trò cốt lõi sau:

1. **`admin` (Quản trị viên hệ thống):** 
   - **Bản chất vai trò:** Phụ trách kỹ thuật hệ thống (quản lý tài khoản, phân quyền, cấu hình tham số phần mềm, giám sát hạ tầng dữ liệu).
   - **Lưu ý nghiệp vụ:** Trên thực tế vận hành, Quản trị viên **hoàn toàn không can thiệp** vào hoạt động chuyên môn, phân công công việc hay chỉ tiêu KPIs của các phòng ban. Các đặc quyền Xem/Sửa/Xóa công việc trong hệ thống của Admin thuần túy mang tính chất kỹ thuật hỗ trợ để khắc phục sự cố dữ liệu khi có yêu cầu bằng văn bản.
2. **`director` (Ban Giám đốc):** Lãnh đạo cấp cao của cơ quan (Giám đốc, Phó Giám đốc). Có vai trò giám sát vĩ mô, giao chỉ tiêu chiến lược và thúc đẩy phong trào thi đua.
3. **`manager` (Trưởng phòng):** Cán bộ quản lý cấp trung (Trưởng phòng/Phó Trưởng phòng ban nghiệp vụ). Trực tiếp giao việc và giám sát phòng ban của mình.
4. **`staff` (Nhân viên / Cán bộ):** Chuyên viên trực tiếp thực hiện các nghiệp vụ chuyên môn được giao.
5. **`secretary` (Thư ký / Phòng Tổ chức Tổng hợp - TCTH):** Bộ phận chịu trách nhiệm quản lý, điều phối tài nguyên dùng chung và lịch trình công tác của toàn cơ quan.

---

## II. BẢNG MA TRẬN PHÂN QUYỀN CHI TIẾT (ROLE MATRIX TABLE)

Ký hiệu quyền hạn trên các bảng dữ liệu:
- **C (Create):** Quyền tạo mới bản ghi.
- **R (Read):** Quyền xem bản ghi.
- **U (Update):** Quyền chỉnh sửa bản ghi.
- **D (Delete):** Quyền xóa bản ghi.
- **- :** Không có quyền truy cập / bị cấm hoàn toàn.

| Phân hệ chức năng | Bảng dữ liệu | Quản trị viên (`admin`) | Ban Giám đốc (`director`) | Trưởng phòng (`manager`) | Nhân viên (`staff`) | Thư ký (`secretary`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Công việc & Báo cáo** | `tasks` *(task_type = 'task' hoặc 'report')* | **R, U, D** *(Chỉ hỗ trợ kỹ thuật)* | **R, U** *(Tất cả)* | **C, R, U** *(Phòng ban)* | **R, U** *(Cá nhân)* | **R** *(Xem chung)* |
| **Chỉ tiêu & KPIs** | `tasks` *(task_type = 'kpi')* | **C, R, U, D** *(Chỉ cấu hình)* | **C, R, U** | **C, R, U** *(Phòng ban)* | **R, U** *(Nhập thực tế đạt được)* | **R** *(Xem chung)* |
| **Lịch trình công tác** | `schedules` | **R, U, D** | **C, R** | **C, R, U** *(Của phòng)* | **C, R, U** *(Do mình tạo)* | **C, R, U, D** *(Duyệt/Từ chối)* |
| **Phương tiện (Xe)** | `vehicles` | **C, R, U, D** | **R** | **R** | **R** | **C, R, U, D** *(Toàn quyền quản lý)* |
| **Phòng họp** | `rooms` | **C, R, U, D** | **R** | **R** | **R** | **C, R, U, D** *(Toàn quyền quản lý)* |
| **Vinh danh & Chấn chỉnh** | `recognitions` | **C, R, U, D** | **C, R** | **R** | **R** | **R** |
| **Cấp tài khoản mới** | `account_requests` | **C, R, U, D** | **R** | **-** | **-** | **-** |

---

## III. QUY TẮC CHI TIẾT VỀ QUYỀN HẠN & LOGIC NGHIỆP VỤ

### 1. Phân hệ Chỉ tiêu KPIs (Bản ghi `task_type = 'kpi'`)
* **Rủi ro kiểm soát:** Nhân viên có thể tự hạ chỉ tiêu mục tiêu (`target_value`) xuống để báo cáo đạt tiến độ khống 100%.
* **Yêu cầu Frontend:**
  - Đối với tài khoản `staff` (Nhân viên): Khi cập nhật tiến độ KPI, giao diện **BẮT BUỘC phải disable** (khóa/không cho phép sửa) các trường: *Tiêu đề (Title), Mô tả (Description), Chỉ tiêu mục tiêu (target_value), Đơn vị tính (unit), Hạn hoàn thành (due_date)*.
  - Nhân viên **chỉ được phép nhập** trường số liệu thực tế đạt được (`current_value`).
* **Yêu cầu Database (RLS):** Chỉ có `admin`, `director` và `manager` phụ trách phòng ban mới được quyền thay đổi trường `target_value` của chỉ tiêu KPI.

### 2. Phân hệ Lịch trình & Duyệt đặt phòng/xe (`schedules`)
* **Trạng thái mặc định:** Mọi lịch trình do Nhân viên (`staff`) hay Trưởng phòng (`manager`) đăng ký có yêu cầu sử dụng xe hoặc phòng họp đều phải có trạng thái mặc định là **Chờ duyệt (`pending`)**.
* **Quy trình Duyệt:**
  - Chỉ có `admin` và tài khoản thuộc phòng **Tổ chức Tổng hợp (`secretary`)** mới có quyền chuyển trạng thái lịch trình thành **Đã duyệt (`approved`)** hoặc **Từ chối (`rejected`)**.
  - Khi lịch được duyệt, trạng thái xe hoặc phòng liên quan tự động chuyển sang bận trong khoảng thời gian tương ứng.

### 3. Phân hệ Quản trị Xe và Phòng họp (`vehicles`, `rooms`)
* **Toàn quyền Quản lý Tài nguyên:** Nhằm giảm tải cho bộ phận quản trị kỹ thuật, cả **Quản trị viên (`admin`)** và **Thư ký / Phòng Tổ chức Tổng hợp (`secretary`)** đều có **toàn quyền (Thêm, Sửa, Xóa)** danh mục Xe và Phòng họp.
* **Cập nhật Vận hành:** Phòng TCTH có trách nhiệm cập nhật tình trạng xe đi bảo dưỡng, hoặc khóa phòng họp phục vụ sự kiện khẩn cấp trực tiếp trên giao diện quản trị mà không cần thông qua admin kỹ thuật.

### 4. Tính năng Vinh danh & Chấn chỉnh nhẹ nhàng (`recognitions`)
* **Tạo động lực tích cực:** Ban Giám đốc (`director`) có quyền tạo hai nhóm tin bài trên luồng hoạt động chung:
  - **Vinh danh (Praise):** Tuyên dương cá nhân/tập thể có thành tích xuất sắc, hoàn thành vượt chỉ tiêu KPIs.
  - **Chấn chỉnh nhẹ nhàng (Gentle Feedback/Remind):** Nhắc nhở tế nhị các đơn vị/cá nhân đang chậm trễ tiến độ công việc hoặc có chỉ số KPIs thấp. Bản tin chấn chỉnh được thiết kế với ngôn từ mang tính chất động viên, thúc đẩy và hướng dẫn khắc phục, tránh sử dụng từ ngữ trừng phạt tiêu cực gây áp lực tâm lý cho cán bộ.

---

## IV. LÀM RÕ VÀ TỐI ƯU HÓA 3 VAI TRÒ KHÁC (COORDINATOR, HR-OFFICER, DRIVER)

Để cấu trúc phân quyền gọn nhẹ và thực tế nhất, 3 vai trò bổ sung này được quy định rõ như sau:

### 1. Vai trò: `coordinator` (Điều phối viên)
* **Đề xuất tối ưu:** **Loại bỏ hoàn toàn** vai trò này ra khỏi thiết kế phân quyền của hệ thống.
* **Lý do:** Quyền hạn điều phối lịch trình, xe cộ, phòng họp của `coordinator` bị trùng lặp hoàn toàn với vai trò Thư ký thuộc phòng **Tổ chức Tổng hợp (`secretary`)**. Việc quy nhất quán về một vai trò `secretary` giúp hệ thống tinh gọn, tránh nhập nhằng trong vận hành.

### 2. Vai trò: `hr-officer` (Cán bộ Nhân sự)
* **Quyền hạn chuyên biệt:** 
  - Xem và quản lý thông tin hồ sơ nhân sự, danh sách phòng ban và sơ đồ tổ chức của toàn cơ quan.
  - Thống kê, giám sát và phê duyệt các đơn xin nghỉ phép (`leave`) của toàn bộ cán bộ nhân viên trong cơ quan.
* **Giới hạn nghiệp vụ:** Không được can thiệp vào các hoạt động nghiệp vụ công việc (`tasks`), không quản lý chỉ tiêu KPIs của các phòng ban khác, và không tham gia điều phối xe hay phòng họp.

### 3. Vai trò: `driver` (Tài xế / Lái xe cơ quan)
* **Giao diện dành riêng cho tài xế:**
  - Xem danh sách lịch trình di chuyển (chuyến công tác - `trip`) được phân công gán kèm với phương tiện của mình (biết rõ ngày giờ đi, chở ai, đi đâu).
  - Cập nhật nhanh trạng thái sẵn sàng hoặc báo hỏng của xe mình phụ trách.
  - Ghi nhận chỉ số hành trình thực tế (Số km xuất phát / Số km kết thúc) sau khi hoàn thành mỗi chuyến đi để phục vụ công tác thanh quyết toán xăng xe của phòng TCTH.

---

---

## V. CHI TIẾT PHÂN CẤP LÃNH ĐẠO & ĐỘ ƯU TIÊN (LEADERSHIP HIERARCHY & PRIORITY)

Để tối ưu hóa trải nghiệm sử dụng phần mềm thực tế, hệ thống bổ sung hai trường dữ liệu mới trong bảng `profiles`:
*   `title` (Chức danh cụ thể - ví dụ: "Tổng Giám đốc", "Phó Giám đốc", "Trưởng phòng", "Phó Trưởng phòng").
*   `is_department_head` (Kiểu boolean: `true` xác định người đứng đầu đơn vị/phòng ban).

### 1. Nguyên tắc Quyền lực ngang hàng (Equal Authority by Role)
*   **Ngang quyền cấp Lãnh đạo cao nhất (`director`):** Tất cả các Giám đốc, Phó Giám đốc đều có quyền quản lý vĩ mô ngang nhau trong hệ thống (đều xem được toàn cơ quan, tạo vinh danh, tạo KPIs chiến lược).
*   **Ngang quyền cấp Lãnh đạo phòng (`manager`):** Cả Trưởng phòng (`is_department_head = true`) và Phó phòng (`is_department_head = false`) đều có quyền quản lý đơn vị nghiệp vụ ngang nhau:
    *   Đều có quyền giao việc/KPIs cho bất kỳ ai thuộc phòng ban của mình (bao gồm giao chéo/giao cho nhau).
    *   Đều có quyền xem, phê duyệt đơn xin nghỉ phép của cán bộ thuộc phòng ban mình quản lý.
    *   Đều có quyền điều chỉnh đóng góp của cán bộ trong phòng và hiệu chỉnh số liệu KPIs thực tế của phòng.
*   **Quyền trực tiếp hoàn thành của Cán bộ được phân công:**
    *   Trong giao việc và báo cáo KPIs, cán bộ trực tiếp được phân công (`assignee`) có toàn quyền trực tiếp cập nhật tiến độ lên 100% để "Hoàn thành" báo cáo/nhiệm vụ được giao, không bị giới hạn hoặc cần Lãnh đạo phê duyệt để đóng task.

### 2. Quy tắc Ưu tiên hiển thị & Ưu tiên xử lý (Priority Rule)
Trường dữ liệu `is_department_head` không dùng để tước quyền hay hạn chế quyền lực của Phó phòng, mà dùng để **thiết lập độ ưu tiên hiển thị và xử lý**:
*   **Ưu tiên hiển thị:** Trong danh sách chọn người được giao việc, người có `is_department_head = true` (Trưởng phòng/Giám đốc điều hành chính) luôn được xếp lên đầu danh sách để dễ lựa chọn và làm nổi bật chức danh Lãnh đạo đứng đầu.
*   **Ưu tiên xử lý khi xảy ra xung đột:** Trong một số sự kiện nghiệp vụ chưa phân công rõ ràng, hệ thống sẽ ưu tiên gửi thông báo hoặc gán mặc định cho Lãnh đạo cấp cao nhất/Trưởng phòng xử lý trước.

### 3. Quy trình Duyệt đơn nghỉ phép thông minh
*   *Đơn xin nghỉ của Nhân viên:* Cả Trưởng phòng và Phó phòng đều xem và duyệt bước 1 được -> Cán bộ Nhân sự (HR-Officer) duyệt bước 2.
*   *Đơn xin nghỉ của Trưởng phòng:* Gửi lên Ban Giám đốc (`director`) duyệt bước 1 -> Cán bộ Nhân sự duyệt bước 2.
*   *Đơn xin nghỉ của Phó phòng:* Gửi Trưởng phòng hoặc các Giám đốc duyệt bước 1 -> Cán bộ Nhân sự duyệt bước 2.


## VI. QUY ĐỊNH KỸ THUẬT DÀNH CHO LẬP TRÌNH VIÊN (DEVELOPER GUIDELINES)

### 1. Khi viết các câu lệnh SQL / Migrations
* Luôn đảm bảo cơ chế **Row Level Security (RLS)** trên Supabase được kích hoạt cho các bảng mới bằng lệnh:
  ```sql
  ALTER TABLE <ten_bang> ENABLE ROW LEVEL SECURITY;
  ```
* Tuyệt đối không viết các câu lệnh truy vấn bỏ qua bộ lọc quyền hạn của người dùng. Mọi thao tác cập nhật dữ liệu nhạy cảm phải kiểm tra trùng khớp `auth.uid()` hoặc gán quyền chính xác thông qua hàm kiểm tra vai trò:
  ```sql
  CREATE POLICY "Managers and Admin can update" ON tasks FOR UPDATE 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director', 'manager'));
  ```

### 2. Khi phát triển Giao diện (Frontend)
* Không được ẩn các thành phần nhạy cảm chỉ bằng CSS (`display: none`). Bắt buộc phải kiểm tra quyền hạn thực tế từ Session/Profile của người dùng trong React Component trước khi render:
  ```tsx
  if (profile?.role === 'staff') {
    // Khóa các ô nhập liệu chỉ tiêu KPI
  }
  ```
* Mọi API Endpoint (nếu có) phải kiểm tra quyền hạn (Role) của người gửi yêu cầu trước khi xử lý nghiệp vụ, không tin tưởng hoàn toàn vào dữ liệu do Client gửi lên.

---
> **Tuyên bố tuân thủ:** Mọi sản phẩm bàn giao, Pull Request (PR) không tuân thủ tài liệu Role Matrix này sẽ bị từ chối duyệt ngay lập tức mà không cần giải thích thêm.
