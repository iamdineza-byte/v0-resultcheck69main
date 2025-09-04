"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Trophy, School, User, BookOpen, Award, GraduationCap, ArrowLeft, Download, Eye } from "lucide-react"

// Helper for grade colors
const getGradeColor = (grade: string) => {
  switch (grade) {
    case "A":
      return "bg-success text-success-foreground"
    case "S":
      return "bg-primary text-primary-foreground"
    case "D":
      return "bg-warning text-warning-foreground"
    case "C":
      return "bg-accent text-accent-foreground"
    case "F":
      return "bg-destructive text-destructive-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

interface Subject {
  subject: {
    subjectName: string
  }
  subjectWeightedPercent: number
  markPercent: number
  letterGrade: string
  subjectId: string
}

interface StudentResult {
  studentNames: string
  studentIndexNumber: string
  studentNationalId?: string
  academicYear: string
  attendedSchool?: string
  weightedPercent: number
  division: string
  combination?: string
  rawMark: Subject[]
  placedSchoolName?: string
  placedCombinationName?: string
}

const ResultsChecker = () => {
  const [activeTab, setActiveTab] = useState("ADVANCED")
  const { toast } = useToast()

  // Individual states
  const [indexNumber, setIndexNumber] = useState("")
  const [nationalId, setNationalId] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<StudentResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Class states
  const [schoolCode, setSchoolCode] = useState("")
  const [levelCode, setLevelCode] = useState("")
  const [examYear, setExamYear] = useState("")
  const [classLoading, setClassLoading] = useState(false)
  const [classResults, setClassResults] = useState<StudentResult[]>([])
  const [classSchoolName, setClassSchoolName] = useState("")
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)

  // Individual fetch
  const getResults = async () => {
    if (!indexNumber || (activeTab === "ADVANCED" && !nationalId)) {
      toast({
        title: "Missing Information",
        description: "Please enter all required fields.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      let apiUrl = ""
      if (activeTab === "ORDINARY") {
        apiUrl = `https://secondary.sdms.gov.rw/api/results-publication/findByIndex?indexNumber=${indexNumber}&_t=${Date.now()}&_cb=${Math.random()}`
      } else {
        apiUrl = `https://secondary.sdms.gov.rw/api/results-publication/findByIndexAndNationalId?indexNumber=${indexNumber}&nationalId=${nationalId}&_t=${Date.now()}&_cb=${Math.random()}`
      }

      const res = await fetch(apiUrl, { headers: { Accept: "application/json" } })
      if (!res.ok) throw new Error("Failed to fetch results")
      const data = await res.json()

      if (!data || !data.studentNames) {
        toast({
          title: "No Results Found",
          description: "Please check your details and try again.",
          variant: "destructive",
        })
      } else {
        setResult(data)
        setIsModalOpen(true) // Open modal automatically when results are retrieved
        toast({
          title: "Results Retrieved!",
          description: "Your results have been successfully loaded.",
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: `Error fetching results: ${err instanceof Error ? err.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Class fetch
  const fetchClassResults = async () => {
    if (!schoolCode || !levelCode || !examYear) {
      toast({
        title: "Missing Information",
        description: "Please enter School Code, Level Code (OLC/PR), and Exam Year.",
        variant: "destructive",
      })
      return
    }

    setClassLoading(true)
    setClassResults([])
    setClassSchoolName("")

    try {
      const results: StudentResult[] = []
      let seq = 1
      let emptyCount = 0
      const MAX_CONSECUTIVE_EMPTY = 20
      const MAX_STUDENTS = 1000

      while (emptyCount < MAX_CONSECUTIVE_EMPTY && seq <= MAX_STUDENTS) {
        const seqStr = String(seq).padStart(3, "0")
        const idx = `${schoolCode}${levelCode.toUpperCase()}${seqStr}${examYear}`
        try {
          const res = await fetch(
            `https://secondary.sdms.gov.rw/api/results-publication/findByIndex?indexNumber=${idx}&_t=${Date.now()}&_cb=${Math.random()}`,
            { headers: { Accept: "application/json" } },
            { headers: { Accept: "application/json" } },
          )
          if (!res.ok) {
            emptyCount++
            seq++
            continue
          }
          const data = await res.json()
          if (data && data.studentNames) {
            results.push(data)
            emptyCount = 0
          } else {
            emptyCount++
          }
        } catch {
          emptyCount++
        }
        seq++
      }

      results.sort((a, b) => (b?.weightedPercent ?? 0) - (a?.weightedPercent ?? 0))

      if (results.length > 0) {
        setClassSchoolName(results[0].attendedSchool ?? "")
        setClassResults(results)
        setIsClassModalOpen(true) // Open class modal automatically when results are retrieved
        toast({
          title: "Class Results Retrieved!",
          description: `Found results for ${results.length} students.`,
        })
      } else {
        toast({
          title: "No Results Found",
          description: "No results found for this class. Double-check school code, level and year.",
          variant: "destructive",
        })
        setClassResults(results)
      }
    } catch (err) {
      toast({
        title: "Error",
        description: `Error fetching class results: ${err instanceof Error ? err.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setClassLoading(false)
    }
  }

  // Build dynamic subject columns for class table
  const classSubjects = useMemo(() => {
    if (classResults.length === 0) return []

    const subjectSet = new Set<string>()
    classResults.forEach((st) => {
      if (Array.isArray(st.rawMark)) {
        st.rawMark.forEach((m) => {
          if (m?.subject?.subjectName) subjectSet.add(m.subject.subjectName)
        })
      }
    })
    return Array.from(subjectSet)
  }, [classResults])

  // CSV Export function
  const exportClassResultsCSV = () => {
    if (classResults.length === 0) {
      toast({
        title: "No Data",
        description: "No class results to export.",
        variant: "destructive",
      })
      return
    }

    // Build CSV header
    const headers = [
      "Index Number",
      "Name",
      "Weighted %",
      "Division",
      "Placed School",
      "Placed Combination",
      ...classSubjects,
    ]

    // Build CSV rows
    const rows = classResults.map((student) => {
      const row = [
        student.studentIndexNumber,
        student.studentNames,
        student.weightedPercent + "%",
        student.division,
        student.placedSchoolName || "-",
        student.placedCombinationName || "-",
      ]

      // Add subject marks
      classSubjects.forEach((subject) => {
        const markObj = student?.rawMark?.find((m) => m?.subject?.subjectName === subject)
        if (markObj) {
          const mark = typeof markObj.markPercent === "number" ? `${markObj.markPercent.toFixed(1)}%` : "-"
          const grade = markObj.letterGrade ?? "-"
          row.push(`${mark} (${grade})`)
        } else {
          row.push("-")
        }
      })

      return row
    })

    // Create CSV content
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `class_results_${schoolCode}_${levelCode}_${examYear}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Complete",
      description: "Class results have been exported to CSV.",
    })
  }

  // Function to open results in popup
  const openResultsPopup = () => {
    setIsModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary shadow-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          <div className="flex items-start sm:items-center gap-3 mb-3">
            <div className="p-1.5 sm:p-2 bg-primary-foreground/10 rounded-lg flex-shrink-0">
              <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-display font-bold text-primary-foreground text-balance leading-tight">
                Rwanda Education Results Portal
              </h1>
              <p className="text-primary-foreground/80 text-xs sm:text-sm lg:text-base mt-1 font-sans">
                Official academic results checking platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-primary-foreground/70 text-xs sm:text-sm font-sans">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-accent rounded-full animate-pulse flex-shrink-0"></div>
            <span className="truncate">Available 24/7 • Secure • Instant Results</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-12">
        {/* Main Form Card */}
        <Card className="shadow-lg bg-card border border-border mb-6 sm:mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
            <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl lg:text-2xl text-foreground font-display">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <span className="truncate">Check Your Results</span>
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-sans">
              Enter your details below to access your academic results
            </p>
          </div>
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6 sm:mb-8">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto gap-1 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger
                  value="ADVANCED"
                  className="text-xs sm:text-sm p-3 sm:p-4 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium font-sans min-h-[44px] touch-manipulation"
                >
                  <span className="text-center leading-tight">Advanced / TSS / Professional</span>
                </TabsTrigger>
                <TabsTrigger
                  value="ORDINARY"
                  className="text-xs sm:text-sm p-3 sm:p-4 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium font-sans min-h-[44px] touch-manipulation"
                >
                  <span className="text-center leading-tight">Ordinary / Primary</span>
                </TabsTrigger>
                <TabsTrigger
                  value="CLASS"
                  className="text-xs sm:text-sm p-3 sm:p-4 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium font-sans min-h-[44px] touch-manipulation"
                >
                  <span className="text-center leading-tight">Whole Class</span>
                </TabsTrigger>
              </TabsList>

              {/* Individual Forms */}
              <TabsContent value="ADVANCED" className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground font-sans">Index Number</label>
                    <Input
                      placeholder="Enter your index number"
                      value={indexNumber}
                      onChange={(e) => setIndexNumber(e.target.value)}
                      className="h-12 sm:h-12 text-base border-border focus:ring-primary font-sans touch-manipulation"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground font-sans">National Identity Number</label>
                    <Input
                      placeholder="Enter your national ID"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      className="h-12 sm:h-12 text-base border-border focus:ring-primary font-sans touch-manipulation"
                    />
                  </div>
                  <Button
                    onClick={getResults}
                    disabled={loading}
                    className="w-full h-12 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-sans touch-manipulation"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span className="truncate">Fetching Results...</span>
                      </>
                    ) : (
                      <>
                        <Trophy className="mr-2 h-5 w-5 flex-shrink-0" />
                        <span className="truncate">Get My Results</span>
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="ORDINARY" className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground font-sans">Index Number</label>
                    <Input
                      placeholder="Enter your index number"
                      value={indexNumber}
                      onChange={(e) => setIndexNumber(e.target.value)}
                      className="h-12 sm:h-12 text-base border-border focus:ring-primary font-sans touch-manipulation"
                    />
                  </div>
                  <Button
                    onClick={getResults}
                    disabled={loading}
                    className="w-full h-12 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-sans touch-manipulation"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span className="truncate">Fetching Results...</span>
                      </>
                    ) : (
                      <>
                        <Trophy className="mr-2 h-5 w-5 flex-shrink-0" />
                        <span className="truncate">Get My Results</span>
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="CLASS" className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground font-sans">School Code</label>
                    <Input
                      placeholder="Enter school code (first 6 digits)"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                      className="h-12 sm:h-12 text-base border-border focus:ring-primary font-sans touch-manipulation"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground font-sans">Level Code</label>
                    <Input
                      placeholder="e.g., OLC for Ordinary, PR for Primary"
                      value={levelCode}
                      onChange={(e) => setLevelCode(e.target.value)}
                      className="h-12 sm:h-12 text-base border-border focus:ring-primary font-sans touch-manipulation"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground font-sans">Exam Year</label>
                    <Input
                      placeholder="e.g., 2025"
                      value={examYear}
                      onChange={(e) => setExamYear(e.target.value)}
                      className="h-12 sm:h-12 text-base border-border focus:ring-primary font-sans touch-manipulation"
                    />
                  </div>
                  <Button
                    onClick={fetchClassResults}
                    disabled={classLoading}
                    className="w-full h-12 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-sans touch-manipulation"
                  >
                    {classLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span className="truncate">Fetching Class Results...</span>
                      </>
                    ) : (
                      <>
                        <School className="mr-2 h-5 w-5 flex-shrink-0" />
                        <span className="truncate">Fetch Class Results</span>
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Help Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <Card className="bg-muted/30 border border-border/50 hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-foreground font-display">
                    <User className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Need Help?</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-2 font-sans">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                    <span className="leading-relaxed">Contact your school for your index number</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                    <span className="leading-relaxed">Results are available 24/7 online</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                    <span className="leading-relaxed">Call help desk: 9070 | Email: info@nesa.gov.rw</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30 border border-border/50 hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-foreground font-display">
                    <Award className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Quick Tips</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-2 font-sans">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                    <span className="leading-relaxed">Double-check your index number</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                    <span className="leading-relaxed">Results are final and official</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mt-1.5 sm:mt-2 flex-shrink-0"></div>
                    <span className="leading-relaxed">Download your results confirmation after viewing</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Empty State for Class */}
        {activeTab === "CLASS" && classResults.length === 0 && !classLoading && (
          <Card className="bg-muted/20 border-dashed border-2 border-border/50 hover:border-border transition-colors duration-200">
            <CardContent className="text-center py-12 sm:py-16 px-4">
              <div className="max-w-sm mx-auto">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                  <School className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 font-display">
                  No Class Results Yet
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed font-sans">
                  Enter the School Code, Level Code (OLC/PR), and Exam Year above, then click{" "}
                  <span className="font-semibold text-primary">Fetch Class Results</span> to view all student results
                  for that class.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Individual Results Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto bg-background mx-2 sm:mx-auto">
          <DialogHeader className="border-b border-border pb-3 sm:pb-4 sticky top-0 bg-background z-10">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-bold text-foreground font-display min-w-0">
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <span className="truncate">Academic Results</span>
              </DialogTitle>
              <Button
                onClick={() => setIsModalOpen(false)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1 sm:gap-2 hover:bg-muted font-sans flex-shrink-0 min-h-[44px] touch-manipulation"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Close</span>
              </Button>
            </div>
          </DialogHeader>

          {result && (
            <div className="space-y-6 sm:space-y-8 pt-4 sm:pt-6 px-1">
              <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl p-4 sm:p-8 text-center shadow-lg">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="p-2 sm:p-3 bg-primary-foreground/20 rounded-full flex-shrink-0">
                    <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <div className="text-center sm:text-left min-w-0">
                    <h2 className="text-lg sm:text-2xl font-bold text-balance font-display leading-tight">
                      Academic Results Certificate
                    </h2>
                    <p className="text-primary-foreground/90 text-xs sm:text-sm mt-1 font-sans">
                      Rwanda Education Results Portal
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 bg-primary-foreground/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-sans">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-accent rounded-full flex-shrink-0"></div>
                  <span>Official Results • Verified</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                  <Card className="bg-card border border-border shadow-md hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground font-display">
                        <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                        <span>Student Information</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-sans">
                              Full Name
                            </span>
                            <span className="font-semibold text-foreground text-base sm:text-lg font-display leading-tight">
                              {result.studentNames}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-sans">
                              Index Number
                            </span>
                            <span className="font-mono font-medium text-foreground bg-muted/50 px-2 sm:px-3 py-1 rounded-md w-fit text-sm sm:text-base">
                              {result.studentIndexNumber}
                            </span>
                          </div>
                          {result.studentNationalId && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-sans">
                                National ID
                              </span>
                              <span className="font-mono font-medium text-foreground text-sm sm:text-base">
                                {result.studentNationalId}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-sans">
                              Academic Year
                            </span>
                            <span className="font-semibold text-foreground font-sans text-sm sm:text-base">
                              {result.academicYear}
                            </span>
                          </div>
                          {result.attendedSchool && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-sans">
                                School Attended
                              </span>
                              <span className="font-medium text-foreground text-pretty font-sans text-sm sm:text-base leading-relaxed">
                                {result.attendedSchool}
                              </span>
                            </div>
                          )}
                          {result.placedSchoolName && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-sans">
                                Placed School
                              </span>
                              <span className="font-medium text-foreground text-pretty font-sans text-sm sm:text-base leading-relaxed">
                                {result.placedSchoolName}
                              </span>
                            </div>
                          )}
                          {result.placedCombinationName && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide font-sans">
                                Placed Combination
                              </span>
                              <span className="font-medium text-foreground font-sans text-sm sm:text-base">
                                {result.placedCombinationName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground font-display">
                        <Award className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                        <span>Performance Summary</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-primary mb-1 font-display">
                          {result.weightedPercent}%
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground font-sans">Weighted Percentage</div>
                      </div>

                      <div className="flex items-center justify-center">
                        <Badge
                          className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-semibold font-sans ${
                            result.division === "PASS"
                              ? "bg-primary text-primary-foreground"
                              : "bg-destructive text-destructive-foreground"
                          }`}
                        >
                          {result.division}
                        </Badge>
                      </div>

                      <div className="pt-2 border-t border-border/50">
                        <div className="flex justify-between text-xs sm:text-sm font-sans">
                          <span className="text-muted-foreground">Total Subjects:</span>
                          <span className="font-semibold text-foreground">{result.rawMark?.length ?? 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border border-border shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm sm:text-base text-foreground font-display">
                        Grade Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {["A", "S", "D", "C", "F"].map((grade) => {
                          const count = result.rawMark?.filter((subject) => subject.letterGrade === grade).length || 0
                          return count > 0 ? (
                            <div key={grade} className="flex items-center justify-between text-xs sm:text-sm font-sans">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={`${getGradeColor(grade)} w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs flex-shrink-0`}
                                >
                                  {grade}
                                </Badge>
                                <span className="text-muted-foreground">Grade {grade}</span>
                              </div>
                              <span className="font-medium text-foreground">{count}</span>
                            </div>
                          ) : null
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="bg-card border border-border shadow-md">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground font-display">
                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                    <span>Subject-Level Results</span>
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-sans">
                    Detailed breakdown of performance by subject
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="bg-primary/5 border-b border-border hover:bg-primary/5">
                          <TableHead className="text-primary font-semibold py-3 sm:py-4 px-3 sm:px-6 font-sans text-xs sm:text-sm">
                            Subject
                          </TableHead>
                          <TableHead className="text-primary font-semibold py-3 sm:py-4 px-2 sm:px-4 text-center font-sans text-xs sm:text-sm">
                            Weight
                          </TableHead>
                          <TableHead className="text-primary font-semibold py-3 sm:py-4 px-2 sm:px-4 text-center font-sans text-xs sm:text-sm">
                            Raw Marks
                          </TableHead>
                          <TableHead className="text-primary font-semibold py-3 sm:py-4 px-2 sm:px-4 text-center font-sans text-xs sm:text-sm">
                            Grade
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.rawMark?.map((subject, index) => (
                          <TableRow
                            key={index}
                            className={`border-b border-border/50 hover:bg-muted/30 transition-colors duration-150 ${
                              index % 2 === 0 ? "bg-muted/10" : "bg-background"
                            }`}
                          >
                            <TableCell className="font-medium py-3 sm:py-4 px-3 sm:px-6 text-foreground font-sans text-xs sm:text-sm">
                              <div className="text-pretty leading-relaxed">{subject.subject.subjectName}</div>
                            </TableCell>
                            <TableCell className="py-3 sm:py-4 px-2 sm:px-4 text-center text-muted-foreground font-sans text-xs sm:text-sm">
                              {subject.subjectWeightedPercent}
                            </TableCell>
                            <TableCell className="py-3 sm:py-4 px-2 sm:px-4 text-center">
                              <span className="font-semibold text-foreground bg-muted/50 px-2 sm:px-3 py-1 rounded-md font-sans text-xs sm:text-sm">
                                {Number(subject.markPercent).toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="py-3 sm:py-4 px-2 sm:px-4 text-center">
                              <Badge
                                className={`${getGradeColor(subject.letterGrade)} font-semibold px-2 sm:px-3 py-1 font-sans text-xs`}
                              >
                                {subject.letterGrade}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-gradient-to-r from-muted/30 to-muted/20 border border-border/50 rounded-xl p-4 sm:p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-destructive rounded-full flex-shrink-0"></div>
                  <p className="text-xs sm:text-sm font-medium text-foreground font-display">Important Notice</p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 font-sans leading-relaxed">
                  This is not an official results checking website. For official verification, please visit:
                </p>
                <a
                  href="https://nesa.gov.rw"
                  className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium text-xs sm:text-sm transition-colors duration-200 font-sans touch-manipulation min-h-[44px] px-2 py-1 rounded"
                >
                  nesa.gov.rw
                  <ArrowLeft className="h-3 w-3 rotate-180 flex-shrink-0" />
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Class Results Modal */}
      <Dialog open={isClassModalOpen} onOpenChange={setIsClassModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden bg-background mx-2 sm:mx-auto">
          <DialogHeader className="border-b border-border pb-3 sm:pb-4 sticky top-0 bg-background z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-bold text-foreground font-display">
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <School className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <span className="truncate">Class Results Overview</span>
                </DialogTitle>
                <p className="text-muted-foreground mt-1 font-sans text-xs sm:text-sm">
                  <span className="font-semibold text-foreground">{classSchoolName}</span> •
                  <span className="font-semibold text-primary ml-1">{classResults.length}</span> students found
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={exportClassResultsCSV}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 sm:gap-2 hover:bg-primary hover:text-primary-foreground transition-colors duration-200 font-sans min-h-[44px] touch-manipulation bg-transparent"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Button
                  onClick={() => setIsClassModalOpen(false)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 sm:gap-2 hover:bg-muted font-sans min-h-[44px] touch-manipulation"
                >
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Close</span>
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden pt-2 sm:pt-4">
            <div className="w-full h-[60vh] sm:h-[70vh] overflow-auto border border-border rounded-lg bg-background shadow-inner">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-primary/5 z-10 shadow-sm border-b border-border">
                  <TableRow className="hover:bg-primary/5">
                    <TableHead className="text-xs font-semibold text-primary sticky top-0 bg-primary/5 border-r border-border min-w-[80px] sm:min-w-[100px] py-2 sm:py-3 px-2 sm:px-4 font-sans">
                      Index No.
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-primary sticky top-0 bg-primary/5 border-r border-border min-w-[120px] sm:min-w-[150px] py-2 sm:py-3 px-2 sm:px-4 font-sans">
                      Student Name
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-primary sticky top-0 bg-primary/5 border-r border-border min-w-[60px] sm:min-w-[80px] py-2 sm:py-3 px-2 sm:px-4 text-center font-sans">
                      Weight %
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-primary sticky top-0 bg-primary/5 border-r border-border min-w-[60px] sm:min-w-[70px] py-2 sm:py-3 px-2 sm:px-4 text-center font-sans">
                      Result
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-primary sticky top-0 bg-primary/5 border-r border-border min-w-[100px] sm:min-w-[120px] py-2 sm:py-3 px-2 sm:px-4 font-sans hidden sm:table-cell">
                      Placed School
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-primary sticky top-0 bg-primary/5 border-r border-border min-w-[100px] sm:min-w-[120px] py-2 sm:py-3 px-2 sm:px-4 font-sans hidden sm:table-cell">
                      Combination
                    </TableHead>
                    {classSubjects.slice(0, 3).map((subject) => (
                      <TableHead
                        key={subject}
                        className="text-xs font-semibold text-primary sticky top-0 bg-primary/5 border-r border-border min-w-[70px] sm:min-w-[90px] py-2 sm:py-3 px-1 sm:px-2 text-center font-sans"
                        title={subject}
                      >
                        <div className="text-pretty leading-tight text-xs">
                          {subject.length > 8 ? subject.substring(0, 8) + "..." : subject}
                        </div>
                      </TableHead>
                    ))}
                    {classSubjects.length > 3 && (
                      <TableHead className="text-xs font-semibold text-primary sticky top-0 bg-primary/5 border-r border-border min-w-[50px] py-2 sm:py-3 px-1 sm:px-2 text-center font-sans">
                        <Eye className="h-3 w-3 mx-auto" title={`+${classSubjects.length - 3} more subjects`} />
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classResults.map((student, index) => (
                    <TableRow
                      key={index}
                      className={`border-b border-border/30 hover:bg-muted/50 transition-colors duration-150 ${
                        index % 2 === 0 ? "bg-muted/10" : "bg-background"
                      }`}
                    >
                      <TableCell className="font-mono text-xs border-r border-border/30 py-2 sm:py-3 px-2 sm:px-4 font-medium text-foreground">
                        <div className="text-pretty">{student.studentIndexNumber}</div>
                      </TableCell>
                      <TableCell
                        className="text-xs border-r border-border/30 py-2 sm:py-3 px-2 sm:px-4 font-medium text-foreground font-sans"
                        title={student.studentNames}
                      >
                        <div className="text-pretty leading-tight">{student.studentNames}</div>
                      </TableCell>
                      <TableCell className="font-bold text-xs border-r border-border/30 py-2 sm:py-3 px-2 sm:px-4 text-center">
                        <span className="bg-primary/10 text-primary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-semibold font-sans text-xs">
                          {student.weightedPercent}%
                        </span>
                      </TableCell>
                      <TableCell className="border-r border-border/30 py-2 sm:py-3 px-2 sm:px-4 text-center">
                        <Badge
                          className={`text-xs font-semibold font-sans px-1.5 py-0.5 ${
                            student.division === "PASS"
                              ? "bg-primary text-primary-foreground"
                              : "bg-destructive text-destructive-foreground"
                          }`}
                        >
                          {student.division}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-xs border-r border-border/30 py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground font-sans hidden sm:table-cell"
                        title={student.placedSchoolName || "-"}
                      >
                        <div className="text-pretty leading-tight">{student.placedSchoolName || "-"}</div>
                      </TableCell>
                      <TableCell
                        className="text-xs border-r border-border/30 py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground font-sans hidden sm:table-cell"
                        title={student.placedCombinationName || "-"}
                      >
                        <div className="text-pretty leading-tight">{student.placedCombinationName || "-"}</div>
                      </TableCell>
                      {classSubjects.slice(0, 3).map((subject) => {
                        const markObj = student?.rawMark?.find((m) => m?.subject?.subjectName === subject)
                        const mark =
                          typeof markObj?.markPercent === "number" ? `${markObj.markPercent.toFixed(1)}%` : "-"
                        const grade = markObj?.letterGrade ?? "-"
                        return (
                          <TableCell
                            key={subject}
                            className="border-r border-border/30 py-2 sm:py-3 px-1 sm:px-2 text-center"
                          >
                            {markObj ? (
                              <div className="space-y-0.5 sm:space-y-1">
                                <div className="font-medium text-xs text-foreground bg-muted/50 px-1 sm:px-2 py-0.5 rounded font-sans">
                                  {mark}
                                </div>
                                <Badge
                                  className={`${getGradeColor(grade)} text-xs px-1 py-0.5 font-semibold font-sans`}
                                >
                                  {grade}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground font-sans">-</span>
                            )}
                          </TableCell>
                        )
                      })}
                      {classSubjects.length > 3 && (
                        <TableCell className="border-r border-border/30 py-2 sm:py-3 px-1 sm:px-2 text-center">
                          <span className="text-xs text-muted-foreground font-sans">...</span>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-destructive rounded-full flex-shrink-0"></div>
                <p className="text-xs sm:text-sm font-semibold text-destructive font-display">Important Notice</p>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-sans leading-relaxed">
                This bulk checking method is designed for{" "}
                <span className="font-semibold text-foreground">Primary and Ordinary level</span> students only.
                Advanced level results require individual checking with National ID verification.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ResultsChecker
