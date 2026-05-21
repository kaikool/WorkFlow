import {
  Calendar as CalendarIcon,
  Users,
  DoorOpen,
  Car,
  Palmtree,
} from "lucide-react";

export const typeLabels: any = {
  meeting: { label: "Họp nội bộ", color: "bg-slate-50 text-slate-700 border-slate-200", icon: DoorOpen },
  trip: { label: "Đi công tác", color: "bg-amber-50 text-amber-700 border-amber-100", icon: Car },
  event: { label: "Sự kiện chi nhánh", color: "bg-slate-50 text-slate-700 border-slate-200", icon: CalendarIcon },
  leave: { label: "Nghỉ phép", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Palmtree },
};

export const statusLabels: any = {
  pending:     { label: "Đang chờ duyệt", color: "bg-slate-100 text-slate-500" },
  approved:    { label: "Đã xác nhận",    color: "bg-slate-900 text-white" },
  rejected:    { label: "Từ chối",         color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "Đang thực hiện", color: "bg-amber-600 text-white" },
  completed:   { label: "Hoàn thành",     color: "bg-slate-100 text-slate-700" },
};

export const directorColors = [
  {
    bg: 'bg-indigo-50/80',
    border: 'border-indigo-100',
    text: 'text-indigo-700',
    bullet: 'bg-indigo-600',
    pill: 'bg-indigo-50/80 text-indigo-700 border-indigo-100 hover:bg-indigo-100',
    hover: 'hover:bg-indigo-100'
  },
  {
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-100',
    text: 'text-emerald-700',
    bullet: 'bg-emerald-600',
    pill: 'bg-emerald-50/80 text-emerald-700 border-emerald-100 hover:bg-emerald-100',
    hover: 'hover:bg-emerald-100'
  },
  {
    bg: 'bg-violet-50/80',
    border: 'border-violet-100',
    text: 'text-violet-700',
    bullet: 'bg-violet-600',
    pill: 'bg-violet-50/80 text-violet-700 border-violet-100 hover:bg-violet-100',
    hover: 'hover:bg-violet-100'
  },
  {
    bg: 'bg-rose-50/80',
    border: 'border-rose-100',
    text: 'text-rose-700',
    bullet: 'bg-rose-600',
    pill: 'bg-rose-50/80 text-rose-700 border-rose-100 hover:bg-rose-100',
    hover: 'hover:bg-rose-100'
  },
  {
    bg: 'bg-sky-50/80',
    border: 'border-sky-100',
    text: 'text-sky-700',
    bullet: 'bg-sky-600',
    pill: 'bg-sky-50/80 text-sky-700 border-sky-100 hover:bg-sky-100',
    hover: 'hover:bg-sky-100'
  },
  {
    bg: 'bg-orange-50/80',
    border: 'border-orange-100',
    text: 'text-orange-700',
    bullet: 'bg-orange-600',
    pill: 'bg-orange-50/80 text-orange-700 border-orange-100 hover:bg-orange-100',
    hover: 'hover:bg-orange-100'
  },
  {
    bg: 'bg-teal-50/80',
    border: 'border-teal-100',
    text: 'text-teal-700',
    bullet: 'bg-teal-600',
    pill: 'bg-teal-50/80 text-teal-700 border-teal-100 hover:bg-teal-100',
    hover: 'hover:bg-teal-100'
  },
  {
    bg: 'bg-fuchsia-50/80',
    border: 'border-fuchsia-100',
    text: 'text-fuchsia-700',
    bullet: 'bg-fuchsia-600',
    pill: 'bg-fuchsia-50/80 text-fuchsia-700 border-fuchsia-100 hover:bg-fuchsia-100',
    hover: 'hover:bg-fuchsia-100'
  }
];

// Danh sách giờ từ 7h đến 18h
export const timeOptions = Array.from({ length: 23 }).map((_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const hour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minute = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
});
