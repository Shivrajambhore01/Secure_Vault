/**
 * Admin session store — completely separate from the user store (lib/store.ts).
 *
 * Uses different localStorage keys ("sv_admin_*") so there is zero
 * overlap with the user session (which uses "sv_*" keys).
 */

"use client"

export interface AdminUser {
  id: string
  fullName: string
  email: string
  role: "SUPER_ADMIN" | "VERIFICATION_ADMIN" | "SECURITY_ADMIN" | "SUPPORT_ADMIN"
  status: "ACTIVE" | "DISABLED"
  lastLogin: string | null
  createdAt: string
}

const ADMIN_KEYS = {
  isLoggedIn: "sv_admin_logged_in",
  adminUser: "sv_admin_user",
}

export function adminIsLoggedIn(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(ADMIN_KEYS.isLoggedIn) === "true"
}

export function setAdminLoggedIn(value: boolean): void {
  localStorage.setItem(ADMIN_KEYS.isLoggedIn, value.toString())
  if (!value) {
    // Clear admin user data on logout
    localStorage.removeItem(ADMIN_KEYS.adminUser)
  }
}

export function getAdminUser(): AdminUser | null {
  if (typeof window === "undefined") return null
  const data = localStorage.getItem(ADMIN_KEYS.adminUser)
  return data ? (JSON.parse(data) as AdminUser) : null
}

export function setAdminUser(admin: AdminUser): void {
  localStorage.setItem(ADMIN_KEYS.adminUser, JSON.stringify(admin))
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_KEYS.isLoggedIn)
  localStorage.removeItem(ADMIN_KEYS.adminUser)
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  VERIFICATION_ADMIN: "Verification Admin",
  SECURITY_ADMIN: "Security Admin",
  SUPPORT_ADMIN: "Support Admin",
}

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  VERIFICATION_ADMIN: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  SECURITY_ADMIN: "bg-red-500/15 text-red-400 border-red-500/30",
  SUPPORT_ADMIN: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
}

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  DISABLED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
}

export function formatAdminBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
