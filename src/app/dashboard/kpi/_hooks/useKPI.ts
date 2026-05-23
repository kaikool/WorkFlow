import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { sortProfilesByHierarchy } from "@/lib/utils";

export function useKPI(KPI_CATEGORIES: any[], KPI_TEMPLATES: any[]) {
 const router = useRouter();
 const [goals, setGoals] = useState<any[]>([]);
 const [team, setTeam] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [isCreateOpen, setIsCreateOpen] = useState(false);
 const [isSuccess, setIsSuccess] = useState(false);
 const [profile, setProfile] = useState<any>(null);
 const searchParams = useSearchParams();
 const searchQuery = searchParams.get('q') || "";

 const [selectedCategory, setSelectedCategory] = useState<string>('lending');
 const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
 const [targetType, setTargetType] = useState<'department' | 'individual'>('department');
 const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
 const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
 const [unitValue, setUnitValue] = useState("");
 const [customTitle, setCustomTitle] = useState("");
 const [customDescription, setCustomDescription] = useState("");

 const { toast } = useToast();
 const supabase = createClient();

 useEffect(() => {
 fetchInitialData();
 }, []);

 // Auto-open dialog tạo KPI khi vào URL có ?create=1 (từ FAB mobile)
 useEffect(() => {
   if (searchParams.get('create') === '1') {
     setIsCreateOpen(true);
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [searchParams]);

 const fetchInitialData = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
 setProfile(p);

 if (p?.department_id) {
 const { data: members } = await supabase
 .from('profiles')
 .select('id, full_name, title, avatar_url, role, is_department_head')
 .eq('department_id', p.department_id)
 .order('full_name');
 setTeam(sortProfilesByHierarchy(members || []));
 }

 await fetchGoals(p);
 } catch (error: any) {
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const fetchGoals = async (p?: any) => {
 const userProfile = p || profile;
 let query = supabase
 .from('kpis')
 .select(`*, assignee:profiles!kpis_assignee_id_fkey(full_name, avatar_url)`);

 // Phân quyền: Lọc theo phòng ban nếu không phải admin hoặc director
 if (userProfile && userProfile.role !== 'admin' && userProfile.role !== 'director' && userProfile.department_id) {
 query = query.or(`department_id.eq.${userProfile.department_id},created_by.eq.${userProfile.id},assignee_id.eq.${userProfile.id}`);
 }

 const { data, error } = await query.order('created_at', { ascending: false });
 if (error) throw error;
 setGoals(data || []);
 };

 const toggleMember = (id: string) => {
 setSelectedMemberIds(prev =>
 prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
 );
 };

 const handleCreateGoal = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const formData = new FormData(e.currentTarget);

 const targetValue = parseInt(formData.get('target_value') as string);
 const unit = formData.get('unit') as string;
 const title = customTitle || formData.get('title') as string;
 const description = customDescription || formData.get('description') as string;

 const baseTask = {
 title,
 description,
 target_value: targetValue,
 unit,
 created_by: profile?.id,
 department_id: profile?.department_id,
 due_date: new Date(Date.now() + (timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : timeframe === 'quarter' ? 90 : 365) * 24 * 60 * 60 * 1000).toISOString(),
 metadata: {
 category: selectedCategory,
 timeframe: timeframe,
 target_type: targetType
 }
 };

 try {
 if (targetType === 'department') {
 const { data: newTask, error } = await supabase.from('kpis').insert(baseTask).select().single();
 if (error) throw error;

 // Thông báo cho cán bộ trong phòng — loại trừ driver theo quy tắc §5.E.2
 const deptNotifyTargets = team.filter((m: any) => m.role !== 'driver' && m.id !== profile?.id);
 if (deptNotifyTargets.length > 0) {
 const deptNotifications = deptNotifyTargets.map((member: any) => ({
 user_id: member.id,
 title: "Chỉ tiêu phòng mới",
 content: `Lãnh đạo đã giao chỉ tiêu chung cho phòng: "${title}". Mục tiêu: ${targetValue} ${unit}.`,
 link: `/dashboard/kpi/${newTask.id}`
 }));
 await supabase.from('notifications').insert(deptNotifications);
 }
 } else {
 if (selectedMemberIds.length === 0) {
 toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng chọn ít nhất một cán bộ." });
 return;
 }

 const tasks = selectedMemberIds.map(memberId => ({
 ...baseTask,
 assignee_id: memberId,
 }));
 const { error } = await supabase.from('kpis').insert(tasks);
 if (error) throw error;

 const notifications = selectedMemberIds.map(memberId => ({
 user_id: memberId,
 title: "Chỉ tiêu KPIs mới",
 content: `Lãnh đạo đã giao chỉ tiêu: "${title}". Mục tiêu cần đạt: ${targetValue} ${unit}.`,
 link: '/dashboard/kpi'
 }));
 await supabase.from('notifications').insert(notifications);
 }

 setIsSuccess(true);
 fetchGoals();
 setTimeout(() => {
 setIsSuccess(false);
 setIsCreateOpen(false);
 setSelectedTemplate(null);
 setCustomTitle("");
 setCustomDescription("");
 setSelectedMemberIds([]);
 }, 2000);
 } catch (error: any) {
 toast({
 title: "Lỗi",
 description: error.message,
 variant: "destructive"
 });
 }
 };

 const normalizedSearch = searchQuery.trim().toLowerCase();
 const filteredGoals = goals.filter(g => (g.title ?? "").toLowerCase().includes(normalizedSearch));

 const avgProgress = goals.length > 0
 ? Math.round(goals.reduce((acc, g) => acc + (g.progress || 0), 0) / goals.length)
 : 0;

  return {
    router, goals, setGoals, team, setTeam, loading, setLoading, isCreateOpen, setIsCreateOpen,
    isSuccess, setIsSuccess, profile, setProfile, searchQuery,
    selectedCategory, setSelectedCategory, selectedTemplate, setSelectedTemplate,
    targetType, setTargetType, selectedMemberIds, setSelectedMemberIds,
    timeframe, setTimeframe, unitValue, setUnitValue, customTitle, setCustomTitle,
    customDescription, setCustomDescription, toast, supabase,
    fetchInitialData, fetchGoals, toggleMember, handleCreateGoal, filteredGoals, avgProgress
  };
}
