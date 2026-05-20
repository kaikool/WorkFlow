'use client'

import React, { useState, useEffect } from "react";
import { 
 Users, 
 ShieldCheck, 
 Search,
 UserCheck,
 Loader2,
 ShieldAlert,
 DoorOpen,
 Car,
 Plus,
 Trash2,
 MapPin,
 Hash,
 Activity,
 CheckCircle2,
 Phone,
 Pencil
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { 
 Table, 
 TableBody, 
 TableCell, 
 TableHead, 
 TableHeader, 
 TableRow 
} from "@/components/ui/table";
import { 
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { 
 Tabs, 
 TabsContent, 
 TabsList, 
 TabsTrigger 
} from "@/components/ui/tabs";
import {
 Dialog,
 DialogContent,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from "@/components/ui/dialog";
import { cn, sortProfilesByHierarchy } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

export default function AdminPage() {
 const { toast } = useToast();
 const router = useRouter();
 const supabase = createClient();
 
 const [loading, setLoading] = useState(true);
 const [userProfile, setUserProfile] = useState<any>(null);
 const [users, setUsers] = useState<any[]>([]);
 const [rooms, setRooms] = useState<any[]>([]);
 const [vehicles, setVehicles] = useState<any[]>([]);
 const [stats, setStats] = useState({ tasks: 0, goals: 0, members: 0 });
 const [searchQuery, setSearchQuery] = useState("");

 // State cho tạo mới
 const [newRoom, setNewRoom] = useState({ name: "", capacity: 10, location: "" });
 const [newVehicle, setNewVehicle] = useState({ name: "", plate_number: "", type: "4 chỗ", driver_name: "", driver_phone: "" });
 const [isRoomOpen, setIsRoomOpen] = useState(false);
 const [isVehicleOpen, setIsVehicleOpen] = useState(false);

 const [editingRoom, setEditingRoom] = useState<any>(null);
 const [isEditRoomOpen, setIsEditRoomOpen] = useState(false);
 const [editingVehicle, setEditingVehicle] = useState<any>(null);
 const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);


 useEffect(() => {
 const initAdmin = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 router.push('/login');
 return;
 }

 const { data: profile } = await supabase
 .from('profiles')
 .select('*, departments(name)')
 .eq('id', user.id)
 .single();
 
 setUserProfile(profile);

 // Chỉ ADMIN hoặc SECRETARY mới được vào trang này
 if (profile?.role !== 'admin' && profile?.role !== 'secretary') {
 toast({ variant: "destructive", title: "Từ chối truy cập", description: "Khu vực này chỉ dành cho Quản trị viên và Lễ tân." });
 router.push('/dashboard/schedule');
 return;
 }

 await fetchData();
 } catch (error: any) {
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 initAdmin();
 }, []);

 const fetchData = async () => {
 try {
 const { count: memberCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
 const { data: userList } = await supabase.from('profiles').select('*, departments (name)').order('full_name');
 const { data: roomList } = await supabase.from('rooms').select('*').order('name');
 const { data: vehicleList } = await supabase.from('vehicles').select('*').order('name');
 
 setStats({ tasks: 0, goals: 0, members: memberCount || 0 });
 setUsers(sortProfilesByHierarchy(userList || []));
 setRooms(roomList || []);
 setVehicles(vehicleList || []);
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi tải dữ liệu", description: error.message });
 }
 };

 const handleUpdateRole = async (userId: string, newRole: any) => {
 try {
 const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
 if (error) throw error;
 setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
 toast({ title: "Thành công", description: "Đã cập nhật quyền hạn cán bộ." });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 }
 };

 const handleCreateRoom = async () => {
 try {
 const { data, error } = await supabase.from('rooms').insert([newRoom]).select();
 if (error) throw error;
 setRooms([...rooms, data[0]]);
 setIsRoomOpen(false);
 setNewRoom({ name: "", capacity: 10, location: "" });
 toast({ title: "Thành công", description: "Đã thêm phòng họp mới." });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 }
 };

 const handleCreateVehicle = async () => {
 try {
 const { data, error } = await supabase.from('vehicles').insert([newVehicle]).select();
 if (error) throw error;
 setVehicles([...vehicles, data[0]]);
 setIsVehicleOpen(false);
 setNewVehicle({ name: "", plate_number: "", type: "4 chỗ", driver_name: "", driver_phone: "" });
 toast({ title: "Thành công", description: "Đã thêm xe mới." });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 }
 };

 const handleUpdateRoom = async () => {
  try {
   const { error } = await supabase.from('rooms').update({
    name: editingRoom.name,
    capacity: editingRoom.capacity,
    location: editingRoom.location
   }).eq('id', editingRoom.id);
   if (error) throw error;
   setRooms(rooms.map(r => r.id === editingRoom.id ? editingRoom : r));
   setIsEditRoomOpen(false);
   setEditingRoom(null);
   toast({ title: "Thành công", description: "Đã cập nhật phòng họp." });
  } catch (error: any) {
   toast({ variant: "destructive", title: "Lỗi", description: error.message });
  }
 };

 const handleUpdateVehicle = async () => {
  try {
   const { error } = await supabase.from('vehicles').update({
    name: editingVehicle.name,
    plate_number: editingVehicle.plate_number,
    type: editingVehicle.type,
    driver_name: editingVehicle.driver_name,
    driver_phone: editingVehicle.driver_phone
   }).eq('id', editingVehicle.id);
   if (error) throw error;
   setVehicles(vehicles.map(v => v.id === editingVehicle.id ? editingVehicle : v));
   setIsEditVehicleOpen(false);
   setEditingVehicle(null);
   toast({ title: "Thành công", description: "Đã cập nhật xe." });
  } catch (error: any) {
   toast({ variant: "destructive", title: "Lỗi", description: error.message });
  }
 };

 const handleDeleteRoom = async (room: any) => {
 try {
 // Check for future schedules using this room
 const { count: futureScheduleCount, error: checkError } = await supabase
 .from('schedules')
 .select('id', { count: 'exact', head: true })
 .eq('room_id', room.id)
 .gte('start_time', new Date().toISOString());
 
 if (checkError) throw checkError;
 
 if ((futureScheduleCount || 0) > 0) {
 const count = futureScheduleCount;
 toast({ 
 variant: "destructive", 
 title: "Không thể xóa", 
 description: `Phòng "${room.name}" đang có ${count} lịch trình trong tương lai. Vui lòng hủy lịch trước khi xóa phòng.` 
 });
 return;
 }

 const { error } = await supabase.from('rooms').delete().eq('id', room.id);
 if (error) throw error;
 
 setRooms(rooms.filter(r => r.id !== room.id));
 toast({ title: "Thành công", description: `Đã xóa phòng "${room.name}".` });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 }
 };

 const handleDeleteVehicle = async (vehicle: any) => {
 try {
 // Check for future schedules using this vehicle
 const { count: futureScheduleCount, error: checkError } = await supabase
 .from('schedules')
 .select('id', { count: 'exact', head: true })
 .eq('vehicle_id', vehicle.id)
 .gte('start_time', new Date().toISOString());
 
 if (checkError) throw checkError;
 
 if ((futureScheduleCount || 0) > 0) {
 const count = futureScheduleCount;
 toast({ 
 variant: "destructive", 
 title: "Không thể xóa", 
 description: `Xe "${vehicle.plate_number}" đang có ${count} lịch trình trong tương lai. Vui lòng hủy gán xe trước khi xóa.` 
 });
 return;
 }

 const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id);
 if (error) throw error;
 
 setVehicles(vehicles.filter(v => v.id !== vehicle.id));
 toast({ title: "Thành công", description: `Đã xóa xe "${vehicle.plate_number}".` });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 }
 };

 if (loading) {
 return (
 <div className="flex h-screen items-center justify-center">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 );
 }

 const isAdmin = userProfile?.role === 'admin';
 const filteredUsers = users.filter(u => u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

 return (
 <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
 <div className="space-y-1">
 <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3 tabular-nums">
 <ShieldCheck className="w-8 h-8 text-red-600" />
 Quản trị Hệ thống
 </h1>
 <p className="text-[12px] text-slate-500 font-bold truncate whitespace-nowrap">
 Toàn quyền cấu hình hệ thống bankportal
 </p>
 </div>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
 <Card className="border-none shadow-sm rounded-[2rem] bg-blue-50/50">
 <CardContent className="p-6 flex items-center gap-4">
 <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600">
 <Users className="w-6 h-6" />
 </div>
 <div>
 <p className="text-sm font-medium text-slate-500 leading-none mb-1 truncate whitespace-nowrap">Cán bộ</p>
 <p className="text-2xl font-bold text-slate-800 tabular-nums">{stats.members}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="border-none shadow-sm rounded-[2rem] bg-purple-50/50">
 <CardContent className="p-6 flex items-center gap-4">
 <div className="p-3 bg-white rounded-2xl shadow-sm text-purple-600">
 <DoorOpen className="w-6 h-6" />
 </div>
 <div>
 <p className="text-sm font-medium text-slate-500 leading-none mb-1 truncate whitespace-nowrap">Phòng họp</p>
 <p className="text-2xl font-bold text-slate-800 tabular-nums">{rooms.length}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="border-none shadow-sm rounded-[2rem] bg-emerald-50/50">
 <CardContent className="p-6 flex items-center gap-4">
 <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600">
 <Car className="w-6 h-6" />
 </div>
 <div>
 <p className="text-sm font-medium text-slate-500 leading-none mb-1 truncate whitespace-nowrap">Đội xe</p>
 <p className="text-2xl font-bold text-slate-800 tabular-nums">{vehicles.length}</p>
 </div>
 </CardContent>
 </Card>
 </div>

 <Tabs defaultValue={isAdmin ? "users" : "rooms"} className="space-y-8">
  <TabsList className="bg-slate-100/50 p-1 rounded-xl h-11 border border-slate-100 w-full flex gap-1">
  {isAdmin && (
    <TabsTrigger value="users" className="flex-1 rounded-lg px-2 sm:px-6 py-1.5 font-medium text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
    <Users className="w-3.5 h-3.5 mr-1.5 shrink-0" /> <span className="truncate">Cán bộ</span>
    </TabsTrigger>
  )}
  <TabsTrigger value="rooms" className="flex-1 rounded-lg px-2 sm:px-6 py-1.5 font-medium text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
  <DoorOpen className="w-3.5 h-3.5 mr-1.5 shrink-0" /> <span className="truncate">Phòng họp</span>
  </TabsTrigger>
  <TabsTrigger value="vehicles" className="flex-1 rounded-lg px-2 sm:px-6 py-1.5 font-medium text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
  <Car className="w-3.5 h-3.5 mr-1.5 shrink-0" /> <span className="truncate">Đội xe</span>
  </TabsTrigger>
  </TabsList>

  {/* User Management Tab (Admin Only) */}
  {isAdmin && (
    <TabsContent value="users" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
    <Card className="border-none shadow-sm rounded-[32px] overflow-hidden">
    <CardHeader className="bg-slate-50/50 pb-6 border-b border-slate-100">
    <div className="flex items-center justify-between">
    <CardTitle className="text-lg font-bold text-slate-800">Danh sách Cán bộ Hệ thống</CardTitle>
    <div className="relative w-72">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
    <Input 
    placeholder="Tìm theo tên..." 
    className="pl-11 h-11 bg-white border-none rounded-2xl shadow-sm font-bold"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    />
    </div>
    </div>
    </CardHeader>
    <CardContent className="p-0">
    <Table>
    <TableHeader>
    <TableRow className="border-slate-100 bg-slate-50/30">
    <TableHead className="pl-8 font-medium text-sm text-slate-500 truncate whitespace-nowrap">Cán bộ</TableHead>
    <TableHead className="font-medium text-sm text-slate-500 truncate whitespace-nowrap">Bộ phận</TableHead>
    <TableHead className="font-medium text-sm text-slate-500 text-center truncate whitespace-nowrap">Vai trò</TableHead>
    <TableHead className="pr-8 font-medium text-sm text-slate-500 text-right truncate whitespace-nowrap">Điều chỉnh</TableHead>
    </TableRow>
    </TableHeader>
    <TableBody>
    {filteredUsers.map(u => (
    <TableRow key={u.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
    <TableCell className="pl-8 py-5">
    <div className="flex items-center gap-3">
    <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
    <AvatarImage src={u.avatar_url} />
    <AvatarFallback className="bg-primary text-white font-bold">{u.full_name?.[0]}</AvatarFallback>
    </Avatar>
    <span className="font-bold text-slate-700">{u.full_name}</span>
    </div>
    </TableCell>
    <TableCell className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">{u.departments?.name || "Chi nhánh"}</TableCell>
    <TableCell className="text-center">
    <Badge className={cn(
    "text-[9px] font-bold px-2 py-0.5 rounded-md",
    u.role === 'admin' ? "bg-red-500 text-white" : u.role === 'manager' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
    )}>{u.role}</Badge>
    </TableCell>
    <TableCell className="pr-8 text-right">
    <Select defaultValue={u.role} onValueChange={(v) => handleUpdateRole(u.id, v)}>
    <SelectTrigger className="w-32 h-9 text-xs md:text-sm font-medium ml-auto bg-slate-50 border-none rounded-xl">
    <SelectValue />
    </SelectTrigger>
    <SelectContent className="rounded-xl border-none shadow-2xl">
    <SelectItem value="admin">Admin</SelectItem>
    <SelectItem value="director">Director</SelectItem>
    <SelectItem value="manager">Manager</SelectItem>
    <SelectItem value="staff">Staff</SelectItem>
    </SelectContent>
    </Select>
    </TableCell>
    </TableRow>
    ))}
    </TableBody>
    </Table>
    </CardContent>
    </Card>
    </TabsContent>
  )}

 {/* Rooms Tab */}
 <TabsContent value="rooms" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
 <div className="flex justify-end">
 <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
 <DialogTrigger asChild>
 <Button className="h-12 px-8 rounded-2xl bg-primary shadow-lg shadow-primary/20 font-medium text-sm truncate whitespace-nowrap">
 <Plus className="w-4 h-4 mr-2" /> Thêm phòng họp
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-[32px] border-none shadow-2xl">
 <DialogHeader><DialogTitle className="text-xl font-bold tabular-nums">Thiết lập phòng họp mới</DialogTitle></DialogHeader>
 <div className="space-y-6 py-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Tên phòng họp</Label>
 <Input placeholder="VD: Phòng Hội thảo Tầng 2..." className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Sức chứa (Người)</Label>
 <Input type="number" className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={newRoom.capacity} onChange={e => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})} />
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Vị trí</Label>
 <Input placeholder="Vd: tầng 2 - Khu B" className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={newRoom.location} onChange={e => setNewRoom({...newRoom, location: e.target.value})} />
 </div>
 </div>
 </div>
 <DialogFooter><Button onClick={handleCreateRoom} className="w-full h-12 rounded-2xl bg-primary font-bold">Xác nhận tạo phòng</Button></DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {rooms.map(room => (
 <Card key={room.id} className="border-none shadow-sm rounded-[32px] overflow-hidden group hover:shadow-xl transition-all duration-500">
 <CardContent className="p-8 space-y-4">
 <div className="flex justify-between items-start">
 <div className="p-4 bg-purple-50 rounded-[24px] text-purple-600">
        <DoorOpen className="w-6 h-6" />
       </div>
       <div className="flex gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-blue-500 rounded-2xl" onClick={() => { setEditingRoom(room); setIsEditRoomOpen(true); }}>
         <Pencil className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-red-500 rounded-2xl" onClick={() => handleDeleteRoom(room)}>
         <Trash2 className="w-5 h-5" />
        </Button>
       </div>
 </div>
 <div>
 <h3 className="text-lg font-bold text-slate-800">{room.name}</h3>
 <div className="flex items-center gap-4 mt-2">
 <div className="flex items-center gap-1.5 text-slate-500">
 <Users className="w-3.5 h-3.5" />
 <span className="text-sm font-medium truncate whitespace-nowrap">{room.capacity} chỗ</span>
 </div>
 <div className="flex items-center gap-1.5 text-slate-500">
 <MapPin className="w-3.5 h-3.5" />
 <span className="text-sm font-medium truncate whitespace-nowrap">{room.location}</span>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
   </div>
  <Dialog open={isEditRoomOpen} onOpenChange={setIsEditRoomOpen}>
   <DialogContent className="rounded-[32px] border-none shadow-2xl">
    <DialogHeader><DialogTitle className="text-xl font-bold tabular-nums">Sửa phòng họp</DialogTitle></DialogHeader>
    {editingRoom && (
     <div className="space-y-6 py-4">
      <div className="space-y-2">
       <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Tên phòng họp</Label>
       <Input placeholder="VD: Phòng Hội thảo Tầng 2..." className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={editingRoom.name} onChange={e => setEditingRoom({...editingRoom, name: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
       <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Sức chứa (Người)</Label>
        <Input type="number" className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={editingRoom.capacity} onChange={e => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value)})} />
       </div>
       <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Vị trí</Label>
        <Input placeholder="Vd: tầng 2 - Khu B" className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={editingRoom.location} onChange={e => setEditingRoom({...editingRoom, location: e.target.value})} />
       </div>
      </div>
     </div>
    )}
    <DialogFooter><Button onClick={handleUpdateRoom} className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold">Lưu thay đổi</Button></DialogFooter>
   </DialogContent>
  </Dialog>
 </TabsContent>

  {/* Vehicles Tab */}
 <TabsContent value="vehicles" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
 <div className="flex justify-end">
 <Dialog open={isVehicleOpen} onOpenChange={setIsVehicleOpen}>
 <DialogTrigger asChild>
 <Button className="h-12 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 font-medium text-sm text-white truncate whitespace-nowrap">
 <Plus className="w-4 h-4 mr-2" /> Thêm xe mới
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-[32px] border-none shadow-2xl">
 <DialogHeader><DialogTitle className="text-xl font-bold tabular-nums">Bổ sung Xe & Lái xe</DialogTitle></DialogHeader>
 <div className="space-y-6 py-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Tên xe / Hãng xe</Label>
 <Input placeholder="VD: Toyota Fortuner..." className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={newVehicle.name} onChange={e => setNewVehicle({...newVehicle, name: e.target.value})} />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Biển số</Label>
 <Input placeholder="VD: 30A-123.45" className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm truncate whitespace-nowrap" value={newVehicle.plate_number} onChange={e => setNewVehicle({...newVehicle, plate_number: e.target.value})} />
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Loại xe</Label>
 <Select value={newVehicle.type} onValueChange={v => setNewVehicle({...newVehicle, type: v})}>
 <SelectTrigger className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm"><SelectValue /></SelectTrigger>
 <SelectContent className="rounded-2xl">
 <SelectItem value="4 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 4 chỗ</SelectItem>
 <SelectItem value="7 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 7 chỗ</SelectItem>
 <SelectItem value="Khác" className="text-base md:text-sm py-3 md:py-2">Loại khác</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Họ tên Lái xe</Label>
 <Input placeholder="VD: Nguyễn Văn A..." className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={newVehicle.driver_name} onChange={e => setNewVehicle({...newVehicle, driver_name: e.target.value})} />
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">SĐT Lái xe</Label>
 <Input placeholder="VD: 0987..." className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={newVehicle.driver_phone} onChange={e => setNewVehicle({...newVehicle, driver_phone: e.target.value})} />
 </div>
 </div>
 </div>
 <DialogFooter><Button onClick={handleCreateVehicle} className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-bold">Lưu thông tin</Button></DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {vehicles.map(v => (
 <Card key={v.id} className="border-none shadow-sm rounded-[32px] overflow-hidden group hover:shadow-xl transition-all duration-500">
 <CardContent className="p-8 space-y-6">
 <div className="flex justify-between items-start">
 <div className="p-4 bg-emerald-50 rounded-[24px] text-emerald-600">
        <Car className="w-6 h-6" />
       </div>
       <div className="flex gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-blue-500 rounded-2xl" onClick={() => { setEditingVehicle(v); setIsEditVehicleOpen(true); }}>
         <Pencil className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-red-500 rounded-2xl" onClick={() => handleDeleteVehicle(v)}>
         <Trash2 className="w-5 h-5" />
        </Button>
       </div>
 </div>
 <div className="space-y-4">
 <div>
 <h3 className="text-lg font-bold text-slate-800 leading-tight">{v.name}</h3>
 <Badge variant="outline" className="mt-2 font-bold border-slate-100 text-slate-500 text-[9px] px-2.5 py-1 rounded-lg">
 <Hash className="w-2.5 h-2.5 mr-1.5" /> {v.plate_number} • {v.type}
 </Badge>
 </div>
 <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
 <div className="flex items-center justify-between">
 <p className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">Lái xe phụ trách</p>
 <Phone className="w-3 h-3 text-emerald-600" />
 </div>
 <p className="text-sm font-bold text-slate-700">{v.driver_name || "Chưa gán"}</p>
 <p className="text-sm font-medium text-emerald-600">{v.driver_phone}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
   </div>
  <Dialog open={isEditVehicleOpen} onOpenChange={setIsEditVehicleOpen}>
   <DialogContent className="rounded-[32px] border-none shadow-2xl">
    <DialogHeader><DialogTitle className="text-xl font-bold tabular-nums">Sửa thông tin Xe & Lái xe</DialogTitle></DialogHeader>
    {editingVehicle && (
     <div className="space-y-6 py-4">
      <div className="space-y-2">
       <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Tên xe / Hãng xe</Label>
       <Input placeholder="VD: Toyota Fortuner..." className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={editingVehicle.name} onChange={e => setEditingVehicle({...editingVehicle, name: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
       <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Biển số</Label>
        <Input placeholder="VD: 30A-123.45" className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm truncate whitespace-nowrap" value={editingVehicle.plate_number} onChange={e => setEditingVehicle({...editingVehicle, plate_number: e.target.value})} />
       </div>
       <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Loại xe</Label>
        <Select value={editingVehicle.type} onValueChange={val => setEditingVehicle({...editingVehicle, type: val})}>
         <SelectTrigger className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm"><SelectValue /></SelectTrigger>
         <SelectContent className="rounded-2xl">
          <SelectItem value="4 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 4 chỗ</SelectItem>
          <SelectItem value="7 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 7 chỗ</SelectItem>
          <SelectItem value="Khác" className="text-base md:text-sm py-3 md:py-2">Loại khác</SelectItem>
         </SelectContent>
        </Select>
       </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
       <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Họ tên Lái xe</Label>
        <Input placeholder="VD: Nguyễn Văn A..." className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={editingVehicle.driver_name} onChange={e => setEditingVehicle({...editingVehicle, driver_name: e.target.value})} />
       </div>
       <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">SĐT Lái xe</Label>
        <Input placeholder="VD: 0987..." className="h-12 bg-slate-50 border-none rounded-2xl font-bold text-base md:text-sm" value={editingVehicle.driver_phone} onChange={e => setEditingVehicle({...editingVehicle, driver_phone: e.target.value})} />
       </div>
      </div>
     </div>
    )}
    <DialogFooter><Button onClick={handleUpdateVehicle} className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold">Lưu thay đổi</Button></DialogFooter>
   </DialogContent>
  </Dialog>
 </TabsContent>
 </Tabs>
 </div>
 );
}
