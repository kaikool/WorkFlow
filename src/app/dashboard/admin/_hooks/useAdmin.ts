import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { sortProfilesByHierarchy } from "@/lib/utils";

export function useAdmin() {
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
 const [drivers, setDrivers] = useState<any[]>([]);

 // State cho tạo mới
 const [newRoom, setNewRoom] = useState({ name: "", capacity: 10, location: "" });
 const [newVehicle, setNewVehicle] = useState({ name: "", plate_number: "", type: "4 chỗ", driver_id: "none" });
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
 const { data: vehicleList } = await supabase.from('vehicles').select('*, driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)').order('name');
 const { data: driverList } = await supabase.from('profiles').select('id, full_name, phone').eq('role', 'driver');
 
 setStats({ tasks: 0, goals: 0, members: memberCount || 0 });
 setUsers(sortProfilesByHierarchy(userList || []));
 setRooms(roomList || []);
 setVehicles(vehicleList || []);
 setDrivers(driverList || []);
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
 const { data, error } = await supabase.from('vehicles').insert([{
   name: newVehicle.name, plate_number: newVehicle.plate_number, type: newVehicle.type, driver_id: newVehicle.driver_id === "none" ? null : newVehicle.driver_id
 }]).select('*, driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)');
 if (error) throw error;
 setVehicles([...vehicles, data[0]]);
 setIsVehicleOpen(false);
 setNewVehicle({ name: "", plate_number: "", type: "4 chỗ", driver_id: "none" });
 toast({ title: "Thành công", description: "Đã thêm xe mới." });
 } catch (error: any) {
 if (error.code === '23505' || error.code === '409' || error.status === 409 || error.message?.includes('vehicles_plate_number_key') || error.message?.toLowerCase().includes('duplicate')) {
    toast({ variant: "destructive", title: "Biển số trùng lặp", description: "Biển số xe này đã tồn tại trong hệ thống. Vui lòng kiểm tra lại." });
  } else {
    toast({ variant: "destructive", title: "Lỗi", description: error.message || "Đã xảy ra lỗi không xác định." });
  }
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
   const { data, error } = await supabase.from('vehicles').update({
    name: editingVehicle.name,
    plate_number: editingVehicle.plate_number,
    type: editingVehicle.type,
    driver_id: editingVehicle.driver_id === "none" ? null : editingVehicle.driver_id
   }).eq('id', editingVehicle.id).select('*, driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)');
   if (error) throw error;
   setVehicles(vehicles.map(v => v.id === editingVehicle.id ? data[0] : v));
   setIsEditVehicleOpen(false);
   setEditingVehicle(null);
   toast({ title: "Thành công", description: "Đã cập nhật xe." });
  } catch (error: any) {
   if (error.code === '23505' || error.code === '409' || error.status === 409 || error.message?.includes('vehicles_plate_number_key') || error.message?.toLowerCase().includes('duplicate')) {
     toast({ variant: "destructive", title: "Biển số trùng lặp", description: "Biển số xe này đã tồn tại trong hệ thống. Vui lòng kiểm tra lại." });
   } else {
     toast({ variant: "destructive", title: "Lỗi", description: error.message || "Đã xảy ra lỗi không xác định." });
   }
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

  return {
    loading, userProfile, users, rooms, vehicles, stats, searchQuery, setSearchQuery, drivers,
    newRoom, setNewRoom, isRoomOpen, setIsRoomOpen, newVehicle, setNewVehicle, isVehicleOpen, setIsVehicleOpen,
    editingRoom, setEditingRoom, isEditRoomOpen, setIsEditRoomOpen, editingVehicle, setEditingVehicle, isEditVehicleOpen, setIsEditVehicleOpen,
    handleUpdateRole, handleCreateRoom, handleCreateVehicle, handleUpdateRoom, handleUpdateVehicle, handleDeleteRoom, handleDeleteVehicle, fetchData
  };
}
