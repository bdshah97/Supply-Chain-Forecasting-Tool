
import React from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Download, ShieldCheck, TrendingUp, AlertCircle, CheckCircle2, Globe, Sparkles } from 'lucide-react';
import { OnePagerData } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: OnePagerData | null;
  isLoading: boolean;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, data, isLoading }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-300 overflow-y-auto print:p-0 print:bg-white print:static print:block print:overflow-visible" id="report-portal-root">
      <style>{`
        @page {
          size: landscape;
          margin: 0 !important;
        }

        @media print {
          /* 1. Global Reset - Kill every other node on the page */
          #root, 
          [role="dialog"],
          .no-print,
          aside, nav, header, footer {
            display: none !important;
            visibility: hidden !important;
          }

          /* 2. Absolute Body Control */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            width: 100% !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: 'Helvetica', 'Arial', sans-serif !important;
          }

          /* 3. The Portal Root Takeover */
          #report-portal-root {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: #ffffff !important;
            z-index: 99999999 !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: visible !important;
          }

          /* 4. The Slide Container */
          .report-slide-canvas {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: 100% !important;
            padding: 40px !important;
            background-color: #ffffff !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
          }

          /* 5. Force Solid Colors (PDF Engine Support) */
          .bg-indigo-600 { background-color: #4f46e5 !important; }
          .text-indigo-600 { color: #4f46e5 !important; }
          .bg-slate-900 { background-color: #0f172a !important; }
          .text-white { color: #ffffff !important; }
          .text-slate-900 { color: #000000 !important; }
          .text-slate-700 { color: #334155 !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .bg-orange-50 { background-color: #fffaf0 !important; }
          .text-orange-500 { color: #f97316 !important; }
          .bg-emerald-50 { background-color: #f0fdf4 !important; }
          .text-emerald-600 { color: #059669 !important; }
          .border-indigo-600 { border-color: #4f46e5 !important; }
          .border-b-2 { border-bottom: 2px solid #4f46e5 !important; }
          .border-slate-100 { border-color: #f1f5f9 !important; }

          /* 6. Kill all problematic CSS features */
          * {
            filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
            transition: none !important;
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      <div className="bg-white text-slate-900 w-full max-w-[1100px] aspect-[16/9] rounded-[2.5rem] shadow-2xl flex flex-col report-slide-canvas relative overflow-hidden print:rounded-none">
        {/* Header Section */}
        <div className="px-10 pt-10 pb-6 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-3.5 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-600/20">
              <FileText size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase leading-none mb-2">
                {isLoading ? "Synthesizing Memo..." : data?.title}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-[0.25em] text-indigo-600">Strategic Intelligence Brief</span>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">SSA & COMPANY</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
             <button 
              onClick={() => window.print()}
              className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
            >
              <Download size={24} />
            </button>
            <button 
              onClick={onClose} 
              className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-all"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" size={32} />
            </div>
            <p className="text-xs font-black text-slate-900 uppercase tracking-widest animate-pulse">Running Neural Analytics</p>
          </div>
        ) : data ? (
          <div className="px-10 pb-10 flex-1 flex flex-col justify-between overflow-hidden">
            <div className="grid grid-cols-12 gap-10 h-[40%] min-h-0">
              <div className="col-span-8 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 border-b-2 border-indigo-600 w-fit pb-1.5 mb-5 shrink-0">
                  <TrendingUp size={20} className="text-indigo-600" />
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Operational Summary</h2>
                </div>
                <div className="text-[14px] leading-[1.6] text-slate-700 font-medium overflow-hidden line-clamp-6">
                  {data.executiveSummary}
                </div>
              </div>
              <div className="col-span-4 grid grid-rows-3 gap-3">
                {data.kpis.slice(0, 3).map((kpi, i) => (
                  <div key={i} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-center overflow-hidden">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{kpi.label}</p>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-2xl font-black text-indigo-600 leading-none">{kpi.value}</p>
                      <p className="text-[10px] font-bold text-slate-500 truncate">{kpi.context}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-10 h-[40%] min-h-0 pt-8 border-t border-slate-100">
              <div className="space-y-5 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 border-b-2 border-orange-500 w-fit pb-1.5 shrink-0">
                  <AlertCircle size={20} className="text-orange-500" />
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-orange-500">Key Vulnerabilities</h2>
                </div>
                <div className="grid grid-rows-3 gap-2.5 flex-1 min-h-0">
                  {data.strategicRisks.slice(0, 3).map((risk, i) => (
                    <div key={i} className="px-4 py-2.5 border border-orange-100 bg-orange-50 rounded-xl flex gap-4 items-center overflow-hidden">
                      <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                      <div className="flex-1 flex items-baseline gap-2 overflow-hidden">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight shrink-0">{risk.risk}:</p>
                        <p className="text-[11px] text-slate-600 truncate font-medium">{risk.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-5 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 border-b-2 border-emerald-600 w-fit pb-1.5 shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Strategic Response</h2>
                </div>
                <div className="grid grid-rows-3 gap-2.5 flex-1 min-h-0">
                  {data.recommendations.slice(0, 3).map((rec, i) => (
                    <div key={i} className="px-4 py-2.5 border border-emerald-100 bg-emerald-50 rounded-xl flex gap-4 items-center overflow-hidden">
                      <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                      <p className="text-[11px] font-bold text-slate-700 truncate">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-auto h-[12%] shrink-0">
              <div className="h-full px-10 bg-slate-900 rounded-3xl text-white relative overflow-hidden flex items-center justify-between">
                <div className="flex flex-col overflow-hidden max-w-[80%]">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-1">Fiscal Outlook</p>
                  <p className="text-[14px] font-bold tracking-tight leading-relaxed italic text-indigo-50 truncate">"{data.outlook}"</p>
                </div>
                <Globe size={48} className="text-slate-700 opacity-50 shrink-0" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
};

export default ReportModal;
