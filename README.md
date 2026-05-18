# ProjectFlow - Hướng dẫn & Tiêu chuẩn phát triển

Đây là tài liệu quy chuẩn bắt buộc áp dụng cho toàn bộ vòng đời phát triển dự án ProjectFlow. Tất cả các thành viên, trợ lý AI hay nhà phát triển tham gia đều phải tuân thủ nghiêm ngặt các quy tắc dưới đây.

## 1. Ngôn ngữ & Giao tiếp
- **Ngôn ngữ chính:** Toàn bộ hệ thống, bao gồm giao diện người dùng (UI), ghi chú mã nguồn (comments), tài liệu (docs), mô tả chức năng... phải sử dụng 100% **Tiếng Việt**.
- **Ghi chú (Comment):** Yêu cầu tính súc tích, phản ánh đúng bản chất đoạn code. **Tuyệt đối không** sử dụng các tiền tố đánh dấu rác như `[FIX]`, `[NEW]`, `[UPDATE]`, hoặc phiên bản (version explicit) trong comment.

## 2. Tiêu chuẩn Thiết kế UI/UX (Apple HIG & Premium Minimalist)
Giao diện phải toát lên sự cao cấp, tối giản và chuyên nghiệp.
- **Hình khối & Bo góc:** Từ bỏ phong cách "kẹo ngọt" (ví dụ: bo tròn 9999px). Sử dụng quy chuẩn góc bo hiện đại: `rounded-xl`, `rounded-2xl` cho thẻ/nút bấm, và `rounded-[32px]` cho Modal/Dialog.
- **Typography:** Ưu tiên **Sentence case** (Viết hoa chữ cái đầu tiên của câu/từ). Sử dụng hệ thống font chuẩn, kiểm soát tốt các line-height và tracking.
- **Chiều sâu & Màu sắc:** Sử dụng nền trắng hoặc xám siêu nhạt (`bg-slate-50`). Thay vì dùng các viền thô cứng, hãy tận dụng bóng đổ mềm (`shadow-sm`, `shadow-xl`) kết hợp viền mờ (`border-slate-100/50`).
- **Responsive & PWA:** 
  - Đảm bảo trải nghiệm chạm (touch-target) chuẩn xác trên màn hình di động.
  - Chống tình trạng "auto-zoom" của Safari/iOS khi click vào ô nhập liệu bằng cách cấu hình size font: `text-base md:text-sm`.
  - Kiểm soát chữ tràn viền bằng `truncate` và `whitespace-nowrap` thay vì để layout bị vỡ.

## 3. Kiến trúc Công nghệ
- **Core:** Next.js (App Router), React, Tailwind CSS.
- **Database / Auth:** Supabase (Client-side & Server-side).
- **Icons:** Lucide-React (Không sử dụng các thư viện icon lộn xộn khác).
- **UI Components:** Kế thừa tư duy của Shadcn-UI kết hợp xây dựng custom components đồng bộ. Quản lý trạng thái nhập liệu chủ yếu qua `Dialog` và `Sheet` để hạn chế chuyển trang thừa thãi.

## 4. Quản lý Quyền hạn (RBAC & Access Control)
Hệ thống tuân thủ mô hình phân quyền 3 lớp đối với các tác vụ CRUD (Create, Read, Update, Delete):
1. **Cán bộ / Nhân viên (Staff):** Chỉ được phép xem, sửa và xóa những dữ liệu **do chính mình tạo ra** hoặc **được giao nhiệm vụ** (Assignee).
2. **Lãnh đạo Phòng (Manager):** Có quyền can thiệp (Xem/Sửa/Xóa) toàn bộ các dữ liệu, tài nguyên thuộc **cùng phòng ban** với mình.
3. **Ban Giám Đốc (Director):** Có **toàn quyền** xem, sửa, xóa các dữ liệu, tài nguyên của toàn bộ các phòng.
4. **Admin:** Có **toàn quyền** quản trị trên toàn bộ hệ thống.

## 5. Quy tắc Logic & Hiệu năng
- **Tối ưu hóa Database:** Hạn chế fetch toàn bộ dữ liệu về Client rồi mới lọc (filter). Các điều kiện phức tạp nên được đưa xuống query của Supabase.
- **Đảm bảo tính toàn vẹn (Data Integrity):** Chức năng Xóa (Delete) phải luôn được kiểm tra ràng buộc (ví dụ: không cho phép xóa xe/phòng nếu đang có lịch trình sử dụng trong tương lai).
- **Tính đồng bộ (URD):** Mọi tài nguyên (Phòng họp, Xe, Task, KPI, Lịch trình) phải luôn đảm bảo có đủ vòng đời quản lý: Cập nhật (Update), Đọc (Read), và Xóa (Delete) bên cạnh việc Tạo mới.

---
*Tài liệu này đóng vai trò như kim chỉ nam cho cấu trúc mã nguồn. Việc giữ cho mã nguồn sạch, thiết kế đẹp và logic chặt chẽ là ưu tiên hàng đầu.*
