export interface InstituteSettings {
  name: string;
  logo: string;
  address: string;
  contact: string;
}

export interface Student {
  id: string;
  name: string;
  parentName: string;
  parentMobile: string;
  alternateMobile: string;
  grade: string;
  schoolName: string;
  schoolTiming: string;
  preferredTuitionTiming: string;
  reasonForPreferredTiming: string;
  subjects: string[];
  admissionDate: string;
  feesAmount: number;
  feesPlan: "quarterly" | "half-yearly";
  batchId: string | null;
  status: "active" | "inactive" | "ACTIVE" | "ARCHIVED" | "READY_TO_TRANSFER";
  gradeLevel?: string;
  totalFees?: number;
  password?: string;
  createdAt?: any; // To support Firestore Timestamp or string
  instituteId?: string;
  class?: string;
  classLevel?: string;
}

export interface TransferLog {
  transfer_id: string;
  student_unique_code: string;
  from_institute_id: string;
  to_institute_id: string | null;
  transfer_pin: string;
  log_status: "PENDING" | "ACCEPTED" | "CANCELLED";
  created_at: any; // Firestore timestamp or string
}

export interface Batch {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  days: string[];
  assignedTeacherIds?: string[];
  targetGrade?: string;
  targetClass?: string;
  class?: string;
  classLevel?: string;
}

export interface Teacher {
  id: string; // teacher's UID
  name: string;
  email: string;
  role: "teacher" | "TEACHER" | string;
  createdAt: string;
  createdByAdminEmail?: string;
  password?: string;
}

export interface AttendanceRecord {
  date: string;
  studentId: string;
  status: "Present" | "Absent" | "Leave";
}

export interface FeeInstallment {
  id: string;
  studentId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: "Paid" | "Partially Paid" | "Unpaid";
  paidAmount: number;
  paymentDate?: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  recipientType: "All Students" | "All Parents" | "Selected Students";
  recipients: string[];
  sentAt: string;
  status: "Delivered" | "Failed";
}

export interface NotificationLog {
  id: string;
  studentId: string;
  type: "absent_alert" | "fee_reminder" | "notice";
  recipientMobile: string;
  text: string;
  sentAt: string;
  status: "Sent" | "Blocked";
}
