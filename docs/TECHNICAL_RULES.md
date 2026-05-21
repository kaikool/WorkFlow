# TÀI LIỆU QUY TẮC KỸ THUẬT & LOGIC HỆ THỐNG (TECHNICAL_RULES.md)

> **MỤC TIÊU:** Đây là tài liệu kỹ thuật tối cao quy định toàn bộ tiêu chuẩn thiết kế UI/UX theo Apple HIG, cấu trúc mã nguồn, quy tắc phân quyền, chính sách bảo mật dữ liệu cấp cơ sở dữ liệu (RLS), và các logic nghiệp vụ cốt lõi của dự án **projectFlow — WorkFlow Portal**. 
>
> ⚠️ **BẮT BUỘC:** Tất cả các phiên làm việc của lập trình viên và trợ lý AI tiếp theo phải đọc kỹ và tuân thủ tuyệt đối các quy tắc trong tài liệu này. Mọi thay đổi cấu trúc mã nguồn hoặc giao diện trái với tài liệu này đều được coi là lỗi nghiêm trọng.

---

## 1. TỔNG QUAN DỰ ÁN & MA TRẬN VAI TRÒ (ROLES MATRIX)

Dự án **projectFlow** là cổng thông tin nội bộ của đơn vị tài chính/ngân hàng truyền thống, chịu trách nhiệm quản lý công việc nghiệp vụ, chỉ tiêu KPIs kinh doanh, đặt phòng họp, điều phối xe công và duyệt nghỉ phép.

Hệ thống được chia thành **7 vai trò cốt lõi** với các đặc quyền và giao diện chuyên biệt:
*   `admin` (Quản trị hệ thống): Toàn quyền cấu hình, phê duyệt tài khoản, truy cập toàn bộ dữ liệu.
*   `director` (Ban Giám đốc - BGĐ): Quản lý vĩ mô, theo dõi dòng thời gian (Timeline) của toàn bộ chi nhánh, duyệt đơn nghỉ phép của Trưởng phòng/Lãnh đạo đơn vị.
*   `manager` (Lãnh đạo đơn vị / Trưởng phòng): Quản lý nhân sự và công việc trong phòng ban mình phụ trách, giao chỉ tiêu KPIs cho cán bộ, duyệt nghỉ phép của cán bộ thuộc phòng.
*   `staff` (Cán bộ nhân viên): Tiếp nhận công việc, cập nhật số liệu đóng góp KPIs cá nhân, đăng ký lịch họp/lịch công tác, tạo đơn xin nghỉ phép.
*   `secretary` (Thư ký Tổ chức Tổng hợp - TCTH): Điều phối tài nguyên dùng chung gồm phòng họp và xe công, quản lý danh mục xe/phòng.
*   `hr_officer` (Cán bộ Nhân sự): Quản lý hồ sơ nhân sự, xem toàn bộ danh bạ đơn vị, phê duyệt nghỉ phép bước cuối (sau khi Trưởng phòng duyệt).
*   `driver` (Tài xế cơ quan): Sử dụng không gian làm việc chuyên biệt (Driver Workspace) trên di động để nhận chuyến, cập nhật chỉ số Km hành trình và báo cáo sự cố phương tiện.

---

## 2. TIÊU CHUẨN THIẾT KẾ UI/UX (APPLE HIG & BOLD MINIMALISM)

Giao diện của **projectFlow** tuân thủ triết lý **Exaggerated Minimalism (Tối giản phóng đại)** và tiêu chuẩn thiết kế của Apple dành cho ứng dụng chuyên nghiệp.

