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
