import React, { useState, useMemo } from "react";
import { 
  Users, 
  Bell, 
  CheckCheck,
  Search,
  MessageCircle,
  AlertTriangle,
  Calendar,
  Send,
  ExternalLink,
  Edit3,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  UserX
} from "lucide-react";
import { Student, Batch, AttendanceRecord, Notice, NotificationLog, InstituteSettings } from "../types";
import { authFetch } from "../utils";

interface WhatsAppCenterViewProps {
  students: Student[];
  batches?: Batch[];
  attendance?: AttendanceRecord[];
  notices?: Notice[];
  logs?: NotificationLog[];
  settings?: InstituteSettings;
  onMarkAttendance?: (date: string, records: { [studentId: string]: "Present" | "Absent" }) => Promise<any>;
  onSendAbsentWhatsApp?: (studentId: string, customMessage?: string) => Promise<any>;
  onSendAllAbsentWhatsApp?: (date: string, batchId?: string, customMessage?: string) => Promise<any>;
  isSubscribed?: boolean;
  onSubscriptionBlocked?: () => void;
  instituteData?: {
    billingModel?: string;
    isWhatsAppEnabled?: boolean;
    isSmsEnabled?: boolean;
    whatsappLimit?: number;
    whatsappSent?: number;
    whatsappLeft?: number;
  } | null;
}

