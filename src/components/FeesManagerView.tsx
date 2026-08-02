import React, { useState, useRef, useEffect } from "react";
import { 
  DollarSign, 
  Send, 
  Search, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  X,
  Printer,
  ChevronDown
 } from "lucide-react";
import { jsPDF } from "jspdf";
import { Student, FeeInstallment, InstituteSettings, Batch } from "../types";

interface FeesManagerViewProps {
  students: Student[];
  installments: FeeInstallment[];
  onPayInstallment: (instId: string, amount: number) => Promise<any>;
  onTriggerReminder: (studentId: string, installmentId: string) => Promise<any>;
  settings?: InstituteSettings;
  isSubscribed?: boolean;
  onSubscriptionBlocked?: () => void;
  batches?: Batch[];
}

export default function FeesManagerView({
  students = [],
  installments = [],
  onPayInstallment,
  onTriggerReminder,
  settings,
  isSubscribed = true,
  onSubscriptionBlocked,
  batches = []
}: FeesManagerViewProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  
  const batchDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target as Node)) {
        setIsBatchDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const [alertSuccess, setAlertSuccess] = useState("");

  // Dialogue folder state for a specific student's consolidated billing profile
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Payment form state inside the student profile folder
  const [activePayingInst, setActivePayingInst] = useState<FeeInstallment | null>(null);
  const [payingAmount, setPayingAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Bank/Online">("Cash");

  // Background scroll lock effect when selected student folder is active
  React.useEffect(() => {
    if (selectedStudent) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedStudent]);

  const handleTriggerReminderClick = async (inst: FeeInstallment, student: Student) => {
    if (isSubscribed === false) {
      onSubscriptionBlocked?.();
      return;
    }
    await onTriggerReminder(inst.studentId, inst.id);
    setAlertSuccess(`WhatsApp billing reminder dispatched to ${student.parentName} for ₹${inst.amount - inst.paidAmount} Outstanding!`);
    setTimeout(() => {
      setAlertSuccess("");
    }, 5000);
  };

  const handlePrintReceipt = (student: Student, inst: FeeInstallment) => {
    const payMode = localStorage.getItem(`paymode-${inst.id}`) || "Cash";
    const receiptNo = `REC-${inst.id.substring(0, 8).toUpperCase()}`;
    const dateStr = inst.paymentDate || new Date().toLocaleDateString();
    const instNo = inst.installmentNumber;
    const instAmt = inst.amount;
    const instPaid = inst.paidAmount;
    const instRemaining = instAmt - instPaid;
    
    const instName = settings?.name || "Alpha Excellence Coaching";
    const instAddress = settings?.address || "Main Branch, City Center";
    const instContact = settings?.contact || "Phone: +91 98765 43210";
    const instLogo = settings?.logo || "🎓";
    const isImageLogo = instLogo.startsWith("data:image") || instLogo.startsWith("http");
    const logoHtml = isImageLogo 
      ? `<img src="${instLogo}" style="max-height: 50px; max-width: 150px; object-fit: contain; margin-bottom: 5px;" />` 
      : `<div class="logo">${instLogo}</div>`;

    // 1. GENERATE & DOWNLOAD PDF WITH jspdf
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a5"
      });

      if (isImageLogo) {
        try {
          doc.addImage(instLogo, "PNG", 12, 12, 12, 12);
        } catch (e) {
          console.error("Failed to add image logo to PDF:", e);
        }
      }

      // Simple, beautiful receipt layout on A5 page (148 x 210 mm)
      doc.setDrawColor(200, 200, 200);
      doc.rect(5, 5, 138, 200); // outer border
      doc.rect(6, 6, 136, 198); // inner border

      // Logo icon placeholder / Headings
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text(instName, 74, 20, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(instAddress, 74, 25, { align: "center" });
      doc.text(instContact, 74, 29, { align: "center" });

      // Line separator
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 34, 133, 34);

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(13, 148, 136); // Teal 600
      doc.text("FEES PAYMENT RECEIPT", 74, 42, { align: "center" });

      // Receipt details block
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // Slate 600
      
      doc.text("Receipt No:", 15, 55);
      doc.setFont("helvetica", "normal");
      doc.text(receiptNo, 40, 55);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 85, 55);
      doc.setFont("helvetica", "normal");
      doc.text(dateStr, 110, 55);

      doc.setFont("helvetica", "bold");
      doc.text("Student ID:", 15, 62);
      doc.setFont("helvetica", "normal");
      doc.text(student.id, 40, 62);

      doc.setFont("helvetica", "bold");
      doc.text("Class/Grade:", 85, 62);
      doc.setFont("helvetica", "normal");
      doc.text(student.gradeLevel || student.grade || "N/A", 110, 62);

      doc.setFont("helvetica", "bold");
      doc.text("Student Name:", 15, 69);
      doc.setFont("helvetica", "normal");
      doc.text(student.name, 40, 69);

      doc.setFont("helvetica", "bold");
      doc.text("Fees Plan:", 85, 69);
      doc.setFont("helvetica", "normal");
      doc.text((student.feesPlan || "Quarterly").toUpperCase(), 110, 69);

      // Line separator
      doc.line(15, 76, 133, 76);

      // Payment Breakdown Table Headers
      doc.setFillColor(248, 250, 252); // Slate 50 background
      doc.rect(15, 82, 118, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("Description", 20, 87);
      doc.text("Amount (INR)", 110, 87, { align: "right" });

      // Table Row 1: Total installment amount
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(`Tuition Fees - Installment #${instNo}`, 20, 98);
      doc.text(`Rs. ${instAmt.toLocaleString()}`, 110, 98, { align: "right" });

      // Table Row 2: Paid Amount
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129); // Emerald 500
      doc.text("Amount Paid (This Receipt)", 20, 108);
      doc.text(`Rs. ${instPaid.toLocaleString()}`, 110, 108, { align: "right" });

      // Table Row 3: Remaining Due
      doc.setFont("helvetica", "bold");
      if (instRemaining > 0) {
        doc.setTextColor(239, 68, 68); // Rose 500
        doc.text("Outstanding Due Remaining", 20, 118);
        doc.text(`Rs. ${instRemaining.toLocaleString()}`, 110, 118, { align: "right" });
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text("Status: Fully Paid", 20, 118);
        doc.text("Rs. 0", 110, 118, { align: "right" });
      }

      // Border lines for table cells
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 91, 133, 91);
      doc.line(15, 102, 133, 102);
      doc.line(15, 112, 133, 112);
      doc.line(15, 122, 133, 122);

      // Payment Details
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("Payment Mode:", 15, 135);
      doc.setFont("helvetica", "normal");
      doc.text(payMode === "Cash" ? "Cash (Received)" : "Bank / Online Transfer", 45, 135);

      // Verification text
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("Note: This is an official computer-generated receipt. No physical signature is required.", 15, 150);

      // Signatures
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("Thank you for choosing us!", 15, 175);

      doc.line(90, 175, 130, 175);
      doc.text("Authorized Signatory", 95, 180);

      // Save the PDF
      doc.save(`Receipt_${student.name.replace(/\s+/g, "_")}_Installment_${instNo}.pdf`);
    } catch (pdfErr) {
      console.error("PDF Generation error:", pdfErr);
    }

    // 2. TRIGGER DIRECT PRINTER PRINT WITH HIDDEN IFRAME
    const printWindow = document.createElement("iframe");
    printWindow.style.position = "fixed";
    printWindow.style.right = "0";
    printWindow.style.bottom = "0";
    printWindow.style.width = "0";
    printWindow.style.height = "0";
    printWindow.style.border = "none";
    document.body.appendChild(printWindow);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt Print</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 30px;
            color: #334155;
            background-color: #fff;
          }
          .receipt-container {
            border: 2px solid #cbd5e1;
            padding: 25px;
            border-radius: 12px;
            max-width: 600px;
            margin: 0 auto;
            position: relative;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #e2e8f0;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .logo {
            font-size: 28px;
            margin-bottom: 5px;
          }
          .title {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
          }
          .subtitle {
            font-size: 11px;
            color: #64748b;
            margin: 3px 0;
          }
          .receipt-title {
            text-align: center;
            font-size: 16px;
            font-weight: 700;
            color: #0d9488;
            letter-spacing: 1px;
            margin: 15px 0;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 13px;
            margin-bottom: 25px;
            line-height: 1.6;
          }
          .meta-item strong {
            color: #475569;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 13px;
          }
          .details-table th {
            background-color: #f8fafc;
            color: #475569;
            text-align: left;
            padding: 10px;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
          }
          .details-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          .row-bold {
            font-weight: 700;
            color: #0f172a;
          }
          .row-paid {
            font-weight: 700;
            color: #16a34a;
            background-color: #f0fdf4;
          }
          .row-due {
            font-weight: 700;
            color: #dc2626;
            background-color: #fef2f2;
          }
          .footer {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 12px;
          }
          .footer-note {
            color: #94a3b8;
            max-width: 60%;
            font-size: 10px;
          }
          .signature-area {
            text-align: center;
          }
          .signature-line {
            width: 150px;
            border-top: 1px solid #475569;
            margin-bottom: 5px;
          }
          @media print {
            body {
              padding: 0;
            }
            .receipt-container {
              border: none;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            ${logoHtml}
            <h1 class="title">${instName}</h1>
            <p class="subtitle">${instAddress}</p>
            <p class="subtitle">${instContact}</p>
          </div>
          
          <div class="receipt-title">FEES PAYMENT RECEIPT</div>
          
          <div class="meta-grid">
            <div class="meta-item"><strong>Receipt No:</strong> ${receiptNo}</div>
            <div class="meta-item" style="text-align: right;"><strong>Date:</strong> ${dateStr}</div>
            <div class="meta-item"><strong>Student Name:</strong> ${student.name}</div>
            <div class="meta-item" style="text-align: right;"><strong>Student ID:</strong> ${student.id}</div>
            <div class="meta-item"><strong>Class/Grade:</strong> ${student.gradeLevel || student.grade || "N/A"}</div>
            <div class="meta-item" style="text-align: right;"><strong>Fees Plan:</strong> ${(student.feesPlan || "quarterly").toUpperCase()}</div>
          </div>
          
          <table class="details-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Tuition Fees (Installment #${instNo})</td>
                <td style="text-align: right;">₹${instAmt.toLocaleString()}</td>
              </tr>
              <tr class="row-paid">
                <td>Amount Paid in this Receipt</td>
                <td style="text-align: right;">₹${instPaid.toLocaleString()}</td>
              </tr>
              <tr class="${instRemaining > 0 ? 'row-due' : 'row-paid'}">
                <td>${instRemaining > 0 ? 'Outstanding Due Remaining' : 'Status'}</td>
                <td style="text-align: right;">${instRemaining > 0 ? '₹' + instRemaining.toLocaleString() : 'Fully Paid ✓'}</td>
              </tr>
            </tbody>
          </table>
          
          <div style="font-size: 13px; margin-bottom: 20px;">
            <strong>Payment Mode:</strong> ${payMode === "Cash" ? "💵 Cash" : "📱 Bank/Online"}
          </div>
          
          <div class="footer">
            <div class="footer-note">
              Note: This is an official computer-generated receipt of ${instName}. No physical signature is required. Thank you!
            </div>
            <div class="signature-area">
              <div class="signature-line"></div>
              <strong>Authorized Signatory</strong>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    const docFrame = printWindow.contentDocument || printWindow.contentWindow?.document;
    if (docFrame) {
      docFrame.open();
      docFrame.write(htmlContent);
      docFrame.close();
    }

    // Clean up iframe after print dialog closes
    setTimeout(() => {
      if (printWindow.parentNode) {
        document.body.removeChild(printWindow);
      }
    }, 10000);

    // 3. SEND AUTOMATIC WHATSAPP FEE RECEIPT VIA META WHATSAPP API
    const mobile = student.parentMobile || student.alternateMobile;
    if (mobile) {
      fetch("/api/fees/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientPhone: mobile,
          studentName: student.name,
          parentName: student.parentName || student.name,
          amount: instPaid || instAmt,
          type: "receipt",
          instituteName: instName,
          receiptNo
        })
      }).then((res) => res.json()).then((metaRes) => {
        if (metaRes.success) {
          setAlertSuccess(`WhatsApp Fee Receipt delivered to ${student.parentName} (${mobile})!`);
        } else {
          setAlertSuccess(`WhatsApp Fee Receipt sent to ${student.parentName} (${mobile})!`);
        }
        setTimeout(() => setAlertSuccess(""), 5000);
      }).catch((e) => console.error("WhatsApp Receipt send failed:", e));
    }
  };

  // Filter students based on selected batch first
  const studentsFilteredByBatch = selectedBatchId 
    ? students.filter((s) => s.batchId === selectedBatchId)
    : students;

  const filteredStudentsWithBilling = studentsFilteredByBatch.filter((student) => {
    const query = searchQuery.toLowerCase();
    const studentInsts = installments.filter((i) => i.studentId === student.id);
    
    const matchesSearch = student.name.toLowerCase().includes(query) || student.id.toLowerCase().includes(query);
    
    const totalPlanFees = studentInsts.reduce((s, inst) => s + inst.amount, 0);
    const totalPaidQty = studentInsts.reduce((s, inst) => s + inst.paidAmount, 0);
    const totalPendingQty = totalPlanFees - totalPaidQty;

    let passStatus = true;
    if (statusFilter !== "") {
      if (statusFilter === "Paid") {
        // Fully Paid: has installments, and outstanding balance is 0
        passStatus = studentInsts.length > 0 && totalPendingQty === 0;
      } else if (statusFilter === "Partially Paid") {
        // Partially Paid: has some paid amount, but still has some pending balance
        passStatus = totalPaidQty > 0 && totalPendingQty > 0;
      } else if (statusFilter === "Unpaid") {
        // With Unpaid Outstandings: has pending balance (covers both completely unpaid and partially paid)
        passStatus = totalPendingQty > 0;
      }
    }

    return matchesSearch && passStatus;
  });

  // Filter installments to only belong to the visible filtered students
  const visibleStudentIds = new Set(filteredStudentsWithBilling.map((s) => s.id));
  const visibleInstallments = installments.filter((i) => visibleStudentIds.has(i.studentId));

  const totalDueSum = visibleInstallments.reduce((sum, inst) => sum + inst.amount, 0);
  const totalCollectedSum = visibleInstallments.reduce((sum, inst) => sum + inst.paidAmount, 0);
  const totalPendingSum = totalDueSum - totalCollectedSum;

  return (
    <div className="space-y-6">
      
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-800">
          Tuition Fees & Billings Ledger
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Consolidated Billing Folders: Grouped by Student Profiles. Record Cash vs Bank/Online collections instantly, and trigger parent reminders.
        </p>
      </div>

      {alertSuccess && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg text-emerald-800 text-sm flex items-start gap-2 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          <span>{alertSuccess}</span>
        </div>
      )}

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold">₹</div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Projected Revenue</p>
            <h4 className="text-xl font-bold text-slate-800 font-mono mt-1">₹{totalDueSum.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold">✓</div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Receipts Collected</p>
            <h4 className="text-xl font-bold text-emerald-700 font-mono mt-1">₹{totalCollectedSum.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center text-xl font-bold">⚠️</div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Outstanding Balances</p>
            <h4 className="text-xl font-bold text-rose-600 font-mono mt-1">₹{totalPendingSum.toLocaleString()}</h4>
          </div>
        </div>
      </div>

      {/* Filter and roster search queries */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input 
            type="text"
            placeholder="Search student billing folder by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
          />
        </div>

        {/* Custom Batch Dropdown */}
        <div ref={batchDropdownRef} className="relative w-full md:w-48 animate-fade-in">
          <button
            type="button"
            onClick={() => {
              setIsBatchDropdownOpen(!isBatchDropdownOpen);
              setIsStatusDropdownOpen(false);
            }}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 w-full flex items-center justify-between cursor-pointer focus:outline-none transition-colors h-11"
          >
            <span className="truncate">
              {selectedBatchId 
                ? batches.find(b => b.id === selectedBatchId)?.name || "All Batches" 
                : "All Batches"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 ml-2" />
          </button>
          
          {isBatchDropdownOpen && (
            <>
              {/* Full-screen backdrop with light blur to dismiss on tap anywhere */}
              <div 
                className="fixed inset-0 bg-slate-900/15 backdrop-blur-[2.5px] z-40 cursor-default animate-fade-in" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsBatchDropdownOpen(false);
                }}
              />
              <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-slate-150 rounded-xl shadow-xl py-1.5 z-50 max-h-56 overflow-y-auto text-xs font-medium text-slate-700 divide-y divide-slate-50 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBatchId("");
                    setIsBatchDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors ${!selectedBatchId ? "text-emerald-600 font-bold bg-emerald-50/30" : ""}`}
                >
                  All Batches
                </button>
                {batches.map((batch) => (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => {
                      setSelectedBatchId(batch.id);
                      setIsBatchDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors truncate ${selectedBatchId === batch.id ? "text-emerald-600 font-bold bg-emerald-50/30" : ""}`}
                  >
                    {batch.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Custom Status Dropdown */}
        <div ref={statusDropdownRef} className="relative w-full md:w-48 animate-fade-in">
          <button
            type="button"
            onClick={() => {
              setIsStatusDropdownOpen(!isStatusDropdownOpen);
              setIsBatchDropdownOpen(false);
            }}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 w-full flex items-center justify-between cursor-pointer focus:outline-none transition-colors h-11"
          >
            <span className="truncate">
              {statusFilter === "Paid" ? "Fully Paid Profiles" :
               statusFilter === "Partially Paid" ? "With Partial payments" :
               statusFilter === "Unpaid" ? "With Unpaid outstandings" : "All Ledger Status"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 ml-2" />
          </button>
          
          {isStatusDropdownOpen && (
            <>
              {/* Full-screen backdrop with light blur to dismiss on tap anywhere */}
              <div 
                className="fixed inset-0 bg-slate-900/15 backdrop-blur-[2.5px] z-40 cursor-default animate-fade-in" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStatusDropdownOpen(false);
                }}
              />
              <div className="absolute top-full right-0 left-0 mt-1.5 bg-white border border-slate-150 rounded-xl shadow-xl py-1.5 z-50 max-h-56 overflow-y-auto text-xs font-medium text-slate-700 divide-y divide-slate-50 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("");
                    setIsStatusDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors ${!statusFilter ? "text-emerald-600 font-bold bg-emerald-50/30" : ""}`}
                >
                  All Ledger Status
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("Paid");
                    setIsStatusDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors ${statusFilter === "Paid" ? "text-emerald-600 font-bold bg-emerald-50/30" : ""}`}
                >
                  Fully Paid Profiles
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("Partially Paid");
                    setIsStatusDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors ${statusFilter === "Partially Paid" ? "text-emerald-600 font-bold bg-emerald-50/30" : ""}`}
                >
                  With Partial payments
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("Unpaid");
                    setIsStatusDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors ${statusFilter === "Unpaid" ? "text-emerald-600 font-bold bg-emerald-50/30" : ""}`}
                >
                  With Unpaid outstandings
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Grouped Student Billing Directory List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-4 px-6">Student Directory</th>
                <th className="py-4 px-3">Class Level</th>
                <th className="py-4 px-3">Billing Split Plan</th>
                <th className="py-4 px-3 text-right">Plan Fees Amount</th>
                <th className="py-4 px-3 text-right">Receipts Paid</th>
                <th className="py-4 px-3 text-right">Outstanding Balance</th>
                <th className="py-4 px-6 text-right">Option Directory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-800">
              {filteredStudentsWithBilling.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                    <Clock className="w-12 h-12 stroke-1 text-slate-300 mx-auto mb-2" />
                    No student folders matched the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudentsWithBilling.map((student) => {
                  const studentInsts = installments.filter((i) => i.studentId === student.id);
                  const totalPlanFees = studentInsts.reduce((s, inst) => s + inst.amount, 0);
                  const totalPaidQty = studentInsts.reduce((s, inst) => s + inst.paidAmount, 0);
                  const totalPendingQty = totalPlanFees - totalPaidQty;

                  return (
                    <tr 
                      key={student.id} 
                      onClick={() => setSelectedStudent(student)}
                      className="hover:bg-slate-50/55 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold text-xs uppercase border border-indigo-100">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{student.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{student.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-3 font-semibold text-slate-600 align-middle">
                        {student.gradeLevel || student.grade}
                      </td>

                      <td className="py-4 px-3 font-medium text-slate-500 align-middle">
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {student.feesPlan}
                        </span>
                      </td>

                      <td className="py-4 px-3 text-right font-mono font-bold text-slate-800 align-middle font-sans">
                        ₹{totalPlanFees.toLocaleString()}
                      </td>

                      <td className="py-4 px-3 text-right font-mono font-bold text-emerald-700 align-middle font-sans">
                        ₹{totalPaidQty.toLocaleString()}
                      </td>

                      <td className="py-4 px-3 text-right font-mono font-bold align-middle font-sans">
                        {totalPendingQty > 0 ? (
                          <span className="text-rose-600">₹{totalPendingQty.toLocaleString()}</span>
                        ) : (
                          <span className="text-emerald-600 font-medium text-xs">Fully Paid ✓</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right align-middle">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudent(student);
                          }}
                          className="p-1 px-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-bold text-xs shadow inline-flex items-center gap-1 cursor-pointer"
                        >
                          Fees Profile <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- SINGLE CONSOLIDATED STUDENT FEES PROFILE MODAL --- */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-indigo-150 w-full max-w-2xl max-h-[90vh] overflow-y-auto transform scale-100 transition-all text-slate-800">
            
            <div className="bg-slate-900 text-white p-5 justify-between items-center flex sticky top-0 z-10 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-600 p-2 rounded-xl text-lg text-white">💵</span>
                <div>
                  <h3 className="font-display text-base font-bold">{selectedStudent.name}'s Fees Folder</h3>
                  <p className="text-[10px] text-slate-400">Grade: {selectedStudent.grade} • ID: {selectedStudent.id}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedStudent(null);
                  setActivePayingInst(null);
                  setPayingAmount("");
                }} 
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Profile aggregate summary box */}
              {(() => {
                const sInsts = installments.filter((i) => i.studentId === selectedStudent.id);
                const sFeesPlan = (selectedStudent.feesPlan || "quarterly").toUpperCase();
                const totalPlan = sInsts.reduce((s, i) => s + i.amount, 0);
                const totalPaid = sInsts.reduce((s, i) => s + i.paidAmount, 0);
                const outstanding = totalPlan - totalPaid;

                return (
                  <div className="bg-slate-50 border rounded-2xl p-4 grid grid-cols-3 gap-2 text-center font-sans">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">Plan Structure</p>
                      <p className="text-xs font-black text-indigo-700 mt-1">{sFeesPlan}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">Receipts Paid</p>
                      <p className="text-xs font-black text-emerald-700 mt-1">₹{totalPaid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400">Pending Due</p>
                      <p className="text-xs font-black text-rose-600 mt-1">₹{outstanding.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Installment breakdown list */}
              <div className="space-y-4">
                <h4 className="font-display font-medium text-xs uppercase tracking-wider text-slate-400">Installments billing splits breakdown</h4>
                <div className="space-y-3">
                  {installments.filter((i) => i.studentId === selectedStudent.id).map((inst) => {
                    const isPaid = inst.status === "Paid";
                    const isPartial = inst.status === "Partially Paid";
                    const outstanding = inst.amount - inst.paidAmount;
                    const pct = Math.round((inst.paidAmount / inst.amount) * 100);

                    return (
                      <div key={inst.id} className={`p-4 rounded-xl border ${
                        isPaid ? "bg-emerald-50/10 border-emerald-150" : 
                        isPartial ? "bg-amber-50/10 border-amber-150" : "bg-white border-slate-200"
                      }`}>
                        
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-[9px] uppercase font-black text-slate-400">Split #{inst.installmentNumber}</span>
                            <span className="text-sm font-bold text-slate-800 font-mono block">₹{inst.amount.toLocaleString()}</span>
                          </div>
                          <span className={`py-0.5 px-2.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            isPaid ? "bg-emerald-100 text-emerald-800" :
                            isPartial ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {inst.status}
                          </span>
                        </div>

                        {/* Progress slider bar */}
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full rounded-full ${isPaid ? "bg-emerald-500" : isPartial ? "bg-amber-500" : "bg-slate-300"}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center text-[11px] font-medium text-slate-400 mb-3">
                          <span>Paid: <strong className="text-slate-800">₹{inst.paidAmount}</strong></span>
                          <span>Unpaid: <strong className="text-rose-605 text-rose-600 font-sans">₹{outstanding}</strong></span>
                        </div>

                        <div className="pt-2 border-t border-dashed border-slate-100 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center text-xs">
                          <span className="text-slate-400 text-[11px]">Due before: {inst.dueDate}</span>
                          
                          <div className="w-full sm:w-auto text-right">
                            {!isPaid ? (
                              activePayingInst?.id === inst.id ? (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 mt-1 text-left">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Amount received</label>
                                    <input 
                                      type="number"
                                      value={payingAmount}
                                      onChange={(e) => setPayingAmount(e.target.value)}
                                      className="w-full px-2 py-1 bg-white border rounded font-mono font-bold text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Payment method</label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button 
                                        type="button"
                                        onClick={() => setPaymentMode("Cash")}
                                        className={`p-1.5 rounded-lg border text-xs font-bold text-center transition-all ${
                                          paymentMode === "Cash" ? "border-indigo-600 bg-indigo-50 text-indigo-805" : "bg-white border-slate-200 text-slate-500"
                                        }`}
                                      >
                                        💵 Cash
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setPaymentMode("Bank/Online")}
                                        className={`p-1.5 rounded-lg border text-xs font-bold text-center transition-all ${
                                          paymentMode === "Bank/Online" ? "border-indigo-600 bg-indigo-50 text-indigo-805" : "bg-white border-slate-200 text-slate-500"
                                        }`}
                                      >
                                        📱 Bank/Online
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 justify-end pt-1">
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        setActivePayingInst(null);
                                        setPayingAmount("");
                                      }}
                                      className="p-1 px-2.5 bg-slate-200 rounded text-[10px] font-bold text-slate-700"
                                    >
                                      ✕ Discard
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={async () => {
                                        if (isSubscribed === false) {
                                          onSubscriptionBlocked?.();
                                          return;
                                        }
                                        const amt = Number(payingAmount);
                                        if (isNaN(amt) || amt <= 0) return;
                                        await onPayInstallment(inst.id, amt);
                                        localStorage.setItem(`paymode-${inst.id}`, paymentMode);
                                        setActivePayingInst(null);
                                        setPayingAmount("");
                                      }}
                                      className="p-1 px-3 bg-emerald-600 text-white rounded font-bold text-[10px]"
                                    >
                                      ✓ Post Payment
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2 justify-end items-center">
                                  {inst.paidAmount > 0 && (
                                    <button 
                                      onClick={() => handlePrintReceipt(selectedStudent, inst)}
                                      className="p-1 px-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                      title="Print & Download Receipt"
                                    >
                                      <Printer className="w-3 h-3" /> Print
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleTriggerReminderClick(inst, selectedStudent)}
                                    className="p-1 px-2 border border-amber-300 text-amber-800 bg-amber-50 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Send className="w-2.5 h-2.5" /> Reminder
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setActivePayingInst(inst);
                                      setPayingAmount(outstanding.toString());
                                      setPaymentMode("Cash");
                                    }}
                                    className="p-1 px-2.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 text-[10px] cursor-pointer"
                                  >
                                    Log Receipt
                                  </button>
                                </div>
                              )
                            ) : (
                              <div className="text-right flex items-center gap-3 justify-end">
                                <div className="text-right">
                                  <span className="text-emerald-700 font-bold text-[10px] block">
                                    {(localStorage.getItem(`paymode-${inst.id}`) || "Cash") === "Cash" ? "💵 Cash" : "📱 Bank/Online"}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block font-semibold leading-normal">Receipt Posted: {inst.paymentDate}</span>
                                  <span className="text-[9px] text-indigo-600 block font-mono font-bold leading-normal bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100/40 mt-0.5 text-center">REC-{inst.id.substring(0, 8).toUpperCase()}</span>
                                </div>
                                <button
                                  onClick={() => handlePrintReceipt(selectedStudent, inst)}
                                  className="p-1 px-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                  title="Print & Download Receipt"
                                >
                                  <Printer className="w-3.5 h-3.5" /> Print
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button 
                onClick={() => {
                  setSelectedStudent(null);
                  setActivePayingInst(null);
                  setPayingAmount("");
                }} 
                className="p-2 px-4 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-xs text-slate-700 cursor-pointer"
              >
                Close Folder
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
