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

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-64 bg-background border-border text-sm">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Requests</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="MORE_DOCUMENTS_REQUIRED">Needs Docs</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <div className="py-16 text-center flex flex-col items-center justify-center gap-6 rounded-[20px] border border-dashed border-border/60 bg-glass backdrop-blur-md p-8 max-w-xl mx-auto shadow-sm animate-in fade-in slide-in-from-bottom-5 duration-700">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/5 border border-primary/10">
                <FileSearch className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">No Requests Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {searchQuery || statusFilter !== "ALL" 
                    ? "No death verification requests match your search criteria. Try modifying your filter tabs or search terms." 
                    : "All verification queues are completely clear! There are currently no pending nominee request claims in the system."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {requests.map((req) => {
                // Calculate risk score based on priority
                const riskScore = req.priority === "HIGH" ? 78 : req.priority === "MEDIUM" ? 42 : 15
                const riskLabel = req.priority === "HIGH" ? "High" : req.priority === "MEDIUM" ? "Medium" : "Low"
                const riskColor = req.priority === "HIGH" ? "text-red-500 bg-red-500/10 border-red-500/20" : req.priority === "MEDIUM" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"

                // Calculate progress based on uploaded files
                let uploadedCount = 0
                if (req.certificateFile) uploadedCount++
                if (req.governmentIdFile) uploadedCount++
                if (req.relationshipProofFile) uploadedCount++
                const progressPct = Math.round((uploadedCount / 3) * 100)

                // Map status
                let mappedStatus: string = req.status
                if (req.status === "MORE_DOCUMENTS_REQUIRED") {
                  mappedStatus = "more_documents_required"
                }

                return (
                  <Card 
                    key={req.id} 
                    onClick={() => navigateToDetail(req.id)}
                    className="group flex flex-col justify-between"
                  >
                    {/* Header: Request ID & Status Badge */}
                    <CardHeader className="flex items-center justify-between border-b border-border/10">
                      <div className="flex items-center gap-2">
                        <FileSearch className="h-5 w-5 text-primary" />
                        <CardTitle className="text-sm font-bold">REQ-{req.id.slice(-6).toUpperCase()}</CardTitle>
                      </div>
                      <StatusBadge status={mappedStatus} className="px-2 py-0.5 text-[9px]" />
                    </CardHeader>

                    {/* Body Content */}
                    <CardContent className="flex flex-col gap-4 py-5 flex-grow text-xs leading-relaxed text-muted-foreground">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span>Owner Name</span>
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {req.ownerName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Nominee Claimant</span>
                          <span className="font-bold text-foreground">{req.nomineeName} ({req.nomineeRelation})</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Risk Assessment</span>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${riskColor}`}>
                            {riskScore}/100 • {riskLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Submitted Date</span>
                          <span className="font-semibold text-foreground">{formatDate(req.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Admin Assigned</span>
                          <span className="font-bold text-foreground">{req.reviewedBy || "Unassigned"}</span>
                        </div>
                      </div>

                      {/* Verification Progress */}
                      <div className="space-y-2 border-t border-border/10 pt-4 mt-auto font-sans">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <span>Verification Progress</span>
                          <span>{uploadedCount}/3 Documents</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-primary transition-all duration-500" 
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>

                    {/* Footer Actions */}
                    <CardFooter className="flex justify-end border-t border-border/10 py-3 bg-secondary/5">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-primary hover:text-primary/80 gap-1 rounded-xl"
                      >
                        Review Request
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
