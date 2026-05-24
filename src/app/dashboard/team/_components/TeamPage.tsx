'use client'

import React, { useEffect, useMemo, useState } from "react";
import { Users, Cake, Plane, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canViewPeopleDirectory } from "@/lib/permissions";
import { useTeamDirectory } from "../_hooks/useTeamDirectory";
import { getProfileBadgeStatus, matchProfileSearch } from "../_lib/utils";
import { ProfileStatus, STATUS_BADGES } from "../_lib/constants";
import ProfileDetailDialog from "./ProfileDetailDialog";
import OrgChartView from "./OrgChartView";

// Container chính cho /dashboard/team — 1 view duy nhất (org-chart style).
// Filter trạng thái = Tabs. Search dùng chung top nav (?q=...). Deep link ?id= mở dialog.
const FILTER_TABS: Array<{ key: ProfileStatus | 'all'; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'on_leave', label: STATUS_BADGES.on_leave.label },
  { key: 'on_trip', label: STATUS_BADGES.on_trip.label },
  { key: 'birthday_today', label: 'Sinh nhật' },
  { key: 'new_joiner', label: 'Mới vào' },
];

export default function TeamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailId = searchParams.get('id');
  const query = searchParams.get('q') || '';
  const { profile, members, todaySchedules, oooByUser, loading } = useTeamDirectory();

  const [filter, setFilter] = useState<ProfileStatus | 'all'>('all');

  // Guard role — driver redirect.
  useEffect(() => {
    if (!loading && profile && !canViewPeopleDirectory(profile)) {
      router.replace('/dashboard');
    }
  }, [loading, profile, router]);

  const getStatus = useMemo(() => {
    const cache = new Map<string, ProfileStatus>();
    return (m: any): ProfileStatus => {
      if (cache.has(m.id)) return cache.get(m.id)!;
      const s = getProfileBadgeStatus(m, todaySchedules, oooByUser.get(m.id) ?? null);
      cache.set(m.id, s);
      return s;
    };
  }, [todaySchedules, oooByUser]);

  // Stats hero — đếm theo trạng thái.
  const stats = useMemo(() => {
    const counts = { total: members.length, on_leave: 0, on_trip: 0, birthday_today: 0, new_joiner: 0 };
    for (const m of members) {
      const s = getStatus(m);
      if (s === 'on_leave') counts.on_leave++;
      else if (s === 'on_trip') counts.on_trip++;
      else if (s === 'birthday_today') counts.birthday_today++;
      else if (s === 'new_joiner') counts.new_joiner++;
    }
    return counts;
  }, [members, getStatus]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (!matchProfileSearch(m, query)) return false;
      if (filter === 'all') return true;
      return getStatus(m) === filter;
    });
  }, [members, query, filter, getStatus]);

  const openDetail = (member: any) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('id', member.id);
    router.push(`/dashboard/team?${params.toString()}`, { scroll: false });
  };

  const closeDetail = (open: boolean) => {
    if (open) return;
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete('id');
    const q = params.toString();
    router.push(`/dashboard/team${q ? `?${q}` : ''}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="page-container space-y-6 md:space-y-8 animate-fade-in-up">
        <PageHeader title="Nhân sự" description="Danh bạ và sơ đồ tổ chức chi nhánh" />
        <ListSkeleton variant="card" rows={6} />
      </div>
    );
  }

  return (
    <div className="page-container space-y-6 md:space-y-8 animate-fade-in-up">
      <PageHeader
        title="Nhân sự"
        description="Danh bạ và sơ đồ tổ chức chi nhánh"
      />

      {/* Stats hero — luôn hiển thị */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="icon-sm" />}
          tone="bg-primary/10 text-primary"
          label="Tổng cán bộ"
          value={stats.total}
        />
        <StatCard
          icon={<Plane className="icon-sm" />}
          tone="bg-amber-50 text-amber-700"
          label="Đang vắng mặt"
          value={stats.on_leave + stats.on_trip}
        />
        <StatCard
          icon={<Cake className="icon-sm" />}
          tone="bg-pink-50 text-pink-600"
          label="Sinh nhật hôm nay"
          value={stats.birthday_today}
        />
        <StatCard
          icon={<Sparkles className="icon-sm" />}
          tone="bg-emerald-50 text-emerald-600"
          label="Mới gia nhập"
          value={stats.new_joiner}
        />
      </div>

      {/* Filter status = Tabs (đồng bộ pattern với module Tasks) */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as ProfileStatus | 'all')} className="w-full">
        <TabsList className="min-h-11 grid grid-cols-5">
          {FILTER_TABS.map((opt) => (
            <TabsTrigger
              key={opt.key}
              value={opt.key}
              className="rounded-lg py-1.5 font-semibold text-[13px] flex items-center justify-center gap-1.5"
            >
              <span className="truncate">{opt.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center">
        <span className="text-meta">{filteredMembers.length} người</span>
      </div>

      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="icon-lg" />}
          title="Không có kết quả phù hợp"
          description={query ? "Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm trên thanh tìm." : "Thử bỏ bộ lọc."}
        />
      ) : (
        <OrgChartView members={filteredMembers} onSelect={openDetail} getStatus={getStatus} />
      )}

      <ProfileDetailDialog
        targetId={detailId}
        open={!!detailId}
        onOpenChange={closeDetail}
        viewer={profile}
        todaySchedules={todaySchedules}
      />
    </div>
  );
}

function StatCard({
  icon, tone, label, value,
}: {
  icon: React.ReactNode; tone: string; label: string; value: number;
}) {
  return (
    <div className="premium-card p-4 flex items-center gap-3">
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${tone}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-meta truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}
