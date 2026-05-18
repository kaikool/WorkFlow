# 📝 [TEMPLATE] Mô Tả Tính Năng Mới (Feature Requirements)

> **Hướng dẫn sử dụng:**
> Copy toàn bộ nội dung file này, đổi tên file thành tên tính năng (ví dụ: `[Feature] Quan_ly_KPIs.md`), sau đó điền thông tin vào các mục bên dưới. Bạn điền càng chi tiết, Agent sẽ càng hiểu rõ ngữ cảnh và đưa ra bản thiết kế (Implementation Plan) chính xác, hạn chế tối đa việc phải đập đi xây lại.

---

## 1. Tên Tính Năng & Mục Tiêu (Overview & Objective)
- **Tên tính năng:** [Ví dụ: Quản lý KPI kinh doanh]
- **Mục tiêu cốt lõi:** [Giải quyết bài toán gì? Ví dụ: Giúp ban giám đốc theo dõi số liệu KPI trực tiếp, thay vì phải đợi báo cáo Excel hàng tháng]
- **Kết quả kỳ vọng (Success Criteria):** [Thế nào được gọi là hoàn thành tính năng này? Ví dụ: Lãnh đạo nhìn vào Dashboard biết ngay phòng nào đang trễ KPI]

## 2. Đối Tượng Sử Dụng (Actors & Roles)
*Liệt kê các nhóm người dùng sẽ tương tác với tính năng này và quyền hạn của họ:*
- **Role 1 (VD: Ban Giám đốc):** [Được xem tất cả KPI, có quyền tạo/sửa/xóa KPI, không được phép tự nhập số liệu thực tế]
- **Role 2 (VD: Trưởng phòng):** [Chỉ xem KPI của phòng mình, được phép phân bổ KPI xuống nhân viên]
- **Role 3 (VD: Nhân viên):** [Chỉ xem KPI cá nhân, được phép nhập số liệu thực tế, nhấn hoàn thành]

## 3. Luồng Nghiệp Vụ (User Workflow / Happy Path)
*Mô tả từng bước người dùng thao tác từ lúc bắt đầu đến lúc kết thúc (Giống như kể một câu chuyện):*
1. **Bước 1:** [Giám đốc vào trang Tạo mới KPI, nhập tên, chỉ tiêu, chọn phòng ban nhận và nhấn "Giao KPI"]
2. **Bước 2:** [Hệ thống gửi thông báo (Notification) cho Trưởng phòng tương ứng]
3. **Bước 3:** [Trưởng phòng nhận thông báo, click vào xem chi tiết, nhấn nút "Giao tiếp cho nhân viên"]
4. **Bước 4:** [Nhân viên thực hiện xong, nhập số liệu vào ô "Thực tế", nhấn "Cập nhật tiến độ". Hệ thống tự tính %]
5. **Bước 5:** [Giám đốc vào Dashboard và thấy thanh tiến độ của KPI đó chuyển sang màu xanh (Đạt 100%)]

## 4. Cấu Trúc Dữ Liệu (Data & States)
*Bạn muốn lưu trữ những trường thông tin nào? Tính năng này có những trạng thái (Status) nào?*
- **Trường thông tin cần thiết:** [Tên, Mô tả, Hạn chót, Chỉ tiêu cần đạt, Số liệu thực tế, File đính kèm...]
- **Các trạng thái vòng đời (Lifecycle):** 
  - `Todo`: Vừa tạo, chưa ai xử lý.
  - `Doing`: Đang trong quá trình làm (tiến độ > 0).
  - `Done`: Đạt 100% chỉ tiêu.
  - `Closed`: Khóa sổ, không cho thao tác nữa.

## 5. Quy Tắc Nghiệp Vụ (Business Rules & Validations)
*Các ràng buộc, luật lệ của hệ thống (Rất quan trọng để tránh lỗi logic):*
- **Quy tắc 1:** [Nhân viên không thể tự xóa KPI của mình]
- **Quy tắc 2:** [Khi tiến độ đạt 100%, trạng thái tự động chuyển sang `Done` và báo Notification cho Giám đốc]
- **Quy tắc 3:** [Báo cáo đã `Closed` thì ẩn luôn nút Edit, Input bị disable toàn bộ]

## 6. Yêu Cầu Giao Diện (UI/UX Requirements)
*Bạn hình dung giao diện hiển thị như thế nào? (Mặc định Agent sẽ dùng bộ UI FinanceOS - Bright & Professional)*
- **Danh sách (List View):** [Hiển thị dạng bảng Table hay dạng Thẻ Card? Cần các bộ lọc nào (Lọc theo phòng ban, Lọc theo trạng thái)?]
- **Chi tiết (Detail View):** [Nửa trái là thông tin KPI, nửa phải là luồng Thảo luận (Chat/Comment)? Cần biểu đồ Progress Bar nổi bật?]
- **Hành động (Actions):** [Nút Giao việc nằm ở góc phải trên cùng, màu Primary]

## 7. Các Trường Hợp Ngoại Lệ (Edge Cases) (Tùy chọn)
*Điều gì xảy ra nếu...?*
- **Trường hợp 1:** [Nếu quá hạn mà chưa đạt 100% thì sao? -> Tự động chuyển màu đỏ báo "Trễ hạn"]
- **Trường hợp 2:** [Nếu phòng ban đó chưa có Trưởng phòng? -> Chặn không cho giao việc và báo lỗi Pop-up]

---
*(Lưu lại file này và yêu cầu Agent: "Hãy đọc file này và lên Implementation Plan cho tôi duyệt!")*
