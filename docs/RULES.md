# Quy tắc phát triển ProjectFlow

> Tài liệu này là **BẮT BUỘC** cho mọi thành viên phát triển (con người lẫn AI assistant).
> Commit trực tiếp vào repo Git, áp dụng trên mọi máy.

---

## 1. Giới hạn kích thước file

| Loại file | Giới hạn tối đa | Hành động khi vượt |
|---|---|---|
| Component / Page (`*.tsx`) | **500 dòng** | Phải tách thành module con trong `_components/` |
| Logic / Hooks (`*.ts`) | **300 dòng** | Phải tách thành file nhỏ hơn trong `_lib/` hoặc `_hooks/` |
| CSS / Style | **400 dòng** | Phải chia theo module |

> ⛔ **Nghiêm cấm** để bất kỳ file nào vượt quá 500 dòng. Nếu đang viết mà gần chạm ngưỡng, phải dừng lại và tách module trước khi tiếp tục.

---

## 2. Cấu trúc thư mục chuẩn

Mỗi module/route lớn phải tuân theo cấu trúc:

```
src/app/dashboard/[module]/
├── page.tsx                 # Shell page: state, hooks, handlers (≤ 300 dòng)
├── _components/             # Các component UI
│   ├── ComponentA.tsx
│   └── ComponentB.tsx
└── _lib/                    # Logic, constants, utilities
    ├── constants.ts
    └── utils.ts
```

- `page.tsx` chỉ chứa **state, hooks, handlers và layout chính** — không chứa JSX phức tạp
- Component con trong `_components/` phải **tự chứa** (self-contained), nhận data qua props
- Logic tái sử dụng đặt trong `_lib/`

---

## 3. Quy tắc đặt tên

| Đối tượng | Convention | Ví dụ |
|---|---|---|
| Component | PascalCase | `ScheduleCard.tsx` |
| Utility file | camelCase | `utils.ts`, `constants.ts` |
| Hook | camelCase, prefix `use` | `useScheduleData.ts` |
| Thư mục private | Prefix `_` | `_components/`, `_lib/` |
| CSS class | kebab-case | `premium-card` |

---

## 4. Quy tắc Code

### Nguyên tắc chung
- **Ngôn ngữ comment**: Tiếng Việt
- **Không để comment debug**: Xóa `console.log`, `// TODO`, `// FIX` trước khi commit
- **Không có comment version**: Không ghi `[FIX]`, `[NEW]`, `[UPDATE]`, `[v2]` trong comment
- **Comment phản ánh bản chất**: Ngắn gọn, mô tả đúng mục đích của đoạn code

### TypeScript
- Sử dụng `interface` cho props của component
- Tránh `any` khi có thể, dùng type cụ thể
- Export mặc định (`export default`) cho component chính của file

### React / Next.js
- Dùng `'use client'` chỉ khi cần thiết
- Tách logic phức tạp ra `useMemo`, `useCallback`
- State chỉ đặt ở component cha cần thiết nhất (lift state tối thiểu)

---

## 5. Design System & Ngôn ngữ thiết kế

> Tham khảo chi tiết: [`design-system/projectflow/MASTER.md`](design-system/projectflow/MASTER.md)

**TUÂN THỦ TUYỆT ĐỐI**: Ngôn ngữ thiết kế (Design System) là bắt buộc. Không tự ý sáng tạo sai lệch với các nguyên tắc đã định ra trong file `MASTER.md`.

### Tóm tắt nhanh
- **Font**: System Font Stack (không dùng Google Fonts)
- **Typography Apple HIG responsive**: Desktop web body `16px`; iPad/mobile body `17px`; control desktop `15px`, iPad/mobile `16px`; caption tối thiểu `12px`
- **Touch target responsive**: Desktop web tối thiểu `40px`; iPad/mobile tối thiểu `44px`
- **Bo góc**: Button/input `12px`; card mobile `18px`, iPad `22px`, desktop `24px` theo token hệ thống
- **Spacing**: Dùng lưới `4px/8px`; page mobile `16px`, iPad `24px`, desktop `32px`; card mobile `20px`, iPad/desktop `24px`
- **Màu chính**: Primary theo token CSS hiện hành, accent chỉ dùng cho highlight quan trọng
- **Phong cách**: Apple HIG — rõ chữ, dễ chạm, tối giản, chuyên nghiệp, không rườm rà

