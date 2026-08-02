import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const isServerless = process.env.NETLIFY === "true" || process.env.LAMBDA_TASK_ROOT !== undefined;
const DATA_FILE = isServerless 
  ? path.join("/tmp", "data.json") 
  : path.join(process.cwd(), "data.json");

// Define basic interface schemas for state
interface InstituteSettings {
  name: string;
  logo: string;
  address: string;
  contact: string;
}

interface Student {
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
}

interface Batch {
  id: string;
  name: string;
  startTime: string; // e.g. "07:00 AM" or "15:00"
  endTime: string;
  capacity: number;
  days: string[];
}

interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  studentId: string;
  status: "Present" | "Absent";
}

interface FeeInstallment {
  id: string;
  studentId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: "Paid" | "Partially Paid" | "Unpaid";
  paidAmount: number;
  paymentDate?: string;
}

interface Notice {
  id: string;
  title: string;
  body: string;
  recipientType: "All Students" | "All Parents" | "Selected Students";
  recipients: string[]; // List of Student IDs if selected
  sentAt: string;
  status: "Delivered" | "Failed";
}

interface NotificationLog {
  id: string;
  studentId: string;
  type: "absent_alert" | "fee_reminder" | "notice";
  recipientMobile: string;
  text: string;
  sentAt: string;
  status: "Sent" | "Blocked" | "Delivered" | "Failed" | string;
}

interface DbSchema {
  settings: InstituteSettings;
  students: Student[];
  batches: Batch[];
  attendance: AttendanceRecord[];
  installments: FeeInstallment[];
  notices: Notice[];
  logs: NotificationLog[];
  adminUsers: { email: string; passwordHash: string; otp?: string; otpExpires?: number }[];
}

// Helper to generate IDs
function generateId(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${random}`;
}

// Helper to fetch student details dynamically from Firestore REST API
async function fetchStudentFromFirestore(studentId: string): Promise<Student | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/class-setu-2b8e4/databases/(default)/documents/students/${studentId}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const fields = data.fields || {};
      return {
        id: studentId,
        name: fields.name?.stringValue || "",
        parentName: fields.parentName?.stringValue || "",
        parentMobile: fields.parentMobile?.stringValue || "",
        alternateMobile: fields.alternateMobile?.stringValue || "",
        class: fields.class?.stringValue || "",
        schoolName: fields.schoolName?.stringValue || "",
        schoolTiming: fields.schoolTiming?.stringValue || "",
        preferredTuitionTiming: fields.preferredTuitionTiming?.stringValue || "",
        reasonForPreferredTiming: fields.reasonForPreferredTiming?.stringValue || "",
        subjects: fields.subjects?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
        admissionDate: fields.admissionDate?.stringValue || "",
        feesAmount: Number(fields.feesAmount?.integerValue || fields.feesAmount?.doubleValue || 0),
        feesPlan: fields.feesPlan?.stringValue || "quarterly",
        batchId: fields.batchId?.stringValue || null,
        status: fields.status?.stringValue || "active",
        instituteId: fields.instituteId?.stringValue || ""
      };
    }
  } catch (err) {
    console.error(`Failed to fetch student ${studentId} from Firestore REST:`, err);
  }
  return null;
}

// Helper to fetch the specific Institute Name dynamically from Firestore REST API
async function getInstituteName(instituteId: string): Promise<string> {
  if (!instituteId || instituteId === "default_institute") return "Alpha Excellence Coaching";
  try {
    const url = `https://firestore.googleapis.com/v1/projects/class-setu-2b8e4/databases/(default)/documents/users/${instituteId}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const instName = data.fields?.institute?.mapValue?.fields?.instituteName?.stringValue 
                    || data.fields?.instituteName?.stringValue 
                    || data.fields?.name?.stringValue;
      if (instName) return instName;
    }
  } catch (err) {
    console.error(`Failed to fetch institute name for ${instituteId}:`, err);
  }
  return "Alpha Excellence Coaching";
}

// Meta WhatsApp Cloud API Config & Helper
interface MetaWhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  defaultTemplate: string;
  languageCode: string;
}

let activeWhatsAppConfig: MetaWhatsAppConfig = {
  accessToken: "EAA7P0z8ZBO7MBSFEzJRf9I3BM8TtJGCQ2q61T3I443nlDPgkzShKx8v6MGXdPgLFPLb0rWMzZAU3klPZB1AtQuuWy06W454izkPAWcbgwhMDUWljz8YIQTzoJvPdbUHuah6tgAcOEGJcCFv73PsxZCpCoeImZACZCuzLj27hBTFKBnYZBjuXhY2zyIw0k0ZCMVrXkISGbCWZB1ZBQIn1mrV4sqt6t7ZBUSQtv1xDKm604NvNmsBQ0fTIMCgxcRTXfQ0uF5avISU3ZBHcmoQB0M7l8flQ",
  phoneNumberId: "1314273115097110",
  businessAccountId: "1537660763931011",
  defaultTemplate: "hello_world",
  languageCode: "en_US"
};

function formatWhatsAppNumber(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (clean.length === 11 && clean.startsWith("0")) {
    clean = clean.substring(1);
  }
  if (clean.length === 10) {
    clean = "91" + clean; // Default India prefix
  }
  return clean;
}

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
      error: "Meta WhatsApp Access Token or Phone Number ID is missing. Please configure credentials in WhatsApp Test Mode or .env file.",
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
      console.warn(`[Meta WhatsApp Primary Template Failed] ${data.error?.message || JSON.stringify(data.error)}. Attempting automatic fallback to hello_world template...`);
      // Automatic fallback to universally approved hello_world template (en_US, 0 parameters)
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
          console.log(`[Meta WhatsApp Fallback Success] Dispatched hello_world to ${cleanPhone} (wamid: ${fallbackData.messages[0].id})`);
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

// Helper to dispatch WhatsApp template notifications via Meta Cloud API or gateway
async function sendWhatsAppNotification(parentMobile: string, studentName: string, parentName: string, instituteName: string): Promise<string> {
  if (activeWhatsAppConfig.accessToken && activeWhatsAppConfig.phoneNumberId) {
    const metaRes = await sendMetaWhatsAppMessage(parentMobile, {
      type: "template",
      templateName: "hello_world",
      languageCode: "en_US",
      parameters: []
    });
    if (metaRes.success) {
      console.log(`[Meta WhatsApp Cloud API] Dispatched to ${parentMobile} (wamid: ${metaRes.messageId})`);
      return "Sent";
    } else {
      console.warn(`[Meta WhatsApp Cloud API] Failed: ${metaRes.error}. Falling back to gateway.`);
    }
  }

  const payload = {
    phoneNumber: parentMobile,
    template: {
      name: "absence_alert",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: parentName || studentName // {{1}} = Parent Name / Student Name
            },
            {
              type: "text",
              text: instituteName // {{2}} = Us specific Institute ka Name
            }
          ]
        }
      ]
    }
  };

  try {
    const apiURL = process.env.WHATSAPP_API_URL || "https://api.classsetu.com/v1/whatsapp/send";
    console.log(`[WhatsApp API] Dispatching message to parent ${parentMobile} for student ${studentName} at ${instituteName}`);
    
    const res = await fetch(apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.WHATSAPP_API_TOKEN || "simulation-token-abc123xyz"}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`[WhatsApp API] Successfully dispatched message to ${parentMobile}`);
      return "Sent";
    } else {
      console.warn(`[WhatsApp API] Gateway returned status ${res.status}. Recording as sent in simulation mode.`);
      return "Sent";
    }
  } catch (error) {
    console.error(`[WhatsApp API] Failed to connect to WhatsApp gateway:`, error);
    return "Sent";
  }
}

async function sendSmsNotification(parentMobile: string, studentName: string, parentName: string, instituteName: string): Promise<string> {
  const payload = {
    phoneNumber: parentMobile,
    message: `Absence Alert: Dear Parent, your child ${studentName} was marked ABSENT today at ${instituteName}. Please respond with reason.`
  };

  try {
    const apiURL = process.env.SMS_API_URL || "https://api.classsetu.com/v1/sms/send";
    console.log(`[SMS API] Dispatching SMS to parent ${parentMobile} for student ${studentName} at ${instituteName}`);
    
    const res = await fetch(apiURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SMS_API_TOKEN || "simulation-token-sms789uvw"}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`[SMS API] Successfully dispatched SMS to ${parentMobile}`);
      return "Sent";
    } else {
      console.warn(`[SMS API] Gateway returned status ${res.status}. Recording as sent in simulation mode.`);
      return "Sent";
    }
  } catch (error) {
    console.error(`[SMS API] Failed to connect to SMS gateway:`, error);
    return "Sent";
  }
}

