import React, { useState, useEffect } from "react";
import { 
  Send, 
  Users, 
  MessageSquareCode, 
  Bell, 
  Smartphone, 
  CheckCheck,
  Search,
  MessageCircle,
  FileText,
  Key,
  Flame,
  ShieldCheck,
  Terminal,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { Student, Notice, NotificationLog } from "../types";
import { isPayAsYouGoModel } from "../utils";

interface WhatsAppCenterViewProps {
  students: Student[];
  notices: Notice[];
  logs: NotificationLog[];
  onSendNotice: (notice: Partial<Notice> & { selectedStudentIds?: string[], medium?: "WhatsApp" | "SMS" }) => Promise<any>;
  isSubscribed?: boolean;
  onSubscriptionBlocked?: () => void;
  instituteData?: {
    billingModel?: string;
    isWhatsAppEnabled?: boolean;
    isSmsEnabled?: boolean;
    whatsappLimit?: number;
    whatsappSent?: number;
    whatsappLeft?: number;
    smsLimit?: number;
    smsSent?: number;
    smsLeft?: number;
  } | null;
}

export default function WhatsAppCenterView({
  students = [],
  notices = [],
  logs = [],
  onSendNotice,
  isSubscribed = true,
  onSubscriptionBlocked,
  instituteData
}: WhatsAppCenterViewProps) {
  
  // Tab Mode
  const [activeTab, setActiveTab] = useState<"broadcaster" | "meta_test">("broadcaster");

  // Notice Composer state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recipientType, setRecipientType] = useState<"All Students" | "All Parents" | "Selected Students">("All Parents");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [broadcastMedium, setBroadcastMedium] = useState<"WhatsApp" | "SMS">("WhatsApp");
  
  const [searchStudentQuery, setSearchStudentQuery] = useState("");
  const [composerSuccess, setComposerSuccess] = useState("");
  const [composerError, setComposerError] = useState("");

  // Meta Cloud API Configuration & Test Mode state
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [defaultTemplate, setDefaultTemplate] = useState("hello_world");
  const [languageCode, setLanguageCode] = useState("en_US");
  const [showToken, setShowToken] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configStatus, setConfigStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Live WhatsApp Test Dispatch state
  const [testRecipientPhone, setTestRecipientPhone] = useState("");
  const [testMessageType, setTestMessageType] = useState<"template" | "text">("template");
  const [testTemplateName, setTestTemplateName] = useState("hello_world");
  const [testParam1, setTestParam1] = useState("ClassSetu Parent");
  const [testParam2, setTestParam2] = useState("Alpha Coaching Institute");
  const [testTextMessage, setTestTextMessage] = useState("Hello! This is a live test notification from ClassSetu WhatsApp Cloud API.");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Load current Meta WhatsApp Config from backend on mount
  useEffect(() => {
    fetch("/api/whatsapp/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.accessToken) setAccessToken(data.accessToken);
        if (data.phoneNumberId) setPhoneNumberId(data.phoneNumberId);
        if (data.businessAccountId) setBusinessAccountId(data.businessAccountId);
        if (data.defaultTemplate) setDefaultTemplate(data.defaultTemplate);
        if (data.languageCode) setLanguageCode(data.languageCode);
        setIsConfigLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load WhatsApp config:", err);
        setIsConfigLoaded(true);
      });
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigStatus(null);

    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          phoneNumberId,
          businessAccountId,
          defaultTemplate,
          languageCode
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigStatus({ success: true, message: "Meta WhatsApp credentials saved successfully!" });
      } else {
        setConfigStatus({ success: false, message: data.error || "Failed to save configuration." });
      }
    } catch (err: any) {
      setConfigStatus({ success: false, message: "Server connection failed: " + err.message });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipientPhone) {
      alert("Please provide a recipient phone number with country code (e.g. 919876543210)");
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/whatsapp/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientPhone: testRecipientPhone,
          type: testMessageType,
          templateName: testTemplateName,
          languageCode,
          parameters: [testParam1, testParam2],
          textMessage: testTextMessage,
          configOverride: {
            accessToken,
            phoneNumberId
          }
        })
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: "Failed to dispatch test payload: " + err.message
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleToggleStudent = (sId: string) => {
    setSelectedStudentIds((prev) => 
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      return;
    }
    if (!title || !body) {
      setComposerError("Title and message content are required.");
      return;
    }
    setComposerError("");
    setComposerSuccess("");

    await onSendNotice({
      title,
      body,
      recipientType,
      selectedStudentIds,
      medium: broadcastMedium
    });

    setComposerSuccess(`Message broadcast successfully dispatched via ${broadcastMedium}! Automated delivery logs have crawled status on parent terminals.`);
    setTitle("");
    setBody("");
    setSelectedStudentIds([]);
    
    setTimeout(() => {
      setComposerSuccess("");
    }, 6000);
  };

  const filteredStudents = students.filter((s) => 
    s.name.toLowerCase().includes(searchStudentQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchStudentQuery.toLowerCase())
  );

  // Sort logs by sent date (newest first)
  const sortedLogs = [...logs].sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  const isPayAsYouGo = isPayAsYouGoModel(instituteData);

  const whatsappLimit = Number(instituteData?.whatsappLimit ?? 0);
  const whatsappSent = Number(instituteData?.whatsappSent ?? 0);
  const whatsappRemaining = Math.max(0, whatsappLimit - whatsappSent);

  const smsLimit = Number(instituteData?.smsLimit ?? 0);
  const smsSent = Number(instituteData?.smsSent ?? 0);
  const smsRemaining = Math.max(0, smsLimit - smsSent);

  return (
    <div className="space-y-6">
      
      {/* Title & Tab Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-emerald-600" /> Unified Communication Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Broadcast notices via WhatsApp or SMS, and configure Meta Cloud API Test Mode credentials.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab("broadcaster")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "broadcaster"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Send className="w-3.5 h-3.5 text-emerald-600" /> Broadcaster & Notices
          </button>
          <button
            onClick={() => setActiveTab("meta_test")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "meta_test"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-emerald-700"
            }`}
          >
            <Key className="w-3.5 h-3.5" /> Meta WhatsApp Test Mode Setup
            {accessToken && phoneNumberId ? (
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>
        </div>
      </div>

      {/* META WHATSAPP TEST MODE TAB */}
      {activeTab === "meta_test" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Credentials Configuration Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> Meta WhatsApp Cloud API Credentials
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter your Meta Developer Console credentials to send live WhatsApp messages in Test Mode.
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  accessToken && phoneNumberId 
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                    : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}>
                  {accessToken && phoneNumberId ? "Configured & Active" : "Credentials Needed"}
                </span>
              </div>

              {configStatus && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  configStatus.success 
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}>
                  {configStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                  <span>{configStatus.message}</span>
                </div>
              )}

              <form onSubmit={handleSaveConfig} className="space-y-4 text-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                    Meta Temporary / Permanent Access Token <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      required
                      placeholder="EAAG..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Meta Developer Portal → WhatsApp → API Setup → Copy "Temporary Access Token" or System User Token.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                      Phone Number ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 102938475610293"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Found under "Phone number ID" in Meta WhatsApp console.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                      WhatsApp Business Account ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 100293847561 (Optional)"
                      value={businessAccountId}
                      onChange={(e) => setBusinessAccountId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Optional WABA ID from Meta Developer Portal.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                      Default Template Name
                    </label>
                    <input
                      type="text"
                      placeholder="hello_world or absence_alert"
                      value={defaultTemplate}
                      onChange={(e) => setDefaultTemplate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                      Language Code
                    </label>
                    <input
                      type="text"
                      placeholder="en_US or en"
                      value={languageCode}
                      onChange={(e) => setLanguageCode(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Save Meta WhatsApp Credentials
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Setup Instructions Card */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-display font-bold text-sm text-emerald-400 flex items-center gap-2">
                <Sliders className="w-4 h-4" /> Test Mode Setup Guide (Hindi / English)
              </h4>
              <ol className="text-xs space-y-2 text-slate-300 list-decimal pl-4 leading-relaxed font-sans">
                <li>
                  <strong>Meta Developer Console par jayein:</strong> Visit <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="text-emerald-400 underline">developers.facebook.com</a> and create an App (type: Other → Business).
                </li>
                <li>
                  <strong>WhatsApp Setup:</strong> Go to <em>WhatsApp → API Setup</em>.
                </li>
                <li>
                  <strong>Credentials Copy karein:</strong> Copy <em>Temporary Access Token</em> and <em>Phone number ID</em> and paste above.
                </li>
                <li>
                  <strong>Test Recipient Add karein:</strong> In Meta WhatsApp API Setup panel, under "To", add your personal WhatsApp mobile number and verify via OTP.
                </li>
                <li>
                  <strong>Test Message bhejein:</strong> Right panel me recipient phone number dalein and click "Send Live Test WhatsApp Message".
                </li>
              </ol>
            </div>
          </div>

          {/* Right: Live WhatsApp Test Dispatch Console */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
              <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" /> Live WhatsApp Test Dispatcher
              </h3>

              <form onSubmit={handleSendTestMessage} className="space-y-4 text-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                    Recipient Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 919876543210 (with country code)"
                    value={testRecipientPhone}
                    onChange={(e) => setTestRecipientPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Must be registered under "To" test phone numbers in Meta console.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                    Payload Message Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTestMessageType("template")}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        testMessageType === "template"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      📄 Meta Template ({testTemplateName || 'hello_world'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestMessageType("text")}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        testMessageType === "text"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      💬 Raw Text Message
                    </button>
                  </div>
                </div>

                {testMessageType === "template" ? (
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Template Name</label>
                      <input
                        type="text"
                        value={testTemplateName}
                        onChange={(e) => setTestTemplateName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Variable {"{{1}}"}</label>
                      <input
                        type="text"
                        value={testParam1}
                        onChange={(e) => setTestParam1(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border rounded-lg font-sans"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Variable {"{{2}}"}</label>
                      <input
                        type="text"
                        value={testParam2}
                        onChange={(e) => setTestParam2(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border rounded-lg font-sans"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">
                      Text Message Body
                    </label>
                    <textarea
                      rows={3}
                      value={testTextMessage}
                      onChange={(e) => setTestTextMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    ></textarea>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching to Meta Graph API...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send Live Test WhatsApp Message
                    </>
                  )}
                </button>
              </form>

              {/* Response Log Terminal Box */}
              {testResult && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1">
                      <Terminal className="w-4 h-4 text-emerald-600" /> Meta API Execution Output
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      testResult.success ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {testResult.success ? "200 OK" : "ERROR"}
                    </span>
                  </div>

                  <div className={`p-4 rounded-xl text-xs font-mono overflow-x-auto space-y-2 ${
                    testResult.success ? "bg-slate-900 text-emerald-400 border border-emerald-800" : "bg-slate-900 text-rose-300 border border-rose-800"
                  }`}>
                    {testResult.success ? (
                      <div>
                        <p className="text-emerald-300 font-bold mb-1">✅ Message Dispatched Successfully!</p>
                        <p className="text-slate-300">Message ID: <span className="text-amber-300">{testResult.messageId}</span></p>
                        <p className="text-slate-300">Recipient: <span className="text-sky-300">{testResult.recipient}</span></p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-rose-400 font-bold mb-1">❌ Meta API Request Failed</p>
                        <p className="text-slate-200 leading-relaxed">{testResult.error || "Unknown Meta error"}</p>
                      </div>
                    )}

                    {testResult.rawResponse && (
                      <details className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                        <summary className="cursor-pointer hover:text-slate-200">View Raw Meta JSON Payload</summary>
                        <pre className="mt-2 p-2 bg-black/50 rounded overflow-x-auto text-[10px] text-slate-300">
                          {JSON.stringify(testResult.rawResponse, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* BROADCASTER & NOTICES TAB */}
      {activeTab === "broadcaster" && (
        <>
          {composerSuccess && (
            <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg text-emerald-800 text-sm flex gap-2">
              <CheckCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>{composerSuccess}</span>
            </div>
          )}

          {/* Grid: Left Composer & Preview, Right Audit Trace logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Composer Form & Smartphone preview (Col span 7) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
                <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                  <MessageSquareCode className="w-5 h-5 text-emerald-600" /> Dispatch Notices Broadcaster
                </h3>

                {composerError && <p className="text-xs text-rose-600 font-bold">{composerError}</p>}

                <form onSubmit={handleComposeSubmit} className="space-y-4 text-slate-800">
                  
                  {/* Broadcast Medium Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Broadcast Medium</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBroadcastMedium("WhatsApp")}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          broadcastMedium === "WhatsApp"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-base">💬</span> WhatsApp Service
                      </button>
                      <button
                        type="button"
                        onClick={() => setBroadcastMedium("SMS")}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          broadcastMedium === "SMS"
                            ? "bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-base">📱</span> SMS Service
                      </button>
                    </div>
                    
                    {/* Balance indicator */}
                    <div className="mt-2 flex justify-between items-center text-[10px] font-semibold text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span>Balance Available:</span>
                      {isPayAsYouGo ? (
                        <span className="text-purple-700 font-mono font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
                          Pay As You Go (No Limit) — Used: {broadcastMedium === "WhatsApp" ? whatsappSent : smsSent} msgs
                        </span>
                      ) : broadcastMedium === "WhatsApp" ? (
                        <span className="text-emerald-700 font-mono font-bold">
                          {whatsappRemaining} / {whatsappLimit} free credits
                        </span>
                      ) : (
                        <span className="text-indigo-700 font-mono font-bold">
                          {smsRemaining} / {smsLimit} free SMS credits
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Notice Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Schedule Change Alert, Holiday Announcement"
                      value={title} 
                      onChange={(e) => setTitle(e.target.value)}
                      className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 text-sm font-semibold ${
                        broadcastMedium === "SMS" ? "focus:ring-indigo-500" : "focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Recipient Group</label>
                    <select
                      value={recipientType}
                      onChange={(e) => setRecipientType(e.target.value as any)}
                      className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 ${
                        broadcastMedium === "SMS" ? "focus:ring-indigo-500" : "focus:ring-emerald-500"
                      }`}
                    >
                      <option value="All Parents">{broadcastMedium === "SMS" ? "All Parents (SMS Direct Delivery)" : "All Parents (High priority WhatsApp)"}</option>
                      <option value="All Students">All Students (E-Notice Board)</option>
                      <option value="Selected Students">Selected Students Specific</option>
                    </select>
                  </div>

                  {/* Dynamic student picker if "Selected Students" */}
                  {recipientType === "Selected Students" && (
                    <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute top-2.5 left-3" />
                        <input 
                          type="text"
                          placeholder="Type student name or ID to select..."
                          value={searchStudentQuery}
                          onChange={(e) => setSearchStudentQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-white border rounded-lg text-xs"
                        />
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1 text-xs">
                        {filteredStudents.map((s) => {
                          const isChecked = selectedStudentIds.includes(s.id);
                          return (
                            <div 
                              key={s.id} 
                              onClick={() => handleToggleStudent(s.id)}
                              className={`p-2 rounded-lg flex justify-between items-center cursor-pointer select-none ${
                                isChecked 
                                  ? broadcastMedium === "SMS" ? "bg-indigo-50 text-indigo-800 font-bold" : "bg-emerald-50 text-emerald-800 font-bold"
                                  : "hover:bg-slate-100"
                              }`}
                            >
                              <span>{s.name} <span className="font-mono text-[10px] text-slate-400">({s.id})</span></span>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                readOnly 
                                className={`rounded border-slate-300 h-3.5 w-3.5 ${
                                  broadcastMedium === "SMS" ? "text-indigo-600 focus:ring-indigo-500" : "text-emerald-600 focus:ring-emerald-500"
                                }`} 
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Message Content (Raw Text)</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder={broadcastMedium === "SMS" ? "Draft SMS content clearly. Standard carrier charges may apply." : "Draft notice body clearly. Standard coaching variables can be injected."}
                      value={body} 
                      onChange={(e) => setBody(e.target.value)}
                      className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 text-sm ${
                        broadcastMedium === "SMS" ? "focus:ring-indigo-500" : "focus:ring-emerald-500"
                      }`}
                    ></textarea>
                  </div>

                  <div>
                    <button 
                      type="submit"
                      className={`w-full font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md ${
                        broadcastMedium === "SMS" 
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-2 focus:ring-indigo-500" 
                          : "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-2 focus:ring-emerald-500"
                      }`}
                    >
                      {broadcastMedium === "SMS" ? (
                        <>
                          <Smartphone className="w-4 h-4" /> Issue SMS Broadcast
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Issue Broadcast Notice
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>

              {/* Smartphone layout preview */}
              <div className="hidden sm:block bg-slate-900 text-slate-900 rounded-[36px] p-4 max-w-sm mx-auto shadow-xl relative border-[6px] border-slate-800">
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-xl z-20"></div>
                
                {broadcastMedium === "WhatsApp" ? (
                  <div className="bg-[#ece5dd]/90 h-[28rem] rounded-[24px] overflow-hidden relative flex flex-col justify-between font-sans">
                    {/* Phone app header bar */}
                    <div className="bg-[#075e54] text-white p-3 pt-6 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                        🎓
                      </div>
                      <div>
                        <h4 className="text-xs font-bold">ClassSetu Broadcaster</h4>
                        <p className="text-[8px] text-emerald-200">Online • verified business</p>
                      </div>
                    </div>

                    {/* Chat bubble body container */}
                    <div className="p-4 flex-1 space-y-3 overflow-y-auto text-xs font-sans">
                      {title || body ? (
                        <div className="bg-[#dcf8c6] p-3 rounded-lg shadow-sm border border-emerald-100 max-w-[85%] ml-auto relative">
                          <p className="font-bold text-xs text-emerald-900 mb-1">📢 {title || "Notice Title"}</p>
                          <p className="text-[11px] text-slate-800 leading-normal">{body || "Draft notices variables. Text written in Composer will overlay elegantly inside real-time preview."}</p>
                          <div className="text-right text-[8px] text-slate-400 mt-1 flex justify-end gap-1 items-center">
                            <span>19:11 PM</span> <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic text-center text-xs py-12">Composer draft is empty. Compile parameters above to inspect live device preview layouts.</p>
                      )}
                    </div>

                    {/* Input field footer mock */}
                    <div className="bg-slate-100 p-2 border-t flex items-center gap-2">
                      <div className="bg-white flex-1 rounded-full py-1.5 px-3 text-[10px] text-slate-400 border border-slate-200">
                        Business chat only. Reply disabled.
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#128c7e] text-white flex items-center justify-center text-sm shadow-md">
                        🎤
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white h-[28rem] rounded-[24px] overflow-hidden relative flex flex-col justify-between font-sans">
                    {/* SMS header bar */}
                    <div className="bg-[#f4f4f5] border-b border-slate-200 text-slate-800 p-3 pt-6 flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs">
                        💬
                      </div>
                      <h4 className="text-[10px] font-bold mt-1 text-slate-800">ClassSetu SMS Gateway</h4>
                      <p className="text-[7px] text-slate-500 uppercase tracking-wider">iMessage / Text Message</p>
                    </div>

                    {/* Chat bubble body container */}
                    <div className="p-4 flex-1 space-y-3 overflow-y-auto text-xs bg-white font-sans">
                      {title || body ? (
                        <div className="bg-[#007aff] text-white p-3 rounded-2xl rounded-tr-sm max-w-[85%] ml-auto relative shadow-sm">
                          <p className="font-bold text-xs text-blue-100 mb-1">📢 {title || "Notice Title"}</p>
                          <p className="text-[11px] leading-normal">{body || "Draft notices variables. Text written in Composer will overlay elegantly inside real-time preview."}</p>
                          <div className="text-right text-[7px] text-blue-200 mt-1">
                            <span>Delivered</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic text-center text-xs py-12">Composer draft is empty. Compile parameters above to inspect live device preview layouts.</p>
                      )}
                    </div>

                    {/* Input field footer mock */}
                    <div className="bg-[#f4f4f5] p-2 border-t flex items-center gap-2">
                      <div className="bg-white flex-1 rounded-full py-1.5 px-3 text-[10px] text-slate-400 border border-slate-200">
                        Text Message (ClassSetu Gateway)
                      </div>
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm shadow-sm font-bold">
                        ↑
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Audit status traces (Col span 5) */}
            <div className="lg:col-span-5 space-y-4 font-sans">
              <div className="flex justify-between items-center">
                <h4 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Bell className="w-4.5 h-4.5 text-emerald-600 animate-swing" /> Automation Trace Logs
                </h4>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-[44rem] overflow-y-auto font-sans">
                <p className="text-[11px] text-slate-400 italic leading-normal">
                  Active ledger logging critical communication events. Real-time trace outputs automatically whenever billing outstandings or absent actions invoke:
                </p>

                <div className="space-y-4">
                  {sortedLogs.length === 0 ? (
                    <p className="text-slate-400 py-12 text-center text-xs italic">No automated communications captured yet.</p>
                  ) : (
                    sortedLogs.map((log, index) => {
                      const isAbsent = log.type === "absent_alert";
                      const isDue = log.type === "fee_reminder";
                      const isSms = log.medium === "SMS" || (log.text?.includes("NOTICE (") && log.medium !== "WhatsApp");

                      return (
                        <div key={`${log.id}-${index}`} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-slate-800">
                          <div className="flex justify-between items-start">
                            <div className="flex gap-1">
                              <span className={`text-[9px] uppercase font-bold py-0.5 px-1.5 rounded ${
                                isAbsent ? "bg-rose-100 text-rose-800" :
                                isDue ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-850"
                              }`}>
                                {(log.type || "notice").replace("_", " ")}
                              </span>
                              <span className={`text-[9px] uppercase font-bold py-0.5 px-1.5 rounded ${
                                isSms ? "bg-indigo-100 text-indigo-800" : "bg-emerald-100 text-emerald-800"
                              }`}>
                                {isSms ? "SMS" : "WhatsApp"}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400">{new Date(log.sentAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[11px] text-slate-700 leading-normal font-sans">
                            {log.text}
                          </p>
                          <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-mono">To: {log.recipientMobile}</span>
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-650" /> Sent
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
        </>
      )}

    </div>
  );
}
