// Constants chia sẻ cho module Nhân sự (Team).
// Tách khỏi component để tái dùng giữa Card, Dialog, Widget.

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Quản trị hệ thống", color: "bg-slate-900 text-white shadow-sm" },
  director: { label: "Ban giám đốc", color: "bg-primary text-white shadow-primary-glow" },
  manager: { label: "Lãnh đạo đơn vị", color: "bg-amber-50 text-amber-600 border border-amber-200" },
  staff: { label: "Cán bộ", color: "bg-slate-50 text-slate-500 border border-slate-100" },
  secretary: { label: "Lễ tân", color: "bg-amber-50 text-amber-700 border border-amber-200" },
  hr_officer: { label: "Cán bộ Nhân sự", color: "bg-blue-50 text-blue-600 border border-blue-200" },
  driver: { label: "Lái xe cơ quan", color: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
};

export type ProfileStatus =
  | 'available'
  | 'on_leave'
  | 'on_trip'
  | 'ooo'
  | 'birthday_today'
  | 'new_joiner';

export const STATUS_BADGES: Record<ProfileStatus, { label: string; dotColor: string; chipClass: string }> = {
  available: { label: 'Sẵn sàng', dotColor: 'bg-emerald-500', chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  on_leave: { label: 'Đang nghỉ phép', dotColor: 'bg-amber-500', chipClass: 'bg-amber-50 text-amber-700 border-amber-100' },
  on_trip: { label: 'Đi công tác', dotColor: 'bg-blue-500', chipClass: 'bg-blue-50 text-blue-700 border-blue-100' },
  ooo: { label: 'Vắng mặt', dotColor: 'bg-amber-500', chipClass: 'bg-amber-50 text-amber-700 border-amber-100' },
  birthday_today: { label: 'Sinh nhật hôm nay', dotColor: 'bg-pink-500', chipClass: 'bg-pink-50 text-pink-700 border-pink-100' },
  new_joiner: { label: 'Mới vào (30 ngày)', dotColor: 'bg-violet-500', chipClass: 'bg-violet-50 text-violet-700 border-violet-100' },
};

export const RECOGNITION_TYPES = {
  great_work: { emoji: '👏', label: 'Làm việc xuất sắc' },
  team_player: { emoji: '🤝', label: 'Đồng đội tốt' },
  innovation: { emoji: '💡', label: 'Sáng kiến' },
  mentor: { emoji: '🎓', label: 'Hướng dẫn tận tâm' },
} as const;

export type RecognitionType = keyof typeof RECOGNITION_TYPES;

export const NEW_JOINER_DAYS = 30;
export const ANNIVERSARY_YEARS = [5, 10, 15, 20] as const;
