"use client"

import { usePathname } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/admin/login"

  if (isLoginPage) {
    return <>{children}</>
  }

  return <AdminShell>{children}</AdminShell>
}
