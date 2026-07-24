import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Layers, 
  CalendarCheck, 
  CircleDollarSign, 
  Settings, 
  MessageSquareCode, 
  TrendingUp, 
  LogOut,
  Sparkles,
  Menu,
  X,
  MoreVertical,
  AlertTriangle
} from "lucide-react";
import { Student, Batch, FeeInstallment, AttendanceRecord, Notice, NotificationLog, InstituteSettings, Teacher, TransferRequest } from "./types";
import AuthPage from "./components/AuthPage";
import DashboardView from "./components/DashboardView";
import StudentManagerView from "./components/StudentManagerView";
import AIBatchSchedulerView from "./components/AIBatchSchedulerView";
import BatchAttendanceView from "./components/BatchAttendanceView";
import FeesManagerView from "./components/FeesManagerView";
import WhatsAppCenterView from "./components/WhatsAppCenterView";
import ReportsSettingsView from "./components/ReportsSettingsView";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { formatGrade, getInstallmentDueDates } from "./utils";

export default function App() {
  // Subscription states
  const [isSubscribed, setIsSubscribed] = useState<boolean>(true);
  const [subscriptionAlert, setSubscriptionAlert] = useState<string | null>(null);
  const [instituteData, setInstituteData] = useState<{
    isWhatsAppEnabled?: boolean;
    isSmsEnabled?: boolean;
    whatsappLimit?: number;
    whatsappSent?: number;
    whatsappLeft?: number;
    smsLimit?: number;
    smsSent?: number;
    smsLeft?: number;
  } | null>(null);

  // Authentication states
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem("cl_token"));
  const [adminUser, setAdminUser] = useState<{ email: string; name: string } | null>(() => {
    const saved = localStorage.getItem("cl_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Global entities state
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [installments, setInstallments] = useState<FeeInstallment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [settings, setSettings] = useState<InstituteSettings>({
    name: "ClassSetu Premium Coaching",
    logo: "🎓",
    address: "",
    contact: ""
  });

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [autoOpenAddStudent, setAutoOpenAddStudent] = useState(false);

  // Background scroll lock effect when modal or overlay is open
  useEffect(() => {
    if (showLogoutConfirm || menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showLogoutConfirm, menuOpen]);

  // Load Firestore states if authenticated
  const loadWorkspaceStateForUser = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      let userData: any = null;

      if (docSnap.exists()) {
        userData = docSnap.data();
      } else {
        // Fallback or seed default values
        const legacyRef = doc(db, "institutes", uid);
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          const legacyData = legacySnap.data();
          userData = {
            email: auth.currentUser?.email || "adzentive@gmail.com",
            institute: {
              instituteName: legacyData.settings?.name || "ClassSetu Premium Coaching"
            },
            batches: legacyData.batches || [],
            installments: legacyData.installments || [],
            attendance: legacyData.attendance || [],
            notices: legacyData.notices || [],
            logs: legacyData.logs || []
          };
          await setDoc(docRef, userData);
        } else {
          userData = {
            email: auth.currentUser?.email || "adzentive@gmail.com",
            institute: {
              instituteName: "ClassSetu Premium Coaching"
            },
            batches: [],
            installments: [],
            attendance: [],
            notices: [],
            logs: []
          };
          await setDoc(docRef, userData);
        }
      }

      // Map Dynamic Values
      const instName = userData.institute?.instituteName || "ClassSetu Premium Coaching";
      const userEmail = userData.email || auth.currentUser?.email || "";

      setSettings({
        name: instName,
        logo: "🎓",
        address: userData.address || "",
        contact: userData.contact || ""
      });

      setAdminUser({
        email: userEmail,
        name: instName.split(" ")[0] || "Admin"
      });

      setBatches(userData.batches || []);
      setInstallments(userData.installments || []);
      setAttendance(userData.attendance || []);
      setNotices(userData.notices || []);
      setLogs(userData.logs || []);

      // Real-time live synchronization of attendance records from "attendance" collection
      try {
        const attendanceQuery = query(collection(db, "attendance"), where("instituteId", "==", uid));
        onSnapshot(attendanceQuery, (snapshot) => {
          const fetchedAttendance: AttendanceRecord[] = [];
          snapshot.docs.forEach((docItem) => {
            const data = docItem.data();
            const date = data.date || "";
            if (!date) return;
            
            if (Array.isArray(data.records)) {
              data.records.forEach((r: any) => {
                if (r && typeof r === "object" && r.studentId) {
                  fetchedAttendance.push({
                    date,
                    studentId: r.studentId,
                    status: r.status === "Absent" ? "Absent" : (r.status === "Leave" || r.status === "L" ? "Leave" : "Present")
                  });
                }
              });
            } else if (data.records && typeof data.records === "object") {
              Object.entries(data.records).forEach(([key, val]: [string, any]) => {
                if (val && typeof val === "object") {
                  fetchedAttendance.push({
                    date,
                    studentId: val.studentId || key,
                    status: val.status === "Absent" ? "Absent" : (val.status === "Leave" ? "Leave" : "Present")
                  });
                } else {
                  fetchedAttendance.push({
                    date,
                    studentId: key,
                    status: val === "Absent" ? "Absent" : (val === "Leave" || val === "L" ? "Leave" : "Present")
                  });
                }
              });
            }
          });
          setAttendance(fetchedAttendance);
        });
      } catch (attendanceErr) {
        console.error("Error setting up real-time attendance collection listener:", attendanceErr);
      }

      // Load Students dynamically from "students" collection where instituteId = uid
      const studentsQuery = query(collection(db, "students"), where("instituteId", "==", uid));
      const querySnap = await getDocs(studentsQuery);
      const studentRecords: Student[] = [];
      querySnap.forEach((stSnap) => {
        const studentData = stSnap.data();
        if (studentData.deleted_status !== 1) {
          studentRecords.push(studentData as Student);
        }
      });
      setStudents(studentRecords);

      // Load active registered teachers
      try {
        const teachersQuery = query(collection(db, "teachers"));
        const teachersSnap = await getDocs(teachersQuery);
        const currentUserEmail = auth.currentUser?.email || "";
        const teacherRecords: Teacher[] = [];
        teachersSnap.forEach((tSnap) => {
          const data = tSnap.data();
          const createdBy = data.createdByAdminEmail;
          
          // Secure filter mapping:
          // 1. If it has the new field, match it strictly against current admin email
          // 2. Fallback for old teachers: if no admin email is set yet, allow it (legacy fallback)
          if (createdBy && createdBy !== currentUserEmail) {
            return;
          }
          
          teacherRecords.push({
            id: tSnap.id,
            name: data.name || "",
            email: data.email || "",
            role: data.role || "teacher",
            createdAt: data.createdAt || "",
            createdByAdminEmail: createdBy || ""
          });
        });
        setTeachers(teacherRecords);
      } catch (teacherErr) {
        console.error("Error loading teachers:", teacherErr);
      }

      // Live synchronization of incoming transfer requests where from_institute_id == uid
      try {
        const incomingRequestsQuery = query(
          collection(db, "transfer_requests"),
          where("from_institute_id", "==", uid)
        );
        onSnapshot(incomingRequestsQuery, (snapshot) => {
          const reqs: TransferRequest[] = [];
          snapshot.docs.forEach((d) => {
            const data = d.data();
            reqs.push({
              id: d.id,
              student_code: data.student_code || "",
              student_name: data.student_name || "",
              student_phone: data.student_phone || "",
              from_institute_id: data.from_institute_id || "",
              to_institute_id: data.to_institute_id || "",
              request_status: data.request_status || "PENDING",
              created_at: data.created_at
            } as TransferRequest);
          });
          setTransferRequests(reqs);
        });
      } catch (err) {
        console.error("Error listening to transfer requests:", err);
      }

    } catch (err) {
      console.error("Firestore DB read/load error:", err);
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    }
  };

  useEffect(() => {
    let unsubscribeInstitute: (() => void) | null = null;
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setAuthToken("fb-token-" + user.uid);
        const adminObj = {
          email: user.email || "",
          name: user.email?.split("@")[0] || "Institute Admin"
        };
        setAdminUser(adminObj);
        localStorage.setItem("cl_token", "fb-token-" + user.uid);
        localStorage.setItem("cl_user", JSON.stringify(adminObj));
        loadWorkspaceStateForUser(user.uid);

        // REAL-TIME CHECK: onSnapshot listener on /institutes/{instituteId}
        const instRef = doc(db, "institutes", user.uid);
        unsubscribeInstitute = onSnapshot(instRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Jaise hi status isSubscribed false ho, naya operations block ho jana chahiye
            const subStatus = data.isSubscribed !== false && data.status !== "expired" && data.status !== "inactive" && data.status !== "EXPIRED";
            setIsSubscribed(subStatus);
            setInstituteData({
              isWhatsAppEnabled: data.isWhatsAppEnabled ?? false,
              isSmsEnabled: data.isSmsEnabled ?? false,
              whatsappLimit: Number(data.whatsappLimit ?? 0),
              whatsappSent: Number(data.whatsappSent ?? 0),
              whatsappLeft: Number(data.whatsappLeft ?? 0),
              smsLimit: Number(data.smsLimit ?? 0),
              smsSent: Number(data.smsSent ?? 0),
              smsLeft: Number(data.smsLeft ?? 0)
            });
          } else {
            setIsSubscribed(true);
            setInstituteData(null);
          }
        }, (error) => {
          console.error("Error listening to institute status:", error);
        });

      } else {
        setAuthToken(null);
        setAdminUser(null);
        setIsSubscribed(true);
        localStorage.removeItem("cl_token");
        localStorage.removeItem("cl_user");
        if (unsubscribeInstitute) {
          unsubscribeInstitute();
          unsubscribeInstitute = null;
        }
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeInstitute) {
        unsubscribeInstitute();
      }
    };
  }, []);

  // Auth Handlers
  const handleLoginSuccess = (token: string, user: { email: string; name: string }) => {
    setAuthToken(token);
    setAdminUser(user);
    setActiveTab("dashboard");
    if (auth.currentUser) {
      loadWorkspaceStateForUser(auth.currentUser.uid);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  // Student Admissions action handlers
  const handleRefreshStudents = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const studentsQuery = query(collection(db, "students"), where("instituteId", "==", user.uid));
      const querySnap = await getDocs(studentsQuery);
      const studentRecords: Student[] = [];
      querySnap.forEach((stSnap) => {
        const studentData = stSnap.data();
        if (studentData.deleted_status !== 1) {
          studentRecords.push(studentData as Student);
        }
      });
      setStudents(studentRecords);
    } catch (err) {
      console.error("Error refreshing students after bulk import:", err);
    }
  };

  const handleAddStudent = async (stdData: Partial<Student>) => {
    const user = auth.currentUser;
    if (!user) return;
    
    // Generate standard student ID per requirements
    const newId = stdData.id || ("STD-" + Math.random().toString(36).substr(2, 6).toUpperCase());
    const newStudent: Student = {
      id: newId,
      name: stdData.name || "Unnamed Student",
      parentName: stdData.parentName || "",
      parentMobile: stdData.parentMobile || "",
      alternateMobile: stdData.alternateMobile || "",
      grade: formatGrade(stdData.gradeLevel || stdData.grade),
      gradeLevel: formatGrade(stdData.gradeLevel || stdData.grade),
      schoolName: stdData.schoolName || "",
      schoolTiming: "",
      preferredTuitionTiming: "",
      reasonForPreferredTiming: "",
      subjects: [],
      admissionDate: stdData.admissionDate || new Date().toISOString().split("T")[0],
      feesAmount: Number(stdData.totalFees) || Number(stdData.feesAmount) || 0,
      totalFees: Number(stdData.totalFees) || Number(stdData.feesAmount) || 0,
      feesPlan: stdData.feesPlan === "half-yearly" ? "half-yearly" : "quarterly",
      batchId: stdData.batchId === "unassigned" ? "" : (stdData.batchId || ""),
      status: "active"
    };

    // Calculate installments automatically
    const totalFees = newStudent.totalFees || newStudent.feesAmount;
    const isQuarterly = newStudent.feesPlan === "quarterly";
    const numInstallments = isQuarterly ? 4 : 2;
    const installmentAmount = Math.round(totalFees / numInstallments);

    const dueDates = getInstallmentDueDates(newStudent.admissionDate, newStudent.feesPlan);
    const newInstallments: FeeInstallment[] = [];
    for (let i = 1; i <= numInstallments; i++) {
      const dueDateStr = dueDates[i - 1] || newStudent.admissionDate;
      
      newInstallments.push({
        id: `INST-${newStudent.id}-${i}`,
        studentId: newStudent.id,
        installmentNumber: i,
        amount: installmentAmount,
        dueDate: dueDateStr,
        status: "Unpaid",
        paidAmount: 0 // local schema mapping compatibility
      });
    }

    const updatedStudents = [...students, newStudent];
    const updatedInstallments = [...installments, ...newInstallments];

    setStudents(updatedStudents);
    setInstallments(updatedInstallments);

    try {
      await setDoc(doc(db, "students", newStudent.id), {
        id: newStudent.id,
        name: newStudent.name,
        gradeLevel: newStudent.gradeLevel,
        parentName: newStudent.parentName,
        parentMobile: newStudent.parentMobile,
        alternateMobile: newStudent.alternateMobile,
        schoolName: newStudent.schoolName,
        totalFees: newStudent.totalFees,
        batchId: newStudent.batchId,
        instituteId: user.uid,
        institute_id: user.uid,
        deleted_status: 0,
        status: "active",
        createdAt: serverTimestamp()
      });

      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        installments: updatedInstallments
      });
    } catch (err) {
      console.error("Failed to add student to Firestore:", err);
      handleFirestoreError(err, OperationType.CREATE, `students/${newStudent.id}`);
    }
  };

  const handleUpdateStudent = async (id: string, stdData: Partial<Student>) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const currentData = docSnap.data();
      let currentInstallments: FeeInstallment[] = currentData.installments || [];

      const index = students.findIndex((s) => s.id === id);
      if (index === -1) return;

      const prevStudent = students[index];
      const prevPlan = prevStudent.feesPlan;
      const prevFeesAmount = prevStudent.feesAmount;

      const updatedStudent: Student = {
        ...prevStudent,
        name: stdData.name !== undefined ? stdData.name : prevStudent.name,
        parentName: stdData.parentName !== undefined ? stdData.parentName : prevStudent.parentName,
        parentMobile: stdData.parentMobile !== undefined ? stdData.parentMobile : prevStudent.parentMobile,
        alternateMobile: stdData.alternateMobile !== undefined ? stdData.alternateMobile : prevStudent.alternateMobile,
        grade: stdData.grade !== undefined ? formatGrade(stdData.grade) : formatGrade(prevStudent.grade),
        gradeLevel: stdData.gradeLevel !== undefined ? formatGrade(stdData.gradeLevel) : (prevStudent.gradeLevel ? formatGrade(prevStudent.gradeLevel) : formatGrade(stdData.grade)),
        schoolName: stdData.schoolName !== undefined ? stdData.schoolName : prevStudent.schoolName,
        schoolTiming: stdData.schoolTiming !== undefined ? stdData.schoolTiming : prevStudent.schoolTiming,
        preferredTuitionTiming: stdData.preferredTuitionTiming !== undefined ? stdData.preferredTuitionTiming : prevStudent.preferredTuitionTiming,
        reasonForPreferredTiming: stdData.reasonForPreferredTiming !== undefined ? stdData.reasonForPreferredTiming : prevStudent.reasonForPreferredTiming,
        subjects: Array.isArray(stdData.subjects) ? stdData.subjects : prevStudent.subjects,
        admissionDate: stdData.admissionDate !== undefined ? stdData.admissionDate : prevStudent.admissionDate,
        feesAmount: stdData.feesAmount !== undefined ? Number(stdData.feesAmount) : prevStudent.feesAmount,
        feesPlan: stdData.feesPlan !== undefined ? stdData.feesPlan : prevStudent.feesPlan,
        batchId: stdData.batchId !== undefined ? stdData.batchId : prevStudent.batchId,
        status: stdData.status !== undefined ? stdData.status : prevStudent.status
      };

      const updatedStudents = [...students];
      updatedStudents[index] = updatedStudent;

      // Recalculate remaining installments if core fees plan or amount scales
      if (prevPlan !== updatedStudent.feesPlan || prevFeesAmount !== updatedStudent.feesAmount) {
        currentInstallments = currentInstallments.filter((inst) => !(inst.studentId === id && inst.status === "Unpaid"));
        const paidInstallments = currentInstallments.filter((inst) => inst.studentId === id && inst.status !== "Unpaid");
        const paidTotal = paidInstallments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
        const remainingFees = Math.max(0, updatedStudent.feesAmount - paidTotal);

        const isQuarterly = updatedStudent.feesPlan === "quarterly";
        const totalNum = isQuarterly ? 4 : 2;
        const outstandingNum = totalNum - paidInstallments.length;

        if (outstandingNum > 0) {
          const remainingAmount = Math.round(remainingFees / outstandingNum);
          const dueDates = getInstallmentDueDates(updatedStudent.admissionDate, updatedStudent.feesPlan);

          for (let i = paidInstallments.length + 1; i <= totalNum; i++) {
            const dueDateStr = dueDates[i - 1] || updatedStudent.admissionDate;

            currentInstallments.push({
              id: `INST-${updatedStudent.id}-${i}`,
              studentId: updatedStudent.id,
              installmentNumber: i,
              amount: remainingAmount,
              dueDate: dueDateStr,
              status: "Unpaid",
              paidAmount: 0
            });
          }
        }
      }

      setStudents(updatedStudents);
      setInstallments(currentInstallments);

      // Save student doc in the "students" collection
      if (prevStudent.batchId !== updatedStudent.batchId) {
        // Specifically update ONLY the single 'batchId' field to satisfy strict sync re-assignment criteria
        await updateDoc(doc(db, "students", id), {
          batchId: updatedStudent.batchId
        });
        
        // Save remaining fields with merge: true
        const { batchId, ...otherFields } = updatedStudent;
        await setDoc(doc(db, "students", id), {
          ...otherFields,
          instituteId: user.uid,
          institute_id: user.uid,
          deleted_status: updatedStudent.deleted_status !== undefined ? updatedStudent.deleted_status : 0
        }, { merge: true });
      } else {
        await setDoc(doc(db, "students", id), {
          ...updatedStudent,
          instituteId: user.uid,
          institute_id: user.uid,
          deleted_status: updatedStudent.deleted_status !== undefined ? updatedStudent.deleted_status : 0
        });
      }

      // Save installments inside the user's document in the "users" collection
      await updateDoc(docRef, {
        installments: currentInstallments
      });
    } catch (err) {
      console.error("Failed to update student in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `students/${id}`);
    }
  };

  const handleApproveTransferRequest = async (request: TransferRequest) => {
    try {
      // 1. Update the student document's instituteId to the requesting (to) institute
      const studentRef = doc(db, "students", request.student_code);
      await updateDoc(studentRef, {
        instituteId: request.to_institute_id,
        institute_id: request.to_institute_id,
        deleted_status: 0,
        status: "ACTIVE"
      });

      // 2. Update the transfer request status to 'APPROVED'
      const requestRef = doc(db, "transfer_requests", request.id);
      await updateDoc(requestRef, {
        request_status: "APPROVED",
        resolved_at: serverTimestamp()
      });

      // 3. Remove the student from local state list (since they no longer belong to this institute)
      setStudents((prev) => prev.filter((s) => s.id !== request.student_code));

      alert(`Transfer request for student ${request.student_name} approved successfully.`);
    } catch (err) {
      console.error("Failed to approve transfer request:", err);
      alert("Failed to approve transfer request. Please try again.");
    }
  };

  const handleRejectTransferRequest = async (request: TransferRequest) => {
    try {
      // Update the transfer request status to 'REJECTED'
      const requestRef = doc(db, "transfer_requests", request.id);
      await updateDoc(requestRef, {
        request_status: "REJECTED",
        resolved_at: serverTimestamp()
      });

      alert(`Transfer request for student ${request.student_name} rejected.`);
    } catch (err) {
      console.error("Failed to reject transfer request:", err);
      alert("Failed to reject transfer request. Please try again.");
    }
  };

  const handleDeleteStudent = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const currentData = docSnap.data();
      const updatedInstallments = (currentData.installments || []).filter((inst: FeeInstallment) => inst.studentId !== id);
      const updatedAttendance = (currentData.attendance || []).filter((att: AttendanceRecord) => att.studentId !== id);

      const updatedStudents = students.filter((s) => s.id !== id);

      setStudents(updatedStudents);
      setInstallments(updatedInstallments);
      setAttendance(updatedAttendance);

      // delete student from the "students" collection
      await deleteDoc(doc(db, "students", id));

      await updateDoc(docRef, {
        installments: updatedInstallments,
        attendance: updatedAttendance
      });
    } catch (err) {
      console.error("Failed to delete student from Firestore:", err);
      handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
    }
  };

  // Batches CRUD
  const handleAddBatch = async (batchData: Partial<Batch>) => {
    const user = auth.currentUser;
    if (!user) return;

    const newBatch: Batch = {
      id: `BTCH-${Math.floor(100 + Math.random() * 900)}`,
      name: batchData.name || "New Tuition Batch",
      startTime: batchData.startTime || "03:00 PM",
      endTime: batchData.endTime || "04:30 PM",
      capacity: Number(batchData.capacity) || 15,
      days: Array.isArray(batchData.days) ? batchData.days : ["Mon", "Wed", "Fri"],
      assignedTeacherIds: Array.isArray(batchData.assignedTeacherIds) ? batchData.assignedTeacherIds : [],
      targetClass: batchData.targetClass || ""
    };

    const updatedBatches = [...batches, newBatch];
    setBatches(updatedBatches);

    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, { batches: updatedBatches });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpdateBatch = async (id: string, batchData: Partial<Batch>) => {
    const user = auth.currentUser;
    if (!user) return;

    const updatedBatches = batches.map((b) => {
      if (b.id === id) {
        return {
          ...b,
          name: batchData.name !== undefined ? batchData.name : b.name,
          startTime: batchData.startTime !== undefined ? batchData.startTime : b.startTime,
          endTime: batchData.endTime !== undefined ? batchData.endTime : b.endTime,
          capacity: batchData.capacity !== undefined ? Number(batchData.capacity) : b.capacity,
          days: Array.isArray(batchData.days) ? batchData.days : b.days,
          assignedTeacherIds: batchData.assignedTeacherIds !== undefined ? batchData.assignedTeacherIds : b.assignedTeacherIds,
          targetClass: batchData.targetClass !== undefined ? batchData.targetClass : b.targetClass
        };
      }
      return b;
    });

    setBatches(updatedBatches);

    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, { batches: updatedBatches });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const updatedBatches = batches.filter((b) => b.id !== id);
    const updatedStudents = students.map((s) => s.batchId === id ? { ...s, batchId: null } : s);

    setBatches(updatedBatches);
    setStudents(updatedStudents);

    try {
      // Clear batchId for affected students in students collection
      const affected = students.filter(s => s.batchId === id);
      for (const s of affected) {
        await updateDoc(doc(db, "students", s.id), { batchId: null });
      }

      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        batches: updatedBatches
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Attendance registries marking
  const handleMarkAttendance = async (date: string, records: { [studentId: string]: "Present" | "Absent" }) => {
    if (isSubscribed === false) {
      setSubscriptionAlert("Subscription Expired. Please renew to add or modify data.");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const currentData = docSnap.data();
      const currentAttendance: AttendanceRecord[] = currentData.attendance || [];
      const currentLogs: NotificationLog[] = currentData.logs || [];

      Object.entries(records).forEach(([studentId, status]) => {
        const existingIdx = currentAttendance.findIndex((a) => a.date === date && a.studentId === studentId);
        if (existingIdx !== -1) {
          currentAttendance[existingIdx].status = status as "Present" | "Absent";
        } else {
          currentAttendance.push({
            date,
            studentId,
            status: status as "Present" | "Absent"
          });
        }

        if (status === "Absent") {
          const student = students.find((s) => s.id === studentId);
          if (student && student.parentMobile) {
            const alertId = `LOG-${Math.floor(1000 + Math.random() * 9000)}`;
            const alertText = `Absence Alert: Dear Parent, your child ${student.name} was marked ABSENT today (${date}) at ${settings.name || "Alpha Excellence Coaching"} classes. Please respond with reason.`;
            currentLogs.push({
              id: alertId,
              studentId: student.id,
              type: "absent_alert",
              recipientMobile: student.parentMobile,
              text: alertText,
              sentAt: new Date().toISOString(),
              status: "Sent"
            });
          }
        }
      });

      setAttendance([...currentAttendance]);
      setLogs([...currentLogs]);

      await updateDoc(docRef, {
        attendance: currentAttendance,
        logs: currentLogs
      });

      // Seamlessly trigger backend API route to process background loops and template dispatches
      try {
        await fetch("/api/attendance/mark", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            date,
            records
          })
        });
      } catch (apiErr) {
        console.error("Backend WhatsApp dispatcher loop failed to execute:", apiErr);
      }
    } catch (err) {
      console.error("Failed to mark attendance in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Fees cash payment clear logs
  const handlePayInstallment = async (installmentId: string, amountPaid: number) => {
    if (isSubscribed === false) {
      setSubscriptionAlert("Subscription Expired. Please renew to add or modify data.");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const currentData = docSnap.data();
      const currentInstallments: FeeInstallment[] = currentData.installments || [];

      const instIdx = currentInstallments.findIndex((i) => i.id === installmentId);
      if (instIdx === -1) return;

      const inst = currentInstallments[instIdx];
      const payAmount = Number(amountPaid) || 0;
      const currentPaid = inst.paidAmount || 0;
      const newPaidTotal = currentPaid + payAmount;
      
      inst.paidAmount = Math.min(inst.amount, newPaidTotal);
      inst.paymentDate = new Date().toISOString().split("T")[0];

      if (inst.paidAmount >= inst.amount) {
        inst.status = "Paid";
      } else if (inst.paidAmount > 0) {
        inst.status = "Partially Paid";
      } else {
        inst.status = "Unpaid";
      }

      currentInstallments[instIdx] = inst;

      setInstallments([...currentInstallments]);

      await updateDoc(docRef, { installments: currentInstallments });
    } catch (err) {
      console.error("Failed to log fee payment in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Trigger outbound mobile due alerts
  const handleTriggerReminder = async (studentId: string, installmentId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const currentData = docSnap.data();
      const currentLogs: NotificationLog[] = currentData.logs || [];
      const currentInstallments: FeeInstallment[] = currentData.installments || [];

      const student = students.find((s) => s.id === studentId);
      const installment = currentInstallments.find((i) => i.id === installmentId);

      if (!student || !installment) return;

      const reminderId = `LOG-${Math.floor(1000 + Math.random() * 9000)}`;
      const triggerMsg = `Fee Reminder Update: Hello ${student.parentName}, your child ${student.name} has tuition fees pending of ₹${installment.amount - (installment.paidAmount || 0)} (Due Date: ${installment.dueDate}) for Plan Type: ${(student.feesPlan || "").toUpperCase()}. Kindly click to settle. - ${settings.name || "Alpha Coaching"}`;

      currentLogs.push({
        id: reminderId,
        studentId,
        type: "fee_reminder",
         recipientMobile: student.parentMobile,
        text: triggerMsg,
        sentAt: new Date().toISOString(),
        status: "Sent"
      });

      setLogs([...currentLogs]);

      await updateDoc(docRef, { logs: currentLogs });
    } catch (err) {
      console.error("Failed to process fee reminder in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Issue broadcast notice board update
  const handleSendNotice = async (noticeData: Partial<Notice> & { selectedStudentIds?: string[] }) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const currentData = docSnap.data();
      const currentNotices: Notice[] = currentData.notices || [];
      const currentLogs: NotificationLog[] = currentData.logs || [];

      const selectedMedium = noticeData.medium || "WhatsApp";

      const newNotice: Notice = {
        id: `NTC-${Math.floor(100 + Math.random() * 900)}`,
        title: noticeData.title || "Announcement",
        body: noticeData.body || "",
        recipientType: noticeData.recipientType || "All Students",
        recipients: Array.isArray(noticeData.selectedStudentIds) ? noticeData.selectedStudentIds : [],
        sentAt: new Date().toISOString(),
        status: "Delivered",
        medium: selectedMedium
      };

      currentNotices.push(newNotice);

      let targetStudents = students;
      if (noticeData.recipientType === "Selected Students") {
        targetStudents = students.filter((s) => newNotice.recipients.includes(s.id));
      }

      targetStudents.forEach((student) => {
        currentLogs.push({
          id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
          studentId: student.id,
          type: "notice",
          recipientMobile: student.parentMobile || student.alternateMobile || "+91 00000 00000",
          text: `NOTICE (${newNotice.title}): ${newNotice.body}`,
          sentAt: new Date().toISOString(),
          status: "Sent",
          medium: selectedMedium
        });
      });

      setNotices([...currentNotices]);
      setLogs([...currentLogs]);

      await updateDoc(docRef, {
        notices: currentNotices,
        logs: currentLogs
      });

      // Update communication counts in institutes doc
      const instRef = doc(db, "institutes", user.uid);
      const instSnap = await getDoc(instRef);
      if (instSnap.exists() && targetStudents.length > 0) {
        const instData = instSnap.data();
        const count = targetStudents.length;

        if (selectedMedium === "SMS") {
          const smsLimit = Number(instData.smsLimit ?? 0);
          const smsSent = Number(instData.smsSent ?? 0) + count;
          const smsLeft = Math.max(0, smsLimit - smsSent);
          await updateDoc(instRef, {
            smsSent,
            smsLeft
          });
        } else {
          const whatsappLimit = Number(instData.whatsappLimit ?? 0);
          const whatsappSent = Number(instData.whatsappSent ?? 0) + count;
          const whatsappLeft = Math.max(0, whatsappLimit - whatsappSent);
          await updateDoc(instRef, {
            whatsappSent,
            whatsappLeft
          });
        }
      }
    } catch (err) {
      console.error("Failed to post notice in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Update Core branding profiles config
  const handleUpdateSettings = async (updatedSettings: InstituteSettings) => {
    const user = auth.currentUser;
    if (!user) return;

    setSettings(updatedSettings);

    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, { 
        settings: updatedSettings,
        institute: {
          instituteName: updatedSettings.name
        }
      });
    } catch (err) {
      console.error("Failed to update settings in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Reset all student data locally on complete academic season clear
  const handleResetAllStudentData = () => {
    setStudents([]);
  };

  const handleAddTeacherState = (newTeacher: Teacher) => {
    setTeachers((prev) => {
      if (prev.some(t => t.id === newTeacher.id)) return prev;
      return [...prev, newTeacher];
    });
  };

  const handleDeleteTeacherState = (teacherId: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
  };

  // Commit AI batch planners allocation
  const handleFinalizeSchedule = async (assignments: { studentId: string; batchId: string | null }[]) => {
    const user = auth.currentUser;
    if (!user) return;

    const updatedStudents = students.map((s) => {
      const match = assignments.find((a) => a.studentId === s.id);
      if (match) {
        return { ...s, batchId: match.batchId };
      }
      return s;
    });

    setStudents(updatedStudents);

    try {
      for (const assignment of assignments) {
        await updateDoc(doc(db, "students", assignment.studentId), {
          batchId: assignment.batchId
        });
      }
    } catch (err) {
      console.error("Failed to finalize schedule:", err);
      handleFirestoreError(err, OperationType.UPDATE, `students`);
    }
  };

  // Render Login state block if unauthenticated
  if (!authToken) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Navigation tab templates configuration
  const tabsConfig = [
    { 
      id: "dashboard", 
      line1: "Dashboard Hub", 
      line2: "Live analytics & core trackers", 
      line3: "Quick admission form active", 
      icon: "📊" 
    },
    { 
      id: "students", 
      line1: "Students Database", 
      line2: "Student directory & personal folders", 
      line3: "Edit personal detail sheets", 
      icon: "👥" 
    },
    { 
      id: "batches", 
      line1: "Batches & Timings", 
      line2: "Course & lecture calendars", 
      line3: "Group timings configuration", 
      icon: "📅" 
    },
    { 
      id: "fees", 
      line1: "Dues & Receipts", 
      line2: "Installments ledger tracker", 
      line3: "Record cash & bank clearings", 
      icon: "💵" 
    },
    { 
      id: "whatsapp", 
      line1: "WhatsApp Desk", 
      line2: "Broadcasting manual templates", 
      line3: "Review automation delivery logs", 
      icon: "💬" 
    },
    { 
      id: "ai_scheduler", 
      line1: "Batch Allocator", 
      line2: "Manage student timing slots", 
      line3: "Rosters alignments & search filters", 
      icon: "🔄" 
    },
    { 
      id: "reports", 
      line1: "Settings & Audits", 
      line2: "Custom branding & variables", 
      line3: "Classes & terms setups", 
      icon: "⚙️" 
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans transition-all duration-300">
      
      {/* Real-time subscription check warning banner */}
      {isSubscribed === false && (
        <div className="bg-gradient-to-r from-amber-550 to-orange-600 text-white font-bold px-4 py-3 text-xs text-center border-b border-orange-700 flex items-center justify-center gap-2.5 animate-pulse shadow-md z-50 sticky top-0">
          <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
          <span className="tracking-wide">Subscription Expired. Read-only mode is active. You can still view, search, and download your existing reports/PDFs, but adding or modifying data is frozen.</span>
        </div>
      )}

      {/* Action Blocked Overlay Modal */}
      {subscriptionAlert && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-amber-100 w-full max-w-md overflow-hidden p-6 text-center space-y-4 animate-fade-in">
            <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-black text-slate-800">Operation Blocked</h3>
              <p className="text-slate-600 text-xs mt-2 leading-relaxed font-semibold">
                {subscriptionAlert}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setSubscriptionAlert(null)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer h-11"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* --- DASHBOARD HEADER --- */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-18 flex justify-between items-center">
          
          {/* Logo & Institute names branding */}
          <div className="flex items-center gap-3">
            <div className="text-2xl bg-emerald-600 h-10 w-10 mt-0.5 rounded-xl shadow-inner flex items-center justify-center select-none overflow-hidden">
              {settings.logo && (settings.logo.startsWith("data:image") || settings.logo.startsWith("http")) ? (
                <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                settings.logo || "🎓"
              )}
            </div>
            <div>
              <h1 className="font-display font-black text-lg tracking-tight uppercase leading-none">
                {settings.name || "ClassSetu"}
              </h1>
              <p className="text-[10px] uppercase text-emerald-400 font-bold tracking-widest mt-0.5">
                Institute management system
              </p>
            </div>
          </div>

          {/* Unified Desktop & Mobile Header Actions */}
          <div className="flex items-center gap-3 sm:gap-4 font-semibold relative">
            {/* Live Indicator (only on desktop/laptop) */}
            <div className="hidden lg:flex bg-slate-800/80 py-1.5 px-3 rounded-full border border-slate-700/60 items-center gap-2 select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              <span className="text-slate-300 text-[10px] uppercase font-bold tracking-wider">Live Active Hub</span>
            </div>

            {/* Current Active Module Name Badge (Desktop only) */}
            <div className="hidden sm:flex items-center gap-2 bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-3 py-1.5 rounded-xl text-xs font-bold leading-none select-none">
              <span className="text-sm">{tabsConfig.find(t => t.id === activeTab)?.icon}</span>
              <span className="truncate">{tabsConfig.find(t => t.id === activeTab)?.line1}</span>
            </div>

            {/* Unified 3-line Menu Button (Hamburger) */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-100 hover:text-white rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
              id="unified-workspace-menu-trigger"
              title="Workspace Menu"
            >
              <span className="font-extrabold text-[10px] uppercase tracking-wider hidden md:inline select-none">Workspace Menu</span>
              {menuOpen ? <X className="w-5 h-5 text-rose-450" /> : <Menu className="w-5 h-5 text-emerald-400" />}
            </button>
          </div>

        </div>
      </header>

      {/* --- UNIFIED NAVIGATION DROPDOWN (DESKTOP & MOBILE) --- */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Click-away backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMenuOpen(false)}
            />
            
            {/* The Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed left-0 right-0 top-18 bg-slate-900 border-b border-slate-800 shadow-2xl z-40 max-h-[85vh] overflow-y-auto"
            >
              <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
                
                {/* Heading info */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Workspace Modules
                    </h3>
                    <p className="text-[11px] text-emerald-400 font-bold mt-1">
                       {tabsConfig.length} Modules Connected • Instant Real-time Database Sync
                    </p>
                  </div>
                  
                  {/* Current Selected badge */}
                  <div className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 px-3 py-1 rounded-full text-[10px] font-bold">
                    Active Screen: {tabsConfig.find(t => t.id === activeTab)?.line1}
                  </div>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tabsConfig.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMenuOpen(false);
                        }}
                        className={`w-full text-left p-4 rounded-xl transition-all border flex items-start gap-4 cursor-pointer group select-none ${
                          isActive 
                            ? "bg-slate-800 border-emerald-500/30 text-white shadow-xl" 
                            : "bg-slate-850 hover:bg-slate-800 border-transparent hover:border-slate-800 text-slate-300 hover:text-white"
                        }`}
                      >
                        <span className="text-2xl pt-0.5 bg-slate-900 p-2.5 rounded-xl border border-slate-800 group-hover:border-slate-750 transition-colors">
                          {tab.icon}
                        </span>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className={`text-sm font-extrabold truncate ${isActive ? "text-emerald-400 font-black" : "text-slate-200 group-hover:text-white"}`}>
                            {tab.line1}
                          </p>
                          <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                            {tab.line2}
                          </p>
                          <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 truncate mt-1">
                            {tab.line3}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer Account & Options */}
                <div className="border-t border-slate-800 mt-6 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-base border border-emerald-500/20">
                      {(adminUser?.name || "A")[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-200 text-xs">
                        {adminUser?.name || "Administrator"}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {adminUser?.email || "No Session Detected"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 px-5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-rose-600/10"
                  >
                    <LogOut className="w-4 h-4" /> Log Out Portal Session
                  </button>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- SIDEBAR + MAIN CONTENT AREA (3-LINE NAVIGATION SPLIT LAYOUT) --- */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 flex gap-8">
        
         {/* Right Main Content Frame */}
         <div className="flex-1 min-w-0">
           {activeTab === "dashboard" && (
             <DashboardView 
               students={students} 
               batches={batches} 
               installments={installments} 
               attendance={attendance} 
               instituteData={instituteData}
               transferRequests={transferRequests}
               onApproveRequest={handleApproveTransferRequest}
               onRejectRequest={handleRejectTransferRequest}
               onNavigate={(id, action) => {
                  setActiveTab(id);
                  if (id === "students" && action === "add") {
                    setAutoOpenAddStudent(true);
                  }
                }}
               
             />
           )}

           {activeTab === "students" && (
             <StudentManagerView 
               students={students} 
               setStudents={setStudents}
               batches={batches} 
               installments={installments} 
               attendance={attendance}
               onAddStudent={handleAddStudent}
               onUpdateStudent={handleUpdateStudent}
               onDeleteStudent={handleDeleteStudent}
                autoOpenAdd={autoOpenAddStudent}
                onResetAutoOpenAdd={() => setAutoOpenAddStudent(false)}
                onRefreshStudents={handleRefreshStudents}
                isSubscribed={isSubscribed}
                onSubscriptionBlocked={() => setSubscriptionAlert("Subscription Expired. Please renew to add or modify data.")}
               onPayInstallment={handlePayInstallment}
             />
           )}

           {activeTab === "batches" && (
             <BatchAttendanceView 
                teachers={teachers}
               students={students} 
               batches={batches} 
               attendance={attendance}
               onAddBatch={handleAddBatch}
               onUpdateBatch={handleUpdateBatch}
               onDeleteBatch={handleDeleteBatch}
               onMarkAttendance={handleMarkAttendance}
                isSubscribed={isSubscribed}
                onSubscriptionBlocked={() => setSubscriptionAlert("Subscription Expired. Please renew to add or modify data.")}
             />
           )}

           {activeTab === "fees" && (
             <FeesManagerView 
               students={students} 
               installments={installments}
                batches={batches} 
               onPayInstallment={handlePayInstallment}
               onTriggerReminder={handleTriggerReminder}
                isSubscribed={isSubscribed}
                onSubscriptionBlocked={() => setSubscriptionAlert("Subscription Expired. Please renew to add or modify data.")}
                settings={settings}
             />
           )}

           {activeTab === "whatsapp" && (
             <WhatsAppCenterView 
               students={students} 
               notices={notices} 
               logs={logs}
               onSendNotice={handleSendNotice}
                isSubscribed={isSubscribed}
                onSubscriptionBlocked={() => setSubscriptionAlert("Subscription Expired. Please renew to add or modify data.")}
                instituteData={instituteData}
             />
           )}

           {activeTab === "ai_scheduler" && (
             <AIBatchSchedulerView 
               students={students}
               batches={batches}
               onFinalizeSchedule={handleFinalizeSchedule}
                isSubscribed={isSubscribed}
                onSubscriptionBlocked={() => setSubscriptionAlert("Subscription Expired. Please renew to add or modify data.")}
             />
           )}

           {activeTab === "reports" && (
             <ReportsSettingsView 
                teachers={teachers}
                onAddTeacherState={handleAddTeacherState}
                 onDeleteTeacherState={handleDeleteTeacherState}
               settings={settings} 
               onUpdateSettings={handleUpdateSettings}
               batches={batches}
               students={students}
                onResetAllStudentData={handleResetAllStudentData}
                isSubscribed={isSubscribed}
                onSubscriptionBlocked={() => setSubscriptionAlert("Subscription Expired. Please renew to add or modify data.")}
             />
           )}
         </div>

      </div>

      {/* --- SYSTEM FOOTER --- */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center text-[11px] text-slate-400">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-2">
          <p>© {new Date().getFullYear()} ClassSetu Premium SaaS • Encrypted administration workspace.</p>
          <div className="flex gap-4 font-semibold text-slate-400">
            <span>Server Status: Online</span>
            <span>Region: Secure Cloud</span>
          </div>
        </div>
      </footer>

      {/* --- LOGOUT CONFIRMATION BOTTOM SHEET --- */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 transition-opacity"
            />
            
            {/* Slide-out Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200/80 z-50 max-h-[85vh] overflow-y-auto pb-safe md:max-w-xl md:mx-auto md:bottom-4 md:rounded-2xl md:border"
            >
              <div className="p-6 md:p-8">
                {/* Visual Accent drag indicator on mobile */}
                <div className="flex justify-center mb-5 md:hidden">
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                </div>

                <div className="flex items-start gap-4 mb-6">
                  <div className="bg-rose-50 text-rose-600 p-3.5 rounded-2xl flex-shrink-0 animate-pulse">
                    <LogOut className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                      Sign Out of Workspace?
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">
                      ClassSetu Premium Administration
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Are you sure you want to log out of <strong>{settings.name || "ClassSetu"}</strong>? Your changes and database states are safely secured and synchronized in Cloud Firestore. You will be redirected to the secure login fold.
                </p>

                {/* Confirm & Cancel Actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3 px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer text-center"
                  >
                    Stay Logged In
                  </button>
                  <button
                    onClick={async () => {
                      setShowLogoutConfirm(false);
                      setMenuOpen(false);
                      await handleLogout();
                    }}
                    className="flex-1 py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold shadow-lg shadow-rose-600/15 hover:shadow-rose-600/25 transition-all cursor-pointer text-center"
                  >
                    Yes, Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
