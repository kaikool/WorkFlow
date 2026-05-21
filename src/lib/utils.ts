import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function compareProfilesByHierarchy(a: any, b: any) {
  const getRolePriority = (role?: string) => {
    if (role === "director") return 0
    if (role === "manager") return 1
    return 2
  }

  const roleA = getRolePriority(a?.role)
  const roleB = getRolePriority(b?.role)
  if (roleA !== roleB) return roleA - roleB

  const headA = a?.is_department_head === true ? 0 : 1
  const headB = b?.is_department_head === true ? 0 : 1
  if (headA !== headB) return headA - headB

  return (a?.full_name || "").localeCompare(b?.full_name || "", "vi")
}

export function sortProfilesByHierarchy<T extends { role?: string; is_department_head?: boolean; full_name?: string }>(profiles: T[]) {
  return [...profiles].sort(compareProfilesByHierarchy)
}

export function canViewLeaveDetails(leave: any, currentUser: any) {
  if (!leave || !currentUser) return false;
  if (leave.type !== 'leave') return true;

  const creatorId = leave.created_by || leave.creator?.id;
  if (creatorId === currentUser.id) return true;

  if (currentUser.role === 'admin' || currentUser.role === 'hr_officer' || currentUser.role === 'director') return true;

  const creator = leave.creator;
  if (creator) {
    if (currentUser.role === 'manager') {
      const isCurrentUserHead = currentUser.is_department_head === true;
      const isCreatorHead = creator.is_department_head === true;
      const isCreatorManager = creator.role === 'manager';

      return (
        creator.department_id === currentUser.department_id &&
        (isCurrentUserHead || (!isCreatorHead && !isCreatorManager))
      );
    }
  }

  return false;
}
