# Hướng dẫn cho AI Assistant

> File này được đọc tự động khi AI assistant mở project.

## Quy tắc bắt buộc
1. **Luôn đọc `RULES.md`** ở root trước khi viết code
2. **Luôn đọc `design-system/projectflow/MASTER.md`** trước khi làm UI. **TUÂN THỦ TUYỆT ĐỐI** ngôn ngữ thiết kế đã định.
3. **Toàn bộ bằng tiếng Việt** — comment, giải thích, phản hồi
4. **Không file nào vượt 500 dòng** — nếu gần chạm ngưỡng, tách module ngay
5. **Không để comment kiểu marker** — không `[FIX]`, `[NEW]`, `[UPDATE]`, `[v2]`
6. **Triển khai tính năng mới**: Phải luôn kết nối với các tính năng có sẵn (vd: **tối thiểu phải tích hợp sẵn sàng hệ thống thông báo** cho người dùng).

## Tài liệu tham khảo theo thứ tự ưu tiên

1. `RULES.md` — Quy tắc phát triển chung
2. `design-system/projectflow/MASTER.md` — Design System
3. `design-system/pages/[page-name].md` — Quy tắc riêng cho từng trang (nếu có)
4. `README.md` — Tổng quan dự án
5. `schema.sql` — Cấu trúc database

## Cấu trúc module chuẩn

```
src/app/dashboard/[module]/
├── page.tsx              # Shell page ≤ 300 dòng
├── _components/          # Component con
└── _lib/                 # Logic, constants
```

## Lưu ý khi refactor

- Giữ nguyên 100% logic hiện có
- Không thay đổi giao diện khi refactor
- Kiểm tra TypeScript compile sau mỗi thay đổi lớn
