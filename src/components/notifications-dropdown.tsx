'use client'

import React, { useState, useEffect } from "react";
import { Bell, Loader2, Inbox } from "lucide-react";
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

 // Khởi tạo channel và đăng ký sự kiện TRƯỚC khi subscribe
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
 <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 border-2 border-white text-[10px] font-bold">
 {unreadCount}
 </Badge>
 )}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-80 p-2 rounded-2xl shadow-xl border-slate-100 mt-2">
 <div className="flex items-center justify-between px-3 py-3 border-b border-slate-50 mb-2">
 <span className="text-[11px] font-bold text-slate-900 uppercase truncate whitespace-nowrap">Thông báo mới</span>
 {unreadCount > 0 && (
 <Button 
 variant="ghost" 
 className="h-auto p-0 text-[10px] font-bold text-primary hover:bg-transparent uppercase tracking-tight truncate whitespace-nowrap" 
 onClick={() => notifications.forEach(n => !n.is_read && markAsRead(n.id))}
 >
 Đọc tất cả
 </Button>
 )}
 </div>
 
 <div className="max-h-[350px] overflow-y-auto space-y-1">
 {loading ? (
 <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
 ) : notifications.length > 0 ? (
 notifications.map((n) => (
 <DropdownMenuItem 
 key={n.id} 
 onClick={() => handleNotificationClick(n)}
 className={cn(
 "p-0 focus:bg-transparent focus:text-inherit rounded-xl mb-1 cursor-pointer"
 )}
 >
 <div className={cn(
 "p-4 w-full rounded-xl transition-all flex flex-col items-start gap-1.5 border border-transparent",
 !n.is_read ? "bg-blue-50/40 hover:bg-blue-50/80" : "hover:bg-slate-50"
 )}>
 <div className="flex justify-between w-full items-start gap-3">
 <span className={cn(
 "text-[13px] font-bold leading-snug tracking-tight",
 !n.is_read ? "text-blue-700" : "text-slate-800"
 )}>
 {n.title}
 </span>
 {!n.is_read && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
 </div>
 <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed font-medium">
 {n.content}
 </p>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-[9px] text-slate-500 font-bold uppercase ">
 {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
 </span>
 <span className="text-[9px] text-slate-500">•</span>
 <span className="text-[9px] text-primary/60 font-bold uppercase ">Hệ thống</span>
 </div>
 </div>
 </DropdownMenuItem>
 ))
 ) : (
 <div className="py-16 text-center space-y-3">
 <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
 <Inbox className="h-6 w-6 text-slate-500" />
 </div>
 <p className="text-[10px] font-bold text-slate-500 uppercase truncate whitespace-nowrap">Hộp thư trống</p>
 </div>
 )}
 </div>
 </DropdownMenuContent>
 </DropdownMenu>
 );
}
