'use client';

// ResourceView — bar chart inline "Ai đang ôm bao nhiêu việc" cho manager+.
// Hiển thị danh sách user + thanh ngang số task active + badge số trễ.

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceViewItem } from '../_lib/types';

interface Props {
  data: ResourceViewItem[];
  loading?: boolean;
}

export function ResourceView({ data, loading }: Props) {
  if (loading) {
    return (
      <section className="premium-card p-5 border-none space-y-4">
        <div className="flex items-center gap-2">
          <Users className="icon-md text-primary" />
          <h2 className="text-sm font-bold text-slate-900">Ai đang ôm bao nhiêu</h2>
        </div>
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-2 w-full bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) return null;

  const maxActive = Math.max(...data.map(d => d.active_count), 1);

  return (
    <section className="premium-card p-5 border-none space-y-4">
      <div className="flex items-center gap-2">
        <Users className="icon-md text-primary" />
        <h2 className="text-sm font-bold text-slate-900">Ai đang ôm bao nhiêu</h2>
      </div>

      <div className="space-y-3">
        {data.map(item => (
          <Link
            key={item.user_id}
            href={`/dashboard/team/${item.user_id}`}
            className="flex items-center gap-3 group"
          >
            <Avatar className="avatar-sm shrink-0">
              <AvatarImage src={item.avatar_url ?? undefined} alt={item.full_name ?? ''} />
              <AvatarFallback className="text-[11px]">
                {item.full_name?.charAt(0) ?? '?'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[12px] font-medium">
                <span className="truncate text-slate-700 group-hover:text-primary transition-colors">
                  {item.full_name ?? '—'}
                </span>
                <span className="text-slate-500 shrink-0 ml-2">
                  {item.active_count}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    item.overdue_count > 0 ? 'bg-red-400' : 'bg-primary',
                  )}
                  style={{ width: `${(item.active_count / maxActive) * 100}%` }}
                />
              </div>
            </div>

            {item.overdue_count > 0 && (
              <div className="flex items-center gap-1 text-red-600 shrink-0">
                <AlertTriangle className="icon-sm" />
                <span className="text-[11px] font-bold">{item.overdue_count}</span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