### A. Bảng Màu Thương Hiệu (Color Palette)
*   **Primary (Màu chủ đạo):** `#0F172A` (`slate-900`) - Mang lại cảm giác tin cậy, vững chắc của ngành tài chính.
*   **Secondary (Màu phụ):** `#1E3A8A` (`blue-900`) - Dùng cho các thanh điều hướng, các nút phụ.
*   **CTA / Accent (Điểm nhấn):** `#CA8A04` (`amber-600`) - Sử dụng làm điểm nhấn tinh tế cho các yếu tố quan trọng, các nút hành động nổi bật (vàng kim/gold).
*   **Background (Nền):** `#F8FAFC` (`slate-50`) kết hợp với thẻ nền trắng `#FFFFFF`.
*   **Muted Text:** `#64748B` (`slate-500`).
*   **Border:** `#E2E8F0` (`slate-200`).
*   🚫 **TUYỆT ĐỐI CẤM:** Không sử dụng các màu `indigo`, `purple`, hoặc `pink` dưới bất kỳ hình thức nào (kể cả màu nền, màu chữ hay dải màu gradient generic).

### B. Quy Chuẩn Typography (Hệ Thống Font & Cỡ Chữ)
*   **Font Stack:** Sử dụng cấu hình font hệ thống chuẩn của Apple (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica`, `Arial`). Không liên kết hoặc tải Google Fonts bên ngoài để đảm bảo hiệu năng và tính riêng tư.
*   **Tracking & Capitalization:** 
    *   Triệt tiêu các thuộc tính letter-spacing âm (`tracking-tight`, `tracking-tighter`) để chữ viết rõ ràng ở mọi kích thước màn hình.
    *   Không viết hoa toàn bộ chữ (all-caps) cho tiêu đề, nhãn (label), tab, badge hay nút bấm. Dùng **Sentence case** (Chỉ viết hoa chữ đầu câu); chỉ viết hoa đối với biển số xe, mã số và từ viết tắt như KPI, TCTH, CASA.
*   **Typography Scale (Tỉ lệ cỡ chữ responsive):**
    *   `text-base` (Body): `17px` trên Mobile/Tablet, `16px` trên Desktop. Dùng cho nội dung chính, mô tả chi tiết.
    *   `text-sm` (Control): `16px` trên Mobile/Tablet, `15px` trên Desktop. Dùng cho nút bấm, trường nhập liệu (input, select).
    *   `text-[13px]`/`text-[14px]` (Subhead): metadata quan trọng.
    *   `text-xs` (Footnote): `13px` cho nhãn, trạng thái, thẻ tag.
    *   Cỡ chữ tối thiểu tuyệt đối: `12px` (Caption). Không được dùng cỡ chữ nhỏ hơn.

### C. Khoảng Cách & Vùng Chạm Tương Tác (Touch Targets)
*   **Vùng chạm tối thiểu (Touch Target):** Mọi phần tử tương tác (Nút bấm, biểu tượng, ô lựa chọn, menu) bắt buộc phải đạt kích thước tối thiểu **`44px` trên Mobile và iPad**, và **`40px` trên Desktop**. Cấm dùng các class làm giảm chiều cao tương tác như `h-7`, `h-8`, `py-0.5`.
*   **Page Margins (Lề trang):**
    *   Mobile: `16px` (`px-4`)
    *   iPad/Tablet: `24px` (`px-6`)
    *   Desktop: `32px` (`px-8` hoặc `max-w-6xl mx-auto px-4 sm:px-6`)
*   **Border Radius (Bo góc):** Bo góc mềm mại nhưng rõ ràng.
    *   Control (Button, Input, Select): `12px` (`rounded-xl`).
    *   Card nhỏ, Badge: `16px` (`rounded-2xl`).
    *   Premium Card (Thẻ cao cấp): `18px` trên mobile, `22px` trên tablet, `24px` trên desktop.
    *   Dialog/Modal: `24px` (`rounded-3xl` hoặc `rounded-2xl`).

### D. Hiệu Ứng Động (Transitions & Micro-Animations)
*   Mọi tương tác trạng thái (hover, focus, active) phải sử dụng transition mượt mà với khoảng thời gian từ `150ms` đến `300ms` (`transition-all duration-300 ease-in-out`). Cấm chuyển đổi trạng thái tức thời (instant).
*   Áp dụng hiệu ứng thu nhỏ nhẹ khi click: `active:scale-95 transition-all` trên toàn bộ các nút bấm (`Button`), thẻ hành động (`Card` có link click) để tạo cảm giác phản hồi vật lý chân thực.

### E. TThiết kế
*  Sử dụng thư viện Shad/UI để tái sử dụng, không tự chế các component, sau này mỗi nơi một kiểu phá cấu trúc
*   Giao diện phải đáp ứng các tiêu chuẩn cao về UI/UX, không phải cái gì cũng áp dụng 1 độ dày, độ dài cứng, vì như thế nhìn nó lại không đẹp, ví dụ nó to quá so với màn hình hoặc context sẽ làm xấu UI
*   Mọi thiết kế đều phải có tính responsive, tương thích đa thiết bị, từ điện thoại, máy tính bảng cho đến máy tính để bàn. 
*   Điều tối quan trọng là chữ viết phải rõ ràng, dễ đọc. Không được sử dụng các cỡ chữ quá nhỏ hoặc các hiệu ứng làm mờ chữ. Không để chữ nhảy xuống dòng, không viết lan man, không cần giải thích những gì quá hiển nhiên hoặc đã được ghi rõ ở chỗ khác. Hãy giữ giao diện gọn gàng, tối giản, chuyên nghiệp và đi thẳng vào vấn đề.
---

## 3. QUY TẮC PHÁT TRIỂN MÃ NGUỒN & CẤU TRÚC FILE

*   **Giới hạn kích thước tệp:** Để duy trì kiến trúc modular sạch sẽ và dễ bảo trì, **không cho phép bất kỳ tệp component `.tsx` hoặc `.ts` nào vượt quá 500 dòng code vật lý**. Nếu một component vượt quá giới hạn này, bắt buộc phải tái cấu trúc tách nhỏ thành các subcomponents độc lập nằm trong thư mục `_components` của module đó.
*   **Ngôn ngữ lập trình:** Sử dụng TypeScript nghiêm ngặt, định nghĩa đầy đủ interface và loại bỏ hoàn toàn kiểu `any` không kiểm soát.
*   **Ngôn ngữ bình luận:** Toàn bộ ghi chú, bình luận mã nguồn (comments), mã lỗi và mô tả logic nghiệp vụ bắt buộc phải viết bằng **Tiếng Việt**.

---

## 4. AN NINH DỮ LIỆU & QUY TẮC RLS DATABASE (ROW LEVEL SECURITY)

Dự án áp dụng an ninh dữ liệu chặt chẽ từ tầng cơ sở dữ liệu thông qua cơ chế RLS của Supabase. Bất kỳ câu truy vấn frontend nào cũng phải tuân thủ chính sách RLS để tránh rò rỉ dữ liệu chéo phòng ban.

### A. Bảng Profiles (Thông tin nhân sự)
*   `SELECT`: Cho phép tất cả người dùng đã xác thực đọc toàn bộ hồ sơ (`USING (true)`).
*   `UPDATE`: Chỉ cho phép chủ tài khoản cập nhật hồ sơ của chính mình (`USING (auth.uid() = id)`).

### B. Bảng Tasks (Công việc nghiệp vụ & Báo cáo)
*   `SELECT` & `UPDATE`: Truy cập bị giới hạn theo cấp bậc và phòng ban:
    *   Admin và Director: Xem và cập nhật toàn hệ thống.
    *   Manager: Xem và cập nhật các công việc thuộc phòng ban mình phụ trách (`department_id` trùng khớp).
    *   Staff: Chỉ được xem/cập nhật nếu là người được giao (`assignee_id`), người tạo (`created_by`), có tên trong bảng phân công phụ (`task_assignees`), hoặc được chỉ định xử lý trong metadata của công việc (`metadata->'assigned_line'`).

### C. Bảng KPIs (Chỉ tiêu kinh doanh)
*   `SELECT`: Giới hạn truy cập giống như bảng `tasks`.
*   `INSERT`: Chỉ cho phép `admin`, `director` hoặc `manager` tạo chỉ tiêu mới cho đơn vị mình phụ trách. Cán bộ thường (`staff`, `driver`) không được phép tạo chỉ tiêu KPIs.
*   `UPDATE`: Admin, Director, Manager và người tạo hoặc người được giao (`assignee_id`).

### D. Bảng Schedules (Lịch trình & Đăng ký phòng họp/xe công)
*   `SELECT`: Cho phép đọc nếu thỏa mãn một trong các điều kiện:
    *   Người dùng là người tạo lịch trình (`created_by = auth.uid()`).
    *   Lịch trình thuộc phòng ban của người dùng (`department_id = user.department_id`).
    *   Người dùng là thành viên tham gia (`schedule_participants`).
    *   Người dùng thuộc Ban Giám đốc hoặc người tạo lịch thuộc Ban Giám đốc.
    *   Người dùng thuộc vai trò điều phối (`admin`, `secretary`, `hr_officer` hoặc `manager` Tổ chức Tổng hợp).
    *   Người dùng có vai trò là Lái xe (`driver`) để có thể xem lịch phân công chuyến.

---

## 5. LOGIC NGHIỆP VỤ CHI TIẾT (BUSINESS LOGICS)

### A. Quản Lý KPIs & Chỉ Tiêu Đóng Góp
1.  **Tách Biệt Hoàn Toàn KPI Với Công Việc:** Chỉ tiêu KPIs kinh doanh được lưu trữ tại bảng riêng `kpis` trên cơ sở dữ liệu. **Tuyệt đối không hiển thị chỉ tiêu KPIs ở giao diện danh sách Công việc Nghiệp vụ thông thường** (`/dashboard/tasks`).
2.  **Công Thức Tiến Độ:** Tiến độ của một chỉ tiêu KPIs được tính toán tự động dựa trên tổng giá trị thực tế đạt được chia cho giá trị mục tiêu:
    $$\text{Tiến độ (\%)} = \text{Round}\left(\frac{\text{Tổng giá trị thực tế}}{\text{Mục tiêu}} \times 100\right)$$
3.  **Cơ Chế Phân Bổ Đóng Góp:**
    *   **Đối với Cán bộ:** Tự cập nhật đóng góp thực tế cá nhân của mình thông qua giao diện nhập liệu dạng tăng/giảm nhanh (`+`/`-`) ở trang chi tiết KPI. Hệ thống lưu đóng góp của từng người trong trường `metadata.contributions` dạng cặp khóa-trị `{ [user_id]: number }`.
    *   **Đối với Lãnh đạo (Manager/Director/Admin):**
        *   Có quyền điều chỉnh trực tiếp đóng góp của từng cán bộ thông qua giao diện nhập số liệu chuyên biệt của lãnh đạo. Khi lưu, hệ thống tự động tính lại tổng và cập nhật trường `current_value`, đồng thời kích hoạt thông báo tự động cho cán bộ có số liệu bị thay đổi.
        *   **Hiệu chỉnh phòng (General Adjustment):** Lãnh đạo có thể nhập một con số hiệu chỉnh chung cho cả đơn vị (được lưu tại `metadata.general_adjustment`). Số này sẽ được cộng trực tiếp vào tổng thực tế đạt được:
            $$\text{Tổng giá trị thực tế} = \sum(\text{Đóng góp của các cá nhân}) + \text{Hiệu chỉnh phòng}$$
4.  **Tự Động Hóa Trạng Thái:** Khi tổng giá trị thực tế đạt hoặc vượt mục tiêu (Tiến độ $\ge 100\%$), hệ thống sẽ tự động chuyển trạng thái chỉ tiêu đó sang `done` (Hoàn thành) và gửi thông báo vinh danh cho người giao chỉ tiêu.
5.  **Chỉ Tiêu Trọng Tâm (Focal KPI):** Lãnh đạo hoặc người tạo có quyền ghim một chỉ tiêu thành "Kế hoạch trọng tâm" (`metadata.is_focal = true`). Chỉ tiêu này sẽ hiển thị nổi bật với biểu tượng Ngôi sao vàng kim và hiển thị ưu tiên trên dashboard của đơn vị.

### B. Cơ Chế Kiểm Tra & Giải Quyết Xung Đột Tài Nguyên
1.  **Xung Đột Lịch Trình Cá Nhân (Attendee Conflicts):**
    *   Khi tạo hoặc sửa lịch trình (`type = 'meeting'` hoặc `'trip'`), hệ thống sẽ quét toàn bộ danh sách người tham gia (`finalParticipants`) và kiểm tra xem có bất kỳ ai đang bận lịch khác trong khoảng thời gian $[Start, End]$ được chọn hay không.
    *   Logic loại trừ: Bỏ qua các lịch trình ở trạng thái `rejected` (Đã từ chối). Các lịch ở trạng thái `pending` (Chờ duyệt) vẫn được tính là gây xung đột và hiển thị dưới dạng cảnh báo bận kèm nhãn "(Chờ duyệt)".
    *   Logic so khớp thời gian chồng lấn:
        $$\text{Overlap} \iff (Start_{Mới} < End_{Cũ}) \land (End_{Mới} > Start_{Cũ})$$
2.  **Xung Đột Tài Nguyên Dùng Chung (Resource Conflicts):**
    *   **Phòng Họp:** Nếu lịch chọn địa điểm là "Chi nhánh" và yêu cầu sử dụng phòng họp (`use_room = true`), hệ thống bắt buộc kiểm tra xem `room_id` có bị trùng lịch sử dụng nào khác trong cùng khung giờ không. Nếu trùng, hiển thị cảnh báo đỏ và ngăn chặn đăng ký nếu không có quyền ưu tiên.
    *   **Xe Công:** Kiểm tra trùng lắp đối với `vehicle_id` được gán cho chuyến đi. Không cho phép một xe công được duyệt cho hai hành trình trùng thời gian.

### C. Luồng Duyệt Đơn Nghỉ Phép (Leave Workflow)
1.  **Quy Trình Duyệt Phân Cấp (Hierarchical Approval):**
    *   `admin`: Được quyền duyệt mọi đơn nghỉ phép.
    *   `director` (Ban Giám đốc): Chỉ có thẩm quyền phê duyệt đơn nghỉ phép của Trưởng phòng/Lãnh đạo đơn vị (`manager` hoặc profile có `is_department_head = true`). BGĐ không trực tiếp duyệt đơn của nhân viên thường để giảm tải.
    *   `manager` (Trưởng phòng): Được quyền duyệt đơn của cán bộ thuộc phòng ban của mình (`department_id` trùng khớp), với điều kiện:
        *   Trưởng phòng là Lãnh đạo thực tế (`is_department_head = true`).
        *   Không tự phê duyệt đơn xin nghỉ do chính mình tạo.
        *   Người tạo đơn không phải là một Trưởng phòng khác hoặc Lãnh đạo khác.
2.  **Bảo Mật Mô Tả & Lý Do Nghỉ (Privacy Rules):**
    *   Nội dung lý do nghỉ phép và mô tả chi tiết được bảo mật cực kỳ nghiêm ngặt tại giao diện. Chỉ có người tạo đơn, Admin, Cán bộ Nhân sự (`hr_officer`), Ban Giám đốc và Trưởng phòng trực tiếp có quyền duyệt đơn mới được xem nội dung chi tiết đơn nghỉ phép.
    *   Đối với tất cả cán bộ khác hoặc cán bộ phòng ban khác khi xem lịch, hệ thống sẽ ẩn nội dung và chỉ hiển thị tiêu đề mặc định là **"Nghỉ phép"** để đảm bảo quyền riêng tư của cá nhân.

### D. Hành Trình Tài Xế & Điều Phối Xe Công (Driver Milestones)
1.  **Đồng Bộ Thống Kê Quãng Đường (All-Time Sync):**
    *   Số liệu thống kê tại Driver Dashboard gồm "Tổng chuyến" và "Quãng đường tích lũy" (Km) được truy vấn trực tiếp từ bảng `schedules` trên database thời gian thực đối với các chuyến đi có `type = 'trip'`, `driver_id = profile.id` và `status = 'completed'`.
    *   Quãng đường tích lũy được tính bằng tổng `metadata.actual_distance` của tất cả các chuyến đã hoàn thành, đảm bảo chỉ số Km hiển thị hoàn hảo và cập nhật tức thì ngay sau khi tài xế bấm kết thúc chuyến.
2.  **Mốc Thời Gian & Chỉ Số Km Xuất Phát (Start Trip Milestone):**
    *   Khi bắt đầu hành trình, tài xế bắt buộc phải nhập chỉ số Odometer xuất phát (`start_km`).
    *   Trạng thái chuyến đi chuyển sang `in_progress`, đồng thời giờ xuất phát thực tế (`start_time`) được cập nhật bằng thời gian thực tế lúc bấm nút để đồng bộ lên Timeline của Ban Giám đốc.
    *   **Kiểm Tra Lệch Giờ Xuất Phát:** Hệ thống so sánh thời gian thực tế xuất phát với thời gian đăng ký trên lịch trình. Nếu chênh lệch **$\ge 15$ phút** (sớm hơn hoặc muộn hơn), hệ thống tự động chèn thông báo cảnh báo lệch lịch cho phòng Tổ chức Tổng hợp để ghi nhận nhật ký vận hành.
3.  **Mốc Kết Thúc & Quyết Toán Hành Trình (End Trip Milestone):**
    *   Khi kết thúc chuyến, tài xế bắt buộc nhập chỉ số Odometer kết thúc (`end_km`). Hệ thống yêu cầu kiểm tra bắt buộc: `end_km` phải lớn hơn `start_km`.
    *   Tính toán tự động:
        $$\text{actual\_distance} = \text{end\_km} - \text{start\_km}$$
    *   Trạng thái chuyển sang `completed`, giờ kết thúc thực tế (`end_time`) được cập nhật bằng giờ hiện tại để giải phóng ngay lập tức trạng thái bận của xe và người tham gia, tránh tắc nghẽn tài nguyên.
    *   **Kiểm Tra Lệch Giờ Kết Thúc:** So sánh giờ về thực tế với giờ dự kiến trên lịch trình. Nếu chênh lệch **$\ge 30$ phút**, gửi thông báo cảnh báo trễ lịch/về sớm cho Tổ chức Tổng hợp.
    *   **Quyết toán tự động:** Tự động gửi thông báo yêu cầu quyết toán chi phí nhiên liệu hành trình kèm theo chỉ số quãng đường thực tế di chuyển (`actual_distance`) cho bộ phận Tổ chức Tổng hợp.
4.  **Báo Cáo Sự Cố Phương Tiện:**
    *   Khi gặp sự cố trên đường, tài xế bấm nút "Báo sự cố", nhập mô tả chi tiết.
    *   Hệ thống lưu trữ mô tả vào `metadata.vehicle_issue`, đồng thời **tự động chuyển trạng thái của phương tiện đó trong bảng `vehicles` sang `maintenance` (Đang bảo trì)**.
    *   Một thông báo khẩn cấp màu đỏ (Alert) kèm biển số xe và nội dung sự cố lập tức được gửi tới toàn bộ cán bộ phòng Tổ chức Tổng hợp để xử lý kỹ thuật.

### E. Kênh Real-Time Đồng Bộ & Định Tuyến Thông Báo (Notifications Routing)
1.  **Thời Gian Thực (Real-time Sync):**
    *   Trang lịch trình sử dụng kết nối kênh real-time của Supabase (`schedule_realtime_sync`) lắng nghe tất cả các sự kiện thay đổi dữ liệu (`INSERT`, `UPDATE`, `DELETE`) trên các bảng `schedules`, `schedule_participants`, `vehicles`, `rooms`. Giao diện sẽ tự động cập nhật ngay lập tức mà không cần F5 hoặc tải lại trang.
2.  **Định Tuyến Thông Báo Lịch Trình Thông Minh:**
    *   Khi phòng ban đăng ký lịch họp/lịch công tác chung hoặc cập nhật lịch trình đơn vị, hệ thống sẽ gửi thông báo cho tất cả người tham gia.
    *   **Quy tắc loại trừ lái xe:** **Tuyệt đối không gửi thông báo cập nhật lịch họp, lịch đơn vị thông thường cho tài xế (`driver`)** để tránh spam bảng tin thông báo của tài xế. Tài xế chỉ nhận được thông báo khi họ được gán trực tiếp làm tài xế chính (`driver_id`) của chuyến đi đó.

---

## 6. ANTI-PATTERNS (NHỮNG ĐIỀU CẤM KỴ - TUYỆT ĐỐI KHÔNG DÙNG)

*   ❌ **Gradient Generic màu Indigo/Purple/Pink:** Cấm sử dụng các tông màu tím, hồng, indigo trong toàn bộ thiết kế giao diện. Chỉ trung thành với hệ màu Slate, Navy và Gold/Amber.
*   ❌ **Kích Thước Vùng Chạm Quá Nhỏ:** Cấm thiết lập chiều cao tương tác dưới `44px` trên thiết bị di động/iPad. Không dùng `py-1`, `h-8` cho các nút bấm hành động.
*   ❌ **Tràn Nội Dung / Horizontal Scroll:** Cấm để xảy ra hiện tượng cuộn ngang trang (horizontal scroll) ở bất kỳ độ phân giải màn hình nào (đặc biệt là 375px trên mobile).
*   ❌ **Tệp Component Quá Tải:** Cấm viết tệp `.tsx` vượt quá 500 dòng. Mọi logic phức tạp phải được tách nhỏ ra subcomponents.
*   ❌ **Bình Luận Tiếng Anh:** Cấm viết comment bằng tiếng Anh hoặc ngôn ngữ không đồng nhất. Bắt buộc dùng tiếng Việt rõ nghĩa.
*   ❌ **Lồng Premium Card:** Cấm lồng một thẻ `.premium-card` bên trong một thẻ `.premium-card` khác, làm mất đi tính phân cấp giao diện.
*   ❌ **Double Padding:** Không để xảy ra hiện tượng double padding giữa khung Shell của hệ thống và Padding riêng của từng trang. Mọi trang phải sử dụng chung cấu trúc Outer Wrapper tiêu chuẩn.

---

## 7. BIỆN PHÁP KIỂM TRA TRƯỚC KHI BÀN GIAO (PRE-DELIVERY CHECKLIST)

Trước khi gửi yêu cầu phê duyệt hoặc bàn giao bất kỳ tính năng UI/Logic nào, lập trình viên/AI phải tự kiểm tra danh sách sau:
- [ ] Tệp tin sửa đổi/tạo mới có số dòng dưới 500 dòng không?
- [ ] Giao diện có sử dụng đúng dải màu quy định (không có màu tím, hồng, indigo)?
- [ ] Vùng chạm tương tác trên thiết bị di động có đạt tối thiểu `44px` không?
- [ ] Đã kiểm tra responsive mượt mà tại các mốc `375px` (Mobile), `768px` (iPad), `1024px` (Tablet), và `1440px` (Desktop) chưa?
- [ ] Quy trình RLS trên database có được cập nhật tương ứng khi thêm cột/bảng mới không?
- [ ] Logic kiểm tra xung đột lịch trình cá nhân và tài nguyên có hoạt động chính xác không?
- [ ] Toàn bộ bình luận mã nguồn được viết bằng tiếng Việt rõ ràng, ngắn gọn chưa?