export default function WhatsAppCenterView({
  students = [],
  batches = [],
  attendance = [],
  logs = [],
  settings,
  onMarkAttendance,
  onSendAbsentWhatsApp,
  onSendAllAbsentWhatsApp,
  isSubscribed = true,
  onSubscriptionBlocked,
  instituteData
}: WhatsAppCenterViewProps) {
  // Today's Date formatted YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  
  // Selected Date & Batch filter
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Template editor state
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [templateText, setTemplateText] = useState(
    "Respected Parent, your child {student_name} was marked ABSENT today ({date}) for {batch_name} at {institute_name}. Kindly let us know the reason for absence."
  );

  // Quick Attendance Marker state
  const [isQuickMarkerOpen, setIsQuickMarkerOpen] = useState(false);
  const [markingRecords, setMarkingRecords] = useState<{ [studentId: string]: "Present" | "Absent" }>({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Action status feedbacks
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [sendingStudentId, setSendingStudentId] = useState<string | null>(null);

  // Filter students by selected batch
  const eligibleStudents = useMemo(() => {
    let list = students.filter(s => s.status === "active" || s.status === "ACTIVE" || !s.status);
    if (selectedBatchId) {
      list = list.filter(s => s.batchId === selectedBatchId);
    }
    return list;
  }, [students, selectedBatchId]);

  // Attendance records for the selected date
  const recordsForDate = useMemo(() => {
    return attendance.filter(a => a.date === selectedDate);
  }, [attendance, selectedDate]);

  // Students marked ABSENT on this date
  const absentStudents = useMemo(() => {
    return eligibleStudents.filter(student => {
      const rec = recordsForDate.find(r => r.studentId === student.id);
      return rec && rec.status === "Absent";
    });
  }, [eligibleStudents, recordsForDate]);

  // Students marked PRESENT on this date
  const presentStudents = useMemo(() => {
    return eligibleStudents.filter(student => {
      const rec = recordsForDate.find(r => r.studentId === student.id);
      return rec && rec.status === "Present";
    });
  }, [eligibleStudents, recordsForDate]);

  // Unmarked students
  const unmarkedStudents = useMemo(() => {
    return eligibleStudents.filter(student => {
      const rec = recordsForDate.find(r => r.studentId === student.id);
      return !rec;
    });
  }, [eligibleStudents, recordsForDate]);

  // Filter absent students with search
  const filteredAbsentStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return absentStudents;
    return absentStudents.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.parentName && s.parentName.toLowerCase().includes(q)) ||
      (s.parentMobile && s.parentMobile.includes(q))
    );
  }, [absentStudents, searchQuery]);

  // Get absent logs for this date / student
  const absentLogs = useMemo(() => {
    return logs.filter(l => l.type === "absent_alert").sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }, [logs]);

  // Format absent alert message for a specific student
  const formatAbsentMessage = (student: Student) => {
    const batch = batches.find(b => b.id === student.batchId);
    const instName = settings?.name || "Our Coaching Institute";
    return templateText
      .replace(/{student_name}/g, student.name)
      .replace(/{parent_name}/g, student.parentName || student.name)
      .replace(/{batch_name}/g, batch?.name || "General Batch")
      .replace(/{date}/g, selectedDate)
      .replace(/{institute_name}/g, instName);
  };

  // Generate direct wa.me link for a student
  const getWhatsAppLink = (student: Student) => {
    const rawNumber = student.parentMobile || student.alternateMobile || "";
    const cleanNumber = rawNumber.replace(/[^0-9]/g, "");
    const formattedNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
    const msg = formatAbsentMessage(student);
    return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(msg)}`;
  };

  // Check if a WhatsApp alert has been recorded as sent for this student today
  const isAlertSentForStudent = (studentId: string) => {
    return absentLogs.some(
      l => l.studentId === studentId && l.sentAt.startsWith(selectedDate)
    );
  };

  // Handle single WhatsApp send via API
  const handleSendSingleApi = async (student: Student) => {
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      return;
    }
    const mobile = student.parentMobile || student.alternateMobile;
    if (!mobile) {
      setActionError(`No parent mobile number found for student ${student.name}. Please update in Students Database.`);
      setTimeout(() => setActionError(""), 5000);
      return;
    }

    setSendingStudentId(student.id);
    setActionError("");
    setActionSuccess("");

    try {
      const msg = formatAbsentMessage(student);
      if (onSendAbsentWhatsApp) {
        const res = await onSendAbsentWhatsApp(student.id, msg);
        if (res && res.success === false) {
          setActionError(`Failed to send WhatsApp to ${student.name}: ${res.error}`);
        } else {
          setActionSuccess(`WhatsApp Absent Alert successfully sent to ${student.parentName} (${mobile})!`);
        }
      } else {
        // Fallback direct POST
        const res = await authFetch("/api/absent/send-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: student.id,
            studentName: student.name,
            parentName: student.parentName || student.name,
            parentMobile: mobile,
            date: selectedDate,
            customMessage: msg,
            instituteName: settings?.name || "Alpha Coaching"
          })
        }).then(r => r.json());

        if (res.success) {
          setActionSuccess(`WhatsApp Absent Alert successfully sent to ${student.parentName} (${mobile})!`);
        } else {
          setActionError(`Notice: ${res.error || "Failed to trigger WhatsApp alert"}`);
        }
      }
    } catch (err: any) {
      setActionError(`Error sending WhatsApp alert: ${err.message}`);
    } finally {
      setSendingStudentId(null);
      setTimeout(() => {
        setActionSuccess("");
        setActionError("");
      }, 5000);
    }
  };

  // Handle bulk WhatsApp send to all absent students
  const handleSendBulkApi = async () => {
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      return;
    }
    if (absentStudents.length === 0) {
      setActionError("No absent students found to send WhatsApp alerts.");
      setTimeout(() => setActionError(""), 4000);
      return;
    }

    setIsSendingBulk(true);
    setActionError("");
    setActionSuccess("");

    try {
      if (onSendAllAbsentWhatsApp) {
        const res = await onSendAllAbsentWhatsApp(selectedDate, selectedBatchId || undefined, templateText);
        if (res && res.success === false) {
          setActionError(`Bulk dispatch error: ${res.error}`);
        } else {
          setActionSuccess(`WhatsApp absent alerts dispatched to ${absentStudents.length} absent students' parents!`);
        }
      } else {
        const payload = absentStudents.map(s => {
          const batch = batches.find(b => b.id === s.batchId);
          return {
            studentId: s.id,
            studentName: s.name,
            parentName: s.parentName || s.name,
            parentMobile: s.parentMobile,
            date: selectedDate,
            batchName: batch?.name || "General",
            customMessage: formatAbsentMessage(s)
          };
        });

        const res = await authFetch("/api/absent/bulk-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: payload,
            instituteName: settings?.name || "Alpha Coaching"
          })
        }).then(r => r.json());

        if (res.success) {
          setActionSuccess(`WhatsApp absent alerts dispatched to ${res.count || absentStudents.length} parents!`);
        } else {
          setActionError(`Bulk notice: ${res.error}`);
        }
      }
    } catch (err: any) {
      setActionError(`Failed to dispatch bulk WhatsApp alerts: ${err.message}`);
    } finally {
      setIsSendingBulk(false);
      setTimeout(() => {
        setActionSuccess("");
        setActionError("");
      }, 6000);
    }
  };

  // Open inline attendance quick marker
  const handleOpenQuickMarker = () => {
    const initRecords: { [studentId: string]: "Present" | "Absent" } = {};
    eligibleStudents.forEach(s => {
      const existing = recordsForDate.find(r => r.studentId === s.id);
      initRecords[s.id] = existing ? existing.status as ("Present" | "Absent") : "Present";
    });
    setMarkingRecords(initRecords);
    setIsQuickMarkerOpen(true);
  };

  // Save inline attendance
  const handleSaveInlineAttendance = async () => {
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      return;
    }
    if (!onMarkAttendance) return;
    setIsSavingAttendance(true);
    try {
      await onMarkAttendance(selectedDate, markingRecords);
      setIsQuickMarkerOpen(false);
      setActionSuccess(`Attendance saved for ${selectedDate}! Absent students updated.`);
      setTimeout(() => setActionSuccess(""), 5000);
    } catch (err: any) {
      setActionError(`Failed to save attendance: ${err.message}`);
    } finally {
      setIsSavingAttendance(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Policy restriction badge banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-display font-extrabold text-sm text-emerald-950 flex items-center gap-1.5">
              <span>Absentee WhatsApp Notification Desk</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Absent Students Only
              </span>
            </h4>
            <p className="text-xs text-emerald-800 font-medium mt-0.5">
              WhatsApp communication is strictly restricted to notify parents when their child is absent. No spam broadcasts.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsTemplateEditorOpen(!isTemplateEditorOpen)}
          className="px-3.5 py-1.5 bg-white hover:bg-emerald-100/50 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
          {isTemplateEditorOpen ? "Hide Message Template" : "Customize Message"}
        </button>
      </div>

      {/* Alert Banners */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
          <CheckCheck className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-500 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Template Editor Drawer (if opened) */}
      {isTemplateEditorOpen && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Customize Absent WhatsApp Template
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Real-time Dynamic Variables</span>
          </div>
          <div>
            <textarea
              rows={3}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Draft your absentee alert message..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="font-bold text-slate-400 uppercase tracking-wider">Available Tags:</span>
            {["{student_name}", "{parent_name}", "{batch_name}", "{date}", "{institute_name}"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTemplateText(prev => prev + " " + tag)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-mono font-bold rounded-md border border-slate-200 cursor-pointer transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary Top Bar: Date, Batch Filter, and Quick Attendance Action */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Attendance Date
            </label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedDate === todayStr 
                    ? "bg-emerald-600 text-white shadow-xs" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Today
              </button>
            </div>
          </div>

          {/* Batch Filter Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Filter Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[160px] cursor-pointer"
            >
              <option value="">All Batches ({batches.length})</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.targetClass || "General"})
                </option>
              ))}
            </select>
          </div>

          {/* Student Search */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Search Absentee
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
              <input
                type="text"
                placeholder="Student, ID, or Parent Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-[180px] sm:w-[220px]"
              />
            </div>
          </div>
        </div>

        {/* Right: Primary Bulk WhatsApp Action */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          <button
            onClick={handleOpenQuickMarker}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Mark / Update Register
          </button>

          <button
            onClick={handleSendBulkApi}
            disabled={isSendingBulk || absentStudents.length === 0}
            className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              absentStudents.length > 0 && !isSendingBulk
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isSendingBulk ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Sending WhatsApp Alerts...
              </>
            ) : (
              <>
                <MessageCircle className="w-3.5 h-3.5" />
                Send WhatsApp to All Absent ({absentStudents.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Attendance & Absentee Metrics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Students</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xl font-black text-slate-800 font-mono">{eligibleStudents.length}</span>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Active enrollments</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Present Today</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xl font-black text-emerald-600 font-mono">{presentStudents.length}</span>
            <UserCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-[10px] text-emerald-700 font-medium mt-1 block">
            {eligibleStudents.length > 0 
              ? `${Math.round((presentStudents.length / eligibleStudents.length) * 100)}% attendance`
              : "No records"}
          </span>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-xs">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Absent Students</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xl font-black text-rose-600 font-mono">{absentStudents.length}</span>
            <UserX className="w-5 h-5 text-rose-500" />
          </div>
          <span className="text-[10px] text-rose-700 font-bold mt-1 block">Requires WhatsApp alert</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">WhatsApp Dispatched</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {absentStudents.filter(s => isAlertSentForStudent(s.id)).length}
            </span>
            <MessageCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Alerts delivered to parents</span>
        </div>
      </div>

      {/* Main Grid: Left = Absent Students Action List, Right = Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Panel: Absent Students Table (col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-display font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <UserX className="w-4 h-4 text-rose-500" />
                  Absent Students for {selectedDate}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedBatchId ? `Filtered for ${batches.find(b => b.id === selectedBatchId)?.name}` : "Showing all coaching batches"}
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                {filteredAbsentStudents.length} Absent
              </span>
            </div>

            {/* List / Empty States */}
            {filteredAbsentStudents.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                  {recordsForDate.length > 0 ? "🎉" : "📋"}
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-800 text-base">
                    {recordsForDate.length > 0 
                      ? "Zero Absentees! 100% Attendance Recorded" 
                      : `No Attendance Recorded for ${selectedDate}`}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    {recordsForDate.length > 0
                      ? "All marked students are present for this session. No absence WhatsApp alerts needed."
                      : "Mark student attendance first using the Quick Marker button to identify absent students and notify their parents."}
                  </p>
                </div>

                {recordsForDate.length === 0 && (
                  <button
                    onClick={handleOpenQuickMarker}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Mark Attendance for {selectedDate}
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredAbsentStudents.map((student) => {
                  const batch = batches.find(b => b.id === student.batchId);
                  const isSent = isAlertSentForStudent(student.id);
                  const waLink = getWhatsAppLink(student);
                  const mobile = student.parentMobile || student.alternateMobile;
                  const isSendingThis = sendingStudentId === student.id;

                  return (
                    <div 
                      key={student.id} 
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Student Info */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 font-extrabold flex items-center justify-center shrink-0 text-sm">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-extrabold text-sm text-slate-800">
                              {student.name}
                            </h4>
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {student.id}
                            </span>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              Absent
                            </span>
                          </div>
                          
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Parent: <strong className="text-slate-700">{student.parentName || "Parent"}</strong></span>
                            <span>•</span>
                            <span className="font-mono font-semibold text-emerald-700">📱 {mobile || "No Mobile"}</span>
                            <span>•</span>
                            <span className="text-slate-500 font-medium">Batch: {batch?.name || "Unassigned"}</span>
                          </div>

                          {/* Sent status badge */}
                          <div className="mt-1.5">
                            {isSent ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                WhatsApp Alert Dispatched
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-500" />
                                Alert Ready to Send
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons for this Absent Student */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* 1-Click WhatsApp Parent Link */}
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                          title="Open WhatsApp chat with prefilled absence notice"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Chat on WhatsApp
                          <ExternalLink className="w-3 h-3 opacity-80" />
                        </a>

                        {/* Send via API */}
                        <button
                          onClick={() => handleSendSingleApi(student)}
                          disabled={isSendingThis || !mobile}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSent 
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200" 
                              : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                          } ${!mobile ? "opacity-50 cursor-not-allowed" : ""}`}
                          title="Trigger automated WhatsApp template message"
                        >
                          {isSendingThis ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          {isSent ? "Resend API" : "Send API"}
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* Real-time Smartphone Preview Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/30 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-1 text-center sm:text-left">
              <h4 className="font-display font-extrabold text-sm text-slate-100">
                Live Absence WhatsApp Preview
              </h4>
              <p className="text-xs text-slate-400 font-sans italic bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 leading-relaxed">
                "{formatAbsentMessage(filteredAbsentStudents[0] || eligibleStudents[0] || { name: "Rahul Kumar", parentName: "Sunil Kumar", id: "STU-101", batchId: null } as any)}"
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel: Absence WhatsApp Trace Logs (col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-display font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-emerald-600" />
                Absent WhatsApp Logs
              </h4>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                {absentLogs.length} total
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Automated delivery ledger recording every absence notification dispatched to parent mobile terminals:
            </p>

            <div className="space-y-3 max-h-[38rem] overflow-y-auto">
              {absentLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic">
                  No absent student WhatsApp messages logged yet.
                </div>
              ) : (
                absentLogs.map((log) => {
                  const student = students.find(s => s.id === log.studentId);
                  return (
                    <div 
                      key={log.id} 
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-slate-800 text-xs"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                          Absence Alert
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">
                          {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                        {log.text}
                      </p>

                      <div className="pt-1.5 border-t border-slate-200/50 flex justify-between items-center text-[10px]">
                        <span className="font-mono text-slate-400">
                          To: {log.recipientMobile}
                        </span>
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {log.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Quick Attendance Marker Modal */}
      {isQuickMarkerOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsQuickMarkerOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-display font-extrabold text-base text-slate-800">
                  Mark Attendance for {selectedDate}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select students to mark as Present or Absent. Absent students will immediately have WhatsApp actions available.
                </p>
              </div>
              <button
                onClick={() => setIsQuickMarkerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Bulk Toggle */}
            <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">
                {eligibleStudents.length} Students in Register
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allPresent: { [id: string]: "Present" | "Absent" } = {};
                    eligibleStudents.forEach(s => allPresent[s.id] = "Present");
                    setMarkingRecords(allPresent);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-slate-200 text-[11px] cursor-pointer"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allAbsent: { [id: string]: "Present" | "Absent" } = {};
                    eligibleStudents.forEach(s => allAbsent[s.id] = "Absent");
                    setMarkingRecords(allAbsent);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 font-bold rounded-lg border border-slate-200 text-[11px] cursor-pointer"
                >
                  Mark All Absent
                </button>
              </div>
            </div>

            {/* Students List */}
            <div className="p-5 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-100">
              {eligibleStudents.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-xs italic">
                  No enrolled active students found for this batch.
                </p>
              ) : (
                eligibleStudents.map((s) => {
                  const status = markingRecords[s.id] || "Present";
                  const isAbsent = status === "Absent";

                  return (
                    <div 
                      key={s.id} 
                      className="pt-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-extrabold text-slate-800">{s.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">({s.id})</span>
                        <p className="text-[10px] text-slate-400">Parent: {s.parentName} ({s.parentMobile || "No mobile"})</p>
                      </div>

                      <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setMarkingRecords(prev => ({ ...prev, [s.id]: "Present" }))}
                          className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                            !isAbsent 
                              ? "bg-emerald-600 text-white shadow-xs" 
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarkingRecords(prev => ({ ...prev, [s.id]: "Absent" }))}
                          className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                            isAbsent 
                              ? "bg-rose-600 text-white shadow-xs" 
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setIsQuickMarkerOpen(false)}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInlineAttendance}
                disabled={isSavingAttendance || eligibleStudents.length === 0}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isSavingAttendance ? "Saving Register..." : "Save & View Absent WhatsApp"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
