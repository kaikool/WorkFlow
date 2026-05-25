export function isCoordinatorDepartment(profile: any): boolean {
  if (!profile) return false;
  const depts = profile.departments;
  if (!depts) return false;
  const first = Array.isArray(depts) ? depts[0] : depts;
  return first?.code === '13602' || first?.name === 'Tổ chức Tổng hợp';
}

export function canCoordinateSharedResources(profile: any): boolean {
  if (!profile) return false;

  if (profile.role === 'admin' || profile.role === 'secretary') return true;

  return profile.role === 'manager' && isCoordinatorDepartment(profile);
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

// Xem danh bạ — mở rộng cho staff/secretary/hr_officer/manager/director/admin.
// Driver vẫn chặn vì không có nhu cầu nghiệp vụ (workspace riêng).
export function canViewPeopleDirectory(profile: any): boolean {
  return !!profile && profile.role !== 'driver';
}

// Xem field nhạy cảm trên hồ sơ người khác (birthday, ad_account, employee_code, gender).
// Self luôn xem được; ngoài ra chỉ admin/hr_officer/director.
export function canViewSensitiveProfileFields(viewer: any, target: any): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;
  return ['admin', 'hr_officer', 'director'].includes(viewer.role);
}

// Sửa hồ sơ — self sửa field hạn chế; admin/hr_officer sửa full.
export function canEditProfile(viewer: any, target: any): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;
  return ['admin', 'hr_officer'].includes(viewer.role);
}

// Gửi ghi nhận đồng nghiệp (recognitions) — mọi role active trừ driver.
export function canRecognize(profile: any): boolean {
  return !!profile && profile.role !== 'driver';
}

// Widget analytics nhân sự (sắp sinh nhật, sắp nghỉ, anniversary) — bộ phận điều phối + HR.
export function canViewPeopleAnalyticsWidget(profile: any): boolean {
  return canCoordinateSharedResources(profile) || profile?.role === 'hr_officer';
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
// kể cả cán bộ staff. Theo nghiệp vụ chi nhánh (phòng điều phối + 4 phòng đầu mối khác).
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

// Cho phép chọn "Cả phòng ban" (giao qua phòng — đầu mối là TP của phòng đó).
// Hub manager/staff điều phối chi nhánh; non-hub manager bị siết về phòng mình
// nên không có nhu cầu chọn phòng (chỉ chính phòng mình → toggle vô nghĩa).
// Admin/Director toàn quyền.
export function canTargetCrossDepartment(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director'].includes(profile.role)) return true;
  return ['manager', 'staff'].includes(profile.role) && isHubDepartment(profile);
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

// Trả về báo cáo đã nộp để sửa (submitted → doing).
// Cho phép: người tạo (created_by) + TP cùng phòng + admin/director.
export function canRejectSubmission(
  profile: any,
  task: { department_id?: string | null; created_by?: string | null; status?: string | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (task.status !== 'submitted') return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  if (task.created_by === profile.id) return true;
  return profile.role === 'manager' && profile.department_id === task.department_id;
}

// Mở lại báo cáo đã hoàn thành (done → doing) — CHỈ admin/director.
// Đã siết quyền: TP cùng phòng và người tạo KHÔNG được reopen để tránh
// vòng lặp "duyệt rồi mở lại" vô hạn — leo lên BGĐ là biên cuối.
export function canReopenDone(
  profile: any,
  task: { status?: string | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (task.status !== 'done') return false;
  return profile.role === 'admin' || profile.role === 'director';
}

// Sửa nội dung công việc (title/description/priority/due_date) — creator + admin/director.
// Cho sửa BẤT KỲ LÚC NÀO trừ canceled/archived. Đảm bảo các field bất biến
// (department/assignee/task_type/requires_approval) chỉ thay đổi qua RPC chuyên biệt
// (task_delegate, không có RPC đổi task_type — phải tạo mới).
export function canEditTask(
  profile: any,
  task: { created_by?: string | null; status?: string | null; is_archived?: boolean | null } | null,
): boolean {
  if (!profile || !task) return false;
  if (task.status === 'canceled' || task.is_archived) return false;
  if (profile.role === 'admin' || profile.role === 'director') return true;
  return task.created_by === profile.id;
}

// Xoá nháp — CHỈ creator, cửa sổ 10 phút sau khi tạo, status=todo, 0 comment user, 0 file.
// Là escape hatch cho lỗi gõ nhầm/tạo nhầm ngay sau khi tạo. Sau ngưỡng dùng Huỷ.
export function canDeleteDraft(
  profile: any,
  task: {
    created_by?: string | null;
    status?: string | null;
    created_at?: string | null;
  } | null,
  commentCount: number,
  attachmentCount: number,
): boolean {
  if (!profile || !task) return false;
  if (task.created_by !== profile.id) return false;
  if (task.status !== 'todo') return false;
  if (commentCount > 0 || attachmentCount > 0) return false;
  if (!task.created_at) return false;
  const ageMs = Date.now() - new Date(task.created_at).getTime();
  return ageMs <= 10 * 60 * 1000;
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

// Xem Analytics module Tasks.
//   • Admin/Director: toàn nhánh.
//   • Manager (any): vào được, scope toàn nhánh nếu phòng điều phối, phòng mình nếu khác.
//   • Staff phòng điều phối (Tổ chức Tổng hợp — code 13602): toàn nhánh.
//   • Staff khác: KHÔNG xem được.
export function canViewTaskAnalytics(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director', 'manager'].includes(profile.role)) return true;
  return profile.role === 'staff' && isCoordinatorDepartment(profile);
}

// Xem Analytics ở phạm vi TOÀN NHÁNH (cho filter dept dropdown).
// Manager ngoài phòng điều phối bị giới hạn phòng mình.
export function canViewBranchAnalytics(profile: any): boolean {
  if (!profile) return false;
  if (['admin', 'director'].includes(profile.role)) return true;
  return isCoordinatorDepartment(profile);
}
