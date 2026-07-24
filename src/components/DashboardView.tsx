import React from "react";
import { 
  Users, 
  Layers, 
  CalendarCheck, 
  CircleDollarSign, 
  ChevronRight, 
  CheckCircle2, 
  UserPlus,
  MessageSquare,
  Send,
  AlertTriangle
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip
} from "recharts";
import { Student, Batch, FeeInstallment, AttendanceRecord, TransferRequest } from "../types";

interface DashboardViewProps {
  students: Student[];
  batches: Batch[];
  installments: FeeInstallment[];
  attendance: AttendanceRecord[];
  onNavigate: (tab: string, action?: string) => void;
  instituteData?: {
    isWhatsAppEnabled?: boolean;
    isSmsEnabled?: boolean;
    whatsappLimit?: number;
    whatsappSent?: number;
    whatsappLeft?: number;
    smsLimit?: number;
    smsSent?: number;
    smsLeft?: number;
  } | null;
  transferRequests?: TransferRequest[];
  onApproveRequest?: (request: TransferRequest) => void;
  onRejectRequest?: (request: TransferRequest) => void;
}

export default function DashboardView({ 
  students = [],
  batches = [],
  installments = [],
  attendance = [],
  onNavigate,
  instituteData,
  transferRequests = [],
  onApproveRequest,
  onRejectRequest
}: DashboardViewProps) {
  
  const activeStudents = students.filter(s => s.status === "active").length;
  const totalBatches = batches.length;

  // Calculate outstanding fees and revenue
  const totalCollected = installments.reduce((sum, inst) => sum + inst.paidAmount, 0);
  const totalPending = installments.reduce((sum, inst) => {
    if (inst.status !== "Paid") {
      return sum + (inst.amount - inst.paidAmount);
    }
    return sum;
  }, 0);

  // Present ratio today or last recorded date
  const latestDate = attendance.length > 0 
    ? [...new Set(attendance.map(a => a.date))].sort((a, b) => b.localeCompare(a))[0]
    : null;

  const todayAttendanceRecords = latestDate 
    ? attendance.filter(a => a.date === latestDate)
    : [];

  const presentCount = todayAttendanceRecords.filter(r => r.status === "Present").length;
  const attendanceRatio = todayAttendanceRecords.length > 0
    ? Math.round((presentCount / todayAttendanceRecords.length) * 100)
    : 100;

  // Chart Data: Fees Collection Trends (Realtime collected by payment month, outstanding by due month)
  const monthlyData: { [key: string]: { name: string; sortKey: string; Collected: number; Pending: number } } = {};

  const getYearMonthKey = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length < 2) return null;
    return `${parts[0]}-${parts[1]}`;
  };

  const getClosestCoreKey = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length < 2) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    
    let academicStartYear = year;
    if (month < 4) {
      academicStartYear = year - 1;
    }
    
    if (month >= 4 && month <= 7) {
      return `${academicStartYear}-05`;
    } else if (month >= 8 && month <= 10) {
      return `${academicStartYear}-08`;
    } else if (month >= 11 && month <= 12) {
      return `${academicStartYear}-11`;
    } else { // 1, 2, 3 (Jan, Feb, Mar)
      return `${academicStartYear + 1}-01`;
    }
  };

  const isCoreMonthKey = (key: string) => {
    if (!key) return false;
    const parts = key.split("-");
    if (parts.length < 2) return false;
    const month = parts[1];
    return ["05", "08", "11", "01"].includes(month);
  };

  const ensureMonthExists = (key: string) => {
    if (!monthlyData[key]) {
      const parts = key.split("-");
      const year = parts[0];
      const month = parts[1];
      const monthIndex = parseInt(month, 10) - 1;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthLabel = monthNames[monthIndex] || month;
      const yearShort = year.substring(2);
      
      monthlyData[key] = {
        name: `${monthLabel} '${yearShort}`,
        sortKey: key,
        Collected: 0,
        Pending: 0
      };
    }
  };

  installments.forEach(inst => {
    // 1. Process Collected Amount (realtime payment month base)
    if (inst.paidAmount > 0) {
      const paymentDate = inst.paymentDate || inst.dueDate;
      const paidKey = getYearMonthKey(paymentDate);
      if (paidKey) {
        ensureMonthExists(paidKey);
        monthlyData[paidKey].Collected += inst.paidAmount || 0;
      }
    }
    
    // 2. Process Pending/Outstanding Amount (due month base)
    if (inst.status !== "Paid") {
      const pendingAmount = (inst.amount || 0) - (inst.paidAmount || 0);
      if (pendingAmount > 0) {
        const dueKey = getYearMonthKey(inst.dueDate);
        if (dueKey) {
          // Map dueKey to closest core month key for pending calculation
          const coreDueKey = getClosestCoreKey(inst.dueDate) || dueKey;
          ensureMonthExists(coreDueKey);
          monthlyData[coreDueKey].Pending += pendingAmount;
        }
      }
    }
  });

  // Ensure the 4 core academic milestone months are always present in the chart to align with the new custom collection schedule
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  let academicStartYear = today.getFullYear();
  if (currentMonth < 4) { // Jan, Feb, Mar are part of the academic cycle starting in the previous year
    academicStartYear = today.getFullYear() - 1;
  }

  const coreMilestones = [
    `${academicStartYear}-05`,
    `${academicStartYear}-08`,
    `${academicStartYear}-11`,
    `${academicStartYear + 1}-01`
  ];

  coreMilestones.forEach(key => {
    ensureMonthExists(key);
  });

  const collectionTrendData = Object.values(monthlyData)
    .filter(item => {
      // Keep core milestones
      if (isCoreMonthKey(item.sortKey)) return true;
      // Keep extra months only if Collected > 0
      return item.Collected > 0;
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // Chart Data: Batch Capacity Load
  const batchLoadData = batches.map(b => {
    const assignedCount = students.filter(s => s.batchId === b.id && s.status === "active").length;
    return {
      name: b.name.split(" ")[0],
      Students: assignedCount,
      Limit: b.capacity
    };
  });

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Intro Greetings Banner */}
      <div className="bg-emerald-gradient rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
        <div>
          <span className="bg-emerald-500/30 text-emerald-100 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
            Active Administration Panel
          </span>
          <h2 className="font-display text-2xl md:text-3xl font-bold mt-2">
            Welcome to ClassSetu 🎓
          </h2>
          <p className="text-emerald-100/90 text-sm mt-1">
            Real-time coaching administration, student rosters, billing ledger tracking, and parent communication dispatch.
          </p>
        </div>
        <button 
          onClick={() => onNavigate("students", "add")}
          className="bg-white text-emerald-800 font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 hover:bg-emerald-50 active:scale-95 transition-all shadow-md cursor-pointer border-none"
        >
          <UserPlus className="w-4 h-4 text-emerald-600" />
          Add Quick Admission
        </button>
      </div>

      {/* Real-time API Dispatch Balances */}
      {(() => {
        const isWhatsAppEnabled = instituteData?.isWhatsAppEnabled ?? false;
        const isSmsEnabled = instituteData?.isSmsEnabled ?? false;
        const whatsappLimit = Number(instituteData?.whatsappLimit ?? 0);
        const whatsappSent = Number(instituteData?.whatsappSent ?? 0);
        const whatsappRemaining = Math.max(0, whatsappLimit - whatsappSent);

        const smsLimit = Number(instituteData?.smsLimit ?? 0);
        const smsSent = Number(instituteData?.smsSent ?? 0);
        const smsRemaining = Math.max(0, smsLimit - smsSent);

        const showAllExhaustedAlert = (isWhatsAppEnabled && whatsappRemaining <= 0) && (isSmsEnabled && smsRemaining <= 0);

        return (
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60 shadow-inner space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  📡 Real-Time Communication API Gateways
                </h3>
                <p className="text-xs text-slate-450 mt-0.5">
                  Live automated balance counters synchronized directly with carrier channels.
                </p>
              </div>
              {showAllExhaustedAlert && (
                <span className="bg-rose-50 border border-rose-200 text-rose-600 px-3 py-1 rounded-lg text-xs font-bold animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  All message limits exhausted. Contact Master Admin.
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Widget 1: WhatsApp */}
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-lg ${isWhatsAppEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">WhatsApp Service</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide mt-1 ${isWhatsAppEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/40' : 'bg-slate-100 text-slate-500 border border-slate-200/40'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isWhatsAppEnabled ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                        {isWhatsAppEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">Remaining Balance</span>
                    <span className={`text-2xl font-black font-mono tracking-tight ${whatsappRemaining <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {whatsappRemaining}
                    </span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold font-mono text-slate-400 uppercase">
                      <span>Used: {whatsappSent}</span>
                      <span>Limit: {whatsappLimit}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${whatsappRemaining <= 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${whatsappLimit > 0 ? Math.min(100, (whatsappSent / whatsappLimit) * 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Status Message */}
                  {isWhatsAppEnabled && whatsappRemaining <= 0 && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 px-3 py-2 rounded-lg text-xs font-medium leading-relaxed">
                      ⚠️ WhatsApp limit exhausted, shifting to SMS only or blocked.
                    </div>
                  )}
                </div>
              </div>

              {/* Widget 2: SMS */}
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-lg ${isSmsEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">SMS Service</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide mt-1 ${isSmsEnabled ? 'bg-indigo-100 text-indigo-800 border border-indigo-200/40' : 'bg-slate-100 text-slate-500 border border-slate-200/40'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isSmsEnabled ? 'bg-indigo-500 animate-ping' : 'bg-slate-400'}`}></span>
                        {isSmsEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wide">Remaining Balance</span>
                    <span className={`text-2xl font-black font-mono tracking-tight ${smsRemaining <= 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                      {smsRemaining}
                    </span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold font-mono text-slate-450 uppercase">
                      <span>Used: {smsSent}</span>
                      <span>Limit: {smsLimit}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${smsRemaining <= 0 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                        style={{ width: `${smsLimit > 0 ? Math.min(100, (smsSent / smsLimit) * 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Status Message */}
                  {isSmsEnabled && smsRemaining <= 0 && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 px-3 py-2 rounded-lg text-xs font-medium leading-relaxed">
                      ⚠️ SMS limit exhausted, shifting to WhatsApp only or blocked.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- STUDENT TRANSFER REQUESTS CENTER --- */}
      <div className="bg-white rounded-2xl p-6 border border-slate-150 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm">📥</span>
              Student Transfer Requests (स्थानांतरण अनुरोध)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These students are currently registered under your institute. Another institute has requested to transfer them to their rosters.
            </p>
          </div>
          {transferRequests.filter(r => r.request_status === "PENDING").length > 0 ? (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full animate-pulse">
              {transferRequests.filter(r => r.request_status === "PENDING").length} Pending
            </span>
          ) : (
            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              0 Active
            </span>
          )}
        </div>

        {transferRequests.filter(r => r.request_status === "PENDING").length > 0 ? (
          <div className="divide-y divide-slate-150">
            {transferRequests
              .filter(r => r.request_status === "PENDING")
              .map((req) => (
                <div key={req.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{req.student_name}</span>
                      <span className="bg-slate-100 text-slate-650 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200">
                        ID: {req.student_code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="text-slate-400">📞 Contact Phone:</span>
                      <span className="font-mono font-bold text-slate-700">{req.student_phone || "Not provided"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onRejectRequest?.(req)}
                      className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Reject (अस्वीकार करें)
                    </button>
                    <button
                      onClick={() => onApproveRequest?.(req)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1"
                    >
                      Approve (स्वीकार करें)
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-xs text-slate-500">
            🍃 कोई लंबित स्थानांतरण अनुरोध नहीं है। (No pending student transfer requests.)
          </div>
        )}
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Students */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Students
              </p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2 font-display">
                {students.length}
              </h3>
              <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {activeStudents} Active Rosters
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-xs">
            <button onClick={() => onNavigate("students", "add")} className="text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer border-none bg-transparent">
              Add Quick Admission <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Active Batches */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Batches
              </p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2 font-display">
                {totalBatches}
              </h3>
              <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Tracked Timings
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Layers className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-xs">
            <button onClick={() => onNavigate("batches")} className="text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer border-none bg-none">
              Schedule/Attendance <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Attendance Percentage */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Latest Attendance
              </p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2 font-display">
                {attendanceRatio}%
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                {latestDate ? `Record: ${latestDate}` : "No matches today"}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <CalendarCheck className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-xs">
            <button onClick={() => onNavigate("batches")} className="text-amber-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer border-none bg-none">
              Open Attendance Sheet <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Outstanding Dues
              </p>
              <h3 className="text-3xl font-bold text-rose-600 mt-2 font-display">
                ₹{totalPending.toLocaleString()}
              </h3>
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                ₹{totalCollected.toLocaleString()} Collected
              </p>
            </div>
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
              <CircleDollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-xs">
            <button onClick={() => onNavigate("fees")} className="text-rose-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer border-none bg-none">
              Collect Installment <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Fees Collection Trend Chart (Full Width) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
            <div>
              <h4 className="font-display text-lg font-bold text-slate-800">
                Fees Collection Trend
              </h4>
              <p className="text-xs text-slate-400">Monthly breakdown of received fees vs pending dues</p>
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600 font-sans">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Collected
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 font-sans">
                <span className="w-3 h-3 rounded-full bg-rose-400 inline-block"></span> Outstanding
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  formatter={(value: any) => `₹${value.toLocaleString()}`}
                />
                <Bar dataKey="Collected" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Pending" name="Outstanding" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
