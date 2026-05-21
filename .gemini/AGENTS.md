# Hướng dẫn cho AI Assistant

> File này được đọc tự động khi AI assistant mở project.

## Quy tắc bắt buộc
1. **Luôn đọc `RULES.md`** ở root (trỏ tới `docs/TECHNICAL_RULES.md`) trước khi viết code.
2. **Luôn đọc `design-system/projectflow/MASTER.md`** trước khi làm UI. **TUÂN THỦ TUYỆT ĐỐI** ngôn ngữ thiết kế đã định.
3. **Toàn bộ bằng tiếng Việt** — comment, giải thích, phản hồi.
4. **Không file nào vượt 500 dòng** — nếu gần chạm ngưỡng, tách module ngay.
5. **Không để comment kiểu marker** — không `[FIX]`, `[NEW]`, `[UPDATE]`, `[v2]`.
6. **Triển khai tính năng mới**: Phải luôn kết nối với các tính năng có sẵn (vd: **BẮT BUỘC phải tạo record `notifications`** cho MỌI hành động thay đổi dữ liệu như Đổi trạng thái, Thêm Comment, Cập nhật tiến độ). Không được phép code thiếu bước bắn thông báo.

## Kích hoạt & Sử dụng các Skills đã cài đặt (.gemini/skills/)
Hệ thống đã được tích hợp sẵn các bộ kỹ năng chuyên biệt cho Web App & Apple HIG. AI Assistant **BẮT BUỘC** phải tự động đọc tài liệu `SKILL.md` tương ứng trong thư mục `.gemini/skills/` khi thực hiện các tác vụ liên quan:
*   **Khi thiết kế UI/UX & các hành động tương tác:** Đọc và áp dụng quy tắc từ:
    *   👉 `[.gemini/skills/apple-hig-expert/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/apple-hig-expert/SKILL.md)` (Độ bo góc, Liquid Glass, vùng chạm tối thiểu 44px, micro-animations, Sentence case).
    *   👉 `[.gemini/skills/ui-design-system/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/ui-design-system/SKILL.md)` (Sử dụng thống nhất các tokens màu sắc slate-900/amber-600, spacing và class `.premium-card`).
*   **Khi viết code Front-end React/Next.js/TypeScript:** Đọc và áp dụng quy tắc từ:
    *   👉 `[.gemini/skills/senior-frontend/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/senior-frontend/SKILL.md)` (Sử dụng Client/Server component hợp lý, tối ưu hóa bundle size, accessibility checklist).
*   **Khi xây dựng API, kết nối Cơ sở dữ liệu (Supabase, Postgres, RLS):** Đọc và áp dụng quy tắc từ:
    *   👉 `[.gemini/skills/senior-fullstack/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/senior-fullstack/SKILL.md)` (Tối ưu hóa query, phân quyền bảo mật dữ liệu).
*   **Khi thiết kế kiến trúc hoặc cần review chất lượng code:** Đọc và áp dụng quy tắc từ:
    *   👉 `[.gemini/skills/senior-architect/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/senior-architect/SKILL.md)` & `[.gemini/skills/code-reviewer/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/code-reviewer/SKILL.md)`.
*   **Khi giao Roles, phân tích vận hành dự án, cấu trúc workflow phòng ban:** Đọc và áp dụng quy tắc từ:
    *   👉 `[.gemini/skills/senior-pm/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/senior-pm/SKILL.md)` (Lập ma trận RACI phân vai, thiết lập quyền hạn (roles), quy trình giao việc công sở và quản trị rủi ro).
    *   👉 `[.gemini/skills/process-mapper/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/process-mapper/SKILL.md)` (Sơ đồ hóa quy trình vận hành công việc, tối ưu hóa các điểm nghẽn và cải tiến hiệu năng phòng ban).
*   **Khi phát triển một tính năng mới (New Feature):** Đọc và áp dụng quy tắc từ:
    *   👉 `[.gemini/skills/spec-driven-workflow/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/spec-driven-workflow/SKILL.md)` (**BẮT BUỘC** soạn thảo tài liệu đặc tả kỹ thuật và viết các kịch bản Given/When/Then chi tiết để kiểm thử trước khi tiến hành viết bất kỳ dòng code logic nào).
*   **Khi kiểm toán lại các quy tắc hệ thống (Rules Auditing) hoặc review thay đổi code:** Đọc và áp dụng quy tắc từ:
    *   👉 `[.gemini/skills/pr-review-expert/SKILL.md](file:///d:/Antigravity/136HUB/WorkFlow/.gemini/skills/pr-review-expert/SKILL.md)` (**BẮT BUỘC** kiểm toán sự tuân thủ đối với `docs/TECHNICAL_RULES.md`, phân tích tác động/blast radius của các thay đổi và đảm bảo an toàn nghiệp vụ trước khi xác nhận hoàn thành).

## Tài liệu tham khảo theo thứ tự ưu tiên

1. `docs/TECHNICAL_RULES.md` — Quy tắc kỹ thuật và nghiệp vụ tối cao.
2. `design-system/projectflow/MASTER.md` — Design System chuẩn.
3. `design-system/pages/[page-name].md` — Quy tắc riêng cho từng trang (nếu có).
4. `README.md` — Tổng quan dự án.
5. `schema.sql` — Cấu trúc database.

## Cấu trúc module chuẩn

```
src/app/dashboard/[module]/
├── page.tsx              # Shell page ≤ 300 dòng
├── _components/          # Component con
└── _lib/                 # Logic, constants
```

## Lưu ý khi refactor

- Giữ nguyên 100% logic hiện có.
- Không thay đổi giao diện khi refactor.
- Kiểm tra TypeScript compile sau mỗi thay đổi lớn (`npx tsc --noEmit`).

