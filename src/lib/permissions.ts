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

  if (profile.role === 'admin' || profile.role === 'hr_officer') return true;

  if (!leave) {
    return profile.role === 'director' || profile.role === 'manager';
  }

  if (profile.role === 'director') {
    return leave.creator?.is_department_head === true || leave.creator?.role === 'manager';
  }

  if (profile.role === 'manager') {
    return (
      leave.creator?.department_id === profile.department_id &&
      leave.created_by !== profile.id &&
      leave.creator?.role !== 'manager'
    );
  }

  return false;
}