### Chuẩn Apple HIG responsive bắt buộc cho toàn bộ app
- Không dùng font nhỏ hơn `12px` ở bất kỳ breakpoint nào. Metadata/badge dùng `12px–13px`; nội dung chính dùng `16px` trên desktop web và `17px` trên iPad/mobile.
- Không dùng `tracking-tight`, `tracking-tighter`, `tracking-wider` cho nội dung đọc. Global CSS triệt tiêu tracking để chữ rõ hơn.
- Không dùng chữ hoa toàn bộ cho heading, label, tab, button, badge hoặc section title. Chỉ dùng chữ hoa cho mã, biển số, viết tắt chính thức như KPI/TCTH, hoặc dữ liệu bắt buộc giữ nguyên.
- Không tạo button/input/menu item thấp hơn `40px` trên desktop web hoặc `44px` trên iPad/mobile. Nếu cần giao diện dày đặc, giảm số control hiển thị thay vì giảm vùng chạm.
- Không tự đặt padding nhỏ kiểu `p-1`, `py-0.5`, `h-7`, `h-8` cho control tương tác trừ khi phần tử không phải vùng bấm/chạm.
- Card dùng `.premium-card`; không lồng card trong card; không tự phá padding chuẩn nếu không có lý do layout bắt buộc.
- Toolbar, dialog, popover, dropdown, select, input, textarea, tab, toast va button phai dung primitive trong `src/components/ui/*` hoac class tuong duong: `text-sm`, `min-h-10` desktop, `min-h-11` cho mobile/iPad, `rounded-xl`, padding ngang toi thieu `px-3`/`px-4`.
- Các token chuẩn nằm trong `src/app/globals.css`: `--app-font-*`, `--app-touch-target`, `--app-page-x`, `--app-card-padding`, `--app-control-radius`, `--app-card-radius`.

---

## 6. Triển khai Tính năng Mới

- **Liên kết chức năng**: Khi phát triển một tính năng mới, bắt buộc phải xem xét cách nó liên kết và ảnh hưởng tới các tính năng đã có sẵn.
- **Hệ thống thông báo (CỰC KỲ QUAN TRỌNG)**: 
  Mọi thao tác thay đổi dữ liệu hoặc trạng thái làm việc đều **bắt buộc** phải tạo ra dòng record (thông báo) gửi vào bảng `notifications`. Tuyệt đối không được code tính năng mà quên mất phần thông báo.
  **Các luồng BẮT BUỘC phải có Notification:**
  - *Khởi tạo:* Giao việc mới, giao KPI, mời họp.
  - *Cập nhật trạng thái:* Chuyển công việc sang Đang làm, Hoàn thành, Hủy bỏ.
  - *Tương tác:* Comment vào công việc/báo cáo, gửi báo cáo mới, phản hồi/duyệt báo cáo.
  - *Hạn chót:* Cảnh báo sắp trễ hạn, quá hạn.
  - *Cá nhân/Nội bộ:* Sinh nhật, thông báo chúc mừng KPI.

---

## 7. Git Workflow

- **Branch chính**: `main`
- **Commit message**: Tiếng Việt, mô tả ngắn gọn hành động
  - ✅ `Refactor trang lịch trình`
  - ✅ `Sửa lỗi logic trùng lịch`
  - ❌ `fix bug`, `update code`
- **Không commit**: `node_modules/`, `.next/`, `.env.local`

---

## 8. Quy tắc Phân quyền (Role Matrix)

> Tham khảo chi tiết: [`docs/ROLE_MATRIX.md`](docs/ROLE_MATRIX.md)

**BẮT BUỘC TUÂN THỦ**: Bất kỳ lập trình viên nào khi tham gia phát triển dự án ProjectFlow, trước khi chỉnh sửa bất kỳ dòng mã nguồn nào liên quan đến Giao diện (Frontend), API, hoặc Database (SQL Policies / RLS), bắt buộc phải đọc, hiểu rõ và tuân thủ tuyệt đối ma trận phân quyền trong file `docs/ROLE_MATRIX.md`.
- **Tuyệt đối không** viết các câu lệnh SQL bypass RLS.
- **Bắt buộc** khóa (disable) các ô nhập liệu chỉ tiêu KPI đối với tài khoản nhân viên (chỉ cho phép sửa `current_value`).
- Mọi yêu cầu lịch trình có sử dụng xe/phòng họp của nhân viên/trưởng phòng đều có trạng thái mặc định là `pending` và chỉ được duyệt bởi `admin` hoặc `secretary`.
- **Bắt buộc tuân thủ phân cấp lãnh đạo & quy tắc ưu tiên:**
  - *Quyền lực ngang hàng theo Role:* Giám đốc/Phó Giám đốc có toàn quyền vĩ mô ngang nhau. Trưởng phòng/Phó phòng có toàn quyền quản lý đơn vị nghiệp vụ ngang nhau (giao việc cho phòng ban mình, duyệt đơn nghỉ phép của phòng, cập nhật tiến độ và hiệu chỉnh số liệu phòng).
  - *Ưu tiên hiển thị:* Người có `is_department_head = true` (Trưởng phòng/Giám đốc điều hành chính) luôn được xếp lên đầu danh sách chọn để dễ giao việc.
  - *Quyền tự chủ của cán bộ được giao:* Cán bộ được giao việc (`assignee`) có toàn quyền trực tiếp cập nhật tiến độ lên 100% để "Hoàn thành" báo cáo/nhiệm vụ của mình.

---

## 9. Checklist trước khi commit

- [ ] Không file nào vượt 500 dòng
- [ ] TypeScript compile thành công (`npx tsc --noEmit`)
- [ ] Không có `console.log` thừa
- [ ] Comment sạch, không có marker debug
- [ ] UI nhất quán với Design System
- [ ] Tuân thủ ma trận phân quyền trong `docs/ROLE_MATRIX.md`
