# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> 📋 **Quy tắc phát triển chung:** Xem [`RULES.md`](../../RULES.md) — giới hạn file size, cấu trúc thư mục, coding standards.

---

**Project:** projectFlow — WorkFlow Portal
**Updated:** 2026-05-18
**Category:** Banking/Traditional Finance

---

## Global Rules

### Color Palette

| Role | Hex | Tailwind | CSS Variable |
|------|-----|----------|--------------|
| Primary | `#0F172A` | `slate-900` | `--color-primary` |
| Secondary | `#1E3A8A` | `blue-900` | `--color-secondary` |
| CTA/Accent | `#CA8A04` | `amber-600` | `--color-cta` |
| Background | `#F8FAFC` | `slate-50` | `--color-background` |
| Text | `#020617` | `slate-950` | `--color-text` |
| Muted Text | `#64748B` | `slate-500` | — |
| Border | `#E2E8F0` | `slate-200` | — |

**Color Notes:** Trust navy + premium gold. Accent dùng `amber-600/700` (gold) cho CTA và highlight quan trọng. Tuyệt đối không dùng purple/pink/indigo gradient.

---

### Typography

- **Font:** IBM Plex Sans (tất cả cấp độ tiêu đề và body)
- **Mood:** financial, trustworthy, professional, corporate, banking, serious
- **Google Fonts:** [IBM Plex Sans](https://fonts.google.com/share?selection.family=IBM+Plex+Sans:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
```

**Typography Scale:**
| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Page Title | `text-2xl` | `font-semibold` | `<h1>` trên mỗi trang |
| Section Title | `text-base` | `font-bold` | Tiêu đề card/block |
| Label | `text-xs` | `font-bold uppercase` | Nhãn trường dữ liệu |
| Body | `text-sm` / `text-[14px]` | `font-medium` | Nội dung |
| Caption | `text-[11px]`–`text-xs` | `font-medium` | Phụ chú, metadata |

---

### Spacing Variables

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--space-xs` | `4px` | `gap-1`, `p-1` | Icon gap nội tuyến |
| `--space-sm` | `8px` | `gap-2`, `p-2` | Gap trong badge/chip |
| `--space-md` | `16px` | `gap-4`, `p-4` | Padding nội dung card |
| `--space-lg` | `24px` | `gap-6`, `p-6` | **Padding chuẩn card** |
| `--space-xl` | `32px` | `gap-8`, `p-8` | Khoảng cách section |
| `--space-2xl` | `48px` | `gap-12` | Section margin lớn |

---

### Shadow Depths

| Level | Tailwind | Usage |
|-------|----------|-------|
| Subtle | `shadow-sm` | Card nền nhạt |
| Card | `shadow` | `.premium-card` chuẩn |
| Hover | `shadow-xl` | Card khi hover |
| Modal | `shadow-2xl` | Dialog, popover |

---

## Layout System

### Shell Structure

```
DashboardShell
└── <aside>   Sidebar (w-64, hidden trên mobile)
└── <main>    py-6 md:py-8 w-full overflow-x-hidden
    └── {children}  ← mỗi trang tự quản lý padding ngang
```

> ⚠️ **Quan trọng:** Shell `<main>` CHỈ cung cấp `padding-top/bottom`. 
> Mỗi trang tự khai báo padding ngang trên outer wrapper của mình.

### Page Outer Wrapper (CHUẨN BẮT BUỘC)

```jsx
// Tất cả trang đều dùng pattern này
<div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-10 animate-fade-in-up pb-20">
```

| Class | Mục đích |
|-------|----------|
| `max-w-6xl mx-auto` | Giới hạn chiều rộng 1152px, căn giữa |
| `px-4 sm:px-6` | Lề ngang: 16px mobile, 24px tablet+ |
| `space-y-6 md:space-y-10` | Khoảng cách dọc giữa các section |
| `pb-20` | Padding dưới cùng tránh nội dung bị cắt |

### Header Row Của Trang

```jsx
// Dòng tiêu đề + nút CTA trên cùng mỗi trang
<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
  <div className="space-y-1">
    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Tên trang</h1>
    <p className="text-[13px] text-slate-500 font-medium">Mô tả ngắn</p>
  </div>
  <Button className="bg-primary h-10 px-5 rounded-xl font-medium">CTA</Button>
</div>
```

> ❌ **Không** dùng `px-4 sm:px-0` hay `px-0 sm:px-6` trong header row — padding đã được cung cấp bởi outer wrapper.

### Detail Page Navigation (Quay lại)

```jsx
// Hàng nav quay lại + nút hành động ở trang chi tiết
<div className="flex items-center justify-between pt-4 sm:pt-0">
  <Button variant="ghost" asChild>
    <Link href="..." className="flex items-center gap-2">
      <ChevronLeft className="w-4 h-4" />
      <span className="text-[13px] font-medium">Quay lại danh sách</span>
    </Link>
  </Button>
  {/* Nút xóa hoặc hành động phụ */}
</div>
```

---

## Component Specs

### Cards — `.premium-card`

```css
.premium-card {
  background: white;
  border-radius: 16px;    /* rounded-2xl */
  padding: 24px;          /* p-6 — CHUẨN BẮT BUỘC */
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  transition: box-shadow 300ms ease, transform 300ms ease;
}

.premium-card:hover {
  box-shadow: 0 10px 40px rgba(15,23,42,0.08);
}
```

**Tailwind equivalent:**
```jsx
<div className="premium-card p-6 border-none space-y-6">
```

> ❌ Không dùng `p-4`, `p-8` trực tiếp trong `.premium-card` — luôn dùng `p-6`.
> ❌ Không lồng `.premium-card` bên trong `.premium-card`.

### Stat Cards (KPI mini widget)

```jsx
<div className="p-4 md:p-5 bg-slate-50 rounded-2xl space-y-1 border border-slate-100 shadow-sm
                transition-all hover:bg-white hover:shadow-md group">
  <p className="text-xs font-bold text-slate-500 uppercase">Label</p>
  <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tighter">Value</p>
</div>
```

### Buttons

```jsx
// Primary CTA
<Button className="bg-primary hover:bg-primary/90 h-10 px-5 rounded-xl font-medium">

// Destructive
<Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl">

// Icon button
<Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
```

> ❌ Button primary KHÔNG dùng `amber/gold` màu nền — chỉ dùng cho highlight accent.
> ✅ `active:scale-95 transition-all` trên mọi button có action.

### Badges

```jsx
// Status badges
const statusStyles = {
  todo:   "bg-slate-100 text-slate-600",
  doing:  "bg-primary/10 text-primary",
  done:   "bg-emerald-50 text-emerald-700",
  late:   "bg-red-50 text-red-600",
  closed: "bg-slate-100 text-slate-500",
};

<Badge className={cn("text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border-none", style)}>
```

### Inputs

```jsx
<Input className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]
                  focus-visible:ring-1 focus-visible:ring-primary/30" />
```

### Modals / Dialogs

```jsx
<DialogContent className="rounded-2xl border-none shadow-2xl max-w-lg">
  <DialogHeader>
    <DialogTitle className="text-[17px] font-semibold text-slate-900">Tiêu đề</DialogTitle>
  </DialogHeader>
  <div className="space-y-5 py-4 max-h-[70vh] overflow-y-auto px-1">
    {/* Nội dung */}
  </div>
</DialogContent>
```

### Section Label (chuẩn trong card)

```jsx
<h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
  <Icon className="w-4 h-4 text-primary" />
  Tên section
</h3>
```

---

## Data Security & Role Permissions

### Phân Quyền Truy Cập Dữ Liệu

| Role | Phạm vi xem |
|------|-------------|
| `admin` | Toàn hệ thống, không giới hạn |
| `director` | Toàn hệ thống, không giới hạn |
| `manager` | Phòng của mình + tasks do mình tạo/được giao |
| `staff` | Phòng của mình + tasks do mình tạo/được giao |

**Pattern filter chuẩn (Supabase):**
```typescript
const isPowerUser = profile?.role === 'admin' || profile?.role === 'director';

if (!isPowerUser && profile?.department_id) {
  query = query.or(
    `department_id.eq.${profile.department_id},created_by.eq.${profile.id},assignee_id.eq.${profile.id}`
  );
}
```

### Task Type Routing

| `task_type` | Hiển thị tại |
|-------------|--------------|
| `regular` | Trang Công việc (`/dashboard/tasks`) |
| `report` | Trang Công việc tab Báo cáo |
| `kpi` | Trang KPI (`/dashboard/kpi`) — **không hiển thị ở Công việc** |

---

## Style Guidelines

**Style:** Exaggerated Minimalism

**Keywords:** Bold minimalism, high contrast, negative space, premium, banking, statement design

**Key Principles:**
- Contrast cao: nền trắng/slate-50 với text slate-900
- Typography đậm: heading `font-bold` / `font-semibold`, label `font-bold uppercase`
- Góc bo tròn nhất quán: card `rounded-2xl`, button `rounded-xl`, input `rounded-xl`
- Animation tinh tế: `transition-all duration-200`, `animate-fade-in-up`, `active:scale-95`
- Số tabular: `tabular-nums tracking-tighter` cho mọi con số quan trọng

---

## Anti-Patterns (Do NOT Use)

- ❌ Purple/pink/indigo gradient
- ❌ Lồng `.premium-card` trong `.premium-card`
- ❌ Padding `px-4 sm:px-0` trong header row (đã xử lý ở outer wrapper)
- ❌ `p-4` hay `p-8` thay cho `p-6` trong `.premium-card`
- ❌ Hiển thị KPI task ở trang Công việc
- ❌ Hiển thị data ngoài phòng ban cho non-admin/non-director
- ❌ Emoji làm icon — dùng Lucide SVG
- ❌ Layout-shifting hover (scale transform làm bật chỗ khác)
- ❌ Transition instant — luôn dùng `duration-150` đến `duration-300`
- ❌ Double padding: shell padding + page padding chồng nhau

---

## Pre-Delivery Checklist

Trước khi commit bất kỳ UI nào, kiểm tra:

- [ ] Outer wrapper đúng pattern: `max-w-6xl mx-auto px-4 sm:px-6 space-y-... pb-20`
- [ ] Cards dùng `premium-card p-6 border-none`
- [ ] KPI task không hiện ở trang Công việc
- [ ] Data scoped đúng theo role/department
- [ ] Không dùng màu indigo/purple/pink
- [ ] `cursor-pointer` trên tất cả element clickable
- [ ] Hover transitions 150–300ms
- [ ] `active:scale-95` trên button/card có action
- [ ] Text contrast ≥ 4.5:1
- [ ] Responsive tốt tại: 375px, 768px, 1024px, 1440px
- [ ] Không horizontal scroll trên mobile
- [ ] Số liệu dùng `tabular-nums tracking-tighter`
