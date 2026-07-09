import React, { useState, useEffect } from "react";
import { 
  Settings, 
  FileSpreadsheet, 
  CheckSquare, 
  MapPin, 
  PhoneCall, 
  Coins, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  QrCode,
  ArrowDownToLine,
  Lock,
  Unlock,
  AlertTriangle,
  Trash2,
  Download
} from "lucide-react";
import { InstituteSettings, Teacher, Student, Batch } from "../types";
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, addDoc, onSnapshot } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, secondaryAuth, db } from "../firebase";

interface ReportsSettingsViewProps {
  settings: InstituteSettings;
  onUpdateSettings: (s: InstituteSettings) => Promise<any>;
  teachers: Teacher[];
  onAddTeacherState: (t: Teacher) => void;
  batches: Batch[];
  students: Student[];
  onResetAllStudentData?: () => void;
  isSubscribed?: boolean;
  onSubscriptionBlocked?: () => void;
}

export default function ReportsSettingsView({
  settings,
  onUpdateSettings,
  teachers = [],
  onAddTeacherState,
  batches = [],
  students = [],
  onResetAllStudentData,
  isSubscribed = true,
  onSubscriptionBlocked
}: ReportsSettingsViewProps) {
  
  // Navigation tabs state
  const [subTab, setSubTab] = useState<"attendance_reports" | "audits" | "settings">("attendance_reports");

  // Historical Attendance Desk state
  interface RootAttendanceDoc {
    id: string;
    instituteId: string;
    batchId: string;
    batchName: string;
    date: string;
    records: {
      studentId: string;
      studentName: string;
      status: "Present" | "Absent" | "Leave";
    }[];
  }

  const [attendanceDocs, setAttendanceDocs] = useState<RootAttendanceDoc[]>([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [seeding, setSeeding] = useState(false);

  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [refreshCounter, setRefreshCounter] = useState(0);

  const loadHistoricalAttendance = async () => {
    setRefreshCounter((prev) => prev + 1);
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setFetchError("Please log in to query administrative attendance reports.");
      return;
    }

    setFetchingDocs(true);
    setFetchError("");

    const attendanceRef = collection(db, "attendance");
    let q = query(attendanceRef, where("instituteId", "==", user.uid));
    
    if (selectedBatchId) {
      q = query(
        attendanceRef, 
        where("instituteId", "==", user.uid), 
        where("batchId", "==", selectedBatchId)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsList: RootAttendanceDoc[] = snapshot.docs.map((docItem) => {
        const data = docItem.data();
        
        let recordsArray: { studentId: string; studentName: string; status: "Present" | "Absent" | "Leave" }[] = [];
        if (Array.isArray(data.records)) {
          recordsArray = data.records.map((r: any) => {
            if (r && typeof r === "object") {
              const rawStatus = r.status || "";
              const isLeave = rawStatus === "Leave" || rawStatus === "L" || rawStatus.toLowerCase() === "leave";
              return {
                studentId: r.studentId || "",
                studentName: r.studentName || "",
                status: r.status === "Absent" ? "Absent" : (isLeave ? "Leave" : "Present")
              };
            }
            return null;
          }).filter(Boolean) as any;
        } else if (data.records && typeof data.records === "object") {
          recordsArray = Object.entries(data.records).map(([key, val]: [string, any]) => {
            if (val && typeof val === "object") {
              const rawStatus = val.status || "";
              const isLeave = rawStatus === "Leave" || rawStatus === "L" || rawStatus.toLowerCase() === "leave";
              return {
                studentId: val.studentId || key,
                studentName: val.studentName || val.name || "",
                status: val.status === "Absent" ? "Absent" : (isLeave ? "Leave" : "Present")
              };
            } else {
              const rawVal = String(val || "");
              const isLeave = rawVal === "Leave" || rawVal === "L" || rawVal.toLowerCase() === "leave";
              return {
                studentId: key,
                studentName: "",
                status: val === "Absent" ? "Absent" : (isLeave ? "Leave" : "Present")
              };
            }
          });
        }

        return {
          id: docItem.id,
          instituteId: data.instituteId || "",
          batchId: data.batchId || "",
          batchName: data.batchName || "",
          date: data.date || "",
          records: recordsArray
        };
      });
      // Sort by date descending
      docsList.sort((a, b) => b.date.localeCompare(a.date));
      setAttendanceDocs(docsList);
      setFetchingDocs(false);
    }, (err: any) => {
      console.error("Error with real-time reports listener:", err);
      setFetchError("Failed to observe live changes: " + err.message);
      setFetchingDocs(false);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedBatchId, refreshCounter]);

  // auto select first report if loaded and none is active
  useEffect(() => {
    if (attendanceDocs.length > 0) {
      if (!selectedBatchId) {
        setSelectedBatchId(attendanceDocs[0].batchId);
      }
      if (!selectedDate) {
        setSelectedDate(attendanceDocs[0].date);
      }
    }
  }, [attendanceDocs]);

  // Aggregate unique dates from loaded docs
  const availableDates = Array.from(new Set<string>((attendanceDocs || []).map((doc) => doc.date))).sort((a, b) => b.localeCompare(a));

  const activeReportDoc = attendanceDocs?.find(
    (d) => d.batchId === selectedBatchId && d.date === selectedDate
  );

  const handleDownloadCSVReport = () => {
    if (!activeReportDoc) return;

    const batchObj = batches.find((b) => b.id === activeReportDoc.batchId);
    const rawBatchName = (batchObj ? batchObj.name : activeReportDoc.batchName) || "Unknown_Batch";
    
    // safe clean name
    const sanitizedBatchName = String(rawBatchName).replace(/[^a-zA-Z0-9_\-]/g, "_");
    const fileName = `Attendance_Report_${sanitizedBatchName}_${activeReportDoc.date}.csv`;

    const headers = ["Student ID", "Student Name", "Status", "Date", "Batch Code"];
    const rows = (activeReportDoc.records || []).map((r) => [
      r.studentId,
      `"${String(r.studentName || "").replace(/"/g, '""')}"`,
      r.status,
      activeReportDoc.date,
      `"${activeReportDoc.batchId}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateSampleReport = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSeeding(true);
    try {
      const selectedBatch = batches[0] || { id: "hindi-101", name: "Hindi (03:00 PM - 05:00 PM)" };
      
      const sampleRecords = students
        .filter((s) => s.batchId === selectedBatch.id)
        .map((s) => ({
          studentId: s.id,
          studentName: s.name,
          status: Math.random() > 0.20 ? ("Present" as const) : ("Absent" as const)
        }));

      if (sampleRecords.length === 0) {
        sampleRecords.push(
          { studentId: "STD-2026-P6AE9D", studentName: "Annya Sharma", status: "Present" },
          { studentId: "STD-2026-F98AA2", studentName: "Rohan Verma", status: "Absent" },
          { studentId: "STD-2026-B11C3D", studentName: "Sanya Roy", status: "Present" }
        );
      }

      const todayStr = new Date().toISOString().split("T")[0];

      const attendanceRef = collection(db, "attendance");
      await addDoc(attendanceRef, {
        instituteId: user.uid,
        batchId: selectedBatch.id,
        batchName: selectedBatch.name,
        date: todayStr,
        records: sampleRecords,
        createdAt: new Date().toISOString()
      });

      await loadHistoricalAttendance();
      
      // select them
      setSelectedBatchId(selectedBatch.id);
      setSelectedDate(todayStr);

    } catch (err: any) {
      console.error("Failed to seed sample report:", err);
      alert("Seeding failed: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Settings edit state
  const [name, setName] = useState(settings.name);
  const [logo, setLogo] = useState(settings.logo);
  const [address, setAddress] = useState(settings.address);
  const [contact, setContact] = useState(settings.contact);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  // Teacher credentials state
  const [tName, setTName] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tPassword, setTPassword] = useState("");
  const [tLoading, setTLoading] = useState(false);
  const [tSuccess, setTSuccess] = useState("");
  const [tError, setTError] = useState("");

  // Emergency teacher selection & inline password modifier state
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // --- END OF ACADEMIC YEAR RESET STATES & HANDLERS ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  
  const [isExcelExported, setIsExcelExported] = useState(false);
  const [isBackupVerified, setIsBackupVerified] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [resetSuccessMsg, setResetSuccessMsg] = useState("");

  // Background scroll lock effect when selected teacher or delete modal is active
  useEffect(() => {
    if (selectedTeacher || showDeleteModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedTeacher, showDeleteModal]);

  const handleUnlockSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      // Re-authenticate with owner credentials
      await signInWithEmailAndPassword(auth, ownerEmail, ownerPassword);
      setIsUnlocked(true);
      setAuthError("");
    } catch (err: any) {
      console.error("Owner unlock verification failed:", err);
      setAuthError(err.message || "Invalid Owner Credentials. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleExportSortedClassWiseExcel = () => {
    if (students.length === 0) {
      alert("No student data available to export.");
      return;
    }

    const studentsByClass: { [key: string]: Student[] } = {};
    students.forEach((s) => {
      const className = s.gradeLevel || s.grade || s.class || s.classLevel || "Unassigned Class";
      if (!studentsByClass[className]) {
        studentsByClass[className] = [];
      }
      studentsByClass[className].push(s);
    });

    const sortedClasses = Object.keys(studentsByClass).sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const csvRows: string[][] = [];

    // Metadata/Header
    csvRows.push([`"INSTITUTE NAME: ${settings.name || "ClassSetu Premium Coaching"}"`]);
    csvRows.push([`"EXCEL EXPORT COMPLETED AT: ${new Date().toLocaleString()}"`]);
    csvRows.push([]); // Spacer

    sortedClasses.forEach((className) => {
      // Class Header Section
      csvRows.push([`"============================================================="`]);
      csvRows.push([`"CLASS / GRADE: ${className.toUpperCase()}"`]);
      csvRows.push([`"============================================================="`]);
      
      // Column headers for this class
      csvRows.push([
        "Student ID",
        "Student Name",
        "Parent Name",
        "Parent WhatsApp Mobile",
        "Alternate Contact",
        "School Name",
        "Admission Date",
        "Total Academic Fees (₹)",
        "Payment Plan",
        "Status"
      ]);

      // Students
      const classStudents = studentsByClass[className];
      classStudents.forEach((s) => {
        csvRows.push([
          s.id,
          s.name,
          s.parentName,
          s.parentMobile,
          s.alternateMobile || "N/A",
          s.schoolName || "N/A",
          s.admissionDate || "N/A",
          (s.totalFees || s.feesAmount || 0).toString(),
          s.feesPlan || "quarterly",
          s.status || "active"
        ]);
      });

      csvRows.push([]); // Empty spacer row after each class group
      csvRows.push([]); // Spacer
    });

    const csvContent = csvRows
      .map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${(settings.name || "institute").toLowerCase().replace(/\s+/g, "_")}_full_students_roster_classwise.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExcelExported(true);
  };

  const handlePermanentlyResetSystem = async () => {
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      setShowDeleteModal(false);
      return;
    }
    if (!isBackupVerified) {
      setDeleteError("Please confirm backup verification by checking the checkbox.");
      return;
    }
    if (deleteConfirmationText !== "DELETE ALL") {
      setDeleteError("Please type 'DELETE ALL' exactly to confirm execution.");
      return;
    }
    setIsDeleting(true);
    setDeleteError("");
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No active authenticated user session found.");
      }
      
      // Bulk update student documents status to "ARCHIVED" where instituteId = user.uid and status !== "ARCHIVED"
      const studentsQuery = query(collection(db, "students"), where("instituteId", "==", user.uid));
      const studentsSnap = await getDocs(studentsQuery);
      
      for (const studentDoc of studentsSnap.docs) {
        const currentStatus = studentDoc.data().status;
        if (currentStatus !== "ARCHIVED" && currentStatus !== "archived") {
          await updateDoc(doc(db, "students", studentDoc.id), {
            status: "ARCHIVED"
          });
        }
      }

      // Reset states locally in App.tsx using prop callback
      if (onResetAllStudentData) {
        onResetAllStudentData();
      }

      setResetSuccessMsg("System successfully reset! All active students have been archived, instantly clearing the dashboard while preserving records.");
      setShowDeleteModal(false);
      setDeleteConfirmationText("");
      setIsBackupVerified(false);
      setIsUnlocked(false); // Relock
      setIsExcelExported(false); // Reset export status
    } catch (err: any) {
      console.error("System reset failed:", err);
      setDeleteError(err.message || "An error occurred during resetting. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      return;
    }
    setTLoading(true);
    setTError("");
    setTSuccess("");

    if (tPassword.length < 6) {
      setTError("Password must be at least 6 characters long.");
      setTLoading(false);
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, tEmail.trim(), tPassword);
      const teacherUid = credential.user.uid;

      const docRef = doc(db, "teachers", teacherUid);
      const timestamp = new Date().toISOString();
      const teacherPayload = {
        name: tName.trim(),
        email: tEmail.trim().toLowerCase(),
        password: tPassword,
        role: "TEACHER",
        createdAt: timestamp,
        createdByAdminEmail: auth.currentUser?.email || ""
      };

      await setDoc(docRef, teacherPayload);

      onAddTeacherState({
        id: teacherUid,
        ...teacherPayload
      });

      setTSuccess(`Teacher account for "${tName}" successfully created!`);
      setTName("");
      setTEmail("");
      setTPassword("");
    } catch (err: any) {
      console.error("Failed to register teacher sub-account:", err);
      if (err.code === "auth/email-already-in-use") {
        setTError("This email address is already registered in the system.");
      } else {
        setTError(err.message || "An unexpected error occurred during teacher registration.");
      }
    } finally {
      setTLoading(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      return;
    }
    setLoading(true);
    setSuccess("");
    try {
      await onUpdateSettings({ name, logo, address, contact });
      setSuccess("Institute configurations updated successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = (type: "attendance" | "fees" | "general") => {
    window.open(`/api/reports/download?type=${type}`, "_blank");
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800">
      
      {/* Title */}
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-800">
          Reports Desk & Portal Settings
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Execute instant data audits, download secure excel formats, and modify school profile parameters.
        </p>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex flex-wrap border-b border-slate-100 pb-px gap-2">
        <button
          onClick={() => setSubTab("attendance_reports")}
          className={`pb-3 px-4 text-xs uppercase tracking-wider font-bold border-b-2 transition-all cursor-pointer ${
            subTab === "attendance_reports"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          📋 Attendance Reports Desk
        </button>
        <button
          onClick={() => setSubTab("audits")}
          className={`pb-3 px-4 text-xs uppercase tracking-wider font-bold border-b-2 transition-all cursor-pointer ${
            subTab === "audits"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          📊 Audit Spreadsheets
        </button>
        <button
          onClick={() => setSubTab("settings")}
          className={`pb-3 px-4 text-xs uppercase tracking-wider font-bold border-b-2 transition-all cursor-pointer ${
            subTab === "settings"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          ⚙️ Portal settings & sub-accounts
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg text-emerald-800 text-sm flex gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* RENDER ACTIVE TAB CORES */}

      {subTab === "attendance_reports" && (
        <div className="space-y-6">
          {/* Top Filter and Download control block */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                  <span>Historical Attendance Ledger</span>
                </h3>
                <p className="text-xs text-slate-450 mt-1">
                  Query student registers directly saved under your institute identifier.
                </p>
              </div>

              {/* Filters dropdown */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Select Batch</label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 text-xs font-bold min-w-[160px]"
                  >
                    <option value="">-- Choose Batch --</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.targetClass || "General"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 text-xs font-bold font-mono min-w-[150px] cursor-pointer"
                  />
                  {availableDates.length > 0 && (
                    <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-1 items-center">
                      <span>Available:</span>
                      {availableDates.slice(0, 3).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDate(d)}
                          className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold font-mono transition-colors cursor-pointer ${
                            selectedDate === d
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-5 flex gap-1.5 ml-2">
                  <button 
                    onClick={loadHistoricalAttendance}
                    disabled={fetchingDocs}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-850 transition-colors cursor-pointer"
                    title="Refresh from Firestore"
                  >
                    <RefreshCw className={`w-4 h-4 ${fetchingDocs ? "animate-spin" : ""}`} />
                  </button>
                  
                  {activeReportDoc && (
                    <button
                      onClick={handleDownloadCSVReport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <ArrowDownToLine className="w-4 h-4" /> Download Report
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance Session Statistics Banner */}
            {activeReportDoc && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-800">
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans">Total Enrolled</span>
                  <span className="text-lg font-black text-slate-850 font-mono">{activeReportDoc.records.length}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans">Present Count</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">
                    {activeReportDoc.records.filter((r) => r.status === "Present").length}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans">Absent Count</span>
                  <span className="text-lg font-black text-rose-600 font-mono">
                    {activeReportDoc.records.filter((r) => r.status === "Absent").length}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans">Leave Count</span>
                  <span className="text-lg font-black text-amber-600 font-mono">
                    {activeReportDoc.records.filter((r) => r.status === "Leave").length}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans">Present Rate</span>
                  <span className="text-lg font-black text-indigo-600 font-mono">
                    {activeReportDoc.records.length > 0 
                      ? `${Math.round((activeReportDoc.records.filter((r) => r.status === "Present").length / activeReportDoc.records.length) * 100)}%`
                      : "0%"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Table display */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
            {fetchingDocs ? (
              <div className="text-center py-20 space-y-4">
                <RefreshCw className="w-10 h-10 animate-spin text-emerald-600 mx-auto" />
                <p className="text-sm text-slate-500 font-bold font-display">Reaching Firestore servers, pulling registers logs...</p>
              </div>
            ) : fetchError ? (
              <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-xl text-rose-800 text-xs font-semibold">
                {fetchError}
              </div>
            ) : activeReportDoc ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h4 className="font-display font-bold text-sm text-slate-800 tracking-tight">
                    Attendance Marked Records ({activeReportDoc.records.length} students)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                    Doc ID: {activeReportDoc.id}
                  </span>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-5">Student ID</th>
                        <th className="py-3 px-5">Student Name</th>
                        <th className="py-3 px-5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {activeReportDoc?.records?.map((r) => (
                        <tr key={r.studentId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-5 font-mono text-slate-450">{r.studentId}</td>
                          <td className="py-3 px-5 font-extrabold text-slate-800">{r.studentName}</td>
                          <td className="py-3 px-5 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              r.status === "Present"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : r.status === "Leave"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-rose-50 text-rose-700 border border-rose-100"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-4 flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-350 rounded-full flex items-center justify-center text-3xl shadow-inner border border-slate-100">
                  📬
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 text-sm">No historical attendance records matches selection</h4>
                  <p className="text-xs text-slate-450 max-w-md mx-auto mt-1 leading-relaxed">
                    {attendanceDocs.length === 0 
                      ? "No records found in the 'attendance' collection yet. If you haven't taken registers, you can quickly seed a simulated session to Firestore using the action below." 
                      : "Please select an available Batch and Date combination from the dropdown filters above to load marked student rosters."}
                  </p>
                </div>

                {attendanceDocs.length === 0 && (
                  <button
                    onClick={handleCreateSampleReport}
                    disabled={seeding}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {seeding ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Seeding Firestore...
                      </>
                    ) : (
                      "🧪 Generate Sample Report to Firestore"
                    )}
                  </button>
                )}

                {attendanceDocs.length > 0 && (
                  <div className="w-full max-w-md pt-4 text-left">
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 text-center">Available Sessions in DB:</span>
                    <div className="flex flex-wrap gap-2 justify-center max-h-[140px] overflow-y-auto p-1.5 border border-slate-100 rounded-2xl bg-slate-50/50">
                      {attendanceDocs.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => {
                            setSelectedBatchId(doc.batchId);
                            setSelectedDate(doc.date);
                          }}
                          className="bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-250 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                        >
                          📅 {doc.date} | {doc.batchName || doc.batchId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "audits" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-2 border-b">
            <h3 className="font-display font-medium text-base text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Administrative spreadsheets downloads
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Generate fully compiled CSV metrics reports instantly. Clean columns compatible with Microsoft Excel, Google Sheets, or Apple Numbers.
          </p>

          <div className="space-y-4 pt-2">
            
            {/* Daily Mark List */}
            <div className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold text-lg">
                  📝
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Daily Attendance Audit Log</h4>
                  <p className="text-xs text-slate-400">Date-wise student registers, parent contact status, present ratios.</p>
                </div>
              </div>
              <button 
                onClick={() => handleDownloadCSV("attendance")}
                className="bg-white hover:bg-slate-50 border p-2 rounded-xl text-slate-650 hover:text-emerald-700 transition-all cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowDownToLine className="w-4 h-4" /> CSV
              </button>
            </div>

            {/* Billings Log */}
            <div className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center font-bold text-lg">
                  💰
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Term Dues & Payment Status Roster</h4>
                  <p className="text-xs text-slate-400">Installment bills split records, historical cash deposits, outstanding receipts totals.</p>
                </div>
              </div>
              <button 
                onClick={() => handleDownloadCSV("fees")}
                className="bg-white hover:bg-slate-50 border p-2 rounded-xl text-slate-650 hover:text-emerald-700 transition-all cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowDownToLine className="w-4 h-4" /> CSV
              </button>
            </div>

            {/* Overall Roster Log */}
            <div className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center font-bold text-lg">
                  📋
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">General Institute Revenue Ledger</h4>
                  <p className="text-xs text-slate-400">Gross metrics totals, total defined active schedules, active registration ratios.</p>
                </div>
              </div>
              <button 
                onClick={() => handleDownloadCSV("general")}
                className="bg-white hover:bg-slate-50 border p-2 rounded-xl text-slate-650 hover:text-emerald-700 transition-all cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowDownToLine className="w-4 h-4" /> CSV
              </button>
            </div>

          </div>
        </div>

        {/* End of Academic Season Reset & Archival Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-2 border-b">
            <h3 className="font-display font-medium text-base text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" /> Master Session Reset
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            जब भी नया अकैडमिक सत्र (New Academic Year) शुरू करना हो, तो आप सभी विद्यार्थियों का डेटा क्लास-वाइज़ एक्सेल में बैकअप लेकर एक साथ डिलीट कर सकते हैं। 
            <span className="font-semibold text-rose-650 block mt-1">⚠️ सुरक्षा कारणों से, बिना क्लास-वाइज़ एक्सेल बैकअप डाउनलोड किए डिलीट फ़ंक्शन अनलॉक नहीं होगा।</span>
          </p>

          {resetSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {resetSuccessMsg}
            </div>
          )}

          {!isUnlocked ? (
            /* Unlock Form */
            <form onSubmit={handleUnlockSystem} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Lock className="w-3.5 h-3.5 text-slate-500" /> Owner Authentication Required
              </div>
              
              {authError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl font-medium border border-rose-100">{authError}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Owner Email Address</label>
                  <input 
                    type="email" 
                    required 
                    value={ownerEmail} 
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="e.g. owner@example.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password" 
                    required 
                    value={ownerPassword} 
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" /> Verify Owner & Unlock Reset Desk
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Unlocked Actions */
            <div className="p-5 bg-emerald-50/25 border border-emerald-100 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Owner Session Unlocked
                </span>
                <button 
                  onClick={() => setIsUnlocked(false)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer text-slate-600"
                >
                  Lock Desk
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Step 1: Export */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-700 tracking-wide uppercase">Step 1: Download Backup</div>
                    <h5 className="text-xs font-bold text-slate-800 mt-1">Export Complete Student Data</h5>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Saves all students grouped and ordered class-wise in an Excel/CSV spreadsheet roster before clearing.
                    </p>
                  </div>
                  <button
                    onClick={handleExportSortedClassWiseExcel}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Class-wise Excel
                  </button>
                </div>

                {/* Step 2: Clear */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] font-bold text-rose-700 tracking-wide uppercase">Step 2: Database Reset</div>
                    <h5 className="text-xs font-bold text-slate-800 mt-1">Permanently Delete All Students</h5>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Wipes students registers, installment records, and attendance logs. 
                    </p>
                  </div>
                  
                  {!isExcelExported ? (
                    <div className="p-2 bg-slate-50 border border-slate-150 rounded-lg text-[10px] font-medium text-slate-500 text-center flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" /> Unlocks after Excel download is completed
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Reset Season (Unlock Done)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

      {subTab === "settings" && (
        <div className="space-y-8">
          {/* Configuration Parameters Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-display font-medium text-base text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" /> Institute general settings
              </h3>
            </div>

            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Logo/emoji</label>
                  <input 
                    type="text" 
                    required
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Institute Name</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Street Address</label>
                <div className="relative">
                  <MapPin className="w-4.5 h-4.5 text-slate-450 absolute left-3 top-3 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Official Contact Number</label>
                <div className="relative">
                  <PhoneCall className="w-4.5 h-4.5 text-slate-450 absolute left-3 top-3 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-normal italic">
                *Modifying configurations overwrites generated ID cards, parent notice alerts, and receipt PDFs automatically to match updated institute branding.
              </p>

              <div className="pt-4 border-t border-slate-50">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" /> Update Configurations
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Teacher sub-account generator section */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <h3 className="font-display font-medium text-base text-slate-855 flex items-center gap-2">
                  👤 Teacher Portal Sub-Accounts Management
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Generate secure standalone credentials for teachers so they can manage attendance, update batch agendas, and stream dynamic lists via App 3.
                </p>
              </div>
            </div>

            {/* Create Teacher + List segment */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Create Form Column */}
              <div className="lg:col-span-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  🗝️ Register Credentials
                </h4>

                {tSuccess && (
                  <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg text-emerald-800 text-xs font-semibold leading-relaxed">
                    {tSuccess}
                  </div>
                )}

                {tError && (
                  <div className="p-3 bg-rose-50 border-l-4 border-rose-500 rounded-lg text-rose-800 text-xs font-semibold leading-relaxed">
                    {tError}
                  </div>
                )}

                <form onSubmit={handleCreateTeacherSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5">Teacher Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Professor Sarah"
                      value={tName}
                      onChange={(e) => setTName(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5">Email Address</label>
                    <input 
                      type="email" 
                      required
                      placeholder="e.g. sarah@classsetu.com"
                      value={tEmail}
                      onChange={(e) => setTEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5">Portal Password</label>
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={tPassword}
                      onChange={(e) => setTPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      *Minimum 6 characters. Sub-account log-in credentials can be used in App 3.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={tLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {tLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Provisioning Auth...
                      </>
                    ) : (
                      <>
                         Create Teacher Sub-Account
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Teacher Directory Column */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    📁 Registered Teacher Accounts Directory ({teachers.length})
                  </h4>
                </div>

                {teachers.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-3xl mb-2">👤</span>
                    <p className="text-xs font-bold text-slate-450">No sub-accounts registered yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Use the left container form to generate secure credentials.</p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-h-[360px] overflow-y-auto">
                    <table className="w-full text-left border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-3 text-center">Role</th>
                          <th className="py-3 px-3 font-mono text-center">Registered On</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {teachers.map((teacher) => (
                          <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-800">{teacher.name}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">{teacher.email}</td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                                {teacher.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-400 font-mono text-center">
                              {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTeacher(teacher);
                                  setNewTeacherPassword("");
                                  setPasswordSuccess("");
                                  setPasswordError("");
                                }}
                                className="bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 font-bold px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Edit Password
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Edit Profile / Change Password Modal */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-100 shadow-2xl relative animate-fade-in space-y-6">
            <div className="flex justify-between items-center pb-4 border-b">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-800">
                  Edit Profile & Password
                </h3>
                <p className="text-xs text-slate-450 font-mono mt-0.5">
                  UID: {selectedTeacher.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeacher(null)}
                className="text-slate-450 hover:text-slate-700 font-bold p-1 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Read-only Teacher details summary header card */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-450 uppercase text-[10px]">Teacher Name:</span>
                <span className="font-bold text-slate-800">{selectedTeacher.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-450 uppercase text-[10px]">Email Address:</span>
                <span className="font-medium text-slate-600 font-mono">{selectedTeacher.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-450 uppercase text-[10px]">Role Security:</span>
                <span className="bg-emerald-100 border border-emerald-250 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[9px]">
                  {selectedTeacher.role}
                </span>
              </div>
            </div>

            {/* Editable credential properties */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                  Change Password
                </label>
                <input
                  type="text"
                  placeholder="Enter new portal password (min 6 chars)"
                  value={newTeacherPassword}
                  onChange={(e) => setNewTeacherPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-450 leading-relaxed mt-1.5 italic">
                  *Provide a reliable portal key. Teacher accounts can sign in immediately on App 3 with their existing registered email.
                </p>
              </div>

              {passwordSuccess && (
                <div id="password-success-msg" className="p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded-xl text-emerald-850 text-xs font-semibold leading-relaxed animate-fade-in">
                  {passwordSuccess}
                </div>
              )}

              {passwordError && (
                <div id="password-error-msg" className="p-3 bg-rose-50 border-l-4 border-rose-600 rounded-xl text-rose-850 text-xs font-semibold leading-relaxed animate-fade-in">
                  {passwordError}
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTeacher(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-150 text-slate-700 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all text-center cursor-pointer border border-slate-150"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={passwordLoading}
                  onClick={async () => {
                    if (isSubscribed === false) {
                      onSubscriptionBlocked?.();
                      setSelectedTeacher(null);
                      return;
                    }
                    const selectedTeacherDocId = selectedTeacher.id;
                    if (!newTeacherPassword || newTeacherPassword.trim().length < 6) {
                      setPasswordError("Password must be at least 6 characters long.");
                      return;
                    }
                    setPasswordLoading(true);
                    setPasswordError("");
                    setPasswordSuccess("");
                    try {
                      const teacherDocRef = doc(db, "teachers", selectedTeacherDocId);
                      await updateDoc(teacherDocRef, {
                        password: newTeacherPassword,
                        updatedAt: serverTimestamp()
                      });
                      
                      setPasswordSuccess("Teacher authentication credentials updated successfully!");
                      setNewTeacherPassword("");
                    } catch (err: any) {
                      console.error("Direct Firestore updates failed: ", err);
                      setPasswordError(err.message || "Emergency credential sync encountered an error.");
                    } finally {
                      setPasswordLoading(false);
                    }
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all text-center cursor-pointer flex justify-center items-center gap-1.5 disabled:opacity-55"
                >
                  {passwordLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save/Update Password"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-650">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="font-display font-bold text-lg text-slate-800">Dangerous Operation!</h3>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                You are about to archive <strong>{students.filter(s => s.status !== "ARCHIVED").length} active students</strong>. 
                This will clear them from your current active rosters and dashboard, but their records are preserved globally.
              </p>
              <p className="font-semibold text-rose-700">
                You must have a downloaded Excel backup of this data before proceeding.
              </p>
              
              <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isBackupVerified}
                  onChange={(e) => setIsBackupVerified(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-[11px] font-medium text-slate-600">
                  I confirm that I have successfully downloaded the class-wise Master Excel Backup.
                </span>
              </label>

              <p className="pt-2">
                Type <span className="font-bold text-slate-850 font-mono bg-slate-100 px-1.5 py-0.5 rounded">DELETE ALL</span> in the box below to proceed:
              </p>
            </div>

            {deleteError && (
              <p className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-150 font-medium">{deleteError}</p>
            )}

            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="Type DELETE ALL here..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none font-mono text-center tracking-widest uppercase font-bold"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmationText("");
                  setIsBackupVerified(false);
                  setDeleteError("");
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentlyResetSystem}
                disabled={isDeleting || !isBackupVerified || deleteConfirmationText !== "DELETE ALL"}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Confirm Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
