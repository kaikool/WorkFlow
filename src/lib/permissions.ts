export function isTcthDepartment(profile: any): boolean {
  if (!profile) return false;
  const depts = profile.departments;
  if (!depts) return false;
  const first = Array.isArray(depts) ? depts[0] : depts;
  return first?.code === '13602' || first?.name === 'Tổ chức Tổng hợp';
}

export function canCoordinateSharedResources(profile: any): boolean {
  if (!profile) return false;

  if (profile.role === 'admin' || profile.role === 'secretary') return true;

  return profile.role === 'manager' && isTcthDepartment(profile);
}

export function canManageResourceCatalog(profile: any): boolean {
  if (!profile) return false;

  return profile.role === 'admin' || profile.role === 'secretary';
}

export function canUseDriverWorkspace(profile: any): boolean {
  return profile?.role === 'driver';
}

export function canUseHumanResourcesWorkspace(profile: any): boolean {
  return profile?.role === 'hr_officer';
}

export function canAccessPeopleDirectory(profile: any): boolean {
  if (!profile) return false;

  return ['admin', 'director', 'hr_officer'].includes(profile.role) || profile.role === 'manager';
}

export function canApproveLeave(profile: any, leave?: any): boolean {
  if (!profile) return false;

  if (profile.role === 'admin') return true;

  // HR Officer chỉ READ đơn nghỉ phép, không duyệt
  if (profile.role === 'hr_officer') return false;

  if (!leave) {
    return profile.role === 'director' || profile.role === 'manager';
  }

  if (profile.role === 'director') {
    return leave.creator?.is_department_head === true || leave.creator?.role === 'manager';
  }

  if (profile.role === 'manager') {
    const isCurrentUserHead = profile.is_department_head === true;
    const isCreatorHead = leave.creator?.is_department_head === true;
    const isCreatorManager = leave.creator?.role === 'manager';

    return (
      leave.creator?.department_id === profile.department_id &&
      leave.created_by !== profile.id &&
      (isCurrentUserHead || (!isCreatorHead && !isCreatorManager))
    );
  }

  return false;
}

// Module Luân chuyển & Truy vết Hồ sơ vật lý ---------------------------------

// Chỉ admin được tạo/sửa/xoá nhóm hồ sơ (đi kèm cấu hình SLA)
export function canManageDocumentCategories(profile: any): boolean {
  return profile?.role === 'admin';
}

// BGĐ + admin được xem toàn bộ hồ sơ chi nhánh (read-only truy vết)
export function canViewAllDocuments(profile: any): boolean {
  return profile?.role === 'admin' || profile?.role === 'director';
}

// Lái xe có workspace riêng, không tham gia luồng hồ sơ giấy
export function canCreateDocument(profile: any): boolean {
  if (!profile) return false;
  return profile.role !== 'driver';
}

// Module Công việc (Tasks) -----------------------------------------------------

// Phòng đầu mối — code đặc biệt được phép yêu cầu báo cáo cho phòng khác,
// kể cả cán bộ staff. Theo nghiệp vụ chi nhánh (TCTH + 4 phòng đầu mối khác).
const HUB_DEPARTMENT_CODES = ['13618', '13602', '13605', '13609', '13603'];

// Trích code phòng từ profile — Supabase có thể trả `departments` dưới dạng
// object hoặc array (1-1 vs ambiguous FK). Helper này xử lý cả 2 case.
export function getProfileDepartmentCode(profile: any): string | null {
  const depts = profile?.departments;
  if (!depts) return null;
  if (Array.isArray(depts)) return depts[0]?.code ?? null;
  return depts?.code ?? null;
}

export function isHubDepartment(profile: any): boolean {
  const code = getProfileDepartmentCode(profile);
  return !!code && HUB_DEPARTMENT_CODES.includes(code);
}

// Lái xe + lễ tân (role secretary trong tổ chức này) không thấy module Tasks
export function canAccessTasksModule(profile: any): boolean {
  if (!profile) return false;
  return !['driver', 'secretary'].includes(profile.role);
}

// Giao việc (Luồng A — task_type='task') cho người khác.
// CHỈ admin/director/manager. Staff (kể cả phòng đầu mối) bị khoá tự-ghi-chú
// vì nhiệm vụ là chiều dọc — staff không có quyền sai bảo người khác.
export function canAssignTaskToOthers(profile: any): boolean {
  if (!profile) return false;
  return ['admin', 'director', 'manager'].includes(profile.role);
}

// Yêu cầu báo cáo (Luồng B — task_type='report').
// Admin/director/manager + cán bộ phòng đầu mối được tạo yêu cầu báo cáo.
export function canRequestReport(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director', 'manager'].includes(profile.role)) return true;
  return profile.role === 'staff' && isHubDepartment(profile);
}

// Phân công (Delegate) báo cáo cấp phòng — chỉ TP cùng phòng + BGĐ + admin.
export function canDelegateTask(profile: any, task: { department_id?: string | null } | null): boolean {
  if (!profile || !task) return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  return profile.role === 'manager' && profile.department_id === task.department_id;
}

// Duyệt báo cáo (Luồng B submitted → done) — cùng quyền với delegate.
export function canApproveReport(profile: any, task: { department_id?: string | null } | null): boolean {
  return canDelegateTask(profile, task);
}

// Trả lại task — submitted → doing (bị từ chối) HOẶC done → doing (reopen).
// Cho phép: người tạo (created_by) + TP cùng phòng + admin/director.
export function canReturnTask(
  profile: any,
  task: { department_id?: string | null; created_by?: string | null; status?: string | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (!['submitted', 'done'].includes(task.status ?? '')) return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  if (task.created_by === profile.id) return true;
  return profile.role === 'manager' && profile.department_id === task.department_id;
}

// Duyệt xin gia hạn — TP cùng phòng + BGĐ + admin + người tạo task.
export function canApproveExtension(
  profile: any,
  task: { department_id?: string | null; created_by?: string | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  if (task.created_by === profile.id) return true;
  return profile.role === 'manager' && profile.department_id === task.department_id;
}

// Tạo template Recurring Reports — BGĐ + TP + cán bộ phòng đầu mối.
export function canCreateRecurringTemplate(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director', 'manager'].includes(profile.role)) return true;
  return profile.role === 'staff' && isHubDepartment(profile);
}

// Xem Analytics module Tasks — admin/BGĐ/TP. Staff/HR officer redirect.
export function canViewTaskAnalytics(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director', 'manager'].includes(profile.role)) return true;
  return profile.role === 'staff' && isHubDepartment(profile);
}
