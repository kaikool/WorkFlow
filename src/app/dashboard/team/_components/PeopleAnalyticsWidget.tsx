'use client'

import React, { useMemo } from "react";
import { Cake, Award, PartyPopper, Plane } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ANNIVERSARY_YEARS } from "../_lib/constants";
import { isMMDDWithinDays, isSameMMDD } from "../_lib/utils";

// Widget cho Coordinator dashboard: sắp sinh nhật / sắp anniversary / đang nghỉ phép.
// Input: members + todaySchedules từ useTeamDirectory (caller pass).
// Render compact card 3 cột — không tự fetch (caller compose).
interface PeopleAnalyticsWidgetProps {
  members: any[];
  todaySchedules: any[];
}

const DAYS_AHEAD = 7;

export default function PeopleAnalyticsWidget({ members, todaySchedules }: PeopleAnalyticsWidgetProps) {
  const data = useMemo(() => {
    const now = new Date();
    const upcomingBirthdays = members.filter((m) => m.birthday && isMMDDWithinDays(m.birthday, DAYS_AHEAD, now));
    const upcomingAnniv = members.filter((m) => {
      if (!m.branch_join_date) return false;
      if (!isMMDDWithinDays(m.branch_join_date, DAYS_AHEAD, now)) return false;
      const join = new Date(m.branch_join_date);
      const yearsAtAnniv = now.getFullYear() - join.getFullYear();
      return ANNIVERSARY_YEARS.includes(yearsAtAnniv as any);
    });

    const onLeaveIds = new Set(
      todaySchedules
        .filter((s) => s.type === 'leave' && ['approved', 'in_progress'].includes(s.status))
        .map((s) => s.created_by),
    );
    const onLeave = members.filter((m) => onLeaveIds.has(m.id)).slice(0, 5);

    return { upcomingBirthdays, upcomingAnniv, onLeave };
  }, [members, todaySchedules]);

  const hasAny = data.upcomingBirthdays.length > 0 || data.upcomingAnniv.length > 0 || data.onLeave.length > 0;
  if (!hasAny) return null;

  return (
    <section className="premium-card p-5 group-stack">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PartyPopper className="icon-sm" />
        </span>
        <h3 className="heading-section">Nhịp đập nhân sự</h3>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Group
          icon={<Cake className="icon-sm" />}
          color="bg-pink-50 text-pink-600 border-pink-100"
          title="Sắp sinh nhật (7 ngày)"
          items={data.upcomingBirthdays}
          render={(m) => (
            <span className="text-meta">
              {format(new Date(m.birthday), "dd/MM", { locale: vi })}
              {isSameMMDD(m.birthday) ? ' • hôm nay' : ''}
            </span>
          )}
        />
        <Group
          icon={<Award className="icon-sm" />}
          color="bg-amber-50 text-amber-600 border-amber-100"
          title="Kỷ niệm gắn bó"
          items={data.upcomingAnniv}
          render={(m) => {
            const years = new Date().getFullYear() - new Date(m.branch_join_date).getFullYear();
            return <span className="text-meta">{years} năm • {format(new Date(m.branch_join_date), "dd/MM")}</span>;
          }}
        />
        <Group
          icon={<Plane className="icon-sm" />}
          color="bg-amber-50 text-amber-700 border-amber-100"
          title="Đang nghỉ phép"
          items={data.onLeave}
          render={(m) => <span className="text-meta truncate">{m.departments?.name ?? ''}</span>}
        />
      </div>
    </section>
  );
}

function Group({
  icon, color, title, items, render,
}: {
  icon: React.ReactNode; color: string; title: string;
  items: any[]; render: (m: any) => React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-3 item-stack shadow-sm">
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border w-fit text-[11px] font-bold ${color}`}>
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <p className="text-meta">Chưa có</p>
      ) : (
        <ul className="item-stack !gap-2">
          {items.slice(0, 5).map((m) => (
            <li key={m.id} className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7 ring-1 ring-slate-100 shrink-0">
                <AvatarImage src={m.avatar_url} className="object-cover" />
                <AvatarFallback className="text-[10px] bg-primary text-white">{m.full_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-slate-900 truncate">{m.full_name}</p>
                <div className="truncate">{render(m)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
