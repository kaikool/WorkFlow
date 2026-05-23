export function isTcthDepartment(profile: any): boolean {
  if (!profile) return false;

  return (
    profile.departments?.code === '13602' ||
    profile.departments?.name === 'Tổ chức Tổng hợp'
  );
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
