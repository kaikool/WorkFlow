// Helper fetch dữ liệu lịch trình — tách khỏi useSchedule để giữ file gốc dưới 500 dòng.
// Profiles/departments KHÔNG còn fetch ở đây — caller bơm vào từ AppDataProvider cache.

import { addDays, endOfDay, endOfWeek, startOfWeek } from "date-fns";
import { canCoordinateSharedResources } from "@/lib/permissions";

const SCHEDULE_SELECT = `*, creator:profiles!schedules_created_by_fkey(full_name, title, avatar_url, department_id, role, is_department_head), room:rooms(name), vehicle:vehicles(name, plate_number), driver:profiles!schedules_driver_id_fkey(id, full_name, title, phone), rejecter:profiles!schedules_rejected_by_fkey(id, full_name, title), participants:schedule_participants(profile:profiles(id, full_name, title, avatar_url, role, is_department_head))`;

export interface FetchedScheduleData {
  schedules: any[];
  vehicles: any[];
  rooms: any[];
}

export async function fetchScheduleData(
  supabase: any,
  selectedDate: Date,
  currentProfile: any
): Promise<FetchedScheduleData> {
  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const end = new Date(Math.max(
    endOfWeek(selectedDate, { weekStartsOn: 1 }).getTime(),
    endOfDay(addDays(selectedDate, 3)).getTime()
  ));

  const schedulesQuery = supabase
    .from('schedules')
    .select(SCHEDULE_SELECT)
    .gte('end_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time');

  const canSeePendingQueue = canCoordinateSharedResources(currentProfile);
  const pendingQueueQuery = canSeePendingQueue
    ? supabase
        .from('schedules')
        .select(SCHEDULE_SELECT)
        .or('status.eq.pending,and(use_vehicle.eq.true,vehicle_id.is.null)')
        .order('start_time')
    : Promise.resolve({ data: [] as any[], error: null });

  const [
    { data: scheds, error: sError },
    { data: pendingQueue, error: pendingError },
    { data: vData },
    { data: rData },
  ] = await Promise.all([
    schedulesQuery,
    pendingQueueQuery,
    supabase.from('vehicles').select('*, default_driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)'),
    supabase.from('rooms').select('*'),
  ]);

  if (sError) throw sError;
  if (pendingError) throw pendingError;

  const merged = [...(scheds || []), ...(pendingQueue || [])].filter(
    (item, index, arr) => arr.findIndex((x: any) => x.id === item.id) === index
  );

  return {
    schedules: merged,
    vehicles: vData || [],
    rooms: rData || [],
  };
}
