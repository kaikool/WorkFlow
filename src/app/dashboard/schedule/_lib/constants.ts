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
    bg: 'bg-slate-50/80',
    border: 'border-slate-200',
    text: 'text-slate-700',
    bullet: 'bg-slate-500',
    pill: 'bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100',
    hover: 'hover:bg-slate-100'
  },
  {
    bg: 'bg-slate-50/80',
    border: 'border-slate-200',
    text: 'text-slate-700',
    bullet: 'bg-slate-500',
    pill: 'bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100',
    hover: 'hover:bg-slate-100'
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
    bg: 'bg-amber-50/80',
    border: 'border-amber-200',
    text: 'text-amber-700',
    bullet: 'bg-amber-500',
    pill: 'bg-amber-50/80 text-amber-700 border-amber-200 hover:bg-amber-100',
    hover: 'hover:bg-amber-100'
  },
  {
    bg: 'bg-slate-50/80',
    border: 'border-slate-200',
    text: 'text-slate-700',
    bullet: 'bg-slate-500',
    pill: 'bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100',
    hover: 'hover:bg-slate-100'
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
    bg: 'bg-slate-50/80',
    border: 'border-slate-200',
    text: 'text-slate-700',
    bullet: 'bg-slate-500',
    pill: 'bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100',
    hover: 'hover:bg-slate-100'
  },
  {
    bg: 'bg-amber-50/80',
    border: 'border-amber-200',
    text: 'text-amber-700',
    bullet: 'bg-amber-500',
    pill: 'bg-amber-50/80 text-amber-700 border-amber-200 hover:bg-amber-100',
    hover: 'hover:bg-amber-100'
  }
];

// Danh sách giờ từ 7h đến 18h
export const timeOptions = Array.from({ length: 23 }).map((_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const hour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minute = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
});
