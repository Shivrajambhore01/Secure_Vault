"use client"

export interface User {
  id: string
  fullName: string
  email: string
  phone: string
  dob: string
  pin: string
  inactivityPeriod: number // months
  createdAt: string
  lastActive: string
  plan: "free" | "pro" | "premium"
  storageUsed: number
  storageLimit: number
  isVerified: boolean
  isTwoFactorEnabled: boolean
  isProfileComplete: boolean
  authMethod?: "local" | "google"
}

export interface DigitalAsset {
  id: string
  name: string
  type: "document" | "password" | "crypto-key" | "image" | "legal-file"
  description: string
  fileName?: string
  fileSize?: number
  nomineeId?: string
  nomineeIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface Nominee {
  id: string
  name: string
  email: string
  phone: string
  relationship: string
  createdAt: string
}

// Simple ID generator
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

// LocalStorage keys
const KEYS = {
  currentUserId: "sv_current_user_id",
  isLoggedIn: "sv_logged_in",
}

// Helper: get per-user storage key
function userKey(userId: string, suffix: string): string {
  return `sv_${userId}_${suffix}`
}

// Get the current logged-in user's ID
export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(KEYS.currentUserId)
}

// Set the current logged-in user's ID
export function setCurrentUserId(userId: string): void {
  localStorage.setItem(KEYS.currentUserId, userId)
}

// User registry: maps email -> userId for login lookup
const USER_REGISTRY_KEY = "sv_user_registry"

function getUserRegistry(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const data = localStorage.getItem(USER_REGISTRY_KEY)
  return data ? JSON.parse(data) : {}
}

function registerUser(email: string, userId: string): void {
  const registry = getUserRegistry()
  registry[email.toLowerCase().trim()] = userId
  localStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(registry))
}

// Look up a user by email (for login)
export function getUserByEmail(email: string): User | null {
  if (typeof window === "undefined") return null
  const registry = getUserRegistry()
  const userId = registry[email.toLowerCase().trim()]
  if (!userId) return null
  const data = localStorage.getItem(userKey(userId, "user"))
  return data ? JSON.parse(data) : null
}

// User functions
export function getUser(): User | null {
  if (typeof window === "undefined") return null
  const userId = getCurrentUserId()
  if (!userId) return null
  const data = localStorage.getItem(userKey(userId, "user"))
  return data ? JSON.parse(data) : null
}

export function saveUser(user: User): void {
  if (!user) return
  localStorage.setItem(userKey(user.id, "user"), JSON.stringify(user))
  // Register email -> userId mapping
  registerUser(user.email, user.id)
  // Also ensure current user ID is set
  setCurrentUserId(user.id)
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(KEYS.isLoggedIn) === "true" && getCurrentUserId() !== null
}

export function setLoggedIn(value: boolean): void {
  localStorage.setItem(KEYS.isLoggedIn, value.toString())
  const userId = getCurrentUserId()
  if (value && userId) {
    const user = getUser()
    if (user) {
      user.lastActive = new Date().toISOString()
      saveUser(user)
    }
    localStorage.removeItem(userKey(userId, "logoutTime"))
  } else if (!value && userId) {
    const user = getUser()
    if (user) {
      // Store info needed for inactivity notification after logout
      localStorage.setItem("sv_inactivity_data", JSON.stringify({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        logoutTime: new Date().toISOString()
      }))
    }
    localStorage.setItem(userKey(userId, "logoutTime"), new Date().toISOString())
    localStorage.removeItem(KEYS.currentUserId)
  }
}

// Logout time (scoped to current user)
export function getLogoutTime(): string | null {
  if (typeof window === "undefined") return null
  const userId = getCurrentUserId()
  if (!userId) return null
  return localStorage.getItem(userKey(userId, "logoutTime"))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
