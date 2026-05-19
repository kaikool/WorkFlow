import { directorColors } from "./constants";
import { format } from "date-fns";

// Lọc danh sách Ban Giám đốc (Sắp xếp đồng bộ: Cấp trưởng lên đầu -> Alphabet Việt)
export function filterBGD(profiles: any[]) {
  const filtered = profiles.filter(p =>
    (p.role === 'director' || p.full_name?.toLowerCase().includes('giám đốc')) &&
    !p.full_name?.toLowerCase().includes('admin') &&
    p.role !== 'admin'
  );

  return filtered.sort((a: any, b: any) => {
    // 1. Cấp trưởng vs cấp phó (is_department_head === true luôn lên đầu)
    const headA = a.is_department_head === true ? 0 : 1;
    const headB = b.is_department_head === true ? 0 : 1;
    if (headA !== headB) return headA - headB;

    // 2. Alphabet tiếng Việt full_name
    return (a.full_name || '').localeCompare(b.full_name || '', 'vi');
  });
}

// Lọc nhân viên (không phải admin, director) - Sắp xếp đồng bộ: Manager -> Staff -> Cấp trưởng -> Alphabet Việt
export function filterStaff(profiles: any[]) {
  const filtered = profiles.filter(p =>
    p.role !== 'admin' &&
    p.role !== 'director' &&
    !p.full_name?.toLowerCase().includes('admin') &&
    !p.full_name?.toLowerCase().includes('giám đốc')
  );

  return filtered.sort((a: any, b: any) => {
    // 1. Vai trò (manager -> others)
    const getRolePriority = (role: string) => {
      if (role === 'manager') return 0;
      return 1;
    };
    const pA = getRolePriority(a.role || 'staff');
    const pB = getRolePriority(b.role || 'staff');
    if (pA !== pB) return pA - pB;

    // 2. Cấp trưởng vs cấp phó (is_department_head === true luôn lên đầu)
    const headA = a.is_department_head === true ? 0 : 1;
    const headB = b.is_department_head === true ? 0 : 1;
    if (headA !== headB) return headA - headB;

    // 3. Alphabet tiếng Việt full_name
    return (a.full_name || '').localeCompare(b.full_name || '', 'vi');
  });
}

// Gán màu cho từng thành viên BGĐ
export function getDirectorColor(fullName: string, allProfiles: any[]) {
  const name = fullName ? fullName.trim() : '';

  const bgdList = filterBGD(allProfiles)
    .map(p => p.full_name)
    .sort();

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
      const mgrIds = allProfiles.filter(p => filterDepts.includes(p.department_id) && p.role === 'manager').map(p => p.id);
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
}) {
  const { checkIds, startDate, endDate, startTime, endTime, schedules } = params;

  if (checkIds.length === 0) return [];

  try {
    const startString = `${format(startDate, 'yyyy-MM-dd')}T${startTime}`;
    const endString = `${format(endDate, 'yyyy-MM-dd')}T${endTime}`;
    const start = new Date(startString);
    const end = new Date(endString);

    const foundConflicts: string[] = [];
    schedules.forEach(s => {
      if (s.status === 'rejected') return;
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
