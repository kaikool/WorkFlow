import {
  Calendar as CalendarIcon,
  Users,
  DoorOpen,
  Car,
  Palmtree,
} from "lucide-react";

export const typeLabels: any = {
  meeting: { label: "Họp nội bộ", color: "bg-blue-50 text-blue-600 border-blue-100", icon: DoorOpen },
  trip: { label: "Đi công tác", color: "bg-orange-50 text-orange-600 border-orange-100", icon: Car },
  event: { label: "Sự kiện chi nhánh", color: "bg-purple-50 text-purple-600 border-purple-100", icon: CalendarIcon },
  leave: { label: "Nghỉ phép", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Palmtree },
};

export const statusLabels: any = {
  pending: { label: "Đang chờ duyệt", color: "bg-slate-100 text-slate-500" },
  approved: { label: "Đã xác nhận", color: "bg-emerald-100 text-emerald-600" },
  rejected: { label: "Từ chối", color: "bg-red-100 text-red-600" }
};

export const directorColors = [
  {
    bg: 'bg-indigo-50/80',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    bullet: 'bg-indigo-500',
    pill: 'bg-indigo-50/80 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    hover: 'hover:bg-indigo-100'
  },
  {
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    bullet: 'bg-emerald-500',
    pill: 'bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    hover: 'hover:bg-emerald-100'
  },
  {
    bg: 'bg-rose-50/80',
    border: 'border-rose-200',
    text: 'text-rose-700',
    bullet: 'bg-rose-500',
    pill: 'bg-rose-50/80 text-rose-700 border-rose-200 hover:bg-rose-100',
    hover: 'hover:bg-rose-100'
  },
  {
    bg: 'bg-amber-50/80',
    border: 'border-amber-200',
    text: 'text-amber-700',
    bullet: 'bg-amber-500',
    pill: 'bg-amber-50/80 text-amber-700 border-amber-200 hover:bg-amber-100',
    hover: 'hover:bg-amber-100'
  },
  {
    bg: 'bg-sky-50/80',
    border: 'border-sky-200',
    text: 'text-sky-700',
    bullet: 'bg-sky-500',
    pill: 'bg-sky-50/80 text-sky-700 border-sky-200 hover:bg-sky-100',
    hover: 'hover:bg-sky-100'
  },
  {
    bg: 'bg-fuchsia-50/80',
    border: 'border-fuchsia-200',
    text: 'text-fuchsia-700',
    bullet: 'bg-fuchsia-500',
    pill: 'bg-fuchsia-50/80 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100',
    hover: 'hover:bg-fuchsia-100'
  },
  {
    bg: 'bg-teal-50/80',
    border: 'border-teal-200',
    text: 'text-teal-700',
    bullet: 'bg-teal-500',
    pill: 'bg-teal-50/80 text-teal-700 border-teal-200 hover:bg-teal-100',
    hover: 'hover:bg-teal-100'
  },
  {
    bg: 'bg-violet-50/80',
    border: 'border-violet-200',
    text: 'text-violet-700',
    bullet: 'bg-violet-500',
    pill: 'bg-violet-50/80 text-violet-700 border-violet-200 hover:bg-violet-100',
    hover: 'hover:bg-violet-100'
  }
];

// Danh sách giờ từ 7h đến 18h
export const timeOptions = Array.from({ length: 12 }).map((_, i) => {
  const time = `${(i + 7).toString().padStart(2, '0')}:00`;
  return time;
});
