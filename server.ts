import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import rateLimit from "express-rate-limit";

dotenv.config();

const PORT = 3000;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "class-setu-2b8e4";

// ==========================================
// 1. FIREBASE ADMIN SDK INITIALIZATION
// ==========================================
if (!getApps().length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || FIREBASE_PROJECT_ID,
      });
      console.log("[Firebase Admin] Initialized with FIREBASE_SERVICE_ACCOUNT credential");
    } catch (e: any) {
      console.error("[Firebase Admin] Failed parsing FIREBASE_SERVICE_ACCOUNT:", e.message);
      initializeApp({ projectId: FIREBASE_PROJECT_ID });
    }
  } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
      projectId: FIREBASE_PROJECT_ID,
    });
    console.log("[Firebase Admin] Initialized with FIREBASE_CLIENT_EMAIL & FIREBASE_PRIVATE_KEY");
  } else {
    // Default ADC or project-level verification
    initializeApp({ projectId: FIREBASE_PROJECT_ID });
    console.log(`[Firebase Admin] Initialized with projectId: ${FIREBASE_PROJECT_ID}`);
  }
}

export const adminAuth = getAuth();
export const firestore = getFirestore();

// ==========================================
// 2. SCHEMAS & INTERFACES
// ==========================================
export interface AuthenticatedRequest extends express.Request {
  user?: DecodedIdToken;
  instituteId?: string;
}

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
  class: string;
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
  instituteId?: string;
  grade?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Batch {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  days: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id?: string;
  date: string;
  studentId: string;
  status: "Present" | "Absent";
  markedAt?: string;
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
  status: "Sent" | "Blocked" | "Delivered" | "Failed" | string;
  medium?: "WhatsApp" | "SMS";
}

export interface MetaWhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  defaultTemplate: string;
  languageCode: string;
}

let activeWhatsAppConfig: MetaWhatsAppConfig = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN || "",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "1314273115097110",
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1537660763931011",
  defaultTemplate: process.env.WHATSAPP_DEFAULT_TEMPLATE || "hello_world",
  languageCode: process.env.WHATSAPP_LANGUAGE_CODE || "en_US"
};

// ==========================================
// 3. MULTI-TENANT FIRESTORE PATH HELPERS
// ==========================================
export const getInstituteDoc = (instituteId: string) => firestore.collection("institutes").doc(instituteId);
export const getStudentsCol = (instituteId: string) => getInstituteDoc(instituteId).collection("students");
export const getBatchesCol = (instituteId: string) => getInstituteDoc(instituteId).collection("batches");
export const getAttendanceCol = (instituteId: string) => getInstituteDoc(instituteId).collection("attendance");
export const getInstallmentsCol = (instituteId: string) => getInstituteDoc(instituteId).collection("installments");
export const getNoticesCol = (instituteId: string) => getInstituteDoc(instituteId).collection("notices");
export const getLogsCol = (instituteId: string) => getInstituteDoc(instituteId).collection("logs");

