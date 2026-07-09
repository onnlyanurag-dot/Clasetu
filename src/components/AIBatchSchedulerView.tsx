import React, { useState } from "react";
import { 
  Search, 
  Filter, 
  Clock, 
  UserCheck, 
  Check, 
  ChevronDown, 
  Users, 
  BookOpen, 
  CheckCircle, 
  AlertCircle, 
  X,
  UserX,
  CalendarDays,
  GraduationCap,
  Layers
} from "lucide-react";
import { Student, Batch } from "../types";
import { formatGrade } from "../utils";

interface AIBatchSchedulerViewProps {
  students: Student[];
  batches: Batch[];
  onFinalizeSchedule: (assignments: { studentId: string; batchId: string | null }[]) => Promise<any>;
  isSubscribed?: boolean;
  onSubscriptionBlocked?: () => void;
}

export default function AIBatchSchedulerView({ 
  students = [], 
  batches = [], 
  onFinalizeSchedule,
  isSubscribed = true,
  onSubscriptionBlocked
}: AIBatchSchedulerViewProps) {
  
  // States for search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("all");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState("all");
  
  // State for tracking open batch dropdown for a student
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  // UI interaction feedback states
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Derive unique student grades for the grade filter list
  const uniqueGrades = Array.from(
    new Set(students.map((s) => s.grade).filter(Boolean))
  ).sort();

  // Filter students based on Search, Grade, and Batch
  const filteredStudents = students.filter((student) => {
    // 1. Search filter (match name, parent name, or ID)
    const matchesSearch = 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.parentName && student.parentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      student.id.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Grade/Class filter
    const matchesGrade = 
      selectedGradeFilter === "all" || 
      student.grade === selectedGradeFilter;

    // 3. Batch filter
    let matchesBatch = true;
    if (selectedBatchFilter !== "all") {
      if (selectedBatchFilter === "unassigned") {
        matchesBatch = !student.batchId;
      } else {
        matchesBatch = student.batchId === selectedBatchFilter;
      }
    }

    return matchesSearch && matchesGrade && matchesBatch;
  });

  // Calculate stats for active students
  const totalStudentsCount = students.length;
  const activeStudentsCount = students.filter(s => s.status === "active").length;
  const assignedCount = students.filter(s => s.batchId).length;
  const unassignedCount = students.filter(s => !s.batchId).length;

  // Format student avatar
  const getAvatarProps = (name: string) => {
    const clean = name.trim().toUpperCase();
    const parts = clean.split(/\s+/);
    const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0][0] || "S";
    
    // Aesthetic pairings background colors
    const colors = [
      "bg-indigo-50 text-indigo-700 border-indigo-100",
      "bg-emerald-50 text-emerald-700 border-emerald-100",
      "bg-amber-50 text-amber-700 border-amber-100",
      "bg-sky-50 text-sky-700 border-sky-100",
      "bg-rose-50 text-rose-700 border-rose-100",
      "bg-violet-50 text-violet-700 border-violet-100",
      "bg-teal-50 text-teal-700 border-teal-100",
    ];
    const index = name.length % colors.length;
    return { initials, colorClass: colors[index] };
  };

  // Handle immediate batch allocation update in Firestore
  const handleBatchChange = async (studentId: string, nextBatchId: string | null) => {
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      setOpenDropdownId(null);
      return;
    }
    setUpdatingStudentId(studentId);
    setOpenDropdownId(null);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // Find current student name
      const student = students.find(s => s.id === studentId);
      const studentName = student ? student.name : "Student";
      
      // Determine next batch name
      const nextBatch = batches.find(b => b.id === nextBatchId);
      const batchLabel = nextBatch ? `batch "${nextBatch.name}"` : "Unassigned";

      // Finalize database assignment
      await onFinalizeSchedule([{ studentId, batchId: nextBatchId }]);
      
      setSuccessMsg(`Successfully reassigned ${studentName} to ${batchLabel}!`);
      // Auto dismiss message after 3 seconds
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update batch. Please try again.");
    } finally {
      setUpdatingStudentId(null);
    }
  };

  // Calculate current enrollment numbers for each batch helper
  const getBatchEnrollmentCount = (batchId: string) => {
    return students.filter((s) => s.batchId === batchId).length;
  };

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" /> Student Batch Allocator
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Reassign students to their respective timing slots. View rosters, filter by target class, and manage real-time batch alignments.
          </p>
        </div>
      </div>

      {/* Stats Board Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-sans mb-1">Total Students</span>
          <span className="text-xl font-black text-slate-800 font-mono">{totalStudentsCount}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{activeStudentsCount} Active Enrolled</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Assigned Timing</span>
          <span className="text-xl font-black text-emerald-600 font-mono">{assignedCount}</span>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
            {totalStudentsCount > 0 ? Math.round((assignedCount / totalStudentsCount) * 100) : 0}% Allocated
          </span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Unassigned</span>
          <span className="text-xl font-black text-amber-600 font-mono">{unassignedCount}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Requires placement setup</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Available Batches</span>
          <span className="text-xl font-black text-indigo-600 font-mono">{batches.length}</span>
          <span className="text-[10px] text-indigo-500 font-medium block mt-0.5">Timing slots active</span>
        </div>
      </div>

      {/* Floating Status Banners */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Interactive Controls Bar: Search & Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student name, parent, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 placeholder-slate-400 transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Class / Grade Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs">
            <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-slate-400 font-bold mr-1">Class:</span>
            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Classes</option>
              {uniqueGrades.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          {/* Batch Timing Slot Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-xs">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400 font-bold mr-1">Timing:</span>
            <select
              value={selectedBatchFilter}
              onChange={(e) => setSelectedBatchFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Timing Slots</option>
              <option value="unassigned">🔴 Unassigned Placements</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Click-away backdrop for student custom dropdown selectors */}
      {openDropdownId && (
        <div 
          className="fixed inset-0 z-30 bg-transparent" 
          onClick={() => setOpenDropdownId(null)}
        />
      )}

      {/* Roster Database List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Table header for desktop screens, simple summary text */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs font-bold text-slate-400">
          <span>Roster (Showing {filteredStudents.length} of {students.length} students)</span>
          <span className="hidden sm:inline">Change Batch Alignment</span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
              <UserX className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No Matching Students Found</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Try adjusting your search query, class grade filters, or batch timing selections to view results.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredStudents.map((student) => {
              const currentBatch = batches.find((b) => b.id === student.batchId);
              const { initials, colorClass } = getAvatarProps(student.name);
              const isUpdating = updatingStudentId === student.id;
              const isDropdownOpen = openDropdownId === student.id;

              return (
                <div 
                  key={student.id} 
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/35 transition-colors"
                >
                  
                  {/* Left: Student Profile Card */}
                  <div className="flex items-start gap-3">
                    
                    {/* Deterministic Initials Avatar */}
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-xs flex-shrink-0 ${colorClass}`}>
                      {initials}
                    </div>

                    {/* Student Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-display font-bold text-sm text-slate-800 leading-none">
                          {student.name}
                        </h4>
                        
                        {/* Grade / Class Tag */}
                        {student.grade && (
                          <span className="bg-slate-100 text-slate-600 font-extrabold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {student.grade}
                          </span>
                        )}

                        {/* Status tag */}
                        <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm font-black ${
                          student.status === "active" 
                            ? "bg-emerald-100 text-emerald-800" 
                            : "bg-slate-100 text-slate-400"
                        }`}>
                          {student.status}
                        </span>
                      </div>

                      {/* Parent details & mobile identifier */}
                      <p className="text-[11px] text-slate-400">
                        Parent: <span className="font-medium text-slate-600">{student.parentName || "Unspecified"}</span> 
                        {student.parentMobile && ` (${student.parentMobile})`}
                      </p>

                      {/* Prefs: School timings & distance (extremely useful context for timing choices) */}
                      {(student.schoolTiming || student.preferredTuitionTiming) && (
                        <div className="flex items-center gap-2 text-[10px] text-indigo-600 bg-indigo-50/45 border border-indigo-100/30 px-2 py-0.5 rounded-md inline-block mt-1">
                          <Clock className="w-3 h-3 text-indigo-500 inline" />
                          <span>
                            {student.schoolTiming ? `School: ${student.schoolTiming}` : ""}
                            {student.schoolTiming && student.preferredTuitionTiming ? " • " : ""}
                            {student.preferredTuitionTiming ? `Prefers: ${student.preferredTuitionTiming}` : ""}
                          </span>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Right: Roster Timing Slot Selector Button with popover */}
                  <div className="relative self-start sm:self-center">
                    
                    {/* The Trigger Button - displaying current assigned batch */}
                    <button
                      onClick={() => {
                        if (isUpdating) return;
                        setOpenDropdownId(isDropdownOpen ? null : student.id);
                      }}
                      disabled={isUpdating}
                      className={`w-full sm:w-64 text-left px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-between gap-2.5 select-none ${
                        isUpdating 
                          ? "bg-slate-50 text-slate-400 border-slate-100" 
                          : currentBatch
                          ? "bg-emerald-50/20 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/40 border-emerald-100/70"
                          : "bg-rose-50/20 text-rose-700 hover:text-rose-800 hover:bg-rose-50/40 border-rose-100/70"
                      }`}
                      title="Click to view and switch timing slots"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isUpdating ? (
                          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        ) : currentBatch ? (
                          <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <UserX className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {isUpdating 
                            ? "Updating workspace..." 
                            : currentBatch 
                            ? `${currentBatch.name} (${currentBatch.startTime})` 
                            : "🔴 Unassigned placement"}
                        </span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 opacity-60 flex-shrink-0 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Dropdown Options List Menu */}
                    {isDropdownOpen && (
                      <div className="absolute right-0 top-11 bg-white border border-slate-100 rounded-xl shadow-xl z-40 w-72 overflow-hidden transform origin-top-right transition-all animate-fade-in py-1.5 divide-y divide-slate-50">
                        
                        <div className="px-3 py-1.5 text-[9px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/40">
                          Select Timing Slot
                        </div>

                        {/* Option: Unassigned */}
                        <button
                          onClick={() => handleBatchChange(student.id, null)}
                          className={`w-full text-left px-4 py-2.5 hover:bg-rose-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            !student.batchId ? "text-rose-600 bg-rose-50/30" : "text-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs">🔴</span>
                            <div>
                              <span>Remove from Batch</span>
                              <span className="block text-[10px] text-slate-400 font-medium">Reset student roster placement</span>
                            </div>
                          </div>
                          {!student.batchId && <Check className="w-4 h-4 text-rose-600" />}
                        </button>

                        {/* Options: All available batches */}
                        {batches.filter((batch) => {
                          const bTarget = batch.targetClass || batch.targetGrade;
                          if (!bTarget) return true;
                          return formatGrade(bTarget) === formatGrade(student.grade);
                        }).map((batch) => {
                          const isCurrent = student.batchId === batch.id;
                          const count = getBatchEnrollmentCount(batch.id);
                          const isAtCapacity = count >= batch.capacity;
                          
                          // Check if grade matches batch targetGrade to flag recommendations
                          const gradeMatches = !batch.targetGrade || 
                            student.grade?.toLowerCase().trim().includes(batch.targetGrade.toLowerCase().trim()) ||
                            batch.targetGrade.toLowerCase().trim().includes(student.grade?.toLowerCase().trim() || "x");

                          return (
                            <button
                              key={batch.id}
                              onClick={() => handleBatchChange(student.id, batch.id)}
                              className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                isCurrent ? "text-emerald-600 bg-emerald-50/20" : "text-slate-700"
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate">{batch.name}</span>
                                  {gradeMatches && !isCurrent && (
                                    <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase px-1 py-0.2 rounded-sm border border-indigo-100">
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                
                                <span className="block text-[10px] text-slate-400 font-mono font-normal">
                                  {batch.startTime} - {batch.endTime}
                                </span>
                                
                                <span className={`block text-[9px] font-bold ${isAtCapacity ? "text-rose-500" : "text-emerald-600"}`}>
                                  Roster occupancy: {count} / {batch.capacity} Cap
                                </span>
                              </div>

                              {isCurrent && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                            </button>
                          );
                        })}

                      </div>
                    )}

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}
