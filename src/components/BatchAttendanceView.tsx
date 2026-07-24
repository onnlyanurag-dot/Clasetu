import React, { useState } from "react";
import { 
  CheckCircle2, 
  X, 
  Trash2, 
  Plus, 
  Calendar, 
  CheckSquare, 
  Square, 
  Layers, 
  Save, 
  Clock, 
  AlertCircle,
  FileCheck2,
  Users,
  ChevronDown,
  Check
} from "lucide-react";
import { Student, Batch, AttendanceRecord, Teacher } from "../types";
import TimeInput from "./TimeInput";

interface BatchAttendanceViewProps {
  students: Student[];
  batches: Batch[];
  attendance: AttendanceRecord[];
  teachers: Teacher[];
  onAddBatch: (batch: Partial<Batch>) => Promise<any>;
  onUpdateBatch: (id: string, batch: Partial<Batch>) => Promise<any>;
  onDeleteBatch: (id: string) => Promise<any>;
  onMarkAttendance: (date: string, records: { [studentId: string]: "Present" | "Absent" }) => Promise<any>;
  isSubscribed?: boolean;
  onSubscriptionBlocked?: () => void;
}

export default function BatchAttendanceView({
  students = [],
  batches = [],
  attendance = [],
  teachers = [],
  onAddBatch,
  onUpdateBatch,
  onDeleteBatch,
  onMarkAttendance,
  isSubscribed = true,
  onSubscriptionBlocked
}: BatchAttendanceViewProps) {
  
  // Create Batch Form State (in modal)
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [deleteConfirmBatchId, setDeleteConfirmBatchId] = useState<string | null>(null);
  const [bName, setBName] = useState("");
  const [bStart, setBStart] = useState("03:00 PM");
  const [bEnd, setBEnd] = useState("04:30 PM");
  const [bCapacity, setBCapacity] = useState(15);
  const [bDays, setBDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [bTeachers, setBTeachers] = useState<string[]>([]);
  const [bTargetClass, setBTargetClass] = useState("Grade 10");
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);

  const availableGrades = [
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
    "Grade 11",
    "Grade 11 (JEE)",
    "Grade 11 (NEET)",
    "Grade 12",
    "Grade 12 (JEE)",
    "Grade 12 (NEET)",
    "Droppers / Repeaters"
  ];

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Background scroll lock effect when any batch modal is open
  React.useEffect(() => {
    const isModalActive = isAddBatchOpen || !!editingBatchId || !!deleteConfirmBatchId;
    if (isModalActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isAddBatchOpen, editingBatchId, deleteConfirmBatchId]);

  const handleToggleDay = (day: string) => {
    setBDays((prev) => 
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleCreateBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      setIsAddBatchOpen(false);
      setEditingBatchId(null);
      return;
    }

    const validateTime = (timeStr: string): boolean => {
      if (!timeStr) return false;
      const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return false;
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h <= 0 || h > 12) return false;
      if (m < 0 || m > 59) return false;
      return true;
    };

    if (!validateTime(bStart) || !validateTime(bEnd)) {
      alert("Invalid Time! Hours cannot exceed 12 and Minutes cannot exceed 59.");
      return;
    }

    const payload = {
      name: bName,
      startTime: bStart,
      endTime: bEnd,
      capacity: Number(bCapacity),
      days: bDays,
      assignedTeacherIds: bTeachers,
      targetClass: bTargetClass
    };

    if (editingBatchId) {
      await onUpdateBatch(editingBatchId, payload);
    } else {
      await onAddBatch(payload);
    }

    setIsAddBatchOpen(false);
    setEditingBatchId(null);
    // Reset forms
    setBName("");
    setBStart("03:00 PM");
    setBEnd("04:30 PM");
    setBCapacity(15);
    setBDays(["Mon", "Wed", "Fri"]);
    setBTeachers([]);
    setBTargetClass("Grade 10");
  };

  // Compute timing slot analytics
  const totalSlots = batches.length;
  const totalEnrolled = students.filter((s) => s.batchId && s.status === "active").length;
  const totalCapacity = batches.reduce((acc, b) => acc + (b.capacity || 0), 0);

  return (
    <div className="space-y-8">
      
      {/* Title zone */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-800">
            Coaching Batch Timings & Timetable
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Create academic coaching batches, structure lecture timings, assign professional teachers, and evaluate roster capacity metrics.
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingBatchId(null);
            setBName("");
            setBStart("03:00 PM");
            setBEnd("04:30 PM");
            setBCapacity(15);
            setBDays(["Mon", "Wed", "Fri"]);
            setBTeachers([]);
            setBTargetClass("Class 10th");
            setIsAddBatchOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-750 text-white font-bold py-2 px-5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:shadow-md cursor-pointer h-11 w-full sm:w-auto transition-all"
        >
          <Plus className="w-4 h-4" /> Define Timing Slot
        </button>
      </div>

      {/* Roster & Slot Statistics Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Batches</span>
            <h3 className="font-display font-black text-xl text-slate-800 mt-0.5">{totalSlots}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scheduled Students</span>
            <h3 className="font-display font-black text-xl text-slate-800 mt-0.5">{totalEnrolled}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Roster Capacity Fill</span>
            <h3 className="font-display font-black text-xl text-slate-800 mt-0.5">
              {totalCapacity > 0 ? `${Math.round((totalEnrolled / totalCapacity) * 105)}%` : "0%"}
              <span className="text-xs font-normal text-slate-400 ml-1.5 font-mono">({totalEnrolled}/{totalCapacity})</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Main active timing slots grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h4 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-emerald-600" /> Organized Timetable Slots ({batches.length})
          </h4>
        </div>

        {batches.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl space-y-3">
            <Layers className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700">No active coaching batches found</h4>
            <p className="text-xs text-slate-450 max-w-sm mx-auto">
              Get started by defining tuition schedule blocks and assigning student seat quotas.
            </p>
            <button 
              onClick={() => setIsAddBatchOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase tracking-wider transition-all mt-2"
            >
              Add New Slot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map((b) => {
              const studentsInBatch = students.filter((s) => s.batchId === b.id && s.status === "active");
              const isOverCapacity = studentsInBatch.length > b.capacity;

              return (
                <div key={b.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow duration-300 space-y-4 min-h-[220px]">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider block">ID: {b.id}</span>
                        <h5 className="font-bold text-slate-800 text-sm flex flex-wrap items-center gap-2">
                          <span className="max-w-[150px] truncate">{b.name}</span>
                          {b.targetClass && (
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              {b.targetClass}
                            </span>
                          )}
                        </h5>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button 
                          onClick={() => {
                            setEditingBatchId(b.id);
                            setBName(b.name);
                            setBStart(b.startTime);
                            setBEnd(b.endTime);
                            setBCapacity(b.capacity);
                            setBDays(b.days);
                            setBTeachers(b.assignedTeacherIds || []);
                            setBTargetClass(b.targetClass || "Grade 10");
                            setIsAddBatchOpen(true);
                          }}
                          className="bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-500 hover:text-emerald-700 font-bold px-2 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                          title="Edit Timing Slot"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => {
                            setDeleteConfirmBatchId(b.id);
                          }}
                          className="p-1 px-1.5 text-slate-350 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Timing Slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-500">
                      <p className="flex items-center gap-1.5 font-mono font-semibold text-slate-700 bg-slate-50 py-1 px-2.5 rounded-lg border border-slate-100 max-w-max">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {b.startTime} - {b.endTime}
                      </p>
                      <p className="flex items-center gap-1.5 font-bold text-slate-700">
                        <span className="uppercase text-[9px] tracking-wider text-slate-400 font-extrabold">Active Days:</span> 
                        <span>{b.days.join(", ")}</span>
                      </p>

                      {/* Assigned Teachers Display */}
                      <div className="pt-2">
                        <span className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">In-Charge Teachers</span>
                        {b.assignedTeacherIds && b.assignedTeacherIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {b.assignedTeacherIds.map((tid, index) => {
                              const teacher = teachers.find((t) => t.id === tid);
                              return (
                                <span key={`${b.id}-${tid}-${index}`} className="bg-slate-100 text-slate-700 border border-slate-200/60 rounded px-1.5 py-0.5 text-[9px] font-bold">
                                  👤 {teacher ? teacher.name : "Professor Sub-Account"}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No assigned teachers found</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-450">Active Roster Size</span>
                    <span className={`font-mono text-sm font-bold ${
                      isOverCapacity ? "text-rose-600" : studentsInBatch.length === b.capacity ? "text-amber-600" : "text-emerald-700"
                    }`}>
                      {studentsInBatch.length} / {b.capacity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- DEFINE BATCH FORM TIMING SLOTS MODAL --- */}
      {isAddBatchOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 w-full max-w-md overflow-hidden transform scale-100 transition-all">
            <div className="bg-emerald-gradient p-5 text-white flex justify-between items-center">
              <h3 className="font-display text-lg font-bold">Define Batch TIMING Schedule</h3>
              <button onClick={() => setIsAddBatchOpen(false)} className="text-emerald-100 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateBatchSubmit} className="p-6 space-y-4 text-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Batch Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Grade 10 Star Morning Batch"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Select Grade</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsGradeDropdownOpen(!isGradeDropdownOpen)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span>{bTargetClass || "Select Grade"}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                  
                  {isGradeDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
                      {availableGrades.map((cl) => {
                        const isSelected = bTargetClass === cl;
                        return (
                          <button
                            key={cl}
                            type="button"
                            onClick={() => {
                              setBTargetClass(cl);
                              setIsGradeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                              isSelected ? "text-emerald-600 bg-emerald-50/20" : "text-slate-700"
                            }`}
                          >
                            <span>{cl}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TimeInput
                  label="Start Time"
                  value={bStart}
                  onChange={setBStart}
                />
                <TimeInput
                  label="End Time"
                  value={bEnd}
                  onChange={setBEnd}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Preferred Capacity Limit</label>
                <input 
                  type="number"
                  required
                  value={bCapacity}
                  onChange={(e) => setBCapacity(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-bold font-mono text-center"
                />
              </div>

              {/* Days choice */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Lecture Schedule Days</label>
                <div className="flex flex-wrap gap-1.5">
                  {weekDays.map((day) => {
                    const isSelected = bDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => handleToggleDay(day)}
                        className={`text-xs font-bold tracking-wider px-2.5 py-1.5 rounded-lg border transition-all ${
                          isSelected 
                            ? "bg-slate-900 border-slate-900 text-white" 
                            : "bg-slate-50 border-slate-250 text-slate-500"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assigned Teachers selection */}
              <div>
                <div className="flex justify-between items-center mb-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Assigned Teachers</label>
                  {teachers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = bTeachers.length === teachers.length;
                        setBTeachers(allSelected ? [] : teachers.map(t => t.id));
                      }}
                      className="text-[10px] text-emerald-600 font-extrabold hover:underline"
                    >
                      {bTeachers.length === teachers.length ? "Deselect All" : "Select All Teachers"}
                    </button>
                  )}
                </div>
                
                {teachers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                    No active registered teachers found in system. Create accounts in Settings Desk tab first!
                  </p>
                ) : (
                  <div className="max-h-[120px] overflow-y-auto border border-slate-250/70 rounded-xl p-3 bg-slate-50 space-y-2">
                    {teachers.map((t) => {
                      const isChecked = bTeachers.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors text-xs font-semibold text-slate-700 select-none">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setBTeachers(prev => 
                                prev.includes(t.id) 
                                  ? prev.filter(id => id !== t.id) 
                                  : [...prev, t.id]
                              );
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                          />
                          <div>
                            <span className="font-bold text-slate-800 block leading-tight">{t.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{t.email}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAddBatchOpen(false);
                    setEditingBatchId(null);
                    setBName("");
                    setBStart("03:00 PM");
                    setBEnd("04:30 PM");
                    setBCapacity(15);
                    setBDays(["Mon", "Wed", "Fri"]);
                    setBTeachers([]);
                    setBTargetClass("Grade 10");
                  }}
                  className="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl cursor-pointer text-sm font-display shadow-md shadow-emerald-50"
                >
                  {editingBatchId ? "Save Configurations" : "Create Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmBatchId && (() => {
        const batchToDelete = batches.find(b => b.id === deleteConfirmBatchId);
        if (!batchToDelete) return null;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-rose-100 w-full max-w-md overflow-hidden transform scale-100 transition-all animate-fade-in text-center p-6 space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-800">Delete Batch Timing Slot?</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Are you absolutely sure you want to delete batch <strong className="text-slate-800">{batchToDelete.name}</strong>?
                </p>
                <p className="text-rose-600 text-[10px] bg-rose-50 p-2 rounded-lg mt-2 font-semibold">
                  This will remove the batch timing slot. All students assigned to this batch will automatically revert to "Unassigned" placements.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setDeleteConfirmBatchId(null)} 
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (isSubscribed === false) {
                      onSubscriptionBlocked?.();
                      return;
                    }
                    await onDeleteBatch(deleteConfirmBatchId);
                    setDeleteConfirmBatchId(null);
                  }} 
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs cursor-pointer hover:bg-rose-700 transition-all shadow-md shadow-rose-200"
                >
                  Delete Batch
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
