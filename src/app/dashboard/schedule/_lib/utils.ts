import { directorColors } from "./constants";
import { format } from "date-fns";
import { sortProfilesByHierarchy } from "@/lib/utils";

// Lọc danh sách Ban Giám đốc (Sắp xếp đồng bộ: Cấp trưởng lên đầu -> Alphabet Việt)
export function filterBGD(profiles: any[]) {
  const filtered = profiles.filter(p =>
    (p.role === 'director' || p.title?.toLowerCase().includes('giám đốc') || p.full_name?.toLowerCase().includes('giám đốc')) &&
    !p.full_name?.toLowerCase().includes('admin') &&
    p.role !== 'admin'
  );

  return sortProfilesByHierarchy(filtered);
}

// Lọc nhân viên (không phải admin, director) - Sắp xếp đồng bộ: Manager -> Staff -> Cấp trưởng -> Alphabet Việt
export function filterStaff(profiles: any[]) {
  const filtered = profiles.filter(p =>
    p.role !== 'admin' &&
    p.role !== 'director' &&
    !p.full_name?.toLowerCase().includes('admin') &&
    !p.full_name?.toLowerCase().includes('giám đốc')
  );

  return sortProfilesByHierarchy(filtered);
}

// Gán màu cho từng thành viên BGĐ
export function getDirectorColor(fullName: string, allProfiles: any[]) {
  const name = fullName ? fullName.trim() : '';

  const bgdList = filterBGD(allProfiles).map(p => p.full_name);

  const index = bgdList.indexOf(fullName);
  if (index !== -1) {
    return directorColors[index % directorColors.length];
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return directorColors[Math.abs(hash) % directorColors.length];
}

// Tính toán danh sách ID người tham gia dựa trên lựa chọn
export function resolveParticipantIds(params: {
  selectedParticipants: string[];
  bgdMode: 'all' | 'specific' | 'none';
  selectedBGD: string[];
  deptMode: 'all' | 'specific' | 'none';
  filterDepts: string[];
  participantMode: 'all' | 'manager' | 'staff';
  allProfiles: any[];
}) {
  const { selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles } = params;

  let ids = [...selectedParticipants];

  // BGĐ
  if (bgdMode === 'all') {
    const bgdIds = filterBGD(allProfiles).map(p => p.id);
    ids = [...new Set([...ids, ...bgdIds])];
  } else if (bgdMode === 'specific') {
    ids = [...new Set([...ids, ...selectedBGD])];
  }

  // Đơn vị / Phòng
  if (deptMode === 'all') {
    const allStaffIds = allProfiles.filter(p => p.role !== 'admin' && p.role !== 'director').map(p => p.id);
    ids = [...new Set([...ids, ...allStaffIds])];
  } else if (deptMode === 'specific' && filterDepts.length > 0) {
    // Chỉ lấy theo phòng ban được chọn
    if (participantMode === 'all') {
      const deptIds = allProfiles.filter(p => filterDepts.includes(p.department_id)).map(p => p.id);
      ids = [...new Set([...ids, ...deptIds])];
    } else if (participantMode === 'manager') {
      const mgrIds = allProfiles.filter(p => filterDepts.includes(p.department_id) && (p.role === 'manager' || p.is_department_head === true)).map(p => p.id);
      ids = [...new Set([...ids, ...mgrIds])];
    }
    // participantMode = 'staff': không thêm lãnh đạo phòng
  }
  // deptMode = 'none' hoặc 'specific' mà chưa chọn phòng: không thêm ai

  return ids;
}

// Kiểm tra xung đột lịch trình
export function checkConflicts(params: {
  checkIds: string[];
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  schedules: any[];
  ignoreScheduleId?: string;
}) {
  const { checkIds, startDate, endDate, startTime, endTime, schedules, ignoreScheduleId } = params;

  if (checkIds.length === 0) return [];

  try {
    const startString = `${format(startDate, 'yyyy-MM-dd')}T${startTime}`;
    const endString = `${format(endDate, 'yyyy-MM-dd')}T${endTime}`;
    const start = new Date(startString);
    const end = new Date(endString);

    const foundConflicts: string[] = [];
    schedules.forEach(s => {
      if (s.id === ignoreScheduleId || s.status === 'rejected' || s.status === 'completed') return;
      const isPending = s.status === 'pending';
      const sStart = new Date(s.start_time);
      const sEnd = new Date(s.end_time);

      const isOverlapping = (start < sEnd && end > sStart);

      if (isOverlapping) {
        s.participants?.forEach((p: any) => {
          if (checkIds.includes(p.profile?.id)) {
            foundConflicts.push(`${p.profile?.full_name} đang bận${isPending ? ' (Chờ duyệt)' : ''}: ${s.title} (${format(sStart, 'HH:mm')} - ${format(sEnd, 'HH:mm')})`);
          }
        });
      }
    });
    return Array.from(new Set(foundConflicts));
  } catch (e) {
    return [];
  }
}

export function checkResourceConflicts(params: {
  roomId?: string | null;
  vehicleId?: string | null;
  start: Date;
  end: Date;
  schedules: any[];
  ignoreScheduleId?: string;
}) {
  const { roomId, vehicleId, start, end, schedules, ignoreScheduleId } = params;
  const conflicts: string[] = [];

  schedules.forEach(s => {
    if (s.id === ignoreScheduleId || s.status === 'rejected' || s.status === 'completed') return;

    const sStart = new Date(s.start_time);
    const sEnd = new Date(s.end_time);
    const isOverlapping = start < sEnd && end > sStart;
    if (!isOverlapping) return;

    if (roomId && roomId !== 'none' && s.room_id === roomId) {
      conflicts.push(`Phòng họp đang bận: ${s.title} (${format(sStart, 'HH:mm')} - ${format(sEnd, 'HH:mm')})`);
    }
  });

  return Array.from(new Set(conflicts));
}

/**
 * Kiểm tra giới hạn số lượng Phó giám đốc đi công tác cùng lúc.
 * Tối đa 2 Phó giám đốc được phép đi cùng thời điểm.
 * Giám đốc (is_department_head = true) được miễn trừ.
 * Ai đăng ký trước được trước, ai đăng ký sau phải nhận cảnh báo.
 */
export function checkDeputyDirectorLimit(params: {
  bdgProfileIds: string[];        // danh sách BGĐ được chọn làm participant
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  schedules: any[];
  allProfiles: any[];
  ignoreScheduleId?: string;
  isEdit?: boolean;
}): string[] {
  const { bdgProfileIds, startDate, endDate, startTime, endTime, schedules, allProfiles, ignoreScheduleId, isEdit } = params;

  if (bdgProfileIds.length === 0) return [];
  const today = new Date();

  // Tìm Giám đốc (is_department_head = true trong số BGĐ)
  const giamDocId = allProfiles.find((p: any) =>
    (p.role === 'director' || p.title?.toLowerCase().includes('giám đốc')) &&
    p.is_department_head === true &&
    !p.full_name?.toLowerCase().includes('admin')
  )?.id;

  // Lọc ra Phó giám đốc từ danh sách BGĐ được chọn (loại Giám đốc)
  const phoGiamDocIds = bdgProfileIds.filter((id: string) => id !== giamDocId);

  if (phoGiamDocIds.length === 0) return [];

  try {
    const startString = `${format(startDate, 'yyyy-MM-dd')}T${startTime}`;
    const endString = `${format(endDate, 'yyyy-MM-dd')}T${endTime}`;
    const newStart = new Date(startString);
    const newEnd = new Date(endString);

    // Track xem mỗi Phó giám đốc đã có bao nhiêu lịch overlap
    const busyPhoMap = new Map<string, { count: number; titles: string[] }>();
    phoGiamDocIds.forEach((id: string) => busyPhoMap.set(id, { count: 0, titles: [] }));

    schedules.forEach((s: any) => {
      if (s.id === ignoreScheduleId || s.status === 'rejected' || s.status === 'completed') return;

      const sStart = new Date(s.start_time);
      const sEnd = new Date(s.end_time);
      const isOverlapping = newStart < sEnd && newEnd > sStart;
      if (!isOverlapping) return;

      (s.participants || []).forEach((p: any) => {
        const pid = p.profile?.id;
        if (pid && phoGiamDocIds.includes(pid)) {
          const entry = busyPhoMap.get(pid)!;
          entry.count += 1;
          if (!entry.titles.includes(s.title)) {
            entry.titles.push(s.title);
          }
        }
      });
    });

    // Đếm số Phó giám đốc đã có lịch bận
    let busyPhoCount = 0;
    const busyNames: string[] = [];
    const phoProfiles = allProfiles.filter((p: any) => phoGiamDocIds.includes(p.id));

    busyPhoMap.forEach((entry, pid) => {
      if (entry.count > 0) {
        busyPhoCount += 1;
        const profile = allProfiles.find((p: any) => p.id === pid);
        if (profile) busyNames.push(profile.full_name);
      }
    });

    // Tổng số Phó giám đốc hiện có (trong DB)
    const totalPhoInDb = allProfiles.filter((p: any) =>
      (p.role === 'director' || p.title?.toLowerCase().includes('giám đốc')) &&
      p.id !== giamDocId &&
      !p.full_name?.toLowerCase().includes('admin')
    ).length;

    // Luôn để 1 Phó giám đốc ở lại trực
    const maxPhoCanGo = Math.max(0, totalPhoInDb - 1);

    // Số phó giám đốc sẽ bận nếu tạo lịch này
    const phoWillBeBusy = busyPhoCount + phoGiamDocIds.length;

    const warnings: string[] = [];
    if (phoWillBeBusy > maxPhoCanGo) {
      const busyList = busyNames.length > 0 ? ` (${busyNames.join(', ')})` : '';
      warnings.push(
        `Hiện có ${busyPhoCount} Phó giám đốc đã có lịch trong khung giờ này${busyList}. ` +
        `Theo quy định, phải để ít nhất 1 Phó giám đốc ở lại trực (tối đa ${maxPhoCanGo}/${totalPhoInDb} được đi). ` +
        `Vui lòng cân nhắc điều chỉnh thành phần tham gia.`
      );
    }

    return warnings;
  } catch (e) {
    return [];
  }
}
