export function hasTCTHPermission(profile: any): boolean {
  if (!profile) return false;
  
  // Drivers never have TCTH permission for vehicle assignment
  if (profile.role === 'driver') return false;

  // 1. Check roles (admin, secretary, hr_officer)
  const allowedRoles = ['admin', 'secretary', 'hr_officer'];
  if (allowedRoles.includes(profile.role)) {
    return true;
  }

  // 2. Check if user is Manager of TCTH (department code '13602')
  if (profile.role === 'manager' && profile.departments?.code === '13602') {
    return true;
  }

  // Legacy fallback just in case department code is not migrated yet
  if (profile.departments?.name === 'Tổ chức Tổng hợp') {
    return true;
  }

  return false;
}
