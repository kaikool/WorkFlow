'use client'

import React, { useState, useEffect } from "react";
import { Bell, Loader2, Inbox, Zap, Calendar, Target, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function NotificationsDropdown() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);

    let active = true;
    let channel: any;

    const setupNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;

      fetchNotifications(user.id);

      // Khởi tạo channel và đăng ký sự kiện Trước khi subscribe
      channel = supabase
        .channel(`notifications_realtime_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
          toast({
            title: payload.new.title,
            description: payload.new.content,
          });
        });

      channel.subscribe();
    };

    setupNotifications();

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  const fetchNotifications = async (userId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const getNotificationIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('hỏa tốc') || t.includes('nhắc') || t.includes('khẩn cấp')) {
      return (
        <span className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 fill-current" />
        </span>
      );
    }
    if (t.includes('lịch trình') || t.includes('xe') || t.includes('phòng họp')) {
      return (
        <span className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0 flex items-center justify-center">
          <Calendar className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (t.includes('kpi') || t.includes('chỉ tiêu') || t.includes('khen') || t.includes('hoàn thành')) {
      return (
        <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 flex items-center justify-center">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
      );
    }
    return (
      <span className="p-2 bg-slate-50 text-slate-600 rounded-xl shrink-0 flex items-center justify-center">
        <Bell className="w-3.5 h-3.5" />
      </span>
    );
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full bg-slate-50">
        <Bell className="h-5 w-5 text-slate-600" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full bg-slate-50 hover:bg-slate-100 transition-all">
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 border-2 border-white text-sm font-medium">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        alignOffset={-8}
        collisionPadding={16}
        className="w-[calc(100vw-32px)] sm:w-[380px] p-2 rounded-2xl shadow-xl border-slate-100 mt-2 bg-white"
      >
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 mb-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-slate-800">Thông báo hệ thống</span>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              className="h-auto p-0 text-sm font-medium text-primary hover:bg-transparent truncate whitespace-nowrap"
              onClick={() => notifications.forEach(n => !n.is_read && markAsRead(n.id))}
            >
              Đọc tất cả
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-0.5">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
          ) : notifications.length > 0 ? (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "cursor-pointer rounded-xl p-3 !pl-4 border-y border-r border-slate-100/60 shadow-sm flex gap-3 relative overflow-hidden transition-all mb-1.5 focus:bg-slate-50/80 focus:text-inherit select-none",
                  !n.is_read
                    ? "bg-gradient-to-r from-blue-50/20 to-white border-l-4 border-l-blue-600"
                    : "bg-white border-l-4 border-l-slate-200"
                )}
              >
                {getNotificationIcon(n.title)}

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className={cn(
                      "text-sm font-medium leading-tight truncate flex-1",
                      !n.is_read ? "text-blue-900" : "text-slate-800"
                    )}>
                      {n.title}
                    </span>
                    {!n.is_read && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-0.5 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-semibold">
                    {n.content}
                  </p>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-slate-400 font-bold">
                      {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[11px] text-slate-300">•</span>
                    <span className="text-[11px] text-primary/60 font-bold">Hệ thống</span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Inbox className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">Hộp thư trống</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