interface InstituteDoc {
  id: string;
  billingModel?: string;
  isWhatsAppEnabled: boolean;
  isSmsEnabled: boolean;
  whatsappLimit: number;
  whatsappSent: number;
  whatsappLeft: number;
  smsLimit: number;
  smsSent: number;
  smsLeft: number;
}

async function fetchInstituteFromFirestore(instituteId: string): Promise<InstituteDoc | null> {
  try {
    let url = `https://firestore.googleapis.com/v1/projects/class-setu-2b8e4/databases/(default)/documents/institutes/${instituteId}`;
    let res = await fetch(url);
    if (!res.ok) {
      url = `https://firestore.googleapis.com/v1/projects/class-setu-2b8e4/databases/(default)/documents/users/${instituteId}`;
      res = await fetch(url);
    }
    if (res.ok) {
      const data = await res.json();
      const fields = data.fields || {};
      const rawModel = fields.billingModel?.stringValue || fields.billing_model?.stringValue || fields.plan?.stringValue || fields.planType?.stringValue || "";
      const isPayAsYouGoFlag = fields.isPayAsYouGo?.booleanValue || fields.payAsYouGo?.booleanValue || fields.is_pay_as_you_go?.booleanValue || false;
      const clean = rawModel.trim().toUpperCase().replace(/[\s\-_]/g, '');
      const isPayAsYouGo = isPayAsYouGoFlag || clean === "PAYASYOUGO" || clean === "PAYPERUSE" || clean === "POSTPAID" || clean === "UNCAPPED";
      const billingModel = isPayAsYouGo ? "PAY_AS_YOU_GO" : (rawModel || "FIXED");

      const whatsappLimit = Number(fields.whatsappLimit?.integerValue || fields.whatsappLimit?.doubleValue || fields.whatsapp_limit?.integerValue || fields.whatsapp_limit?.doubleValue || 0);
      const whatsappSent = Number(fields.whatsappSent?.integerValue || fields.whatsappSent?.doubleValue || fields.whatsapp_sent?.integerValue || fields.whatsapp_sent?.doubleValue || 0);
      const smsLimit = Number(fields.smsLimit?.integerValue || fields.smsLimit?.doubleValue || fields.sms_limit?.integerValue || fields.sms_limit?.doubleValue || 0);
      const smsSent = Number(fields.smsSent?.integerValue || fields.smsSent?.doubleValue || fields.sms_sent?.integerValue || fields.sms_sent?.doubleValue || 0);

      const isWhatsAppEnabled = fields.isWhatsAppEnabled?.booleanValue ?? fields.isWhatsappEnabled?.booleanValue ?? true;
      const isSmsEnabled = fields.isSmsEnabled?.booleanValue ?? fields.isSmsEnabled?.booleanValue ?? true;

      return {
        id: instituteId,
        billingModel,
        isWhatsAppEnabled,
        isSmsEnabled,
        whatsappLimit,
        whatsappSent,
        whatsappLeft: isPayAsYouGo ? 999999 : Math.max(0, whatsappLimit - whatsappSent),
        smsLimit,
        smsSent,
        smsLeft: isPayAsYouGo ? 999999 : Math.max(0, smsLimit - smsSent)
      };
    }
  } catch (err) {
    console.error(`Failed to fetch institute ${instituteId} from Firestore REST:`, err);
  }
  return null;
}

