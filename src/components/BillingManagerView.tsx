import React, { useState } from "react";
const BILLING_GATEWAY_BG_URL = "https://res.cloudinary.com/dzb6aq2gm/image/upload/v1788603892/file_00000000dee88211a832c5827bb04c3f_h2bmsd.png";
import { 
  CreditCard, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  Download, 
  ShieldCheck, 
  FileText, 
  Sparkles,
  Zap,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { NotificationLog, InstituteSettings } from "../types";

interface BillingManagerViewProps {
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
  logs?: NotificationLog[];
  settings?: InstituteSettings;
  isSubscribed?: boolean;
}

export default function BillingManagerView({
  instituteData,
  logs = [],
  settings,
  isSubscribed = true
}: BillingManagerViewProps) {
  const [selectedMonth] = useState(() => {
    const d = new Date();
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  });
  const [activeFilter, setActiveFilter] = useState<"ALL" | "WhatsApp" | "SMS">("ALL");
  const [downloading, setDownloading] = useState(false);

  const isWhatsAppEnabled = instituteData?.isWhatsAppEnabled ?? true;
  const isSmsEnabled = instituteData?.isSmsEnabled ?? true;
  const whatsappSent = Number(instituteData?.whatsappSent ?? 0);
  const smsSent = Number(instituteData?.smsSent ?? 0);
  const totalSent = whatsappSent + smsSent;

  // Rate estimates for Pay-As-You-Go model
  const waRatePerMsg = 0.50; // INR per message estimate
  const smsRatePerMsg = 0.25; // INR per SMS estimate
  const waTotalCost = (whatsappSent * waRatePerMsg).toFixed(2);
  const smsTotalCost = (smsSent * smsRatePerMsg).toFixed(2);
  const estimatedTotalCost = (Number(waTotalCost) + Number(smsTotalCost)).toFixed(2);

  // Filter logs for the table
  const filteredLogs = logs.filter(log => {
    if (activeFilter === "ALL") return true;
    const channel = log.medium || "WhatsApp";
    return channel === activeFilter;
  });

  const handleDownloadStatement = () => {
    setDownloading(true);
    setTimeout(() => {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setDownloading(false);
        return;
      }

      const content = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Billing Statement - ${settings?.name || "ClasSetu"}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #0f172a; }
            .badge { background: #f3e8ff; color: #6b21a8; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            .summary-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
            .summary-table th, .summary-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            .summary-table th { background: #f8fafc; font-size: 12px; text-transform: uppercase; color: #64748b; }
            .total-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: right; margin-top: 20px; }
            .footer { margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">${settings?.name || "ClasSetu Premium Coaching"}</div>
              <div style="color: #64748b; font-size: 13px; margin-top: 4px;">Pay As You Go API Usage & Billing Statement</div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;">Billing Period: ${selectedMonth}</div>
            </div>
            <div style="text-align: right;">
              <span class="badge">Pay As You Go Plan</span>
              <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Generated: ${new Date().toLocaleString()}</div>
            </div>
          </div>

          <table class="summary-table">
            <thead>
              <tr>
                <th>Communication Gateway</th>
                <th>Status</th>
                <th>Units Dispatched</th>
                <th>Model</th>
                <th style="text-align: right;">Estimated Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>WhatsApp Meta Cloud API</strong></td>
                <td><span style="color: #16a34a; font-weight: 600;">Active</span></td>
                <td>${whatsappSent} msgs</td>
                <td>Pay As You Go (Uncapped)</td>
                <td style="text-align: right;">₹${waTotalCost}</td>
              </tr>
              <tr>
                <td><strong>SMS Carrier Direct API</strong></td>
                <td><span style="color: #4f46e5; font-weight: 600;">Active</span></td>
                <td>${smsSent} msgs</td>
                <td>Pay As You Go (Uncapped)</td>
                <td style="text-align: right;">₹${smsTotalCost}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-box">
            <div style="font-size: 13px; color: #64748b;">Total Units Dispatched: <strong>${totalSent} messages</strong></div>
            <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 5px;">
              Estimated Bill: ₹${estimatedTotalCost}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Post-billed at billing cycle conclusion. Zero upfront message locks.</div>
          </div>

          <div class="footer">
            ClasSetu System • Secure Enterprise Billing Ledger • All dispatches verified and logged in real-time.
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(content);
      printWindow.document.close();
      setDownloading(false);
    }, 400);
  };

  return (
    <div className="space-y-8 animate-fade-in" id="billing-profile-view">
      
      {/* Top Banner & Profile Overview */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden group">
        {/* User Provided Banner Image - Clean & Filter-Free */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={BILLING_GATEWAY_BG_URL}
            alt="Class Setu Billing & Communication Banner"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
          />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 bg-slate-950/75 backdrop-blur-md p-4 rounded-2xl border border-white/10 max-w-xl shadow-lg">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="p-2 bg-purple-500/20 border border-purple-400/30 rounded-xl text-purple-300">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-xl md:text-2xl font-black font-display tracking-tight text-white">
                Billing & Gateway Profile
              </h2>
              <span className="bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                Pay As You Go
              </span>
            </div>
            <p className="text-slate-200 text-xs md:text-sm leading-relaxed">
              Complete transparency over WhatsApp Cloud API and SMS communication traffic with dynamic monthly settlement.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadStatement}
              disabled={downloading}
              className="px-4 py-2.5 bg-slate-900/85 hover:bg-slate-900 text-white rounded-xl text-xs font-bold border border-white/20 hover:border-white/40 transition-all flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md active:scale-95"
            >
              {downloading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              ) : (
                <Download className="w-4 h-4 text-purple-400" />
              )}
              <span>Download Statement</span>
            </button>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-4 border-t border-white/15 bg-slate-950/75 backdrop-blur-md rounded-2xl p-4 border relative z-10 shadow-lg">
          <div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Billing Period</span>
            <span className="text-xs md:text-sm font-black text-white font-mono mt-0.5 block">{selectedMonth}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Plan Type</span>
            <span className="text-xs md:text-sm font-black text-emerald-400 mt-0.5 block">Uncapped Post-Paid</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Gateway Status</span>
            <span className="text-xs md:text-sm font-black text-purple-300 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" /> 100% Online
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Total Dispatches</span>
            <span className="text-xs md:text-sm font-black text-white font-mono mt-0.5 block">{totalSent} Messages</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: WhatsApp Service */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isWhatsAppEnabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">WhatsApp Service</h3>
                  <p className="text-xs text-slate-400 font-medium">Meta Cloud API (Official)</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${isWhatsAppEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isWhatsAppEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                {isWhatsAppEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-semibold">Total Dispatched</span>
                <span className="text-2xl font-black font-mono text-emerald-600">{whatsappSent} <span className="text-xs text-slate-400 font-normal">msgs</span></span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                <span>Quota Limit</span>
                <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 uppercase text-[10px]">Uncapped (No Limit)</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Est. Rate / Msg</span>
                <span className="font-mono font-bold text-slate-700">₹{waRatePerMsg.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-600">
            <span>Estimated WhatsApp Subtotal:</span>
            <span className="font-mono font-bold text-emerald-700 text-sm">₹{waTotalCost}</span>
          </div>
        </div>

        {/* Card 2: SMS Service */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isSmsEnabled ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">SMS Service</h3>
                  <p className="text-xs text-slate-400 font-medium">Telecom Direct Gateway</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${isSmsEnabled ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isSmsEnabled ? 'bg-indigo-500 animate-pulse' : 'bg-slate-400'}`}></span>
                {isSmsEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-semibold">Total Dispatched</span>
                <span className="text-2xl font-black font-mono text-indigo-600">{smsSent} <span className="text-xs text-slate-400 font-normal">msgs</span></span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                <span>Quota Limit</span>
                <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 uppercase text-[10px]">Uncapped (No Limit)</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Est. Rate / SMS</span>
                <span className="font-mono font-bold text-slate-700">₹{smsRatePerMsg.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-600">
            <span>Estimated SMS Subtotal:</span>
            <span className="font-mono font-bold text-indigo-700 text-sm">₹{smsTotalCost}</span>
          </div>
        </div>

        {/* Card 3: Combined Monthly Settlement Card */}
        <div className="bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col justify-between border border-purple-800/40 relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-500/20 text-purple-300 rounded-lg text-lg">🧾</span>
                <h3 className="text-sm font-black uppercase tracking-wider text-purple-200">Current Ledger Summary</h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded border border-purple-400/20">
                Pay As You Go
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-xs text-purple-200/80">
                <span>WhatsApp Messages ({whatsappSent})</span>
                <span className="font-mono font-bold text-white">₹{waTotalCost}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-purple-200/80">
                <span>SMS Messages ({smsSent})</span>
                <span className="font-mono font-bold text-white">₹{smsTotalCost}</span>
              </div>
              <div className="pt-3 border-t border-purple-800/60 flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">Estimated Total Bill</span>
                <span className="text-3xl font-black font-mono text-emerald-400">₹{estimatedTotalCost}</span>
              </div>
            </div>
          </div>

          <div className="bg-purple-950/60 rounded-xl p-3 border border-purple-800/50 mt-4 text-[11px] text-purple-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>Automated settlement will be generated at the end of the monthly billing cycle.</span>
          </div>
        </div>

      </div>


      {/* Dispatches & Audit Activity Logs */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-700" />
              Recent Dispatch Ledger & Audit Logs
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live records of messages dispatched through Pay As You Go channels
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeFilter === "ALL" ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setActiveFilter("WhatsApp")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${activeFilter === "WhatsApp" ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              WhatsApp
            </button>
            <button
              onClick={() => setActiveFilter("SMS")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${activeFilter === "SMS" ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              SMS
            </button>
          </div>
        </div>

        {/* Logs Table / List */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No Dispatches in Current Filter</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Automated absence alerts, fee payment receipts, and manual broadcast notices will appear here in real-time as they are sent.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200/80">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Message / Purpose</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Billing Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.slice(0, 15).map((log, idx) => {
                  const channel = log.medium || "WhatsApp";
                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {log.sentAt ? new Date(log.sentAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "Recent"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {channel === "WhatsApp" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[10px]">
                            <MessageSquare className="w-3 h-3" /> WhatsApp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-bold text-[10px]">
                            <Send className="w-3 h-3" /> SMS
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {log.recipientMobile || "Parent Contact"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.text}>
                        {log.text || (log.type === "absent_alert" ? "Daily Absence Alert Notification" : log.type === "fee_reminder" ? "Fee Payment Reminder Receipt" : "Institute Broadcast Notice")}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {log.status || "Delivered"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="text-[10px] font-bold font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                          Pay As You Go
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
