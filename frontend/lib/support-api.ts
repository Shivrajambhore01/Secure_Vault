import { secureAdminFetch } from "./admin-api"

export interface SupportStats {
  totalUsers: number
  verifiedUsers: number
  unverifiedUsers: number
  lockedAccounts: number
  inactiveUsers: number
  twofaUsers: number
  recentSupportActions: number
}

export interface SupportUserMetadata {
  _id: string
  fullName: string
  email: string
  isVerified: boolean
  accountLocked?: boolean
  lockedUntil?: string | null
  createdAt: string
  lastActive?: string
}

export interface SupportUserProfile extends SupportUserMetadata {
  phone?: string
  dob?: string
  isTwoFactorEnabled?: boolean
  assets: {
    _id: string
    fileName: string
    fileType: string
    fileSize: number
    category: string
    createdAt: string
    updatedAt: string
  }[]
  nominees: {
    _id: string
    nomineeName: string
    nomineeEmail: string
    relationship: string
    createdAt: string
  }[]
  assetCount: number
  nomineeCount: number
}

export async function fetchSupportStats(): Promise<SupportStats> {
  const res = await secureAdminFetch("/support/stats")
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function searchSupportUsers(params: { search?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams()
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/support/users?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchSupportUserProfile(userId: string): Promise<SupportUserProfile> {
  const res = await secureAdminFetch(`/support/users/${userId}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function supportLockUser(userId: string, reason: string) {
  const res = await secureAdminFetch(`/support/users/${userId}/lock`, {
    method: "POST",
    body: JSON.stringify({ reason })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function supportUnlockUser(userId: string) {
  const res = await secureAdminFetch(`/support/users/${userId}/unlock`, {
    method: "POST"
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function supportResetPassword(userId: string, newPassword: string) {
  const res = await secureAdminFetch(`/support/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function supportResetPin(userId: string, newPin: string) {
  const res = await secureAdminFetch(`/support/users/${userId}/reset-pin`, {
    method: "POST",
    body: JSON.stringify({ newPin })
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function supportDisable2FA(userId: string) {
  const res = await secureAdminFetch(`/support/users/${userId}/disable-2fa`, {
    method: "POST"
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function supportResendVerification(userId: string) {
  const res = await secureAdminFetch(`/support/users/${userId}/resend-verification`, {
    method: "POST"
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
