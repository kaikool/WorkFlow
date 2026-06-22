# Giấy đề nghị sử dụng xe — Cấu trúc văn bản

> **Cỡ chữ:** Times New Roman, 22 twip (11pt) nếu không ghi khác
> Mỗi dòng là một Paragraph riêng, cách nhau spacing after: 0–200 twip

---

## I. PHẦN ĐẦU — Header (trái)

```
Line 1  | NGÂN HÀNG TMCP CÔNG THƯƠNG VIỆT NAM              CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM    | Bold, 22, RIGHT
Line 2  |      CHI NHÁNH HOÀNG MAI                              Độc lập - Tự do - Hạnh phúc     | Italic, 22
        | 


        | [cách 120]
Line     | GIẤY ĐỀ NGHỊ SỬ DỤNG XE               | Bold, 28, CENTER, Underline
        | [cách 120]
```

## II. NỘI DUNG — Body

```
Line 8  | Kính gửi: Ban Giám đốc Chi nhánh Hoàng Mai    | Bold, 24, MIDDLE
        | [cách 200]

--- CẤU TRÚC DÒNG: Họ tên và giá trị trên CÙNG MỘT DÒNG, dùng multi-run ---

Line 9  | "Họ tên :" (normal) + "Nguyễn Văn A" (bold)   | LEFT, 24
        | [cách 120]

Line 10 | "Đơn vị (phòng/ban):" (normal) + "Phòng ABC" (bold) | LEFT, 24
        | [cách 200]

Line 11 | Thực hiện kế hoạch công tác đã được Ban lãnh đạo phê duyệt. | LEFT, 24
        | [cách 200]

Line 12 | - Số lượng xe ô tô: 01 chiếc                    | LEFT, 24
        | [cách 120]

Line 13 | - Số người sử dụng xe: 03 người, gồm:           | LEFT, 24
        | [cách 120]

===> Danh sách người: mỗi người 1 dòng <===

Line  | 1. Ông Nguyễn Văn A [ có điểm tab để căn thẳng với chức vụ người sau] Chức vụ: Phó giám đốc      | LEFT, 24
        | [cách 60]

Line  | 2. Bà Nguyễn Thị B [ có điểm tab để căn thẳng với chức vụ người sau] Chức vụ: Trưởng phòng       | LEFT, 24
        | [cách 60]

Line  | 3. Nguyễn Văn C [ có điểm tab để căn thẳng với chức vụ người sau] Chức vụ: Cán bộ                | LEFT, 24
        | [cách 200]


Line  | - Thời gian: + Từ: 08 giờ 30 ngày 14 tháng 05 năm 2026 | LEFT, 24
        | [cách 120]

Line  | - Nơi đến công tác: 21 Lê Đức Thọ               | LEFT, 24
        | [cách 120]

Line  | - Lý do công tác: Chúc mừng sinh nhật           | LEFT, 24
        | [cách 200]
```

## III. CHỮ KÝ — Signature

```
        | [cách 60]

Line 20 | Hà Nội, ngày 14 tháng 05 năm 2026              | Italic, 24, RIGHT
        | [cách 60]

=== KẺ BẢNG: 2 cột, không border (không viền), mỗi cột 2500 DXA ===

 BẢNG:
 ┌──────────────────────────────┬──────────────────────────────┐
 │        CỘT 1                 │        CỘT 2                │
 │                              │                              │
 │  XÁC NHẬN TRƯỞNG PHÒNG/BAN   │   NGƯỜI ĐỀ NGHỊ             │
 │  QUẢN LÝ CÁN BỘ             │                              │
 │                              │                              │
 │  (chừa chỗ ký: before 400)   │   (chừa chỗ ký: before 400) │
 └──────────────────────────────┴──────────────────────────────┘
  CỘT 3 				cột 4
PHÒNG TCTH 				GIÁM ĐỐC 
 BẢNG NÀY LÀ 4 CỘT FULL HÀNG NGANG, CĂN GIỮA TEXT BÊN TRONG MỖI CỘT. CHIỀU DÀI VỪA ĐỦ CHỖ KÝ  KHOẢNG 800 HAY HƠN

## IV. MARGIN (lề trang)

```
Top: 1440 (1 inch)
Right: 1440
Bottom: 1440
Left: 1440
```

---

## MẤY CHỖ CON NGHI NGỜ CẦN BỐ CHỈNH:

1. **Bảng chữ ký** — hiện tại con kẻ 2 cột. Đúng hay phải 3 cột (thêm cột giữa trống)?
2. **"PHÒNG TCTH" và "GIÁM ĐỐC DUYỆT"** — để CENTER riêng từng dòng, hay gộp vào hàng cuối của bảng?
3. **Font size** — "22" = 11pt, "24" = 12pt, "28" = 14pt. Có đúng không?
4. **Khoảng cách "Chức vụ:"** — 2 space giữa tên và "Chức vụ:" có đúng không?
5. **Số người** — có zero-pad (03 người) hay không (3 người)?

Bố sửa thoải mái trong file md này, xong con làm lại theo đúng format ạ.