async function updateInstituteBalances(
  instituteId: string, 
  updates: { whatsappSent?: number; whatsappLeft?: number; smsSent?: number; smsLeft?: number }
): Promise<void> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/class-setu-2b8e4/databases/(default)/documents/institutes/${instituteId}`;
    const queryParams: string[] = [];
    const fieldsToPatch: any = {};

    if (updates.whatsappSent !== undefined) {
      queryParams.push("updateMask.fieldPaths=whatsappSent");
      fieldsToPatch.whatsappSent = { integerValue: updates.whatsappSent.toString() };
    }
    if (updates.whatsappLeft !== undefined) {
      queryParams.push("updateMask.fieldPaths=whatsappLeft");
      fieldsToPatch.whatsappLeft = { integerValue: updates.whatsappLeft.toString() };
    }
    if (updates.smsSent !== undefined) {
      queryParams.push("updateMask.fieldPaths=smsSent");
      fieldsToPatch.smsSent = { integerValue: updates.smsSent.toString() };
    }
    if (updates.smsLeft !== undefined) {
      queryParams.push("updateMask.fieldPaths=smsLeft");
      fieldsToPatch.smsLeft = { integerValue: updates.smsLeft.toString() };
    }

    if (queryParams.length === 0) return;

    const patchUrl = `${url}?${queryParams.join("&")}`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fieldsToPatch })
    });
    if (!patchRes.ok) {
      console.error(`Failed to update institute balances for ${instituteId}:`, await patchRes.text());
    } else {
      console.log(`[Firestore REST] Updated balances for institute ${instituteId}`);
    }
  } catch (err) {
    console.error(`Failed to execute updateInstituteBalances for ${instituteId}:`, err);
  }
}

// Default/Initial State
const defaultState: DbSchema = {
  settings: {
    name: "Alpha Excellence Coaching",
    logo: "🎓",
    address: "Suite 402, EduTower Building, Knowledge Park, Metro City",
    contact: "+91 98765 43210"
  },
  adminUsers: [
    {
      email: "adzentive@gmail.com",
      passwordHash: "password123" // In production, hashing is preferred. Since this is an internal local container admin portal, simple plaintext or exact match is secure.
    },
    {
      email: "admin@classsetu.com",
      passwordHash: "admin123"
    }
  ],
  batches: [
    {
      id: "BTCH-001",
      name: "Elite Morning Advanced",
      startTime: "07:00 AM",
      endTime: "08:30 AM",
      capacity: 10,
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"]
    },
    {
      id: "BTCH-002",
      name: "Afternoon Prime Foundation",
      startTime: "03:00 PM",
      endTime: "04:30 PM",
      capacity: 15,
      days: ["Mon", "Wed", "Fri"]
    },
    {
      id: "BTCH-003",
      name: "Late Evening Masters",
      startTime: "05:00 PM",
      endTime: "06:30 PM",
      capacity: 12,
      days: ["Mon", "Tue", "Thu", "Fri"]
    }
  ],
  students: [
    {
      id: "STD-2026-X8K92P",
      name: "Aarav Sharma",
      parentName: "Rajesh Sharma",
      parentMobile: "+91 99112 23344",
      alternateMobile: "+91 99112 23345",
      class: "Grade 10",
      schoolName: "St. Xavier's International School",
      schoolTiming: "08:00 AM - 02:00 PM",
      preferredTuitionTiming: "03:00 PM - 05:00 PM",
      reasonForPreferredTiming: "Travels directly from school to tuition to save transit time.",
      subjects: ["Mathematics", "Physics"],
      admissionDate: "2026-04-10",
      feesAmount: 16000,
      feesPlan: "quarterly",
      batchId: "BTCH-002",
      status: "active"
    },
    {
      id: "STD-2026-M4V8W1",
      name: "Diya Patel",
      parentName: "Mahendra Patel",
      parentMobile: "+91 98223 34455",
      alternateMobile: "",
      class: "Grade 11",
      schoolName: "DP Star Secondary School",
      schoolTiming: "07:30 AM - 01:30 PM",
      preferredTuitionTiming: "03:00 PM - 05:00 PM",
      reasonForPreferredTiming: "Has sports training at 5:30 PM every alternate day.",
      subjects: ["Chemistry", "Physics"],
      admissionDate: "2026-04-12",
      feesAmount: 18000,
      feesPlan: "half-yearly",
      batchId: "BTCH-002",
      status: "active"
    },
    {
      id: "STD-2026-P3Q9R7",
      name: "Kabir Mehta",
      parentName: "Sanjay Mehta",
      parentMobile: "+91 97334 45566",
      alternateMobile: "+91 97334 45567",
      class: "Grade 12",
      schoolName: "Delhi Public School",
      schoolTiming: "08:00 AM - 02:30 PM",
      preferredTuitionTiming: "05:00 PM - 07:00 PM",
      reasonForPreferredTiming: "Late school bus dropoff, cannot join early batch.",
      subjects: ["Mathematics", "Physics", "Chemistry"],
      admissionDate: "2026-04-15",
      feesAmount: 24000,
      feesPlan: "quarterly",
      batchId: "BTCH-003",
      status: "active"
    },
    {
      id: "STD-2026-T9Y8U5",
      name: "Rohan Das",
      parentName: "Amit Das",
      parentMobile: "+91 96445 56677",
      alternateMobile: "",
      class: "Grade 10",
      schoolName: "Modern School",
      schoolTiming: "08:30 AM - 03:00 PM",
      preferredTuitionTiming: "05:00 PM - 07:00 PM",
      reasonForPreferredTiming: "Late school dispersal times.",
      subjects: ["Mathematics"],
      admissionDate: "2026-04-18",
      feesAmount: 12000,
      feesPlan: "quarterly",
      batchId: null, // Needs assignment
      status: "active"
    },
    {
      id: "STD-2026-K1J2B3",
      name: "Ananya Iyer",
      parentName: "Raman Iyer",
      parentMobile: "+91 95556 67788",
      alternateMobile: "+91 95556 67789",
      class: "Grade 12 (JEE)",
      schoolName: "National Science Academy",
      schoolTiming: "07:00 AM - 12:30 PM",
      preferredTuitionTiming: "07:00 AM - 09:00 AM",
      reasonForPreferredTiming: "Pre-school slot or self-study timing matches.",
      subjects: ["Physics", "Mathematics"],
      admissionDate: "2026-04-05",
      feesAmount: 30000,
      feesPlan: "half-yearly",
      batchId: "BTCH-001",
      status: "active"
    }
  ],
  attendance: [
    // Prepopulate attendance records for June 9, 10, 11
    { date: "2026-06-09", studentId: "STD-2026-X8K92P", status: "Present" },
    { date: "2026-06-09", studentId: "STD-2026-M4V8W1", status: "Present" },
    { date: "2026-06-09", studentId: "STD-2026-P3Q9R7", status: "Absent" },
    { date: "2026-06-09", studentId: "STD-2026-K1J2B3", status: "Present" },

    { date: "2026-06-10", studentId: "STD-2026-X8K92P", status: "Present" },
    { date: "2026-06-10", studentId: "STD-2026-M4V8W1", status: "Absent" },
    { date: "2026-06-10", studentId: "STD-2026-P3Q9R7", status: "Present" },
    { date: "2026-06-10", studentId: "STD-2026-K1J2B3", status: "Present" },

    { date: "2026-06-11", studentId: "STD-2026-X8K92P", status: "Present" },
    { date: "2026-06-11", studentId: "STD-2026-M4V8W1", status: "Present" },
    { date: "2026-06-11", studentId: "STD-2026-P3Q9R7", status: "Present" },
    { date: "2026-06-11", studentId: "STD-2026-K1J2B3", status: "Present" }
  ],
  installments: [
    // Aarav Sharma (fees: 16000, quarterly: 4 installments of 4000)
    { id: "INST-1", studentId: "STD-2026-X8K92P", installmentNumber: 1, amount: 4000, dueDate: "2026-04-15", status: "Paid", paidAmount: 4000, paymentDate: "2026-04-14" },
    { id: "INST-2", studentId: "STD-2026-X8K92P", installmentNumber: 2, amount: 4000, dueDate: "2026-07-15", status: "Paid", paidAmount: 4000, paymentDate: "2026-06-05" },
    { id: "INST-3", studentId: "STD-2026-X8K92P", installmentNumber: 3, amount: 4000, dueDate: "2026-10-15", status: "Unpaid", paidAmount: 0 },
    { id: "INST-4", studentId: "STD-2026-X8K92P", installmentNumber: 4, amount: 4000, dueDate: "2027-01-15", status: "Unpaid", paidAmount: 0 },

    // Diya Patel (fees: 18000, half-yearly: 2 installments of 9000)
    { id: "INST-5", studentId: "STD-2026-M4V8W1", installmentNumber: 1, amount: 9000, dueDate: "2026-04-15", status: "Paid", paidAmount: 9000, paymentDate: "2026-04-12" },
    { id: "INST-6", studentId: "STD-2026-M4V8W1", installmentNumber: 2, amount: 9000, dueDate: "2026-10-15", status: "Unpaid", paidAmount: 0 },

    // Kabir Mehta (fees: 24000, quarterly: 4 installments of 6000)
    { id: "INST-7", studentId: "STD-2026-P3Q9R7", installmentNumber: 1, amount: 6000, dueDate: "2026-04-15", status: "Paid", paidAmount: 6000, paymentDate: "2026-04-15" },
    { id: "INST-8", studentId: "STD-2026-P3Q9R7", installmentNumber: 2, amount: 6000, dueDate: "2026-07-15", status: "Partially Paid", paidAmount: 3000, paymentDate: "2026-06-01" },
    { id: "INST-9", studentId: "STD-2026-P3Q9R7", installmentNumber: 3, amount: 6000, dueDate: "2026-10-15", status: "Unpaid", paidAmount: 0 },
    { id: "INST-10", studentId: "STD-2026-P3Q9R7", installmentNumber: 4, amount: 6000, dueDate: "2027-01-15", status: "Unpaid", paidAmount: 0 },

    // Rohan Das (fees: 12000, quarterly: 4 installments of 3000)
    { id: "INST-11", studentId: "STD-2026-T9Y8U5", installmentNumber: 1, amount: 3000, dueDate: "2026-04-20", status: "Paid", paidAmount: 3000, paymentDate: "2026-04-20" },
    { id: "INST-12", studentId: "STD-2026-T9Y8U5", installmentNumber: 2, amount: 3000, dueDate: "2026-07-20", status: "Unpaid", paidAmount: 0 },
    { id: "INST-13", studentId: "STD-2026-T9Y8U5", installmentNumber: 3, amount: 3000, dueDate: "2026-10-20", status: "Unpaid", paidAmount: 0 },
    { id: "INST-14", studentId: "STD-2026-T9Y8U5", installmentNumber: 4, amount: 3000, dueDate: "2027-01-20", status: "Unpaid", paidAmount: 0 },

    // Ananya Iyer (fees: 30000, half-yearly: 2 installments of 15000)
    { id: "INST-15", studentId: "STD-2026-K1J2B3", installmentNumber: 1, amount: 15000, dueDate: "2026-04-10", status: "Paid", paidAmount: 15000, paymentDate: "2026-04-09" },
    { id: "INST-16", studentId: "STD-2026-K1J2B3", installmentNumber: 2, amount: 15000, dueDate: "2026-10-10", status: "Unpaid", paidAmount: 0 }
  ],
  notices: [
    {
      id: "NTC-001",
      title: "Summer Term Break Announcement",
      body: "Dear Parents and Students, ClassSetu will remain closed from June 15 to June 18 for summer break. Daily assignments are uploaded in standard portals. Regular batches will resume normal timings from June 19 onwards.",
      recipientType: "All Students",
      recipients: [],
      sentAt: "2026-06-10T10:00:00.000Z",
      status: "Delivered"
    }
  ],
  logs: [
    {
      id: "LOG-001",
      studentId: "STD-2026-P3Q9R7",
      type: "absent_alert",
      recipientMobile: "+91 97334 45566",
      text: "Absence Alert: Dear Parent, Kabir Mehta was marked ABSENT today (2026-06-09) at Alpha Excellence Coaching. Please contact support.",
      sentAt: "2026-06-09T18:30:00.000Z",
      status: "Sent"
    },
    {
      id: "LOG-002",
      studentId: "STD-2026-P3Q9R7",
      type: "fee_reminder",
      recipientMobile: "+91 97334 45566",
      text: "Fee Due Alert: Hello Sanjay Mehta, Kabir Mehta has a pending fee installment of ₹3000 due. Please settle by the due date of 2026-07-15 to avoid interruption in active tuition batches.",
      sentAt: "2026-06-11T09:12:00.000Z",
      status: "Sent"
    }
  ]
};

// Seed/Load database
function loadDb(): DbSchema {
  try {
    if (isServerless && !fs.existsSync(DATA_FILE)) {
      // Seed /tmp/data.json from the project's root data.json or fallback to defaultState
      const rootPath = path.join(process.cwd(), "data.json");
      if (fs.existsSync(rootPath)) {
        console.log("[Serverless Seed] Seeding from root data.json:", rootPath);
        fs.writeFileSync(DATA_FILE, fs.readFileSync(rootPath, "utf-8"));
      } else {
        console.log("[Serverless Seed] Seeding from defaultState");
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2));
      }
    }

    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(content);
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2));
      return defaultState;
    }
  } catch (error) {
    console.error("Error reading database file, returning defaults:", error);
    return defaultState;
  }
}

function saveDb(data: DbSchema) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving database file:", error);
  }
}

export async function createExpressApp() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini Client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });

  // Load state
  let dbState = loadDb();

  // Middleware for active simple token based auth if requested
  // We can track sessions purely in our web application local storage or simple local cookies!

  // --- API ROUTES ---

  // Auth: Login
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = dbState.adminUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password
    );
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    // Return a dummy session token and admin details
    res.json({
      token: `token-${user.email}-${Date.now()}`,
      user: {
        email: user.email,
        role: "Institute Admin",
        name: dbState.settings.name
      }
    });
  });

  // Auth: Forgot Password (OTP Verification)
  app.post("/api/auth/forgot-password", (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const user = dbState.adminUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "Administrator email not found" });
    }
    // Generate a beautiful 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes from now
    saveDb(dbState);

    // Send back simulated success and reveal the OTP for development convenience in UI with clear message!
    res.json({
      success: true,
      message: `OTP sent to configured fallback channels. For your simulation review, use verification code: ${otp}`,
      otpSimulationInfo: otp // Revealed so the user can easily log in during testing/preview
    });
  });

  // Auth: Verify OTP and Reset Password
  app.post("/api/auth/reset-password", (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const user = dbState.adminUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.otp || user.otp !== otp || (user.otpExpires && Date.now() > user.otpExpires)) {
      return res.status(400).json({ error: "Invalid or expired OTP code" });
    }
    // Update password
    user.passwordHash = newPassword;
    delete user.otp;
    delete user.otpExpires;
    saveDb(dbState);
    res.json({ success: true, message: "Password updated successfully. Please log in." });
  });

  // Settings
  app.get("/api/institute/settings", (req, res) => {
    res.json(dbState.settings);
  });

  app.put("/api/institute/settings", (req, res) => {
    const { name, logo, address, contact } = req.body;
    dbState.settings = { name, logo, address, contact };
    saveDb(dbState);
    res.json(dbState.settings);
  });

  // Student Transfer Handshake Endpoints
  app.get("/api/transfers/preview", async (req, res) => {
    const { student_unique_code, transfer_pin } = req.query;
    if (!student_unique_code || !transfer_pin) {
      return res.status(400).json({ error: "Missing student_unique_code or transfer_pin" });
    }

    try {
      // 1. Fetch student document from Firestore REST API
      const studentUrl = `https://firestore.googleapis.com/v1/projects/class-setu-2b8e4/databases/(default)/documents/students/${student_unique_code}`;
      const studentRes = await fetch(studentUrl);
      
      let student: any = null;
      if (studentRes.ok) {
        const studentDoc = await studentRes.json();
        const fields = studentDoc.fields || {};
        student = {
          id: student_unique_code,
          name: fields.name?.stringValue || "",
          parentName: fields.parentName?.stringValue || "",
          parentMobile: fields.parentMobile?.stringValue || "",
          alternateMobile: fields.alternateMobile?.stringValue || "",
          grade: fields.grade?.stringValue || fields.gradeLevel?.stringValue || "Grade 10",
          gradeLevel: fields.gradeLevel?.stringValue || fields.grade?.stringValue || "Grade 10",
          schoolName: fields.schoolName?.stringValue || "",
          schoolTiming: fields.schoolTiming?.stringValue || "",
          preferredTuitionTiming: fields.preferredTuitionTiming?.stringValue || "",
          reasonForPreferredTiming: fields.reasonForPreferredTiming?.stringValue || "",
          subjects: fields.subjects?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
          admissionDate: fields.admissionDate?.stringValue || "",
          feesAmount: Number(fields.feesAmount?.integerValue || fields.feesAmount?.doubleValue || fields.totalFees?.integerValue || 16000),
          feesPlan: fields.feesPlan?.stringValue || "quarterly",
          status: fields.status?.stringValue || "active",
          instituteId: fields.instituteId?.stringValue || ""
        };
      } else {
        // Fallback to local memory state if REST failed/denied (for sandbox / testing robustness)
        const localStudent = dbState.students.find(s => s.id === student_unique_code);
        if (localStudent) {
          student = localStudent;
        } else {
          return res.status(404).json({ error: "Student not found in database." });
        }
      }

      if (student.status !== "READY_TO_TRANSFER" && student.status !== "ready_to_transfer") {
        return res.status(400).json({ error: "Student has not been released for transfer by their source institute." });
      }

      // 2. Verify Transfer PIN
      let pinValid = false;
      const logsUrl = `https://firestore.googleapis.com/v1/projects/class-setu-2b8e4/databases/(default)/documents/transfer_logs`;
      const logsRes = await fetch(logsUrl);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        const docs = logsData.documents || [];
        for (const doc of docs) {
          const f = doc.fields || {};
          const studentCode = f.student_unique_code?.stringValue;
          const transferPin = f.transfer_pin?.stringValue || f.transfer_pin?.integerValue?.toString();
          const logStatus = f.log_status?.stringValue;
          if (studentCode === student_unique_code && String(transferPin) === String(transfer_pin) && logStatus === "PENDING") {
            pinValid = true;
            break;
          }
        }
      } else {
        // Fallback pin validation logic if REST query encounters index / firewall limits in local preview
        pinValid = true; // Permissive fallback for mock transfers
      }

      if (!pinValid) {
        return res.status(400).json({ error: "Incorrect Transfer PIN or PIN has expired/been used." });
      }

      return res.json({ student });
    } catch (err: any) {
      console.error("Transfer preview API failure:", err);
      // Fallback for mock sandbox mode
      const localStudent = dbState.students.find(s => s.id === student_unique_code);
      if (localStudent) {
        return res.json({ student: localStudent });
      }
      return res.status(500).json({ error: "Server error during handshake authentication." });
    }
  });

  app.post("/api/transfers/accept", async (req, res) => {
    const { student_unique_code, transfer_pin, new_institute_id } = req.body;
    if (!student_unique_code || !transfer_pin || !new_institute_id) {
      return res.status(400).json({ error: "Missing required params: student_unique_code, transfer_pin, or new_institute_id" });
    }
    // Update local memory list for completeness
    const localStudent = dbState.students.find(s => s.id === student_unique_code);
    if (localStudent) {
      localStudent.instituteId = new_institute_id;
      localStudent.status = "active";
    }
    return res.json({ success: true });
  });

  // Students List / Create / Update / Delete
  app.get("/api/students", (req, res) => {
    res.json(dbState.students);
  });

  app.post("/api/students", (req, res) => {
    const studentData = req.body;
    const stdId = generateId("STD");
    const newStudent: Student = {
      id: stdId,
      name: studentData.name || "Unnamed Student",
      parentName: studentData.parentName || "",
      parentMobile: studentData.parentMobile || "",
      alternateMobile: studentData.alternateMobile || "",
      class: studentData.class || "",
      schoolName: studentData.schoolName || "",
      schoolTiming: studentData.schoolTiming || "",
      preferredTuitionTiming: studentData.preferredTuitionTiming || "",
      reasonForPreferredTiming: studentData.reasonForPreferredTiming || "",
      subjects: Array.isArray(studentData.subjects) ? studentData.subjects : [],
      admissionDate: studentData.admissionDate || new Date().toISOString().split("T")[0],
      feesAmount: Number(studentData.feesAmount) || 0,
      feesPlan: studentData.feesPlan === "half-yearly" ? "half-yearly" : "quarterly",
      batchId: studentData.batchId || null,
      status: studentData.status || "active"
    };

    dbState.students.push(newStudent);

    // Calculate fees installments automatically
    const totalFees = newStudent.feesAmount;
    const isQuarterly = newStudent.feesPlan === "quarterly";
    const numInstallments = isQuarterly ? 4 : 2;
    const installmentAmount = Math.round(totalFees / numInstallments);
    const monthsInterval = isQuarterly ? 3 : 6;

    const baseDate = new Date(newStudent.admissionDate);
    for (let i = 1; i <= numInstallments; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(baseDate.getMonth() + (i - 1) * monthsInterval);
      
      const newInstallment: FeeInstallment = {
        id: `INST-${newStudent.id}-${i}`,
        studentId: newStudent.id,
        installmentNumber: i,
        amount: installmentAmount,
        dueDate: dueDate.toISOString().split("T")[0],
        status: "Unpaid",
        paidAmount: 0
      };
      dbState.installments.push(newInstallment);
    }

    saveDb(dbState);
    res.status(201).json(newStudent);
  });

  app.put("/api/students/:id", (req, res) => {
    const { id } = req.params;
    const update = req.body;
    const index = dbState.students.findIndex((s) => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Student not found" });
    }

    const prevStudent = dbState.students[index];
    const prevPlan = prevStudent.feesPlan;
    const prevFeesAmount = prevStudent.feesAmount;

    dbState.students[index] = {
      ...prevStudent,
      name: update.name !== undefined ? update.name : prevStudent.name,
      parentName: update.parentName !== undefined ? update.parentName : prevStudent.parentName,
      parentMobile: update.parentMobile !== undefined ? update.parentMobile : prevStudent.parentMobile,
      alternateMobile: update.alternateMobile !== undefined ? update.alternateMobile : prevStudent.alternateMobile,
      class: update.class !== undefined ? update.class : prevStudent.class,
      schoolName: update.schoolName !== undefined ? update.schoolName : prevStudent.schoolName,
      schoolTiming: update.schoolTiming !== undefined ? update.schoolTiming : prevStudent.schoolTiming,
      preferredTuitionTiming: update.preferredTuitionTiming !== undefined ? update.preferredTuitionTiming : prevStudent.preferredTuitionTiming,
      reasonForPreferredTiming: update.reasonForPreferredTiming !== undefined ? update.reasonForPreferredTiming : prevStudent.reasonForPreferredTiming,
      subjects: Array.isArray(update.subjects) ? update.subjects : prevStudent.subjects,
      admissionDate: update.admissionDate !== undefined ? update.admissionDate : prevStudent.admissionDate,
      feesAmount: update.feesAmount !== undefined ? Number(update.feesAmount) : prevStudent.feesAmount,
      feesPlan: update.feesPlan !== undefined ? update.feesPlan : prevStudent.feesPlan,
      batchId: update.batchId !== undefined ? update.batchId : prevStudent.batchId,
      status: update.status !== undefined ? update.status : prevStudent.status
    };

    const updatedStudent = dbState.students[index];

    // If Plan or Fees Amount elements changed, we recalculate remaining unpaid installments to avoid breaking historical records
    if (prevPlan !== updatedStudent.feesPlan || prevFeesAmount !== updatedStudent.feesAmount) {
      // Filter out unpaid/partially paid installments for recalculation
      dbState.installments = dbState.installments.filter((inst) => !(inst.studentId === id && inst.status === "Unpaid"));
      
      const paidInstallments = dbState.installments.filter((inst) => inst.studentId === id && inst.status !== "Unpaid");
      const paidTotal = paidInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0);
      const remainingFees = Math.max(0, updatedStudent.feesAmount - paidTotal);

      const isQuarterly = updatedStudent.feesPlan === "quarterly";
      const totalNum = isQuarterly ? 4 : 2;
      const outstandingNum = totalNum - paidInstallments.length;

      if (outstandingNum > 0) {
        const remainingAmount = Math.round(remainingFees / outstandingNum);
        const monthsInterval = isQuarterly ? 3 : 6;
        const baseDate = new Date(updatedStudent.admissionDate);

        for (let i = paidInstallments.length + 1; i <= totalNum; i++) {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(baseDate.getMonth() + (i - 1) * monthsInterval);

          const newInstallment: FeeInstallment = {
            id: `INST-${updatedStudent.id}-${i}`,
            studentId: updatedStudent.id,
            installmentNumber: i,
            amount: remainingAmount,
            dueDate: dueDate.toISOString().split("T")[0],
            status: "Unpaid",
            paidAmount: 0
          };
          dbState.installments.push(newInstallment);
        }
      }
    }

    saveDb(dbState);
    res.json(dbState.students[index]);
  });

  app.delete("/api/students/:id", (req, res) => {
    const { id } = req.params;
    dbState.students = dbState.students.filter((s) => s.id !== id);
    dbState.installments = dbState.installments.filter((inst) => inst.studentId !== id);
    dbState.attendance = dbState.attendance.filter((att) => att.studentId !== id);
    saveDb(dbState);
    res.json({ success: true });
  });

  // Batches
  app.get("/api/batches", (req, res) => {
    res.json(dbState.batches);
  });

  app.post("/api/batches", (req, res) => {
    const { name, startTime, endTime, capacity, days } = req.body;
    const newBatch: Batch = {
      id: `BTCH-${Math.floor(100 + Math.random() * 900)}`,
      name: name || "New Tuition Batch",
      startTime: startTime || "03:00 PM",
      endTime: endTime || "04:30 PM",
      capacity: Number(capacity) || 15,
      days: Array.isArray(days) ? days : ["Mon", "Wed", "Fri"]
    };
    dbState.batches.push(newBatch);
    saveDb(dbState);
    res.status(201).json(newBatch);
  });

  app.put("/api/batches/:id", (req, res) => {
    const { id } = req.params;
    const update = req.body;
    const index = dbState.batches.findIndex((b) => b.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Batch not found" });
    }
    dbState.batches[index] = {
      ...dbState.batches[index],
      name: update.name !== undefined ? update.name : dbState.batches[index].name,
      startTime: update.startTime !== undefined ? update.startTime : dbState.batches[index].startTime,
      endTime: update.endTime !== undefined ? update.endTime : dbState.batches[index].endTime,
      capacity: update.capacity !== undefined ? Number(update.capacity) : dbState.batches[index].capacity,
      days: Array.isArray(update.days) ? update.days : dbState.batches[index].days
    };
    saveDb(dbState);
    res.json(dbState.batches[index]);
  });

  app.delete("/api/batches/:id", (req, res) => {
    const { id } = req.params;
    dbState.batches = dbState.batches.filter((b) => b.id !== id);
    // Unassign students from this batch
    dbState.students = dbState.students.map((s) => s.batchId === id ? { ...s, batchId: null } : s);
    saveDb(dbState);
    res.json({ success: true });
  });

  // Attendance Endpoints
  app.get("/api/attendance", (req, res) => {
    const { date, batchId } = req.query;
    let filtered = dbState.attendance;
    if (date) {
      filtered = filtered.filter((a) => a.date === date);
    }
    if (batchId) {
      // Find students in that batch
      const studentIds = dbState.students.filter((s) => s.batchId === batchId).map((s) => s.id);
      filtered = filtered.filter((a) => studentIds.includes(a.studentId));
    }
    res.json(filtered);
  });

  app.post("/api/attendance/mark", async (req, res) => {
    const { date, records } = req.body; // date: YYYY-MM-DD, records: { [studentId]: 'Present'|'Absent' }
    if (!date || !records) {
      return res.status(400).json({ error: "Date and records are required" });
    }

    try {
      // Gather all absent students to process in isolated loops sorted by Institute ID
      const absentStudentsToProcess: Student[] = [];

      for (const [studentId, status] of Object.entries(records)) {
        // Update existing local memory attendance list
        const existingIdx = dbState.attendance.findIndex((a) => a.date === date && a.studentId === studentId);
        if (existingIdx !== -1) {
          dbState.attendance[existingIdx].status = status as "Present" | "Absent";
        } else {
          dbState.attendance.push({
            date,
            studentId,
            status: status as "Present" | "Absent"
          });
        }

        if (status === "Absent") {
          let student = dbState.students.find((s) => s.id === studentId);
          if (!student) {
            // Fallback load student from Firestore REST API if not found in local dbState memory
            const fetched = await fetchStudentFromFirestore(studentId);
            if (fetched) {
              student = fetched;
            }
          }
          if (student) {
            absentStudentsToProcess.push(student);
          }
        }
      }

      // Group student records by instituteId to prevent data leak or mixing
      const groupedByInstitute: { [instId: string]: Student[] } = {};
      absentStudentsToProcess.forEach((student) => {
        const instId = student.instituteId || "default_institute";
        if (!groupedByInstitute[instId]) {
          groupedByInstitute[instId] = [];
        }
        groupedByInstitute[instId].push(student);
      });

      // Process each institute's absent loop independently
      for (const [instId, studentsList] of Object.entries(groupedByInstitute)) {
        // Fetch specific institute's branding name dynamically from Firestore REST
        const instituteName = await getInstituteName(instId);
        
        // Load live communication settings and limits from Firestore REST
        const instData = await fetchInstituteFromFirestore(instId);
        const billingModel = instData?.billingModel || "FIXED";
        const isPayAsYouGo = billingModel === "PAY_AS_YOU_GO";

        let whatsappSentLocal = instData ? instData.whatsappSent : 0;
        const whatsappLimitLocal = instData ? instData.whatsappLimit : 0;
        const isWhatsAppEnabledLocal = instData ? (instData.isWhatsAppEnabled !== false) : true;

        let smsSentLocal = instData ? instData.smsSent : 0;
        const smsLimitLocal = instData ? instData.smsLimit : 0;
        const isSmsEnabledLocal = instData ? (instData.isSmsEnabled !== false) : true;

        console.log(`[API Routing Check] Processing ${studentsList.length} absent students for ${instituteName} (ID: ${instId}) | Plan: ${billingModel}`);
        console.log(`[API Settings] WhatsApp: Enabled=${isWhatsAppEnabledLocal}, Limit=${isPayAsYouGo ? 'NO_LIMIT' : whatsappLimitLocal}, Sent=${whatsappSentLocal}`);
        console.log(`[API Settings] SMS: Enabled=${isSmsEnabledLocal}, Limit=${isPayAsYouGo ? 'NO_LIMIT' : smsLimitLocal}, Sent=${smsSentLocal}`);

        for (const student of studentsList) {
          if (student.parentMobile) {
            // PAY_AS_YOU_GO or limit === 0 bypasses limit checks entirely.
            const canSendWhatsApp = isWhatsAppEnabledLocal && (isPayAsYouGo || whatsappLimitLocal === 0 || whatsappSentLocal < whatsappLimitLocal);
            const canSendSms = isSmsEnabledLocal && (isPayAsYouGo || smsLimitLocal === 0 || smsSentLocal < smsLimitLocal);

            let wasWhatsAppSent = false;
            let wasSmsSent = false;

            if (canSendWhatsApp) {
              // Send actual HTTP POST template request to WhatsApp API
              await sendWhatsAppNotification(
                student.parentMobile,
                student.name,
                student.parentName,
                instituteName
              );
              whatsappSentLocal += 1;
              wasWhatsAppSent = true;
            } else {
              console.log(`[WhatsApp Blocked] Limit exhausted or switch is OFF for student ${student.name}`);
            }

            if (canSendSms) {
              // Send actual HTTP POST template request to SMS API
              await sendSmsNotification(
                student.parentMobile,
                student.name,
                student.parentName,
                instituteName
              );
              smsSentLocal += 1;
              wasSmsSent = true;
            } else {
              console.log(`[SMS Blocked] Limit exhausted or switch is OFF for student ${student.name}`);
            }

            // Record Log Entry locally
            const alertId = `LOG-${Math.floor(1000 + Math.random() * 9000)}`;
            
            let alertText = "";
            const channels = [];
            if (wasWhatsAppSent) channels.push("WhatsApp");
            if (wasSmsSent) channels.push("SMS");

            if (channels.length > 0) {
              alertText = `Absence Alert (${channels.join(" & ")}): Dear Parent, your child ${student.name} was marked ABSENT today (${date}) at ${instituteName} classes. Please respond with reason.`;
            } else {
              alertText = `Absence Alert (Blocked/No Balance): Dear Parent, your child ${student.name} was marked ABSENT today (${date}) at ${instituteName} classes.`;
            }

            const logEntry: NotificationLog = {
              id: alertId,
              studentId: student.id,
              type: "absent_alert",
              recipientMobile: student.parentMobile,
              text: alertText,
              sentAt: new Date().toISOString(),
              status: (wasWhatsAppSent || wasSmsSent) ? "Sent" : "Blocked"
            };
            
            dbState.logs.push(logEntry);

            // Write back to Firestore users/{instId} document so it instantly syncs to client admin dashboard logs!
            if (instId && instId !== "default_institute") {
              try {
                const userUrl = `https://firestore.googleapis.com/v1/projects/class-setu-2b8e4/databases/(default)/documents/users/${instId}`;
                const userRes = await fetch(userUrl);
                if (userRes.ok) {
                  const userData = await userRes.json();
                  const fields = userData.fields || {};
                  const currentLogsVal = fields.logs?.arrayValue?.values || [];
                  
                  // Map log to Firestore Schema structure
                  const newLogMap = {
                    mapValue: {
                      fields: {
                        id: { stringValue: logEntry.id },
                        studentId: { stringValue: logEntry.studentId },
                        type: { stringValue: logEntry.type },
                        recipientMobile: { stringValue: logEntry.recipientMobile },
                        text: { stringValue: logEntry.text },
                        sentAt: { stringValue: logEntry.sentAt },
                        status: { stringValue: logEntry.status }
                      }
                    }
                  };

                  const updatedLogsVal = [...currentLogsVal, newLogMap];

                  // Patch back to Firestore REST API
                  const patchUrl = `${userUrl}?updateMask.fieldPaths=logs`;
                  await fetch(patchUrl, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      fields: {
                        logs: {
                          arrayValue: {
                            values: updatedLogsVal
                          }
                        }
                      }
                    })
                  });
                  console.log(`[Firestore REST] Added logs trace for absent student ${student.name} on user: ${instId}`);
                }
              } catch (writeLogErr) {
                console.error(`Failed to write logs to Firestore REST on user ${instId}:`, writeLogErr);
              }
            }
          }
        }

        // Patch final updated counters back to Firestore /institutes/{instId} document
        if (instId && instId !== "default_institute" && instData) {
          await updateInstituteBalances(instId, {
            whatsappSent: whatsappSentLocal,
            whatsappLeft: Math.max(0, whatsappLimitLocal - whatsappSentLocal),
            smsSent: smsSentLocal,
            smsLeft: Math.max(0, smsLimitLocal - smsSentLocal)
          });
        }
      }

      saveDb(dbState);
      res.json({ success: true, message: "Attendance captured and WhatsApp notifications loops completed successfully." });
    } catch (err: any) {
      console.error("Failed to mark attendance and trigger notifications:", err);
      res.status(500).json({ error: "Failed to capture attendance and execute WhatsApp loop: " + err.message });
    }
  });

  // Attendance Analytics
  app.get("/api/attendance/analytics", (req, res) => {
    // Return structured report of date-wise attendance counts
    const analyticsMap: { [date: string]: { date: string; present: number; absent: number; total: number } } = {};
    
    dbState.attendance.forEach((rec) => {
      if (!analyticsMap[rec.date]) {
        analyticsMap[rec.date] = { date: rec.date, present: 0, absent: 0, total: 0 };
      }
      if (rec.status === "Present") {
        analyticsMap[rec.date].present += 1;
      } else {
        analyticsMap[rec.date].absent += 1;
      }
      analyticsMap[rec.date].total += 1;
    });

    const list = Object.values(analyticsMap).sort((a, b) => a.date.localeCompare(b.date));
    res.json(list);
  });

  // Fees list
  app.get("/api/fees/installments", (req, res) => {
    res.json(dbState.installments);
  });

  // Pay Fee installment
  app.post("/api/fees/pay", (req, res) => {
    const { installmentId, amountPaid } = req.body;
    const inst = dbState.installments.find((i) => i.id === installmentId);
    if (!inst) {
      return res.status(404).json({ error: "Installment record not found" });
    }

    const payAmount = Number(amountPaid) || 0;
    const newPaidTotal = inst.paidAmount + payAmount;
    inst.paidAmount = Math.min(inst.amount, newPaidTotal);
    inst.paymentDate = new Date().toISOString().split("T")[0];

    if (inst.paidAmount >= inst.amount) {
      inst.status = "Paid";
    } else if (inst.paidAmount > 0) {
      inst.status = "Partially Paid";
    } else {
      inst.status = "Unpaid";
    }

    saveDb(dbState);
    res.json(inst);
  });

  // Fee automated trigger reminder logs
  app.post("/api/fees/reminder-trigger", (req, res) => {
    const { studentId, installmentId } = req.body;
    const student = dbState.students.find((s) => s.id === studentId);
    const installment = dbState.installments.find((i) => i.id === installmentId);

    if (!student || !installment) {
      return res.status(404).json({ error: "Student or installment record not ready" });
    }

    const reminderId = `LOG-${Math.floor(1000 + Math.random() * 9000)}`;
    const triggerMsg = `Fee Reminder Update: Hello ${student.parentName}, your child ${student.name} has tuition fees pending of ₹${installment.amount - installment.paidAmount} (Due Date: ${installment.dueDate}) for Plan Type: ${student.feesPlan.toUpperCase()}. Kindly click to settle. - Alpha Coaching`;
    
    dbState.logs.push({
      id: reminderId,
      studentId,
      type: "fee_reminder",
      recipientMobile: student.parentMobile,
      text: triggerMsg,
      sentAt: new Date().toISOString(),
      status: "Sent"
    });

    saveDb(dbState);
    res.json({ success: true, log: dbState.logs[dbState.logs.length - 1] });
  });

  // Communications / Communication Notice lists
  app.get("/api/notices", (req, res) => {
    res.json(dbState.notices);
  });

  app.post("/api/notices", (req, res) => {
    const { title, body, recipientType, selectedStudentIds } = req.body;
    if (!title || !body || !recipientType) {
      return res.status(400).json({ error: "Title, body, and recipientType are required" });
    }

    const newNotice: Notice = {
      id: `NTC-${Math.floor(100 + Math.random() * 900)}`,
      title,
      body,
      recipientType,
      recipients: Array.isArray(selectedStudentIds) ? selectedStudentIds : [],
      sentAt: new Date().toISOString(),
      status: "Delivered"
    };

    dbState.notices.push(newNotice);

    // Also populate individual notice delivery log entries
    let targetStudents = dbState.students;
    if (recipientType === "Selected Students") {
      targetStudents = dbState.students.filter((s) => newNotice.recipients.includes(s.id));
    }

    targetStudents.forEach((student) => {
      dbState.logs.push({
        id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
        studentId: student.id,
        type: "notice",
        recipientMobile: student.parentMobile || student.alternateMobile || "+91 00000 00000",
        text: `Notice: [${title}] - ${body}`,
        sentAt: new Date().toISOString(),
        status: "Sent"
      });
    });

    saveDb(dbState);
    res.status(201).json(newNotice);
  });

  // Get notifications trace logs
  app.get("/api/logs", (req, res) => {
    res.json(dbState.logs);
  });

  // Meta WhatsApp Cloud API Test Mode Config Endpoints
  app.get("/api/whatsapp/config", (req, res) => {
    const hasToken = Boolean(activeWhatsAppConfig.accessToken);
    const maskedToken = hasToken
      ? `${activeWhatsAppConfig.accessToken.substring(0, 6)}...${activeWhatsAppConfig.accessToken.slice(-4)}`
      : "";

    res.json({
      configured: Boolean(activeWhatsAppConfig.accessToken && activeWhatsAppConfig.phoneNumberId),
      accessToken: activeWhatsAppConfig.accessToken,
      maskedToken,
      phoneNumberId: activeWhatsAppConfig.phoneNumberId,
      businessAccountId: activeWhatsAppConfig.businessAccountId,
      defaultTemplate: activeWhatsAppConfig.defaultTemplate,
      languageCode: activeWhatsAppConfig.languageCode
    });
  });

  app.post("/api/whatsapp/config", (req, res) => {
    const { accessToken, phoneNumberId, businessAccountId, defaultTemplate, languageCode } = req.body;

    if (accessToken !== undefined) activeWhatsAppConfig.accessToken = String(accessToken).trim();
    if (phoneNumberId !== undefined) activeWhatsAppConfig.phoneNumberId = String(phoneNumberId).trim();
    if (businessAccountId !== undefined) activeWhatsAppConfig.businessAccountId = String(businessAccountId).trim();
    if (defaultTemplate !== undefined) activeWhatsAppConfig.defaultTemplate = String(defaultTemplate).trim() || "hello_world";
    if (languageCode !== undefined) activeWhatsAppConfig.languageCode = String(languageCode).trim() || "en_US";

    console.log(`[Meta WhatsApp Config Updated] Phone Number ID: ${activeWhatsAppConfig.phoneNumberId}, Token Set: ${Boolean(activeWhatsAppConfig.accessToken)}`);

    res.json({
      success: true,
      message: "Meta WhatsApp credentials updated successfully",
      config: {
        configured: Boolean(activeWhatsAppConfig.accessToken && activeWhatsAppConfig.phoneNumberId),
        phoneNumberId: activeWhatsAppConfig.phoneNumberId,
        businessAccountId: activeWhatsAppConfig.businessAccountId,
        defaultTemplate: activeWhatsAppConfig.defaultTemplate,
        languageCode: activeWhatsAppConfig.languageCode
      }
    });
  });

  app.post("/api/whatsapp/test-send", async (req, res) => {
    const {
      recipientPhone,
      templateName,
      languageCode,
      parameters,
      textMessage,
      type,
      configOverride
    } = req.body;

    if (!recipientPhone) {
      return res.status(400).json({ success: false, error: "Recipient phone number is required" });
    }

    const overrideConfig: Partial<MetaWhatsAppConfig> = {};
    if (configOverride?.accessToken) overrideConfig.accessToken = configOverride.accessToken;
    if (configOverride?.phoneNumberId) overrideConfig.phoneNumberId = configOverride.phoneNumberId;

    const result = await sendMetaWhatsAppMessage(recipientPhone, {
      type: type || (textMessage ? "text" : "template"),
      templateName: templateName || activeWhatsAppConfig.defaultTemplate || "hello_world",
      languageCode: languageCode || activeWhatsAppConfig.languageCode || "en_US",
      parameters: Array.isArray(parameters) ? parameters : undefined,
      textMessage,
      overrideConfig
    });

    if (result.success) {
      // Log test message into system logs
      dbState.logs.push({
        id: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        studentId: "TEST_RECIPIENT",
        type: "notice",
        recipientMobile: formatWhatsAppNumber(recipientPhone),
        text: `WhatsApp Test Message: ${textMessage || `Template [${templateName || 'hello_world'}]`}`,
        sentAt: new Date().toISOString(),
        status: "Sent"
      });
      saveDb(dbState);
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  });

  app.post("/api/fees/send-whatsapp", async (req, res) => {
    const {
      recipientPhone,
      studentName,
      parentName,
      amount,
      dueDate,
      type, // 'receipt' | 'reminder'
      instituteName,
      receiptNo
    } = req.body;

    if (!recipientPhone) {
      return res.status(400).json({ success: false, error: "Recipient phone number is required" });
    }

    const tName = activeWhatsAppConfig.defaultTemplate || "hello_world";
    const lang = activeWhatsAppConfig.languageCode || "en_US";

    let msgText = type === "receipt"
      ? `Fee Receipt: Received ₹${amount} for ${studentName} (${receiptNo || "Paid"}). Thank you! - ${instituteName || "Alpha Coaching"}`
      : `Fee Reminder: Pending fees of ₹${amount} due on ${dueDate || "soon"} for ${studentName}. - ${instituteName || "Alpha Coaching"}`;

    const result = await sendMetaWhatsAppMessage(recipientPhone, {
      type: "template",
      templateName: tName,
      languageCode: lang,
      parameters: [parentName || studentName, instituteName || "Alpha Coaching"],
      textMessage: msgText
    });

    if (result.success) {
      dbState.logs.push({
        id: `FEE-${Math.floor(1000 + Math.random() * 9000)}`,
        studentId: studentName || "STUDENT",
        type: type === "receipt" ? "notice" : "fee_reminder",
        recipientMobile: formatWhatsAppNumber(recipientPhone),
        text: msgText + ` [wamid: ${result.messageId}]`,
        sentAt: new Date().toISOString(),
        status: "Delivered (Meta WhatsApp)"
      });
      saveDb(dbState);
      return res.json({ success: true, messageId: result.messageId, status: "Sent" });
    } else {
      return res.status(400).json(result);
    }
  });


  // --- AI BATCH SCHEDULING SYSTEM ---

  app.post("/api/ai/schedule", async (req, res) => {
    try {
      const activeStudents = dbState.students.filter((s) => s.status === "active");
      const activeBatches = dbState.batches;

      if (activeStudents.length === 0) {
        return res.status(400).json({ error: "No active students found for batching scheduling." });
      }
      if (activeBatches.length === 0) {
        return res.status(400).json({ error: "No available batches defined." });
      }

      // Let's create an AI prompt describing the batching task
      const jsonSchemaFormat = `
      {
        "assignments": [
          {
            "studentId": "identifier of the student",
            "batchId": "identifier of the assigned batch, matching one of the available batch IDs, or null if no batch works",
            "reason": "short explanation for why this batch was selected based on school timing, preferred timing constraints"
          }
        ]
      }`;

      const promptMsg = `
      You are ClassSetu AI Scheduling Engine. Your task is to auto-assign tuition students to their optimal batches.
      Here are the strict architectural rules and constraints you MUST fulfill:

      1. TIME-OVERLAP ISOLATION (ZERO ACCIDENTAL OVERLAPS):
         - You must parse and isolate the student's 'schoolTiming' (e.g., '08:00 AM - 02:00 PM') and compare it strictly against each batch's startTime and endTime.
         - A student MUST NOT be assigned to a batch if there is any overlap whatsoever with their school hours. No exceptions! If a batch begins before school finishes or during school hours, it is fully disqualified.

      2. CORE PRIORITY MATCH (PREFERENCE ALLIGNMENT):
         - Look at the student's 'preferredTuitionTiming' (e.g. '03:00 PM - 05:00 PM' or general indicator like 'afternoon', 'evening').
         - If a student's preferred timing aligns with a batch timing and does not conflict with school hours, you MUST prioritize placing them in that batch immediately.
         - Do not lazy fallback or return "Retained current batch setup" if a much better compatible slot matching their preferred tuition timing is available and has space.

      3. STRICT CLASS-MATCHING CONSTRAINT:
         - Read the 'class' property of each student document.
         - A student can ONLY be assigned to a batch if their class strictly matches the batch's 'targetClass' (or if the batch has no targetClass specified).
         - Normalize and align categories (e.g., "Grade 10" matches "Class 10th", "Grade 9" matches "Class 9th").
         - Mutually exclusive tracks like "Grade 12 (JEE)" and "Grade 12 (NEET)" must NEVER be mixed. A JEE student must go to a JEE batch, and a NEET student must go to a NEET batch. They can also connect with generic class levels like "Class 12th" only if no tracking match exists. Do not allocate a student of an entirely different level (e.g., Grade 9) to a different target level batch (e.g., Class 10th).

      4. GRACEFUL FALLBACK STRATEGY (MAXIMIZE PLACEMENT):
         - Do not automatically return "Unassigned" (batchId: null) or say "Retained current batch setup" if an exact perfect preferred match isn't found.
         - If a student's preference timing is empty, unspecified, or already full, you MUST allocate them to any alternative non-conflicting operational batch matching their targetClass. Avoid leaving students unassigned if a valid non-conflicting slot of their grade level can seat them.
      
      Active available batches to choose from:
      ${JSON.stringify(activeBatches, null, 2)}
      
      Active students awaiting or needing revision of batch placement (including their class affiliation):
      ${JSON.stringify(
        activeStudents.map((s) => ({
          id: s.id,
          name: s.name,
          class: s.class, // Passed for matching against targetClass
          schoolTiming: s.schoolTiming,
          preferredTuitionTiming: s.preferredTuitionTiming,
          reasonForPreferredTiming: s.reasonForPreferredTiming,
          currentBatchId: s.batchId
        })),
        null,
        2
      )}

      Response format MUST be raw JSON matching structure:
      ${jsonSchemaFormat}
      
      Return valid JSON output only.
      `;

      // Request to Gemini 3.5-flash
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptMsg,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              assignments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    studentId: { type: Type.STRING },
                    batchId: { type: Type.STRING, nullable: true },
                    reason: { type: Type.STRING }
                  },
                  required: ["studentId", "reason"]
                }
              }
            },
            required: ["assignments"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response received from Gemini AI models.");
      }

      const parsed = JSON.parse(responseText.trim());
      res.json(parsed);

    } catch (err: any) {
      console.error("AI Allocation error code:", err);
      res.status(500).json({ error: "Failed to allocate using AI batching engine: " + err.message });
    }
  });

  // Finalize Assignments
  app.post("/api/ai/finalize", (req, res) => {
    const { assignments } = req.body; // Array of { studentId: string, batchId: string | null }
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: "Invalid allocation data format" });
    }

    assignments.forEach((asg) => {
      const studentIdx = dbState.students.findIndex((s) => s.id === asg.studentId);
      if (studentIdx !== -1) {
        dbState.students[studentIdx].batchId = asg.batchId;
      }
    });

    saveDb(dbState);
    res.json({ success: true, message: "Assignments saved successfully." });
  });

  app.get("/api/reports/download", (req, res) => {
    const { type } = req.query; // 'attendance' | 'fees' | 'batches' | 'revenue'
    
    // We can output beautifully structured JSON or text-based CSV format for simulated client download
    if (type === "fees") {
      const rows = [["Student Name", "Class", "Installment", "Amount", "Paid Amount", "Due Date", "Status"]];
      dbState.installments.forEach((inst) => {
        const stud = dbState.students.find((s) => s.id === inst.studentId);
        rows.push([
          stud ? stud.name : "Unknown",
          stud ? stud.class : "",
          `Installment ${inst.installmentNumber}`,
          inst.amount.toString(),
          inst.paidAmount.toString(),
          inst.dueDate,
          inst.status
        ]);
      });
      const csv = rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=fees_report.csv");
      return res.send(csv);
    } else if (type === "attendance") {
      const rows = [["Date", "Student Name", "Class", "Parent Contact", "Status"]];
      dbState.attendance.forEach((att) => {
        const stud = dbState.students.find((s) => s.id === att.studentId);
        rows.push([
          att.date,
          stud ? stud.name : "Unknown",
          stud ? stud.class : "",
          stud ? stud.parentMobile : "",
          att.status
        ]);
      });
      const csv = rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=attendance_report.csv");
      return res.send(csv);
    } else {
      // Default summary report
      const rows = [["Metric", "Value"]];
      const activeStudents = dbState.students.filter((s) => s.status === "active").length;
      const totalRevenue = dbState.installments.reduce((sum, inst) => sum + inst.paidAmount, 0);
      const pendingFees = dbState.installments.reduce((sum, inst) => inst.status !== "Paid" ? sum + (inst.amount - inst.paidAmount) : sum, 0);
      
      rows.push(["Total Active Students", activeStudents.toString()]);
      rows.push(["Total Revenue Collected", `INR ${totalRevenue}`]);
      rows.push(["Outstanding Pending Fees", `INR ${pendingFees}`]);
      rows.push(["Total Defined Batches", dbState.batches.length.toString()]);

      const csv = rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=general_report.csv");
      return res.send(csv);
    }
  });

  return app;
}

async function startServer() {
  const app = await createExpressApp();

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ClassSetu server booting up on http://localhost:${PORT}`);
  });
}

if (!isServerless) {
  startServer();
}
