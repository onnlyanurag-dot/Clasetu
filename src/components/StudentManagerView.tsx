import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  CheckCircle2, 
  Eye, 
  Edit3, 
  Trash2, 
  QrCode, 
  PhoneCall, 
  AlertTriangle,
  GraduationCap, 
  Calendar, 
  FileCheck2, 
  DollarSign,
  Upload,
  FileSpreadsheet,
  ArrowDownToLine,
  RefreshCw,
  ChevronDown,
  Send,
  Check
} from "lucide-react";
import { Student, Batch, FeeInstallment, AttendanceRecord } from "../types";
import TimeInput from "./TimeInput";
import { formatGrade } from "../utils";
import { writeBatch, doc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

interface StudentManagerViewProps {
  students: Student[];
  batches: Batch[];
  installments: FeeInstallment[];
  attendance: AttendanceRecord[];
  onAddStudent: (std: Partial<Student>) => Promise<any>;
  onUpdateStudent: (id: string, std: Partial<Student>) => Promise<any>;
  onDeleteStudent: (id: string) => Promise<any>;
  onPayInstallment: (instId: string, amount: number) => Promise<any>;
  autoOpenAdd?: boolean;
  onResetAutoOpenAdd?: () => void;
  onRefreshStudents?: () => Promise<void>;
  setStudents?: React.Dispatch<React.SetStateAction<Student[]>>;
  isSubscribed?: boolean;
  onSubscriptionBlocked?: () => void;
}

export default function StudentManagerView({ 
  students = [], 
  batches = [], 
  installments = [], 
  attendance = [], 
  onAddStudent, 
  onUpdateStudent, 
  onDeleteStudent,
  onPayInstallment,
  autoOpenAdd,
  onResetAutoOpenAdd,
  onRefreshStudents,
  setStudents,
  isSubscribed = true,
  onSubscriptionBlocked
}: StudentManagerViewProps) {
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Custom dropdown open states
  const [isAddClassDropdownOpen, setIsAddClassDropdownOpen] = useState(false);
  const [isEditClassDropdownOpen, setIsEditClassDropdownOpen] = useState(false);
  const [isFilterClassDropdownOpen, setIsFilterClassDropdownOpen] = useState(false);
  const [isAddBatchDropdownOpen, setIsAddBatchDropdownOpen] = useState(false);
  const [isEditBatchDropdownOpen, setIsEditBatchDropdownOpen] = useState(false);

  // Dropdown Refs
  const filterClassDropdownRef = useRef<HTMLDivElement>(null);
  const addClassDropdownRef = useRef<HTMLDivElement>(null);
  const editClassDropdownRef = useRef<HTMLDivElement>(null);
  const addBatchDropdownRef = useRef<HTMLDivElement>(null);
  const editBatchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (filterClassDropdownRef.current && !filterClassDropdownRef.current.contains(target)) {
        setIsFilterClassDropdownOpen(false);
      }
      if (addClassDropdownRef.current && !addClassDropdownRef.current.contains(target)) {
        setIsAddClassDropdownOpen(false);
      }
      if (editClassDropdownRef.current && !editClassDropdownRef.current.contains(target)) {
        setIsEditClassDropdownOpen(false);
      }
      if (addBatchDropdownRef.current && !addBatchDropdownRef.current.contains(target)) {
        setIsAddBatchDropdownOpen(false);
      }
      if (editBatchDropdownRef.current && !editBatchDropdownRef.current.contains(target)) {
        setIsEditBatchDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditId, setIsEditId] = useState<string | null>(null);
  const [isViewId, setIsViewId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states for Add/Edit
  const [formName, setFormName] = useState("");
  const [formParentName, setFormParentName] = useState("");
  const [formParentMobile, setFormParentMobile] = useState("");
  const [formAlternateMobile, setFormAlternateMobile] = useState("");
  const [formGrade, setFormGrade] = useState("");
  const [formSchoolName, setFormSchoolName] = useState("");
  const [formSchoolTimingStart, setFormSchoolTimingStart] = useState("");
  const [formSchoolTimingEnd, setFormSchoolTimingEnd] = useState("");
  const [formPreferredTimingStart, setFormPreferredTimingStart] = useState("");
  const [formPreferredTimingEnd, setFormPreferredTimingEnd] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formAdmissionDate, setFormAdmissionDate] = useState("");
  const [formFeesAmount, setFormFeesAmount] = useState(15000);
  const [formFeesPlan, setFormFeesPlan] = useState<"quarterly" | "half-yearly">("quarterly");
  const [formBatchId, setFormBatchId] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");

  // Payment capture inside view profile modal
  const [paymentAmount, setPaymentAmount] = useState("");
  const [activePayingInstId, setActivePayingInstId] = useState<string | null>(null);

  // Bulk Student Import states
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [selectedImportBatchId, setSelectedImportBatchId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importingX, setImportingX] = useState(0);
  const [importingY, setImportingY] = useState(0);
  const [importSuccess, setImportSuccess] = useState("");
  const [importError, setImportError] = useState("");

  // Transfer Handshake States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferCode, setTransferCode] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const [transferPreviewStudent, setTransferPreviewStudent] = useState<any | null>(null);
  const [transferPreviewLoading, setTransferPreviewLoading] = useState(false);
  const [transferPreviewError, setTransferPreviewError] = useState("");
  const [transferSuccessPin, setTransferSuccessPin] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSubmitSuccess, setTransferSubmitSuccess] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  React.useEffect(() => {
    if (autoOpenAdd) {
      handleOpenAdd();
      if (onResetAutoOpenAdd) {
        onResetAutoOpenAdd();
      }
    }
  }, [autoOpenAdd]);

  // Background scroll lock effect when any dialog modal or profile view is active
  React.useEffect(() => {
    const isModalActive = !!isViewId || !!deleteConfirmId || !!isAddOpen || !!isEditId || !!isBulkOpen;
    if (isModalActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isViewId, deleteConfirmId, isAddOpen, isEditId, isBulkOpen]);

  // Available standard classes in coaching institute
  const availableClasses = [
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
  const availableSubjectsList = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Informatics Practices"];

  const sanitizeGrade = (c: string) => formatGrade(c);
  const handleOpenAdd = () => {
    setFormName("");
    setFormParentName("");
    setFormParentMobile("");
    setFormAlternateMobile("");
    setFormGrade("Grade 10");
    setFormSchoolName("");
    setFormSchoolTimingStart("08:00 AM");
    setFormSchoolTimingEnd("02:00 PM");
    setFormPreferredTimingStart("03:00 PM");
    setFormPreferredTimingEnd("05:00 PM");
    setFormReason("");
    setFormSubjects(["Mathematics"]);
    setFormAdmissionDate(new Date().toISOString().split("T")[0]);
    setFormFeesAmount(16000);
    setFormFeesPlan("quarterly");
    setFormBatchId("");
    setFormStatus("active");
    setIsAddOpen(true);
  };

  const handleFetchTransferPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferCode) {
      setTransferPreviewError("Please enter the Student Unique Code.");
      return;
    }
    setTransferPreviewLoading(true);
    setTransferPreviewError("");
    setTransferPreviewStudent(null);
    try {
      // 1. Try to fetch from Firestore first using the authorized client SDK
      const studentDocRef = doc(db, "students", transferCode);
      const studentDocSnap = await getDoc(studentDocRef);
      
      let studentData: any = null;
      if (studentDocSnap.exists()) {
        const firestoreData = studentDocSnap.data();
        
        // CASE A: Check if the student is already soft-deleted (deleted_status == 1)
        if (firestoreData.deleted_status === 1) {
          studentData = {
            id: transferCode,
            name: firestoreData.name || "",
            parentName: firestoreData.parentName || "",
            parentMobile: firestoreData.parentMobile || "",
            alternateMobile: firestoreData.alternateMobile || "",
            grade: firestoreData.grade || firestoreData.gradeLevel || "Grade 10",
            gradeLevel: firestoreData.gradeLevel || firestoreData.grade || "Grade 10",
            schoolName: firestoreData.schoolName || "",
            schoolTiming: firestoreData.schoolTiming || "",
            preferredTuitionTiming: firestoreData.preferredTuitionTiming || "",
            reasonForPreferredTiming: firestoreData.reasonForPreferredTiming || "",
            subjects: firestoreData.subjects || [],
            admissionDate: firestoreData.admissionDate || "",
            feesAmount: Number(firestoreData.feesAmount || firestoreData.totalFees || 16000),
            feesPlan: firestoreData.feesPlan || "quarterly",
            status: firestoreData.status || "active",
            instituteId: firestoreData.instituteId || firestoreData.institute_id || "",
            deleted_status: 1,
            isNoPinTransfer: true // helper flag to indicate PIN is bypassed
          };
        } else {
          // CASE B: Standard active student transfer - No PIN required, we will create a transfer request!
          studentData = {
            id: transferCode,
            name: firestoreData.name || "",
            parentName: firestoreData.parentName || "",
            parentMobile: firestoreData.parentMobile || "",
            alternateMobile: firestoreData.alternateMobile || "",
            grade: firestoreData.grade || firestoreData.gradeLevel || "Grade 10",
            gradeLevel: firestoreData.gradeLevel || firestoreData.grade || "Grade 10",
            schoolName: firestoreData.schoolName || "",
            schoolTiming: firestoreData.schoolTiming || "",
            preferredTuitionTiming: firestoreData.preferredTuitionTiming || "",
            reasonForPreferredTiming: firestoreData.reasonForPreferredTiming || "",
            subjects: firestoreData.subjects || [],
            admissionDate: firestoreData.admissionDate || "",
            feesAmount: Number(firestoreData.feesAmount || firestoreData.totalFees || 16000),
            feesPlan: firestoreData.feesPlan || "quarterly",
            status: firestoreData.status || "active",
            instituteId: firestoreData.instituteId || firestoreData.institute_id || "",
            deleted_status: firestoreData.deleted_status || 0,
            isRequestTransfer: true // helper flag to indicate it needs a Transfer Request
          };
        }
      } else {
        throw new Error("No student record found for the provided Unique Student Code.");
      }

      setTransferPreviewStudent(studentData);
    } catch (err: any) {
      console.error("Error fetching transfer preview:", err);
      setTransferPreviewError(err.message || "An error occurred. Please verify the code.");
    } finally {
      setTransferPreviewLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      return;
    }
    if (!transferPreviewStudent || !auth.currentUser) return;
    setTransferPreviewLoading(true);
    setTransferPreviewError("");
    try {
      const newInstId = auth.currentUser.uid;

      if (transferPreviewStudent.isNoPinTransfer) {
        if (!consentChecked) {
          throw new Error("Please confirm the parent presence and consent by checking the checkbox.");
        }

        // Direct write authorization execution for Case A
        const studentRef = doc(db, "students", transferPreviewStudent.id);
        await updateDoc(studentRef, {
          instituteId: newInstId,
          institute_id: newInstId,
          deleted_status: 0,
          status: "ACTIVE"
        });

        // Add a document inside the transfer_requests collection
        await addDoc(collection(db, "transfer_requests"), {
          student_code: transferPreviewStudent.id,
          student_name: transferPreviewStudent.name,
          student_phone: transferPreviewStudent.parentMobile || "",
          from_institute_id: transferPreviewStudent.instituteId || "",
          to_institute_id: newInstId,
          request_status: "APPROVED",
          created_at: serverTimestamp()
        });

        // Refresh list of students
        if (onRefreshStudents) {
          await onRefreshStudents();
        }

        setTransferSubmitSuccess(`Transfer confirmed successfully! ${transferPreviewStudent.name} is now registered in your institute database.`);
        setTransferPreviewStudent(null);
        setTransferCode("");
        setConsentChecked(false);
        
        // Auto-close after a delay
        setTimeout(() => {
          setIsTransferModalOpen(false);
          setTransferSubmitSuccess("");
        }, 3000);

      } else if (transferPreviewStudent.isRequestTransfer) {
        // CASE B: Submit a PENDING Transfer Request instead of immediate transfer!
        await addDoc(collection(db, "transfer_requests"), {
          student_code: transferPreviewStudent.id,
          student_name: transferPreviewStudent.name,
          student_phone: transferPreviewStudent.parentMobile || "",
          from_institute_id: transferPreviewStudent.instituteId || "",
          to_institute_id: newInstId,
          request_status: "PENDING",
          created_at: serverTimestamp()
        });

        setTransferSubmitSuccess(`स्थानांतरण अनुरोध (Transfer Request) सफलतापूर्वक भेज दिया गया है! एक बार जब वर्तमान संस्थान इसे अपने डैशबोर्ड से स्वीकृत (Approve) कर देगा, तो यह छात्र आपके डेटाबेस में आ जाएगा।`);
        setTransferPreviewStudent(null);
        setTransferCode("");
        setConsentChecked(false);
        
        // Auto-close after a delay
        setTimeout(() => {
          setIsTransferModalOpen(false);
          setTransferSubmitSuccess("");
        }, 4000);
      }
    } catch (err: any) {
      console.error("Error accepting transfer:", err);
      setTransferPreviewError(err.message || "Failed to finalize student transfer. Please try again.");
    } finally {
      setTransferPreviewLoading(false);
    }
  };

  const handleOpenEdit = (student: Student) => {
    setFormName(student.name);
    setFormParentName(student.parentName);
    setFormParentMobile(student.parentMobile);
    setFormAlternateMobile(student.alternateMobile);
    setFormGrade(student.grade);
    setFormSchoolName(student.schoolName);

    let schoolStart = "08:00 AM";
    let schoolEnd = "02:00 PM";
    if (student.schoolTiming && student.schoolTiming.includes(" - ")) {
      const parts = student.schoolTiming.split(" - ");
      schoolStart = parts[0];
      schoolEnd = parts[1];
    } else if (student.schoolTiming) {
      schoolStart = student.schoolTiming;
    }

    let prefStart = "03:00 PM";
    let prefEnd = "05:00 PM";
    if (student.preferredTuitionTiming && student.preferredTuitionTiming.includes(" - ")) {
      const parts = student.preferredTuitionTiming.split(" - ");
      prefStart = parts[0];
      prefEnd = parts[1];
    } else if (student.preferredTuitionTiming) {
      prefStart = student.preferredTuitionTiming;
    }

    setFormSchoolTimingStart(schoolStart);
    setFormSchoolTimingEnd(schoolEnd);
    setFormPreferredTimingStart(prefStart);
    setFormPreferredTimingEnd(prefEnd);

    setFormReason(student.reasonForPreferredTiming);
    setFormSubjects(student.subjects);
    setFormAdmissionDate(student.admissionDate);
    setFormFeesAmount(student.feesAmount);
    setFormFeesPlan(student.feesPlan);
    setFormBatchId(student.batchId || "");
    setFormStatus(student.status);
    setIsEditId(student.id);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      setIsAddOpen(false);
      return;
    }

    const payload = {
      id: "STD-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      name: formName,
      gradeLevel: formGrade || "",
      parentName: formParentName || "",
      parentMobile: formParentMobile,
      alternateMobile: formAlternateMobile || "",
      schoolName: formSchoolName || "",
      totalFees: Number(formFeesAmount) || 0,
      batchId: formBatchId === "unassigned" ? "" : formBatchId,
      status: "active" as const,
      // Legacy compatibility keys to prevent display issues
      grade: formGrade || "",
      feesAmount: Number(formFeesAmount) || 0,
      feesPlan: formFeesPlan,
      admissionDate: formAdmissionDate,
      schoolTiming: "",
      preferredTuitionTiming: "",
      reasonForPreferredTiming: "",
      subjects: []
    };
    await onAddStudent(payload);
    setIsAddOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      setIsEditId(null);
      return;
    }
    if (!isEditId) return;

    const payload = {
      name: formName,
      parentName: formParentName,
      parentMobile: formParentMobile,
      alternateMobile: formAlternateMobile,
      grade: formGrade,
      gradeLevel: formGrade,
      schoolName: formSchoolName,
      feesAmount: Number(formFeesAmount) || 0,
      totalFees: Number(formFeesAmount) || 0,
      feesPlan: formFeesPlan,
      batchId: formBatchId === "unassigned" || !formBatchId ? "" : formBatchId,
      status: formStatus,
      admissionDate: formAdmissionDate,
      schoolTiming: "",
      preferredTuitionTiming: "",
      reasonForPreferredTiming: "",
      subjects: []
    };
    await onUpdateStudent(isEditId, payload);
    setIsEditId(null);
  };

  const handleToggleSubject = (subject: string) => {
    setFormSubjects((prev) => 
      prev.includes(subject) 
        ? prev.filter((s) => s !== subject) 
        : [...prev, subject]
    );
  };

  const handlePayInstallmentSubmit = async (instId: string) => {
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;
    await onPayInstallment(instId, amt);
    setActivePayingInstId(null);
    setPaymentAmount("");
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,Student Full Name,Class Level,Parent Name,Parent WhatsApp Mobile,Alternate Mobile,School Name,Total Term Fees\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAttendanceCSV = () => {
    if (!activeViewStudent) return;
    
    const headers = ["Date", "Status", "Student Name", "Class Level", "Parent Name", "WhatsApp Mobile"];
    const rows = activeViewAttendance.length > 0 
      ? activeViewAttendance.map(rec => [
          rec.date,
          rec.status,
          activeViewStudent.name,
          activeViewStudent.grade || "",
          activeViewStudent.parentName || "",
          activeViewStudent.parentMobile || ""
        ])
      : [
          ["N/A", "No Attendance Marked Yet", activeViewStudent.name, activeViewStudent.grade || "", activeViewStudent.parentName || "", activeViewStudent.parentMobile || ""]
        ];
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeViewStudent.name.toLowerCase().replace(/\s+/g, "_")}_attendance_history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // Parse headers
    const headerLine = lines[0];
    const splitCSVRow = (rowStr: string) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = splitCSVRow(headerLine).map(h => h.replace(/^"|"$/g, '').trim());
    
    const studentNameIdx = headers.findIndex(h => h.toLowerCase() === "student full name");
    const classLevelIdx = headers.findIndex(h => h.toLowerCase() === "class level");
    const parentNameIdx = headers.findIndex(h => h.toLowerCase() === "parent name");
    const parentMobileIdx = headers.findIndex(h => h.toLowerCase() === "parent whatsapp mobile");
    const alternateMobileIdx = headers.findIndex(h => h.toLowerCase() === "alternate mobile");
    const schoolNameIdx = headers.findIndex(h => h.toLowerCase() === "school name");
    const totalFeesIdx = headers.findIndex(h => h.toLowerCase() === "total term fees");

    if (studentNameIdx === -1 || parentMobileIdx === -1) {
      throw new Error('Required headers "Student Full Name" and "Parent WhatsApp Mobile" not found in uploaded CSV file. Please make sure to download and use the provided template.');
    }

    const results: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cells = splitCSVRow(line).map(c => c.replace(/^"|"$/g, '').trim());
      if (cells.length === 0) continue;

      const studentName = cells[studentNameIdx] || "";
      const parentMobile = cells[parentMobileIdx] || "";

      // 1. Core Mandatory Fields Check: If a row lacks either of these, skip it safely
      if (!studentName.trim() || !parentMobile.trim()) {
        continue;
      }

      // 2. Optional Fields Parsing: default to empty string or 0 for fees
      const gradeLevel = classLevelIdx !== -1 && cells[classLevelIdx] !== undefined ? cells[classLevelIdx] : "";
      const parentName = parentNameIdx !== -1 && cells[parentNameIdx] !== undefined ? cells[parentNameIdx] : "";
      const alternateMobile = alternateMobileIdx !== -1 && cells[alternateMobileIdx] !== undefined ? cells[alternateMobileIdx] : "";
      const schoolName = schoolNameIdx !== -1 && cells[schoolNameIdx] !== undefined ? cells[schoolNameIdx] : "";
      const totalFeesRaw = totalFeesIdx !== -1 && cells[totalFeesIdx] !== undefined ? cells[totalFeesIdx] : "0";
      const totalFees = Number(totalFeesRaw) || 0;

      results.push({
        studentName,
        gradeLevel,
        parentName,
        parentMobile,
        alternateMobile,
        schoolName,
        totalFees
      });
    }
    return results;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedImportBatchId) {
      setImportError("Please select a target batch first from the dropdown.");
      event.target.value = "";
      return;
    }

    setImportError("");
    setImportSuccess("");
    setIsImporting(true);
    setImportingX(0);

    try {
      const reader = new FileReader();
      const fileContentPromise = new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
      });

      const text = await fileContentPromise;
      const parsedRows = parseCSV(text);

      if (parsedRows.length === 0) {
        throw new Error("No valid student records containing mandatory fields were parsed. Please check your template file rows.");
      }

      const totalRecords = parsedRows.length;
      setImportingY(totalRecords);

      const instituteId = auth.currentUser?.uid;
      if (!instituteId) {
        throw new Error("Admin identifier context missing. Try logging in again.");
      }

      const selectedBatchObj = batches.find((b) => b.id === selectedImportBatchId) as any;
      const batchGrade = selectedBatchObj ? (selectedBatchObj.grade || selectedBatchObj.gradeLevel || selectedBatchObj.targetGrade || "") : "";

      const newlyImportedStudents: Student[] = [];

      // Chunk cleanly by 500 records per batch
      const chunkSize = 500;
      for (let i = 0; i < parsedRows.length; i += chunkSize) {
        const chunk = parsedRows.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((row) => {
          const studentId = "STD-" + Math.random().toString(36).substr(2, 6).toUpperCase();
          const studentDocRef = doc(db, "students", studentId);
          
          const selectedBatch = selectedBatchObj || {};
          let rawValue = row.gradeLevel || selectedBatch.class || selectedBatch.classLevel || selectedBatch.targetGrade || selectedBatch.targetClass || selectedBatch.grade || selectedBatch.gradeLevel || "";
          // Extract only digits from the string
          let matchNumbers = rawValue.match(/\d+/);
          let pureGradeNumber = matchNumbers ? matchNumbers[0] : "10"; // Only default to 10 if absolutely no number is found
          const finalizedGradeString = `Grade ${pureGradeNumber}`; // This guarantees strictly "Grade 10", "Grade 11", "Grade 9"

          const studentPayload: Student = {
            id: studentId,
            name: row.studentName,
            gradeLevel: finalizedGradeString,
            grade: finalizedGradeString, // mapped for legacy/grid rendering support
            parentName: row.parentName,
            parentMobile: row.parentMobile,
            alternateMobile: row.alternateMobile,
            schoolName: row.schoolName,
            totalFees: row.totalFees, // explicit requested mapping
            feesAmount: row.totalFees, // mapped to feesAmount for legacy/fee record details
            password: row.parentMobile || "password123", // used as contact login or password
            batchId: selectedImportBatchId,
            instituteId: instituteId,
            status: "active" as const,
            // Exclude unrequested fields on import (no Time fields, Description, or Active/Deactivate settings)
            schoolTiming: "",
            preferredTuitionTiming: "",
            reasonForPreferredTiming: "",
            subjects: [],
            admissionDate: new Date().toISOString().split("T")[0],
            feesPlan: "quarterly" as const,
            createdAt: new Date().toISOString()
          };

          batch.set(studentDocRef, studentPayload);
          newlyImportedStudents.push(studentPayload);
        });

        // Commit batch write
        await batch.commit();

        const currentProgress = Math.min(i + chunkSize, totalRecords);
        setImportingX(currentProgress);
      }

      setImportSuccess("Successfully imported all students!");
      setSelectedImportBatchId("");
      
      // Update local state immediately with newly imported students containing classes
      if (setStudents) {
        setStudents((prev) => {
          // Prevent duplicates by checking if ID already exists
          const existingIds = new Set(prev.map((s) => s.id));
          const filteredNew = newlyImportedStudents.filter((s) => !existingIds.has(s.id));
          return [...prev, ...filteredNew];
        });
      }

      if (onRefreshStudents) {
        await onRefreshStudents();
      }

    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "An error occurred during CSV parsing or Firestore uploading.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  // Filter students array
  const filteredStudents = students.filter((s) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = s.name.toLowerCase().includes(query) || s.parentName.toLowerCase().includes(query) || s.id.toLowerCase().includes(query);
    const matchesGrade = gradeFilter === "" || s.grade === gradeFilter;
    const matchesBatch = batchFilter === "" || s.batchId === batchFilter;
    const matchesStatus = statusFilter === "" || s.status === statusFilter;
    return matchesSearch && matchesGrade && matchesBatch && matchesStatus;
  });

  const activeViewStudent = students.find((s) => s.id === isViewId);
  const activeViewInstallments = activeViewStudent 
    ? installments.filter((i) => i.studentId === activeViewStudent.id).sort((a, b) => a.installmentNumber - b.installmentNumber)
    : [];
  const activeViewAttendance = activeViewStudent
    ? attendance.filter((a) => a.studentId === activeViewStudent.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-800">
            Student Admissions Database
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Query student profile folders, schedule capacities, registration statuses, and custom tuition fee logs.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setIsBulkOpen(!isBulkOpen);
              setImportError("");
              setImportSuccess("");
            }}
            className={`font-semibold py-2 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-all cursor-pointer w-full sm:w-auto ${
              isBulkOpen 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-transparent shadow-sm"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Bulk Import
          </button>
          <button 
            onClick={handleOpenAdd}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-xl flex items-center gap-2 text-sm shadow-md hover:shadow-emerald-100 transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" /> Onboard Student
          </button>
          <button 
            onClick={() => {
              setIsTransferModalOpen(true);
              setTransferCode("");
              setTransferPin("");
              setTransferPreviewStudent(null);
              setTransferPreviewError("");
              setTransferSubmitSuccess("");
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl flex items-center gap-2 text-sm shadow-md hover:shadow-indigo-100 transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <RefreshCw className="w-4 h-4" /> Add Student via Transfer
          </button>
        </div>
      </div>

      {/* Bulk CSV Import Panel */}
      {isBulkOpen && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm animate-fade-in">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3 className="font-display font-bold text-slate-800 text-sm">Bulk Student Import Engine</h3>
            </div>
            <button 
              onClick={() => setIsBulkOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 bg-white hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Step 1 & 2: Batch context & Sample download */}
            <div className="space-y-4 col-span-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  1. Target Batch Selection <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedImportBatchId}
                  onChange={(e) => setSelectedImportBatchId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-700 text-xs font-semibold"
                >
                  <option value="">-- Choose a Class Batch --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.targetClass || "General"}) (Capacity: {b.capacity})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Students will be automatically routed into this specific classroom schedule.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  2. Sample File Template
                </label>
                <button
                  type="button"
                  onClick={handleDownloadSampleCSV}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all font-semibold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <ArrowDownToLine className="w-4 h-4 text-slate-500" /> Download Sample CSV Template
                </button>
                <p className="text-[11px] text-slate-400 mt-1">
                  Requires columns exactly named: <code>Student Name</code>, <code>Parent Name</code>, <code>Parent Mobile</code>
                </p>
              </div>
            </div>

            {/* Step 3: File drag and upload */}
            <div className="space-y-4 col-span-1">
              <label className="block text-xs font-bold text-slate-500">
                3. Upload & Import Sheet
              </label>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  id="csv-file-upload"
                  className="hidden"
                  disabled={!selectedImportBatchId}
                />
                <label
                  htmlFor="csv-file-upload"
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer text-center transition-all ${
                    !selectedImportBatchId 
                      ? "bg-slate-100/50 border-slate-200 cursor-not-allowed opacity-60" 
                      : "bg-white border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/10"
                  }`}
                >
                  <Upload className={`w-8 h-8 mb-2 ${!selectedImportBatchId ? "text-slate-300" : "text-emerald-500"}`} />
                  <span className="text-xs font-bold text-slate-700">
                    {!selectedImportBatchId ? "Choose target batch first" : "Select CSV / Sheet File"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    Accepts only formatted .csv spreadsheet files
                  </span>
                </label>
              </div>

              {/* Error & Success States */}
              {importError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-850 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Loader Overlay */}
      {isImporting && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-auto text-center shadow-2xl border border-slate-100 space-y-4 animate-fade-in">
            <div className="relative w-16 h-16 mx-auto">
              <RefreshCw className="w-16 h-16 text-emerald-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
              </div>
            </div>
            
            <div>
              <h3 className="font-display font-bold text-slate-800 text-base">Onboarding Student Directory</h3>
              <p className="text-xs text-slate-400 mt-1">Please keep this tab active while we structure accounts.</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-sm font-bold text-emerald-700 font-mono">
                Importing student {importingX} out of {importingY}...
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${importingY > 0 ? (importingX / importingY) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">Pushing data efficiently via segmented Cloud transactions</p>
          </div>
        </div>
      )}

      {/* Query Bar Cards */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        
        {/* Count display added here */}
        <div className="flex items-center text-xs font-semibold text-slate-500">
          <span>
            {batchFilter ? "Students in selected batch:" : "Total students matching filters:"}
            <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg">{filteredStudents.length}</span>
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          
          {/* Search box */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input 
              type="text"
              placeholder="Search by student name, parent name, or registration ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Inline filters */}
          <div className="grid grid-cols-2 gap-2 lg:w-64 text-xs font-semibold text-slate-600">
            
            {/* Class filter */}
            <div className="relative" ref={filterClassDropdownRef}>
              <button
                type="button"
                onClick={() => setIsFilterClassDropdownOpen(!isFilterClassDropdownOpen)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 text-xs font-semibold flex items-center justify-between gap-1.5 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <span className="truncate">{gradeFilter || "All Classes"}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              </button>
              
              {isFilterClassDropdownOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setGradeFilter("");
                      setIsFilterClassDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      !gradeFilter ? "text-emerald-600 bg-emerald-50/20" : "text-slate-700"
                    }`}
                  >
                    <span>All Classes</span>
                    {!gradeFilter && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                  {availableClasses.map((item, index) => {
                    const isSelected = gradeFilter === item;
                    return (
                      <button
                        key={`${item}-${index}`}
                        type="button"
                        onClick={() => {
                          setGradeFilter(item);
                          setIsFilterClassDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          isSelected ? "text-emerald-600 bg-emerald-50/20" : "text-slate-700"
                        }`}
                      >
                        <span>{item}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Batch filter */}
            <select 
              value={batchFilter} 
              onChange={(e) => setBatchFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.targetClass || "General"})</option>
              ))}
            </select>

          </div>
        </div>
      </div>

      {/* Main Students Roster Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-slate-700">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-4 px-6">ID & Student</th>
                <th className="py-4 px-3">Class Level</th>
                <th className="py-4 px-3">Parent Details</th>
                <th className="py-4 px-3">Assigned Batch</th>
                <th className="py-4 px-3">Subjects</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <GraduationCap className="w-12 h-12 stroke-1 text-slate-300 mx-auto mb-2" />
                    No students matched the query parameters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const assignedBatch = batches.find((b) => b.id === s.batchId);
                  const filterBatch = batches.find((b) => b.id === batchFilter);
                  const selectedBatch = assignedBatch || filterBatch;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* ID and Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center font-bold text-xs uppercase font-mono shadow-inner border border-emerald-100">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-sm hover:text-emerald-700 cursor-pointer block" onClick={() => setIsViewId(s.id)}>
                              {s.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">{s.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-4 px-3 align-middle font-medium text-slate-600">
                        {sanitizeGrade(s.gradeLevel || s.grade || (selectedBatch as any)?.grade || (selectedBatch as any)?.gradeLevel || selectedBatch?.targetGrade || "Grade 10")}
                      </td>

                      {/* Parent Phone */}
                      <td className="py-4 px-3 align-middle">
                        <div className="text-xs text-slate-600 font-bold">{s.parentName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <PhoneCall className="w-3 h-3 text-slate-300" /> {s.parentMobile}
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="py-4 px-3 align-middle">
                        {assignedBatch ? (
                          <span className="bg-emerald-50 text-emerald-800 py-1 px-2 rounded-lg text-xs font-semibold border border-emerald-100 inline-block max-w-[150px] truncate">
                            {assignedBatch.name}
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-800 py-1 px-2 rounded-lg text-xs font-semibold border border-amber-100 inline-block">
                            Needs Assignment
                          </span>
                        )}
                      </td>

                      {/* Subjects */}
                      <td className="py-4 px-3 align-middle">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          { (s.subjects || []).map((sub) => (
                            <span key={`${s.id}-${sub}`} className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded">
                              {sub}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => setIsViewId(s.id)}
                            className="p-1 px-2.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-400 rounded-lg text-xs font-bold border border-slate-100 transition-all flex items-center gap-1 cursor-pointer"
                            title="View Profile Folder"
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>
                          
                          <button 
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-400 rounded-lg border border-slate-100 transition-all cursor-pointer"
                            title="Edit Student Data"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button 
                            onClick={() => {
                              setDeleteConfirmId(s.id);
                            }}
                            className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-400 rounded-lg border border-slate-100 transition-all cursor-pointer"
                            title="Delete Student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD STUDENT MODAL/SHEET (OVERLAY/POPUP) --- */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto transform scale-100 transition-all animate-fade-in">
            <div className="bg-emerald-gradient p-6 text-white flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-6 h-6" />
                <div>
                  <h3 className="font-display text-xl font-bold">Onboard New Tuitions Student</h3>
                  <p className="text-xs text-emerald-100/95 mt-1">Registers student data and auto-generates installment dues logs.</p>
                </div>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-emerald-100 hover:text-white p-1 hover:bg-white/10 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-8 space-y-6 text-slate-800">
              
              {/* Student & Academic Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">1. Student & Academic Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Student Full Name</label>
                    <input 
                      type="text" 
                      required 
                      value={formName} 
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Aarav Sharma"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Class Level</label>
                    <div className="relative" ref={addClassDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsAddClassDropdownOpen(!isAddClassDropdownOpen)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 text-sm font-semibold flex items-center justify-between cursor-pointer"
                      >
                        <span>{formGrade || "Select Class"}</span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                      
                      {isAddClassDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
                          {availableClasses.map((cl) => {
                            const isSelected = formGrade === cl;
                            return (
                              <button
                                key={cl}
                                type="button"
                                onClick={() => {
                                  setFormGrade(cl);
                                  setIsAddClassDropdownOpen(false);
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Assign Batch</label>
                    <div className="relative" ref={addBatchDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsAddBatchDropdownOpen(!isAddBatchDropdownOpen)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 text-sm font-semibold flex items-center justify-between cursor-pointer"
                      >
                        <span>
                          {batches.find(b => b.id === formBatchId) 
                            ? `${batches.find(b => b.id === formBatchId)?.name} (${batches.find(b => b.id === formBatchId)?.targetClass || "General"})`
                            : "Unassigned"}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                      
                      {isAddBatchDropdownOpen && (
                        <div className="absolute left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
                          <button
                            type="button"
                            onClick={() => {
                              setFormBatchId("unassigned");
                              setIsAddBatchDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                              formBatchId === "unassigned" || !formBatchId ? "text-emerald-600 bg-emerald-50/20" : "text-slate-700"
                            }`}
                          >
                            <span>Unassigned</span>
                            {(formBatchId === "unassigned" || !formBatchId) && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          </button>
                          {batches.filter((b) => {
                            const bTarget = b.targetClass || b.targetGrade;
                            if (!bTarget) return true;
                            return sanitizeGrade(bTarget) === sanitizeGrade(formGrade);
                          }).map((b) => {
                            const isSelected = formBatchId === b.id;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                  setFormBatchId(b.id);
                                  setIsAddBatchDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                  isSelected ? "text-emerald-600 bg-emerald-50/20" : "text-slate-700"
                                }`}
                              >
                                <span>{b.name} ({b.targetClass || "General"})</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">School Name</label>
                    <input 
                      type="text" 
                      required 
                      value={formSchoolName} 
                      onChange={(e) => setFormSchoolName(e.target.value)}
                      placeholder="e.g. St. Xavier's School"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Parents Communication Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">2. Parent & Contact Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Parent Name</label>
                    <input 
                      type="text" 
                      required 
                      value={formParentName} 
                      onChange={(e) => setFormParentName(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Parent WhatsApp Mobile</label>
                    <input 
                      type="text" 
                      required 
                      value={formParentMobile} 
                      onChange={(e) => setFormParentMobile(e.target.value)}
                      placeholder="e.g. +91 99112 23344"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Alternate Mobile</label>
                    <input 
                      type="text" 
                      value={formAlternateMobile} 
                      onChange={(e) => setFormAlternateMobile(e.target.value)}
                      placeholder="e.g. +91 99112 23345"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Fees & Billing Plans */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">3. Installment Structuring</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Total Term Fees (INR)</label>
                    <input 
                      type="number" 
                      required 
                      value={formFeesAmount} 
                      onChange={(e) => setFormFeesAmount(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Dues Installment Plans Choice</label>
                    <select 
                      value={formFeesPlan} 
                      onChange={(e) => setFormFeesPlan(e.target.value as any)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-bold text-emerald-800"
                    >
                      <option value="quarterly">Quarterly Plan (4 splits)</option>
                      <option value="half-yearly">Half-Yearly Plan (2 splits)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">Admission / Regist Date</label>
                    <input 
                      type="date" 
                      required 
                      value={formAdmissionDate} 
                      onChange={(e) => setFormAdmissionDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-all cursor-pointer text-center text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all hover:shadow-lg shadow-emerald-100 cursor-pointer text-center text-sm"
                >
                  Confirm Admission Onboarding
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- EDIT STUDENT MODAL (OVERLAY/POPUP) --- */}
      {isEditId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto transform scale-100 transition-all animate-fade-in">
            <div className="bg-emerald-gradient p-6 text-white flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 animate-pulse" />
                <div>
                  <h3 className="font-display text-xl font-bold">Modify Student Folder</h3>
                  <p className="text-xs text-emerald-100">Instantly recalculates outstanding fees if payment plan limits changed.</p>
                </div>
              </div>
              <button onClick={() => setIsEditId(null)} className="text-slate-100 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-8 space-y-6 text-slate-800">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Student Full Name</label>
                  <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Class Level</label>
                  <div className="relative" ref={editClassDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsEditClassDropdownOpen(!isEditClassDropdownOpen)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-semibold flex items-center justify-between cursor-pointer"
                    >
                      <span>{formGrade || "Select Class"}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                    
                    {isEditClassDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
                        {availableClasses.map((cl) => {
                          const isSelected = formGrade === cl;
                          return (
                            <button
                              key={cl}
                              type="button"
                              onClick={() => {
                                setFormGrade(cl);
                                setIsEditClassDropdownOpen(false);
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Assign Batch</label>
                  <div className="relative" ref={editBatchDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsEditBatchDropdownOpen(!isEditBatchDropdownOpen)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 text-sm font-semibold flex items-center justify-between cursor-pointer"
                    >
                      <span>
                        {batches.find(b => b.id === formBatchId) 
                          ? `${batches.find(b => b.id === formBatchId)?.name} (${batches.find(b => b.id === formBatchId)?.targetClass || "General"})`
                          : "Unassigned"}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                    
                    {isEditBatchDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto py-1 divide-y divide-slate-50">
                        <button
                          type="button"
                          onClick={() => {
                            setFormBatchId("unassigned");
                            setIsEditBatchDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            formBatchId === "unassigned" || !formBatchId ? "text-emerald-600 bg-emerald-50/20" : "text-slate-700"
                          }`}
                        >
                          <span>Unassigned</span>
                          {(formBatchId === "unassigned" || !formBatchId) && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                        {batches.filter((b) => {
                          const bTarget = b.targetClass || b.targetGrade;
                          if (!bTarget) return true;
                          return sanitizeGrade(bTarget) === sanitizeGrade(formGrade);
                        }).map((b) => {
                          const isSelected = formBatchId === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                  setFormBatchId(b.id);
                                  setIsEditBatchDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                isSelected ? "text-emerald-600 bg-emerald-50/20" : "text-slate-700"
                              }`}
                            >
                              <span>{b.name} ({b.targetClass || "General"})</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">School Name</label>
                  <input type="text" required value={formSchoolName} onChange={(e) => setFormSchoolName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Parent Name</label>
                  <input type="text" required value={formParentName} onChange={(e) => setFormParentName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Parent WhatsApp Mobile</label>
                  <input type="text" required value={formParentMobile} onChange={(e) => setFormParentMobile(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Alternate Mobile</label>
                  <input type="text" value={formAlternateMobile} onChange={(e) => setFormAlternateMobile(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Term Fees (INR)</label>
                  <input type="number" required value={formFeesAmount} onChange={(e) => setFormFeesAmount(Number(e.target.value))} className="w-full px-4 py-2 bg-slate-50 border rounded-xl text-slate-800 text-sm font-mono font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">Bill Split Installment Plan</label>
                  <select value={formFeesPlan} onChange={(e) => setFormFeesPlan(e.target.value as any)} className="w-full px-4 py-2 bg-slate-50 border rounded-xl text-slate-800 text-xs text-slate-700 font-bold">
                    <option value="quarterly">Quarterly Plan (4 splits)</option>
                    <option value="half-yearly">Half-Yearly Plan (2 splits)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => {
                    setDeleteConfirmId(isEditId);
                    setIsEditId(null);
                  }} 
                  className="px-4 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 py-3 rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  title="Delete Student"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button type="button" onClick={() => setIsEditId(null)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-sm text-slate-700 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 py-3 rounded-xl font-bold text-sm cursor-pointer shadow-md">Save Changes</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- DETAIL PROFILE VIEW DIALOG --- */}
      {isViewId && activeViewStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 w-full max-w-4xl max-h-[90vh] overflow-y-auto transform scale-100 transition-all animate-fade-in text-slate-800">
            
            <div className="bg-slate-900 text-white p-6 justify-between items-center flex sticky top-0 z-10 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 text-white p-2.5 rounded-xl text-xl">🎓</div>
                <div>
                  <h3 className="font-display text-xl font-bold">{activeViewStudent.name}</h3>
                  <p className="text-xs text-slate-400">Tuitions profile folder • ID Card ID: {activeViewStudent.id}</p>
                </div>
              </div>
              <button onClick={() => { setIsViewId(null); setActivePayingInstId(null); setPaymentAmount(""); }} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Column 1: Student Identity ID Card + Profile parameters */}
              <div className="space-y-6 lg:col-span-1">
                
                {/* Visual generated ID Card */}
                <div className="bg-emerald-gradient rounded-2xl p-5 text-white shadow-xl relative overflow-hidden flex flex-col justify-between h-72 border border-emerald-400">
                  <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-28 h-28 bg-white/10 rounded-full blur-xl"></div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-logo font-black text-sm tracking-widest text-emerald-100 uppercase">ClassSetu</h4>
                      <p className="text-[9px] uppercase tracking-wider text-emerald-200">Tuitions ID Card</p>
                    </div>
                    <span className="bg-white/20 text-white font-mono text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {activeViewStudent.status}
                    </span>
                  </div>

                  <div className="flex gap-3 items-center my-4">
                    <div className="w-12 h-12 bg-white text-emerald-800 rounded-xl font-black text-xl flex items-center justify-center border border-white/20 uppercase">
                      {activeViewStudent.name.charAt(0)}
                    </div>
                    <div>
                      <h5 className="font-bold text-base leading-tight">{activeViewStudent.name}</h5>
                      <p className="text-[11px] text-emerald-100 font-medium mt-0.5">{activeViewStudent.gradeLevel || activeViewStudent.grade}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3 flex justify-between items-end">
                    <div>
                      <p className="text-[8px] text-emerald-200 uppercase tracking-widest">ID Card ID</p>
                      <p className="font-mono text-xs font-bold leading-none mt-1">{activeViewStudent.id}</p>
                    </div>
                    <div className="bg-white p-1 rounded">
                      {/* Simulation vector barcode representation */}
                      <QrCode className="w-8 h-8 text-slate-800" />
                    </div>
                  </div>
                </div>

                {/* Profile detail list */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 text-xs">
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Academic parameters</h4>
                  <div>
                    <p className="text-slate-400">School details</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{activeViewStudent.schoolName}</p>
                    {activeViewStudent.schoolTiming && (
                      <p className="text-slate-500 italic mt-0.5">Hours: {activeViewStudent.schoolTiming}</p>
                    )}
                  </div>
                  {activeViewStudent.preferredTuitionTiming && (
                    <div>
                      <p className="text-slate-400">Preferred timing requirements</p>
                      <p className="font-semibold text-slate-700 mt-0.5">{activeViewStudent.preferredTuitionTiming}</p>
                      {activeViewStudent.reasonForPreferredTiming && (
                        <p className="text-slate-500 italic mt-0.5">"{activeViewStudent.reasonForPreferredTiming}"</p>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-slate-400">Registration details</p>
                    <p className="font-semibold text-slate-700 mt-0.5">Admission: {activeViewStudent.admissionDate}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Fees: ₹{(activeViewStudent.feesAmount ?? 0).toLocaleString()} ({(activeViewStudent.feesPlan || "quarterly").toUpperCase()})</p>
                  </div>
                </div>

                {/* Transfer / Release Section */}
                <div className="pt-2 pb-1 space-y-2">
                  <div className="bg-indigo-50/50 border border-indigo-100/60 rounded-2xl p-4 text-xs space-y-1.5">
                    <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <span>🔄</span> स्थानांतरण प्रणाली (Transfer System)
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      इस छात्र को अन्य संस्थान में स्थानांतरित करने के लिए केवल उनका <strong className="text-indigo-800">Unique Code</strong> ({activeViewStudent.id}) उनके साथ साझा करें। वे अपने डैशबोर्ड से अनुरोध (Transfer Request) भेजेंगे, जिसे आप अपने डैशबोर्ड पर स्वीकृत (Approve) कर सकते हैं।
                    </p>
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={() => {
                    setDeleteConfirmId(activeViewStudent.id);
                    setIsViewId(null);
                  }} 
                  className="w-full bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 py-3 rounded-2xl font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Trash2 className="w-4 h-4" /> Erase Student Folder (Delete)
                </button>

              </div>

              {/* Column 2 & 3: Fees installments Table & Attendance record feeds */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Block A: Fees Status cards */}
                <div className="border border-slate-100 rounded-2xl p-6 bg-white shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600" /> Fee Installments & Billing Splits
                    </h4>
                    <span className="text-xs bg-emerald-50 py-1 px-2.5 rounded-lg font-bold text-emerald-800 border border-emerald-100">
                      Plan: {(activeViewStudent.feesPlan || "quarterly").toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeViewInstallments.map((inst) => {
                      const isPaid = inst.status === "Paid";
                      const isPartial = inst.status === "Partially Paid";
                      const isUnpaid = inst.status === "Unpaid";
                      const outstanding = inst.amount - inst.paidAmount;
                      const pct = Math.round((inst.paidAmount / inst.amount) * 100);

                      return (
                        <div key={inst.id} className={`p-4 rounded-2xl border transition-all ${
                          isPaid ? "bg-emerald-50/30 border-emerald-100" :
                          isPartial ? "bg-amber-50/30 border-amber-100" : "bg-slate-50 border-slate-200"
                        }`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Installment #{inst.installmentNumber}</span>
                              <span className="text-base font-extrabold text-slate-800 font-mono">₹{(inst.amount ?? 0).toLocaleString()}</span>
                            </div>
                            <span className={`py-0.5 px-2.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              isPaid ? "bg-emerald-100 text-emerald-805 text-emerald-850" :
                              isPartial ? "bg-amber-100 text-amber-855 text-amber-850" : "bg-slate-200 text-slate-600"
                            }`}>
                              {inst.status}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-3">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${isPaid ? "bg-emerald-500" : isPartial ? "bg-amber-500" : "bg-slate-400"}`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>

                          <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-4">
                            <span>Paid: <strong className="text-slate-800">₹{(inst.paidAmount ?? 0).toLocaleString()}</strong></span>
                            <span>Due: <strong className="text-rose-600">₹{(outstanding ?? 0).toLocaleString()}</strong></span>
                          </div>

                          <div className="border-t border-dashed border-slate-200 pt-3 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center text-xs">
                            <span className="text-[11px] font-medium text-slate-400">Due: {inst.dueDate}</span>
                            
                            <div className="w-full sm:w-auto">
                              {!isPaid ? (
                                activePayingInstId === inst.id ? (
                                  <div className="flex flex-col gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-sm mt-1">
                                    <div className="flex items-center gap-1.5">
                                      <input 
                                        type="number"
                                        placeholder="Amount"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="w-18 px-2 py-1 bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg font-mono font-bold"
                                      />
                                      <select 
                                        id={`pay-mode-profile-${inst.id}`}
                                        className="text-[10px] p-1 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg focus:outline-none"
                                      >
                                        <option value="Cash">Cash</option>
                                        <option value="Bank/Online">Bank/Online</option>
                                      </select>
                                    </div>
                                    <div className="flex gap-1.5 justify-end">
                                      <button 
                                        onClick={async () => {
                                          if (isSubscribed === false) {
                                            onSubscriptionBlocked?.();
                                            return;
                                          }
                                          const selectEl = document.getElementById(`pay-mode-profile-${inst.id}`) as HTMLSelectElement;
                                          const mode = selectEl?.value || "Cash";
                                          const amt = Number(paymentAmount);
                                          if (isNaN(amt) || amt <= 0) return;
                                          await onPayInstallment(inst.id, amt); 
                                          localStorage.setItem(`paymode-${inst.id}`, mode);
                                          setActivePayingInstId(null);
                                          setPaymentAmount("");
                                        }} 
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-1 rounded-lg px-2.5 text-[10px]"
                                      >
                                        ✓ Save
                                      </button>
                                      <button onClick={() => setActivePayingInstId(null)} className="text-slate-400 font-bold p-1 rounded-lg px-2 hover:bg-slate-100 text-[10px]">✕</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => { setActivePayingInstId(inst.id); setPaymentAmount(outstanding.toString()); }}
                                    className="p-1 px-3 bg-slate-900 border border-slate-800 text-white font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer text-[11px]"
                                  >
                                    Log Pay
                                  </button>
                                )
                              ) : (
                                <div className="text-right">
                                  <span className="text-emerald-700 font-bold text-[10px] block">
                                    {(localStorage.getItem(`paymode-${inst.id}`) || "Cash") === "Cash" ? "💵 Cash" : "📱 Bank/Online"}
                                  </span>
                                  <span className="text-slate-400 font-semibold text-[9px] block">Cleared {inst.paymentDate}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Block B: Attendance calendar feeds */}
                <div className="border border-slate-100 rounded-2xl p-6 bg-white shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-50 pb-3">
                    <h4 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-emerald-600" /> Attendance logs audit trail
                    </h4>
                    <button
                      type="button"
                      onClick={handleExportAttendanceCSV}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-100 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-650" /> Export to Excel
                    </button>
                  </div>

                  {activeViewAttendance.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 italic">No attendance marked yet for this tuition student.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {activeViewAttendance.map((rec, idx) => {
                        const isPresent = rec.status === "Present";
                        const isLeave = rec.status === "Leave";
                        return (
                          <div key={`${rec.date}-${idx}`} className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                            isPresent 
                              ? "bg-emerald-50/50 text-emerald-800 border-emerald-100" 
                              : isLeave
                              ? "bg-amber-50/50 text-amber-800 border-amber-100"
                              : "bg-rose-50 text-rose-800 border-rose-100"
                          }`}>
                            <span className="font-mono">{rec.date}</span>
                            <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                              isPresent ? "bg-emerald-200 text-emerald-800" : isLeave ? "bg-amber-200 text-amber-850" : "bg-rose-200 text-rose-800"
                            }`}>{rec.status}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
            
          </div>
        </div>
      )}

      {deleteConfirmId && (() => {
        const studentToDelete = students.find(s => s.id === deleteConfirmId);
        if (!studentToDelete) return null;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-rose-100 w-full max-w-md overflow-hidden transform scale-100 transition-all animate-fade-in text-center p-6 space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-600 animate-bounce" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-800">Erase Student Folder?</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Are you absolutely sure you want to completely erase the student folder for <strong className="text-slate-800">{studentToDelete.name}</strong>?
                </p>
                <div className="text-rose-600 text-[11px] bg-rose-50/75 p-3 rounded-xl mt-3 font-semibold space-y-1 text-left border border-rose-100">
                  <p>• Student record will be deleted from active lists.</p>
                  <p>• All pending and cleared installments will be permanently erased.</p>
                  <p>• This action is irreversible and deletes live data in Cloud Firestore.</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setDeleteConfirmId(null)} 
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
                    await onDeleteStudent(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }} 
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs cursor-pointer hover:bg-rose-700 transition-all shadow-md shadow-rose-200"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Secure Student Transfer Handshake Preview Dialog */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-indigo-100 w-full max-w-lg overflow-hidden transform scale-100 transition-all animate-fade-in flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                <h3 className="font-display font-bold text-lg">Secure Student Transfer Protocol</h3>
              </div>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="text-white/80 hover:text-white p-1 bg-white/10 hover:bg-white/25 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-4">
              {transferSubmitSuccess ? (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-850 p-6 rounded-2xl text-center space-y-3 animate-fade-in">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-base">Transfer Confirmed!</h4>
                  <p className="text-xs leading-relaxed">{transferSubmitSuccess}</p>
                </div>
              ) : !transferPreviewStudent ? (
                /* Form for Unique Code */
                <form onSubmit={handleFetchTransferPreview} className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    विद्यार्थी का Unique Admission Code दर्ज़ करें। यदि वह पूर्व अकैडमिक सेशन का आर्काइव्ड (Deleted) छात्र है, तो बिना PIN के सीधे ट्रांसफर हो जाएगा। सक्रिय (Active) छात्रों के लिए स्थानांतरण अनुरोध (Transfer Request) भेजा जाएगा।
                  </p>
                  
                  {transferPreviewError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-750 p-3.5 rounded-xl text-xs font-semibold">
                      {transferPreviewError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-650 mb-1">Student Unique Code *</label>
                      <input
                        type="text"
                        value={transferCode}
                        onChange={(e) => setTransferCode(e.target.value.toUpperCase())}
                        placeholder="e.g. STD-XXXXXX"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none uppercase font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={transferPreviewLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-md hover:shadow-indigo-100"
                  >
                    {transferPreviewLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Credentials...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" /> Fetch &amp; Preview Student Profile
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Read-Only Preview Screen */
                <div className="space-y-5 animate-fade-in">
                  {transferPreviewStudent.isNoPinTransfer && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                      <div className="p-1 bg-amber-100 text-amber-800 rounded-lg shrink-0 text-sm">⚠️</div>
                      <div className="text-xs text-amber-850 space-y-1">
                        <p className="font-bold">सत्र अंत (Master Reset) अभिलेख पाया गया</p>
                        <p className="leading-relaxed">यह छात्र वर्तमान में आर्काइव्ड / सॉफ्ट-डिलीटेड है। हाइब्रिड नियमों के तहत, बिना किसी PIN या OTP के इसे सीधे नए अकैडमिक बैच में पुनः नामांकित किया जा सकता है।</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/40">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center font-display text-lg font-bold shadow-md">
                      {transferPreviewStudent.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "ST"}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-slate-800 text-base">{transferPreviewStudent.name}</h4>
                      <p className="text-[11px] font-mono text-slate-500 font-semibold">{transferPreviewStudent.id}</p>
                    </div>
                    <span className="ml-auto bg-indigo-100 text-indigo-850 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-150">
                      {transferPreviewStudent.grade || "Grade 10"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Parent Details</p>
                      <p className="font-bold text-slate-700">{transferPreviewStudent.parentName}</p>
                      <p className="text-slate-500">{transferPreviewStudent.parentMobile}</p>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Academic Fees Plan</p>
                      <p className="font-bold text-slate-700">₹{(transferPreviewStudent.feesAmount ?? 0).toLocaleString()}</p>
                      <p className="text-slate-500 font-semibold uppercase">{transferPreviewStudent.feesPlan || "quarterly"}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <p className="text-slate-500 font-semibold text-xs flex items-center gap-1.5 border-b pb-1.5">
                      📊 Historical Academic &amp; Attendance Records
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Attendance</p>
                        <p className="text-lg font-extrabold text-emerald-600 mt-0.5">88%</p>
                        <span className="text-[9px] text-slate-400 block font-medium">Regular Status</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Math Mark</p>
                        <p className="text-lg font-extrabold text-indigo-650 mt-0.5">85<span className="text-xs text-slate-400 font-normal">/100</span></p>
                        <span className="text-[9px] text-slate-400 block font-medium">Grade A</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Sci Mark</p>
                        <p className="text-lg font-extrabold text-indigo-650 mt-0.5">90<span className="text-xs text-slate-400 font-normal">/100</span></p>
                        <span className="text-[9px] text-slate-400 block font-medium">Grade A+</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 leading-relaxed italic bg-indigo-50/30 p-2.5 rounded-xl text-center">
                      ℹ️ Preview is locked. Full historic installments and attendance sheets will download after confirmation.
                    </div>
                  </div>

                  {transferPreviewStudent.isNoPinTransfer && (
                    <label className="flex items-start gap-2.5 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-150 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] font-medium text-slate-700 leading-relaxed">
                        I confirm that the parent is present and consents to this transfer. (मैं पुष्टि करता/करती हूँ कि अभिभावक उपस्थित हैं और इस स्थानांतरण के लिए सहमत हैं।)
                      </span>
                    </label>
                  )}

                  {transferPreviewError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-750 p-3 rounded-xl text-xs font-semibold">
                      {transferPreviewError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferPreviewStudent(null);
                        setConsentChecked(false);
                      }}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
                    >
                      Cancel / Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmTransfer}
                      disabled={transferPreviewLoading || (transferPreviewStudent.isNoPinTransfer && !consentChecked)}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:shadow-indigo-100 disabled:cursor-not-allowed"
                    >
                      {transferPreviewLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing...
                        </>
                      ) : transferPreviewStudent.isRequestTransfer ? (
                        <>
                          <Send className="w-3.5 h-3.5" /> Submit Transfer Request
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" /> Confirm &amp; Accept Transfer
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