// Helper to generate distinct IDs
function generateId(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${random}`;
}

// Format mobile for WhatsApp Cloud API
function formatWhatsAppNumber(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (clean.length === 11 && clean.startsWith("0")) {
    clean = clean.substring(1);
  }
  if (clean.length === 10) {
    clean = "91" + clean;
  }
  return clean;
}

// Meta WhatsApp Cloud API dispatcher
async function sendMetaWhatsAppMessage(
  recipientPhone: string,
  options: {
    type?: "template" | "text";
    templateName?: string;
    languageCode?: string;
    parameters?: string[];
    textMessage?: string;
    overrideConfig?: Partial<MetaWhatsAppConfig>;
  }
) {
  const token = options.overrideConfig?.accessToken || activeWhatsAppConfig.accessToken;
  const phoneId = options.overrideConfig?.phoneNumberId || activeWhatsAppConfig.phoneNumberId;

  if (!token || !phoneId) {
    return {
      success: false,
      error: "Meta WhatsApp credentials unconfigured. Please configure WhatsApp Cloud API credentials.",
      simulated: true
    };
  }

  const cleanPhone = formatWhatsAppNumber(recipientPhone);
  const graphUrl = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

  let payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone
  };

  if (options.type === "text" && options.textMessage) {
    payload.type = "text";
    payload.text = { preview_url: false, body: options.textMessage };
  } else {
    payload.type = "template";
    const tName = options.templateName || activeWhatsAppConfig.defaultTemplate || "hello_world";
    const lang = options.languageCode || activeWhatsAppConfig.languageCode || "en_US";
    payload.template = {
      name: tName,
      language: { code: lang }
    };

    if (tName !== "hello_world" && options.parameters && options.parameters.length > 0) {
      payload.template.components = [
        {
          type: "body",
          parameters: options.parameters.map((p) => ({
            type: "text",
            text: p
          }))
        }
      ];
    }
  }

  try {
    const res = await fetch(graphUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.messages?.[0]?.id) {
      return {
        success: true,
        messageId: data.messages[0].id,
        recipient: cleanPhone,
        rawResponse: data
      };
    } else {
      console.warn(`[Meta WhatsApp Primary Failed] ${data.error?.message || JSON.stringify(data.error)}. Trying fallback hello_world...`);
      const fallbackPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
          name: "hello_world",
          language: { code: "en_US" }
        }
      };
      try {
        const fallbackRes = await fetch(graphUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(fallbackPayload)
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok && fallbackData.messages?.[0]?.id) {
          return {
            success: true,
            messageId: fallbackData.messages[0].id,
            recipient: cleanPhone,
            rawResponse: fallbackData
          };
        }
      } catch (fbErr) {
        console.error("[Meta WhatsApp Fallback Error]", fbErr);
      }

      return {
        success: false,
        error: data.error?.message || data.error?.error_data?.details || "Meta Cloud API request failed",
        metaError: data.error,
        rawResponse: data
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error connecting to Meta Graph API",
    };
  }
}

// Calculate installment dates for fee generation
function calculateInstallmentDueDates(admissionDateStr: string, feesPlan: "quarterly" | "half-yearly"): string[] {
  const parts = (admissionDateStr || new Date().toISOString().split("T")[0]).split("-");
  const admYear = parseInt(parts[0], 10) || new Date().getFullYear();
  const admMonth = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
  const admDay = parseInt(parts[2], 10) || new Date().getDate();

  let academicStartYear = admYear;
  if (admMonth < 4) {
    academicStartYear = admYear - 1;
  }

  const clampDay = (day: number, month: number) => {
    let maxDays = 31;
    if (month === 11) maxDays = 30;
    return Math.min(day, maxDays);
  };

  const dates: string[] = [];
  if (feesPlan === "quarterly") {
    dates.push(`${academicStartYear}-05-${String(clampDay(admDay, 5)).padStart(2, "0")}`);
    dates.push(`${academicStartYear}-08-${String(clampDay(admDay, 8)).padStart(2, "0")}`);
    dates.push(`${academicStartYear}-11-${String(clampDay(admDay, 11)).padStart(2, "0")}`);
    dates.push(`${academicStartYear + 1}-01-${String(clampDay(admDay, 1)).padStart(2, "0")}`);
  } else {
    dates.push(`${academicStartYear}-05-${String(clampDay(admDay, 5)).padStart(2, "0")}`);
    dates.push(`${academicStartYear}-11-${String(clampDay(admDay, 11)).padStart(2, "0")}`);
  }
  return dates;
}

// ==========================================
// 4. INPUT VALIDATORS
// ==========================================
function validateStudentInput(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request payload must be a JSON object"] };
  }
  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    errors.push("Student name is required (minimum 2 characters).");
  }
  const cleanMobile = (body.parentMobile ? String(body.parentMobile) : "").replace(/\D/g, "");
  if (!cleanMobile || cleanMobile.length < 10) {
    errors.push("Valid 10-digit parent mobile number is required.");
  }
  if (body.feesAmount !== undefined && (typeof body.feesAmount !== "number" || body.feesAmount < 0 || isNaN(body.feesAmount))) {
    errors.push("Fees amount must be a positive number.");
  }
  if (body.feesPlan && !["quarterly", "half-yearly"].includes(body.feesPlan)) {
    errors.push("Fees plan must be either 'quarterly' or 'half-yearly'.");
  }
  return { valid: errors.length === 0, errors };
}

function validateBatchInput(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request payload must be a JSON object"] };
  }
  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    errors.push("Batch name is required (minimum 2 characters).");
  }
  if (body.capacity !== undefined && (typeof body.capacity !== "number" || body.capacity <= 0 || isNaN(body.capacity))) {
    errors.push("Capacity must be a positive integer.");
  }
  return { valid: errors.length === 0, errors };
}

function validateNoticeInput(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request payload must be a JSON object"] };
  }
  if (!body.title || typeof body.title !== "string" || body.title.trim().length < 2) {
    errors.push("Notice title is required (minimum 2 characters).");
  }
  if (!body.body || typeof body.body !== "string" || body.body.trim().length < 3) {
    errors.push("Notice body text is required (minimum 3 characters).");
  }
  return { valid: errors.length === 0, errors };
}

function validateAttendanceMarkInput(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request payload must be a JSON object"] };
  }
  if (!body.date || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    errors.push("Date must be in format YYYY-MM-DD.");
  }
  if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
    errors.push("Attendance records array cannot be empty.");
  }
  return { valid: errors.length === 0, errors };
}

function validateFeePaymentInput(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request payload must be a JSON object"] };
  }
  if (!body.installmentId || typeof body.installmentId !== "string") {
    errors.push("installmentId is required.");
  }
  if (body.amount !== undefined && (typeof body.amount !== "number" || body.amount <= 0 || isNaN(body.amount))) {
    errors.push("Payment amount must be a positive number.");
  }
  return { valid: errors.length === 0, errors };
}

// ==========================================
// 5. RATE LIMITERS
// ==========================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Too many requests, please try again in 15 minutes." }
});

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests to this sensitive endpoint. Please try again later." }
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for write operations. Please slow down." }
});

// ==========================================
// 6. AUTHENTICATION MIDDLEWARE
// ==========================================
export const authenticateFirebaseUser = async (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized: Missing or invalid Authorization header. Expected 'Authorization: Bearer <firebase_id_token>'",
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized: Token missing in Bearer header",
    });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    req.instituteId = decodedToken.uid;
    next();
  } catch (error: any) {
    console.error("[Auth Middleware] Firebase ID Token verification failed:", error.message);
    return res.status(401).json({
      error: "Unauthorized: Invalid or expired Firebase ID token",
      details: error.code || error.message,
    });
  }
};

// ==========================================
// 7. EXPRESS APP INITIALIZATION
// ==========================================
export async function createExpressApp() {
  const app = express();
  app.use(express.json());
  app.use(generalLimiter);

  // Initialize Gemini AI Client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });

  // -------------------------------------------------------------
  // HEALTH CHECK (The ONLY unauthenticated route under /api/*)
  // -------------------------------------------------------------
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "ClasSetu Multi-Tenant API",
      auth: "firebase-admin-enforced",
      persistence: "firestore-isolated"
    });
  });

  // -------------------------------------------------------------
  // ATTACH AUTHENTICATION MIDDLEWARE TO EVERY /api/* ROUTE
  // -------------------------------------------------------------
  app.use("/api", authenticateFirebaseUser);

  // -------------------------------------------------------------
  // INSTITUTE SETTINGS (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.get("/api/institute/settings", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const doc = await getInstituteDoc(instituteId).get();
      if (doc.exists && doc.data()?.settings) {
        return res.json(doc.data()!.settings);
      }
      const defaultSettings: InstituteSettings = {
        name: "My Coaching Institute",
        logo: "🎓",
        address: "Suite 402, EduTower Building, Knowledge Park",
        contact: "+91 98765 43210"
      };
      await getInstituteDoc(instituteId).set({ settings: defaultSettings }, { merge: true });
      res.json(defaultSettings);
    } catch (err: any) {
      console.error(`[Settings GET] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to retrieve institute settings", details: err.message });
    }
  });

  app.put("/api/institute/settings", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const { name, logo, address, contact } = req.body;
    try {
      const updatedSettings: InstituteSettings = {
        name: String(name || "").trim() || "My Coaching Institute",
        logo: String(logo || "🎓"),
        address: String(address || "").trim(),
        contact: String(contact || "").trim()
      };
      await getInstituteDoc(instituteId).set({ settings: updatedSettings, updatedAt: new Date().toISOString() }, { merge: true });
      res.json({ success: true, settings: updatedSettings });
    } catch (err: any) {
      console.error(`[Settings PUT] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to update settings", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // STUDENTS (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.get("/api/students", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const snapshot = await getStudentsCol(instituteId).get();
      const students: Student[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Student, "id">)
      }));
      res.json(students);
    } catch (err: any) {
      console.error(`[Students GET] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to fetch students", details: err.message });
    }
  });

  app.post("/api/students", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const validation = validateStudentInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.errors });
    }

    try {
      const studentId = req.body.id || generateId("STD");
      const feesAmount = Number(req.body.feesAmount || 0);
      const feesPlan: "quarterly" | "half-yearly" = req.body.feesPlan === "half-yearly" ? "half-yearly" : "quarterly";
      const admissionDate = req.body.admissionDate || new Date().toISOString().split("T")[0];

      const newStudent: Student = {
        id: studentId,
        name: req.body.name.trim(),
        parentName: (req.body.parentName || "").trim(),
        parentMobile: req.body.parentMobile.trim(),
        alternateMobile: (req.body.alternateMobile || "").trim(),
        class: req.body.class || req.body.grade || "Grade 10",
        schoolName: (req.body.schoolName || "").trim(),
        schoolTiming: (req.body.schoolTiming || "").trim(),
        preferredTuitionTiming: (req.body.preferredTuitionTiming || "").trim(),
        reasonForPreferredTiming: (req.body.reasonForPreferredTiming || "").trim(),
        subjects: Array.isArray(req.body.subjects) ? req.body.subjects : [],
        admissionDate,
        feesAmount,
        feesPlan,
        batchId: req.body.batchId || null,
        status: "active",
        instituteId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await getStudentsCol(instituteId).doc(studentId).set(newStudent);

      // Generate Fee Installments for this student
      if (feesAmount > 0) {
        const dueDates = calculateInstallmentDueDates(admissionDate, feesPlan);
        const count = dueDates.length;
        const instAmount = Math.round(feesAmount / count);
        const batchWrite = firestore.batch();

        for (let i = 0; i < count; i++) {
          const instId = generateId("INST");
          const installment: FeeInstallment = {
            id: instId,
            studentId,
            installmentNumber: i + 1,
            amount: instAmount,
            dueDate: dueDates[i],
            status: "Unpaid",
            paidAmount: 0
          };
          const ref = getInstallmentsCol(instituteId).doc(instId);
          batchWrite.set(ref, installment);
        }
        await batchWrite.commit();
      }

      res.status(201).json(newStudent);
    } catch (err: any) {
      console.error(`[Student POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to create student", details: err.message });
    }
  });

  app.put("/api/students/:id", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const studentId = req.params.id;
    const validation = validateStudentInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.errors });
    }

    try {
      const docRef = getStudentsCol(instituteId).doc(studentId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: `Student ${studentId} not found in this institute` });
      }

      const updates: Partial<Student> = {
        name: req.body.name.trim(),
        parentName: (req.body.parentName || "").trim(),
        parentMobile: req.body.parentMobile.trim(),
        alternateMobile: (req.body.alternateMobile || "").trim(),
        class: req.body.class || req.body.grade || "Grade 10",
        schoolName: (req.body.schoolName || "").trim(),
        schoolTiming: (req.body.schoolTiming || "").trim(),
        preferredTuitionTiming: (req.body.preferredTuitionTiming || "").trim(),
        reasonForPreferredTiming: (req.body.reasonForPreferredTiming || "").trim(),
        subjects: Array.isArray(req.body.subjects) ? req.body.subjects : [],
        feesAmount: Number(req.body.feesAmount || 0),
        feesPlan: req.body.feesPlan === "half-yearly" ? "half-yearly" : "quarterly",
        batchId: req.body.batchId !== undefined ? req.body.batchId : null,
        status: req.body.status || "active",
        updatedAt: new Date().toISOString()
      };

      await docRef.update(updates);
      res.json({ id: studentId, ...docSnap.data(), ...updates });
    } catch (err: any) {
      console.error(`[Student PUT] Error for ${instituteId}/${studentId}:`, err);
      res.status(500).json({ error: "Failed to update student", details: err.message });
    }
  });

  app.delete("/api/students/:id", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const studentId = req.params.id;

    try {
      const docRef = getStudentsCol(instituteId).doc(studentId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: `Student ${studentId} not found in this institute` });
      }

      await docRef.delete();

      // Clean up installments for deleted student
      const instSnap = await getInstallmentsCol(instituteId).where("studentId", "==", studentId).get();
      const batchWrite = firestore.batch();
      instSnap.docs.forEach(d => batchWrite.delete(d.ref));
      await batchWrite.commit();

      res.json({ success: true, message: `Student ${studentId} and associated records deleted` });
    } catch (err: any) {
      console.error(`[Student DELETE] Error for ${instituteId}/${studentId}:`, err);
      res.status(500).json({ error: "Failed to delete student", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // BATCHES (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.get("/api/batches", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const snapshot = await getBatchesCol(instituteId).get();
      const batches: Batch[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Batch, "id">)
      }));
      res.json(batches);
    } catch (err: any) {
      console.error(`[Batches GET] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to fetch batches", details: err.message });
    }
  });

  app.post("/api/batches", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const validation = validateBatchInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.errors });
    }

    try {
      const batchId = req.body.id || generateId("BTCH");
      const newBatch: Batch = {
        id: batchId,
        name: req.body.name.trim(),
        startTime: req.body.startTime || "07:00 AM",
        endTime: req.body.endTime || "08:30 AM",
        capacity: Number(req.body.capacity) || 15,
        days: Array.isArray(req.body.days) ? req.body.days : ["Mon", "Wed", "Fri"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await getBatchesCol(instituteId).doc(batchId).set(newBatch);
      res.status(201).json(newBatch);
    } catch (err: any) {
      console.error(`[Batch POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to create batch", details: err.message });
    }
  });

  app.put("/api/batches/:id", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const batchId = req.params.id;
    const validation = validateBatchInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.errors });
    }

    try {
      const docRef = getBatchesCol(instituteId).doc(batchId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: `Batch ${batchId} not found in this institute` });
      }

      const updates: Partial<Batch> = {
        name: req.body.name.trim(),
        startTime: req.body.startTime || "07:00 AM",
        endTime: req.body.endTime || "08:30 AM",
        capacity: Number(req.body.capacity) || 15,
        days: Array.isArray(req.body.days) ? req.body.days : ["Mon", "Wed", "Fri"],
        updatedAt: new Date().toISOString()
      };

      await docRef.update(updates);
      res.json({ id: batchId, ...docSnap.data(), ...updates });
    } catch (err: any) {
      console.error(`[Batch PUT] Error for ${instituteId}/${batchId}:`, err);
      res.status(500).json({ error: "Failed to update batch", details: err.message });
    }
  });

  app.delete("/api/batches/:id", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const batchId = req.params.id;

    try {
      const docRef = getBatchesCol(instituteId).doc(batchId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: `Batch ${batchId} not found in this institute` });
      }

      await docRef.delete();

      // Unassign students from this batch
      const studentsInBatch = await getStudentsCol(instituteId).where("batchId", "==", batchId).get();
      const batchWrite = firestore.batch();
      studentsInBatch.docs.forEach(d => batchWrite.update(d.ref, { batchId: null }));
      await batchWrite.commit();

      res.json({ success: true, message: `Batch ${batchId} deleted and students unassigned` });
    } catch (err: any) {
      console.error(`[Batch DELETE] Error for ${instituteId}/${batchId}:`, err);
      res.status(500).json({ error: "Failed to delete batch", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // ATTENDANCE & WHATSAPP ABSENTEE ALERTS (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.get("/api/attendance", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const snapshot = await getAttendanceCol(instituteId).get();
      const records: AttendanceRecord[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<AttendanceRecord, "id">)
      }));
      res.json(records);
    } catch (err: any) {
      console.error(`[Attendance GET] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to fetch attendance records", details: err.message });
    }
  });

  app.post("/api/attendance/mark", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const validation = validateAttendanceMarkInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.errors });
    }

    const { date, records } = req.body;

    try {
      const batchWrite = firestore.batch();
      const absentStudentsToAlert: { studentId: string; status: string }[] = [];

      for (const rec of records) {
        const docId = `${date}_${rec.studentId}`;
        const ref = getAttendanceCol(instituteId).doc(docId);
        batchWrite.set(ref, {
          date,
          studentId: rec.studentId,
          status: rec.status,
          markedAt: new Date().toISOString()
        });

        if (rec.status === "Absent") {
          absentStudentsToAlert.push(rec);
        }
      }
      await batchWrite.commit();

      // Dispatch automated WhatsApp alerts for absent students
      const dispatchedLogs: NotificationLog[] = [];
      for (const abs of absentStudentsToAlert) {
        const studentDoc = await getStudentsCol(instituteId).doc(abs.studentId).get();
        if (studentDoc.exists) {
          const sData = studentDoc.data() as Student;
          const mobile = sData.parentMobile || sData.alternateMobile;
          if (mobile) {
            const msgText = `Absence Alert: Dear ${sData.parentName || "Parent"}, ${sData.name} was marked ABSENT today (${date}). Please contact institute management if unexpected.`;
            const waRes = await sendMetaWhatsAppMessage(mobile, {
              type: "template",
              templateName: "hello_world",
              languageCode: "en_US"
            });

            const logId = generateId("LOG");
            const logEntry: NotificationLog = {
              id: logId,
              studentId: sData.id,
              type: "absent_alert",
              recipientMobile: mobile,
              text: msgText,
              sentAt: new Date().toISOString(),
              status: waRes.success ? "Sent" : "Failed",
              medium: "WhatsApp"
            };
            await getLogsCol(instituteId).doc(logId).set(logEntry);
            dispatchedLogs.push(logEntry);
          }
        }
      }

      res.json({
        success: true,
        message: `Marked attendance for ${records.length} students.`,
        absentCount: absentStudentsToAlert.length,
        dispatchedLogs
      });
    } catch (err: any) {
      console.error(`[Attendance Mark POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to mark attendance", details: err.message });
    }
  });

  app.post("/api/absent/send-whatsapp", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const { studentId, studentName, parentName, parentMobile, date, customMessage, instituteName } = req.body;

    if (!parentMobile) {
      return res.status(400).json({ error: "Parent mobile is required" });
    }

    try {
      const message = customMessage || `Absence Alert: Dear ${parentName || "Parent"}, ${studentName} was marked ABSENT on ${date} at ${instituteName || "ClasSetu"}.`;
      const waRes = await sendMetaWhatsAppMessage(parentMobile, {
        type: "template",
        templateName: "hello_world",
        languageCode: "en_US"
      });

      const logId = generateId("LOG");
      const logEntry: NotificationLog = {
        id: logId,
        studentId: studentId || "UNKNOWN",
        type: "absent_alert",
        recipientMobile: parentMobile,
        text: message,
        sentAt: new Date().toISOString(),
        status: waRes.success ? "Sent" : "Failed",
        medium: "WhatsApp"
      };

      await getLogsCol(instituteId).doc(logId).set(logEntry);

      res.json({
        success: waRes.success,
        messageId: waRes.messageId,
        log: logEntry,
        error: waRes.error
      });
    } catch (err: any) {
      console.error(`[Absent WhatsApp POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to send absent alert", details: err.message });
    }
  });

  app.post("/api/absent/bulk-whatsapp", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const { records, instituteName } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Records array is required" });
    }

    try {
      const results: NotificationLog[] = [];
      for (const item of records) {
        if (!item.parentMobile) continue;
        const msg = item.customMessage || `Absence Alert: Dear ${item.parentName || "Parent"}, ${item.studentName} was marked ABSENT on ${item.date} at ${instituteName || "ClasSetu"}.`;
        const waRes = await sendMetaWhatsAppMessage(item.parentMobile, {
          type: "template",
          templateName: "hello_world",
          languageCode: "en_US"
        });

        const logId = generateId("LOG");
        const logEntry: NotificationLog = {
          id: logId,
          studentId: item.studentId || "UNKNOWN",
          type: "absent_alert",
          recipientMobile: item.parentMobile,
          text: msg,
          sentAt: new Date().toISOString(),
          status: waRes.success ? "Sent" : "Failed",
          medium: "WhatsApp"
        };
        await getLogsCol(instituteId).doc(logId).set(logEntry);
        results.push(logEntry);
      }

      res.json({
        success: true,
        count: results.length,
        logs: results
      });
    } catch (err: any) {
      console.error(`[Bulk Absent WhatsApp POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to dispatch bulk absent alerts", details: err.message });
    }
  });

  app.get("/api/attendance/analytics", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const snapshot = await getAttendanceCol(instituteId).get();
      const records = snapshot.docs.map(d => d.data() as AttendanceRecord);
      const total = records.length;
      const present = records.filter(r => r.status === "Present").length;
      const absent = records.filter(r => r.status === "Absent").length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 100;

      res.json({
        totalRecords: total,
        presentCount: present,
        absentCount: absent,
        averageAttendanceRate: rate
      });
    } catch (err: any) {
      console.error(`[Attendance Analytics] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to compute attendance analytics", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // FEE INSTALLMENTS (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.get("/api/fees/installments", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const snapshot = await getInstallmentsCol(instituteId).get();
      const installments: FeeInstallment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<FeeInstallment, "id">)
      }));
      res.json(installments);
    } catch (err: any) {
      console.error(`[Fees GET] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to fetch fee installments", details: err.message });
    }
  });

  app.post("/api/fees/pay", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const validation = validateFeePaymentInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.errors });
    }

    const { installmentId, amount, paymentDate } = req.body;

    try {
      const docRef = getInstallmentsCol(instituteId).doc(installmentId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: `Installment ${installmentId} not found` });
      }

      const inst = docSnap.data() as FeeInstallment;
      const payAmount = Number(amount) || inst.amount;
      const newPaid = Math.min(inst.amount, (inst.paidAmount || 0) + payAmount);
      const newStatus = newPaid >= inst.amount ? "Paid" : "Partially Paid";
      const pDate = paymentDate || new Date().toISOString().split("T")[0];

      await docRef.update({
        paidAmount: newPaid,
        status: newStatus,
        paymentDate: pDate
      });

      res.json({
        success: true,
        installment: {
          ...inst,
          paidAmount: newPaid,
          status: newStatus,
          paymentDate: pDate
        }
      });
    } catch (err: any) {
      console.error(`[Fee Pay POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to process fee payment", details: err.message });
    }
  });

  app.post("/api/fees/reminder-trigger", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const { studentId, studentName, parentName, parentMobile, dueAmount, dueDate, instituteName } = req.body;

    if (!parentMobile) {
      return res.status(400).json({ error: "Parent mobile is required" });
    }

    try {
      const msg = `Fee Due Alert: Hello ${parentName || "Parent"}, ${studentName} has a pending fee installment of ₹${dueAmount} due on ${dueDate}. Please settle at ${instituteName || "ClasSetu"}.`;
      const waRes = await sendMetaWhatsAppMessage(parentMobile, {
        type: "template",
        templateName: "hello_world",
        languageCode: "en_US"
      });

      const logId = generateId("LOG");
      const logEntry: NotificationLog = {
        id: logId,
        studentId: studentId || "UNKNOWN",
        type: "fee_reminder",
        recipientMobile: parentMobile,
        text: msg,
        sentAt: new Date().toISOString(),
        status: waRes.success ? "Sent" : "Failed",
        medium: "WhatsApp"
      };

      await getLogsCol(instituteId).doc(logId).set(logEntry);

      res.json({
        success: waRes.success,
        log: logEntry,
        messageId: waRes.messageId
      });
    } catch (err: any) {
      console.error(`[Fee Reminder POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to send fee reminder", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // NOTICES (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.get("/api/notices", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const snapshot = await getNoticesCol(instituteId).get();
      const notices: Notice[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Notice, "id">)
      }));
      res.json(notices);
    } catch (err: any) {
      console.error(`[Notices GET] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to fetch notices", details: err.message });
    }
  });

  app.post("/api/notices", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const validation = validateNoticeInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: "Validation failed", details: validation.errors });
    }

    try {
      const noticeId = req.body.id || generateId("NTC");
      const newNotice: Notice = {
        id: noticeId,
        title: req.body.title.trim(),
        body: req.body.body.trim(),
        recipientType: req.body.recipientType || "All Students",
        recipients: Array.isArray(req.body.recipients) ? req.body.recipients : [],
        sentAt: new Date().toISOString(),
        status: "Delivered"
      };

      await getNoticesCol(instituteId).doc(noticeId).set(newNotice);
      res.status(201).json(newNotice);
    } catch (err: any) {
      console.error(`[Notice POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to post notice", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // AUDIT & NOTIFICATION LOGS (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.get("/api/logs", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const snapshot = await getLogsCol(instituteId).get();
      const logs: NotificationLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<NotificationLog, "id">)
      }));
      // Sort newest first
      logs.sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime());
      res.json(logs);
    } catch (err: any) {
      console.error(`[Logs GET] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to fetch logs", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // WHATSAPP CONFIGURATION (TOKEN MASKED - NO RAW TOKEN LEAK)
  // -------------------------------------------------------------
  app.get("/api/whatsapp/config", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const doc = await getInstituteDoc(instituteId).get();
      const data = doc.data() || {};
      const waConfig: MetaWhatsAppConfig = data.whatsappConfig || activeWhatsAppConfig;

      const token = waConfig.accessToken || "";
      const hasToken = Boolean(token);
      // STRICT MASKING: Never leak the raw accessToken
      const maskedToken = hasToken
        ? `${token.substring(0, 6)}...${token.slice(-4)}`
        : "";

      res.json({
        configured: Boolean(token && waConfig.phoneNumberId),
        maskedToken, // ONLY MASKED TOKEN RETURNED!
        phoneNumberId: waConfig.phoneNumberId || "",
        businessAccountId: waConfig.businessAccountId || "",
        defaultTemplate: waConfig.defaultTemplate || "hello_world",
        languageCode: waConfig.languageCode || "en_US"
      });
    } catch (err: any) {
      console.error(`[WhatsApp Config GET] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to retrieve WhatsApp config", details: err.message });
    }
  });

  app.post("/api/whatsapp/config", sensitiveLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const { accessToken, phoneNumberId, businessAccountId, defaultTemplate, languageCode } = req.body;

    try {
      const doc = await getInstituteDoc(instituteId).get();
      const existingConfig = doc.data()?.whatsappConfig || activeWhatsAppConfig;

      const updatedConfig: MetaWhatsAppConfig = {
        accessToken: accessToken !== undefined && accessToken !== "" ? String(accessToken).trim() : existingConfig.accessToken,
        phoneNumberId: phoneNumberId !== undefined ? String(phoneNumberId).trim() : existingConfig.phoneNumberId,
        businessAccountId: businessAccountId !== undefined ? String(businessAccountId).trim() : existingConfig.businessAccountId,
        defaultTemplate: defaultTemplate !== undefined ? String(defaultTemplate).trim() || "hello_world" : existingConfig.defaultTemplate,
        languageCode: languageCode !== undefined ? String(languageCode).trim() || "en_US" : existingConfig.languageCode
      };

      await getInstituteDoc(instituteId).set({ whatsappConfig: updatedConfig }, { merge: true });

      const token = updatedConfig.accessToken || "";
      const maskedToken = token.length > 8 ? `${token.substring(0, 6)}...${token.slice(-4)}` : (token ? "******" : "");

      res.json({
        success: true,
        message: "Meta WhatsApp credentials updated successfully",
        config: {
          configured: Boolean(token && updatedConfig.phoneNumberId),
          maskedToken,
          phoneNumberId: updatedConfig.phoneNumberId,
          businessAccountId: updatedConfig.businessAccountId,
          defaultTemplate: updatedConfig.defaultTemplate,
          languageCode: updatedConfig.languageCode
        }
      });
    } catch (err: any) {
      console.error(`[WhatsApp Config POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to save WhatsApp config", details: err.message });
    }
  });

  app.post("/api/whatsapp/test-send", sensitiveLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const { testMobile, customMessage } = req.body;

    if (!testMobile) {
      return res.status(400).json({ error: "testMobile is required" });
    }

    try {
      const doc = await getInstituteDoc(instituteId).get();
      const waConfig: MetaWhatsAppConfig = doc.data()?.whatsappConfig || activeWhatsAppConfig;

      const result = await sendMetaWhatsAppMessage(testMobile, {
        type: "template",
        templateName: waConfig.defaultTemplate || "hello_world",
        languageCode: waConfig.languageCode || "en_US",
        parameters: [],
        overrideConfig: waConfig
      });

      const logId = generateId("LOG");
      const logEntry: NotificationLog = {
        id: logId,
        studentId: "TEST_RECIPIENT",
        type: "notice",
        recipientMobile: testMobile,
        text: customMessage || "Meta WhatsApp Cloud API Gateway Verification Test",
        sentAt: new Date().toISOString(),
        status: result.success ? "Sent" : "Failed",
        medium: "WhatsApp"
      };

      await getLogsCol(instituteId).doc(logId).set(logEntry);

      res.json({
        success: result.success,
        message: result.success ? "Test message dispatched successfully" : result.error,
        details: result
      });
    } catch (err: any) {
      console.error(`[WhatsApp Test POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to dispatch test message", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // GEMINI AI BATCH SCHEDULING (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.post("/api/ai/schedule", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    try {
      const [stuSnap, batSnap] = await Promise.all([
        getStudentsCol(instituteId).get(),
        getBatchesCol(instituteId).get()
      ]);

      const students = stuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const batches = batSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const systemPrompt = `You are the ClasSetu AI Smart Batch Scheduler Assistant.
Analyze student availability, tuition timing preferences, and current batch capacities.
Output a JSON object with:
- "analysis": summary text
- "assignments": array of { "studentId": string, "batchId": string, "reason": string }`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\nStudents:\n${JSON.stringify(students)}\n\nBatches:\n${JSON.stringify(batches)}` }] }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const json = JSON.parse(response.text || "{}");
      res.json(json);
    } catch (err: any) {
      console.error(`[AI Schedule POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to generate AI schedule", details: err.message });
    }
  });

  app.post("/api/ai/finalize", writeLimiter, async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const { assignments } = req.body;

    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: "Assignments array is required" });
    }

    try {
      const batchWrite = firestore.batch();
      for (const item of assignments) {
        if (item.studentId && item.batchId) {
          const ref = getStudentsCol(instituteId).doc(item.studentId);
          batchWrite.update(ref, {
            batchId: item.batchId,
            updatedAt: new Date().toISOString()
          });
        }
      }
      await batchWrite.commit();
      res.json({ success: true, count: assignments.length });
    } catch (err: any) {
      console.error(`[AI Finalize POST] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to finalize schedule", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // REPORTS DOWNLOAD (Scoped to req.instituteId)
  // -------------------------------------------------------------
  app.get("/api/reports/download", async (req: AuthenticatedRequest, res) => {
    const instituteId = req.instituteId!;
    const { type } = req.query;

    try {
      if (type === "students") {
        const snap = await getStudentsCol(instituteId).get();
        const students = snap.docs.map(d => d.data() as Student);
        let csv = "ID,Name,Parent Name,Parent Mobile,Class,Fees Amount,Status\n";
        students.forEach(s => {
          csv += `"${s.id}","${s.name}","${s.parentName}","${s.parentMobile}","${s.class}",${s.feesAmount},"${s.status}"\n`;
        });
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="students.csv"');
        return res.send(csv);
      }

      const snap = await getAttendanceCol(instituteId).get();
      const records = snap.docs.map(d => d.data() as AttendanceRecord);
      let csv = "Date,Student ID,Status\n";
      records.forEach(r => {
        csv += `"${r.date}","${r.studentId}","${r.status}"\n`;
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="attendance.csv"');
      return res.send(csv);
    } catch (err: any) {
      console.error(`[Reports Download] Error for ${instituteId}:`, err);
      res.status(500).json({ error: "Failed to generate report", details: err.message });
    }
  });

  return app;
}

// ==========================================
// 8. SERVER BOOTSTRAP (Dev & Production)
// ==========================================
async function startServer() {
  const isServerless = process.env.NETLIFY === "true" || process.env.LAMBDA_TASK_ROOT !== undefined;
  if (isServerless) {
    return;
  }

  const app = await createExpressApp();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ClasSetu secure server running on http://localhost:${PORT}`);
  });
}

startServer();
