import React, { useState } from "react";
import { 
  Send, 
  Users, 
  MessageSquareCode, 
  Bell, 
  Smartphone, 
  CheckCheck,
  Search,
  MessageCircle,
  FileText
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
  
  // Notice Composer state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recipientType, setRecipientType] = useState<"All Students" | "All Parents" | "Selected Students">("All Parents");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [broadcastMedium, setBroadcastMedium] = useState<"WhatsApp" | "SMS">("WhatsApp");
  
  const [searchStudentQuery, setSearchStudentQuery] = useState("");
  const [composerSuccess, setComposerSuccess] = useState("");
  const [composerError, setComposerError] = useState("");

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
    <div className="space-y-8">
      
      {/* Title */}
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-800">
          Unified Communication Center
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Broadcast manual notices, alerts, and holidays instantly via WhatsApp or SMS, and monitor deep-trace automated delivery status registers.
        </p>
      </div>

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

    </div>
  );
}
