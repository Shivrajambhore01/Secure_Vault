"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { 
  FileSearch, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Timer,
  Search,
  ChevronRight,
  Filter,
  User,
  MoreVertical
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

import { 
  fetchVerificationStats, 
  fetchVerificationRequests,
  VerificationRequest
} from "@/lib/verification-api"
import { VerificationStatCard } from "@/components/admin/verification-stat-card"
import { VerificationStatusBadge } from "@/components/admin/verification-status-badge"

export default function VerificationDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(true)
  
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  const loadStats = async () => {
    try {
      const data = await fetchVerificationStats()
      setStats(data)
    } catch (error: any) {
      toast.error(error.message || "Failed to load verification stats")
    } finally {
      setLoadingStats(false)
    }
  }

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const data = await fetchVerificationRequests({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: searchQuery || undefined,
        limit: 50
      })
      setRequests(data.requests)
    } catch (error: any) {
      toast.error(error.message || "Failed to load verification requests")
    } finally {
      setLoadingRequests(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    // Debounce search slightly
    const timer = setTimeout(() => {
      loadRequests()
    }, 300)
    return () => clearTimeout(timer)
  }, [loadRequests])

  const navigateToDetail = (id: string) => {
    router.push(`/admin/verifications/${id}`)
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy HH:mm")
    } catch (e) {
      return dateString
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileSearch className="w-8 h-8 text-blue-500" />
          Death Verification
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Review and process proof-of-death submissions from nominees before asset transfer.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <VerificationStatCard
          title="Pending Review"
          value={loadingStats ? "-" : stats?.pending || 0}
          icon={Clock}
          color="text-amber-500 bg-amber-500/10 border-amber-500/20"
        />
        <VerificationStatCard
          title="Under Review"
          value={loadingStats ? "-" : stats?.underReview || 0}
          icon={FileSearch}
          color="text-blue-500 bg-blue-500/10 border-blue-500/20"
        />
        <VerificationStatCard
          title="Approved Today"
          value={loadingStats ? "-" : stats?.approvedToday || 0}
          icon={CheckCircle2}
          color="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
        />
        <VerificationStatCard
          title="Rejected Today"
          value={loadingStats ? "-" : stats?.rejectedToday || 0}
          icon={XCircle}
          color="text-red-500 bg-red-500/10 border-red-500/20"
        />
        <VerificationStatCard
          title="Avg Review Time"
          value={loadingStats ? "-" : `${stats?.avgReviewTimeHours || 0}h`}
          icon={Timer}
          color="text-violet-500 bg-violet-500/10 border-violet-500/20"
        />
      </div>

      {/* Main Content Area */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              Verification Queue
              {requests.length > 0 && (
                <Badge variant="secondary" className="bg-muted text-muted-foreground ml-2">
                  {requests.length} results
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search names or emails..."
                  className="pl-9 bg-background border-border text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50">
            <Tabs defaultValue="ALL" value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <TabsList className="bg-background border border-border h-10 w-full justify-start overflow-x-auto">
                <TabsTrigger value="ALL" className="data-[state=active]:bg-muted">All Requests</TabsTrigger>
                <TabsTrigger value="PENDING" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500">Pending</TabsTrigger>
                <TabsTrigger value="UNDER_REVIEW" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500">Under Review</TabsTrigger>
                <TabsTrigger value="MORE_DOCUMENTS_REQUIRED" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-500">Needs Docs</TabsTrigger>
                <TabsTrigger value="APPROVED" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500">Approved</TabsTrigger>
                <TabsTrigger value="REJECTED" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-500">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        
        <CardContent>
          {loadingRequests ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl bg-muted/50" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center">
              <div className="bg-muted/30 p-4 rounded-full mb-4">
                <FileSearch className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No requests found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {searchQuery || statusFilter !== "ALL" 
                  ? "Try adjusting your filters or search query to find what you're looking for." 
                  : "There are currently no death verification requests in the system."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Owner & Nominee</th>
                      <th className="px-6 py-4 font-medium">Status & Priority</th>
                      <th className="px-6 py-4 font-medium">Submitted</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {requests.map((req) => (
                      <tr 
                        key={req.id} 
                        className="bg-card hover:bg-muted/20 transition-colors cursor-pointer group"
                        onClick={() => navigateToDetail(req.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center gap-2 text-foreground font-medium">
                              <User className="w-4 h-4 text-muted-foreground" />
                              {req.ownerName}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span className="opacity-50">↳</span> 
                              <span>{req.nomineeName}</span>
                              <span className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px] uppercase font-semibold">
                                {req.nomineeRelation}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <VerificationStatusBadge status={req.status} />
                            {req.priority === "HIGH" && req.status === "PENDING" && (
                              <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-500 bg-red-500/10">
                                URGENT (&gt;7 days)
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                          {formatDate(req.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Review
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
