import { secureAdminFetch } from "./admin-api"

export interface SecurityStats {
  loginsToday: number
  failedLoginsToday: number
  activeSessions: number
  lockedAccounts: number
  otpRequestsToday: number
  alertsCount: number
}

export interface SecurityLog {
  _id: string
  requestId: string
  timestamp: string
  actorType: "USER" | "NOMINEE" | "ADMIN" | "SYSTEM"
  actorId: string
  actorEmail?: string
  action: string
  resourceType?: string
  resourceId?: string
  ipAddress: string
  userAgent: string
  result: "SUCCESS" | "FAILURE" | "BLOCKED"
  reason?: string
  metadata?: any
}

export interface ActiveSession {
  _id: string
  sessionId?: string
  refreshTokenId: string
  userId: string
  email: string
  userAgent: string
  ipAddress: string
  createdAt: string
  lastActive: string
}

export async function fetchSecurityStats(): Promise<SecurityStats> {
  const res = await secureAdminFetch("/security/stats")
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchLoginHistory(params: { search?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/security/login-history?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchFailedLogins(params: { search?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/security/failed-logins?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchOtpLogs(params: { search?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/security/otp-logs?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchUserActivity(params: { search?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/security/user-activity?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchAdminActivity(params: { search?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/security/admin-activity?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchAssetAccessLogs(params: { search?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/security/asset-access-logs?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchActiveSessions(params: { search?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/security/sessions?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function terminateSession(refreshTokenId: string) {
  const res = await secureAdminFetch(`/security/sessions/${refreshTokenId}/terminate`, {
    method: "POST"
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function lockUser(userId: string, reason: string) {
  const res = await secureAdminFetch(`/security/users/${userId}/lock`, {
    method: "POST",
    body: JSON.stringify({ reason })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function unlockUser(userId: string) {
  const res = await secureAdminFetch(`/security/users/${userId}/unlock`, {
    method: "POST"
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchSecurityAlerts(params: { skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/security/alerts?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchRecentActivity(): Promise<SecurityLog[]> {
  const res = await secureAdminFetch("/security/recent-activity")
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
