import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Area, ComposedChart, Bar, Line, Legend, BarChart, Cell
} from 'recharts';
import { 
  TrendingUp, Download, BrainCircuit, 
  FileText, Activity, Layers,
  Globe, Package, Truck, Database, 
  Zap, Trash2, HelpCircle, Search, Check, X, ChevronDown, 
  Eye, EyeOff, Plus, AlertTriangle, Settings2, Cpu,
  Calendar, MessageSquare, Play, BarChart3, ShieldCheck, History, UserCircle, FileOutput, ArrowUpRight,
  Settings, Link as LinkIcon, Info, BookOpen, DollarSign, ShieldAlert, Sparkles, Wand2, Loader2, Gauge, Filter
} from 'lucide-react';
import { SKUS, CATEGORIES, SAMPLE_DATA, SAMPLE_ATTRIBUTES, SAMPLE_INVENTORY, DEFAULT_HORIZON } from './constants';
import { DataPoint, FilterState, TimeInterval, ForecastMethodology, ProductAttribute, InventoryLevel, Scenario, AiProvider, AudienceType, OnePagerData, MarketShock, ProductionPlan } from './types';
import { calculateForecast, calculateMetrics, cleanAnomalies, applyMarketShocks, detectHWMethod } from './utils/forecasting';
import { calculateSupplyChainMetrics, runParetoAnalysis } from './utils/supplyChain';
import { exportToCSV, exportBulkCSV, exportAlerts } from './utils/export';
import { getIndustryInsights, getMarketTrendAdjustment, MarketAdjustment, getNarrativeSummary, getOnePagerReport, getAnomalyAnalysis } from './services/aiService';
import MetricsCard from './components/MetricsCard';
import ChatAgent from './components/ChatAgent';
import ReportModal from './components/ReportModal';
import InfoTooltip from './components/InfoTooltip';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0, 
    minimumFractionDigits: 0 
  }).format(Math.round(val));

const formatNumber = (val: number) => 
  new Intl.NumberFormat('en-US').format(Math.round(val));

// Helper: Normalize date to YYYY-MM-01 format (consistent format throughout the app)
const normalizeDateFormat = (dateStr: any): string => {
  if (!dateStr) return '';
  
  try {
    // If it's a Date object, convert to string
    if (dateStr instanceof Date) {
      const y = dateStr.getFullYear();
      const m = String(dateStr.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}-01`;
    }
    
    // If it's a string, parse it
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}-01`;
    }
    
    // Try manual parsing of YYYY-MM-DD format
    if (typeof dateStr === 'string') {
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (!isNaN(year) && !isNaN(month)) {
          const m = String(month).padStart(2, '0');
          return `${year}-${m}-01`;
        }
      }
    }
  } catch (e) {
    console.warn(`Failed to normalize date: ${dateStr}`, e);
  }
  
  return '';
};

// Helper: Format date for display (ensures consistent date formatting)
const formatDateForDisplay = (dateStr: any): string => {
  if (!dateStr) return '';
  
  // Handle if already a Date object
  if (dateStr instanceof Date) {
    return `${dateStr.getMonth() + 1}/${dateStr.getFullYear()}`;
  }
  
  // Convert string to Date if possible
  const dateObj = new Date(dateStr);
  if (!isNaN(dateObj.getTime())) {
    return `${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
  }
  
  // If already in MM/YYYY format, return as-is
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    return dateStr;
  }
  
  // Last resort - try manual parsing
  const parts = String(dateStr).split('-');
  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[0], 10);
    if (!isNaN(month) && !isNaN(year)) {
      return `${month}/${year}`;
    }
  }
  
  return '';
};

const METHOD_DESCRIPTIONS: Record<ForecastMethodology, string> = {
  [ForecastMethodology.HOLT_WINTERS]: "Triple exponential smoothing (Level, Trend, Seasonality). Use multiplicative for steady-state products with consistent patterns, additive for growth ramp-ups or sparse data.",
  [ForecastMethodology.PROPHET]: "Additive model decomposition. Robust against missing data and outliers.",
  [ForecastMethodology.ARIMA]: "Focuses on autocorrelation and moving averages. Best for stable, trending demand.",
  [ForecastMethodology.LINEAR]: "Simple regression fitting a straight line. Ideal for long-term structural drift identification."
};

// Utility: Downsample data for chart rendering (large datasets)
const downsampleData = (data: any[], maxPoints: number = 1000): any[] => {
  if (data.length <= maxPoints) return data;
  const bucketSize = Math.ceil(data.length / maxPoints);
  const downsampled = [];
  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, i + bucketSize);
    if (bucket.length > 0) {
      downsampled.push(bucket[Math.floor(bucket.length / 2)]); // Take median point
    }
  }
  return downsampled;
};

const CustomTrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => {
            let displayName = entry.name;
            let displayColor = entry.color;

            if (entry.dataKey === 'historical') {
              displayName = 'Historical Quantity';
              displayColor = '#6366f1';
            } else if (entry.dataKey === 'scenarioForecast') {
              displayName = 'Forecasted Quantity';
              displayColor = '#ef4444';
            } else if (entry.dataKey === 'upperBound') {
              displayName = 'Upper Bound Quantity';
              displayColor = '#ef4444';
            } else if (entry.dataKey === 'lowerBound') {
              displayName = 'Lower Bound Quantity';
              displayColor = '#ef4444';
            }

            return (
              <div key={index} className="flex items-center justify-between gap-6">
                <span className="text-[11px] font-bold uppercase tracking-tight" style={{ color: displayColor }}>
                  {displayName}
                </span>
                <span className="text-[11px] font-black" style={{ color: displayColor }}>
                  {formatNumber(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const SearchableSelect: React.FC<{
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  label: string;
  icon: React.ReactNode;
}> = ({ options, value, onChange, placeholder, label, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const opts = ['All', ...options];
    if (!search) return opts;
    return opts.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full space-y-3 relative" ref={containerRef}>
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">{icon}</div>
        <h3 className="text-[10px] font-black text-slate-200 uppercase tracking-widest">{label}</h3>
      </div>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-200 cursor-pointer hover:border-indigo-500 transition-all shadow-inner"
      >
        <span className={value === 'All' ? 'text-slate-500' : 'text-slate-200'}>{value === 'All' ? placeholder : value}</span>
        <ChevronDown size={14} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[100] p-2 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          <input 
            autoFocus
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
            placeholder="Type to filter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto no-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div 
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${value === opt ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  {opt}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-[10px] text-slate-600 italic">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MultiSearchableSelect: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  label: string;
  icon: React.ReactNode;
}> = ({ options, selected, onToggle, onSelectAll, onClear, label, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full space-y-3 relative" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">{icon}</div>
          <h3 className="text-[10px] font-black text-slate-200 uppercase tracking-widest">{label}</h3>
        </div>
        <div className="flex gap-3">
           <button onClick={(e) => { e.stopPropagation(); onSelectAll(); }} className="text-[8px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors">Select All</button>
           <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-[8px] font-black uppercase text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
        </div>
      </div>
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-200 cursor-pointer hover:border-indigo-500 transition-all shadow-inner"
      >
        <div className="flex flex-wrap gap-1 items-center max-w-[90%] overflow-hidden">
          {selected.length === 0 ? (
            <span className="text-slate-500">Search and select SKUs...</span>
          ) : selected.length === options.length ? (
            <span className="text-slate-200">All Entities Selected</span>
          ) : (
            selected.slice(0, 2).map(s => (
              <span key={s} className="bg-indigo-600 px-2 py-0.5 rounded text-[9px] text-white">{s}</span>
            ))
          )}
          {selected.length > 2 && <span className="text-slate-500 text-[8px]">+{selected.length - 2} more</span>}
        </div>
        <ChevronDown size={14} className={`text-slate-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[500] p-2 animate-in fade-in zoom-in-95 duration-200">
          <input 
            autoFocus
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
            placeholder="Type SKU name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div 
                  key={opt}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(opt);
                  }}
                  className={`px-3 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center justify-between ${selected.includes(opt) ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  <span>{opt}</span>
                  {selected.includes(opt) && <Check size={12} />}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-[10px] text-slate-600 italic">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SchemaModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Data Schema Guide</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Consultant-Standard Formatting</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><X size={20} /></button>
        </div>
        <div className="space-y-6 text-slate-300">
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <h3 className="text-[10px] font-black uppercase text-indigo-400 mb-2">Historical Sales (sales.csv)</h3>
            <p className="text-[11px] mb-2 font-mono text-slate-500">date (YYYY-MM-DD), sku, category, quantity</p>
          </div>
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <h3 className="text-[10px] font-black uppercase text-emerald-400 mb-2">Attributes (attr.csv)</h3>
            <p className="text-[11px] mb-2 font-mono text-slate-500">sku, category, leadTimeDays, unitCost, sellingPrice, serviceLevel</p>
          </div>
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <h3 className="text-[10px] font-black uppercase text-orange-400 mb-2">Inventory (inv.csv)</h3>
            <p className="text-[11px] mb-2 font-mono text-slate-500">sku, onHand</p>
          </div>
        </div>
        <button onClick={onClose} className="w-full mt-8 py-4 bg-indigo-600 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white shadow-lg">Acknowledged</button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [data, setData] = useState<DataPoint[]>(SAMPLE_DATA);
  const [inventory, setInventory] = useState<InventoryLevel[]>(SAMPLE_INVENTORY);
  const [attributes, setAttributes] = useState<ProductAttribute[]>(SAMPLE_ATTRIBUTES);
  const [hasUserUploadedData, setHasUserUploadedData] = useState({ hist: false, inv: false, attr: false, prod: false });
  const [uploadError, setUploadError] = useState<{ type: string; message: string } | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [draftShockMonth, setDraftShockMonth] = useState<string>('');
  const [draftShockDescription, setDraftShockDescription] = useState<string>('');
  const [draftShockPercentage, setDraftShockPercentage] = useState<number>(0);
  const [draftIndustryPrompt, setDraftIndustryPrompt] = useState('Global manufacturer of industrial sensors');
  const [draftHorizon, setDraftHorizon] = useState(DEFAULT_HORIZON);
  const [draftAudience, setDraftAudience] = useState<AudienceType>(AudienceType.EXECUTIVE);
  const [hwMethod, setHwMethod] = useState<'additive' | 'multiplicative'>('multiplicative');
  const [autoDetectHW, setAutoDetectHW] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    startDate: '2021-01-01', endDate: '2024-05-01', skus: SKUS, category: 'All',
    confidenceLevel: 95, methodology: ForecastMethodology.HOLT_WINTERS,
    includeExternalTrends: false, globalLeadTime: 30, globalServiceLevel: 0.95,
    applyAnomalyCleaning: false, showLeadTimeOffset: false, aiProvider: AiProvider.GEMINI,
    supplierVolatility: 0, shocks: [], stickyNotes: [], productionPlans: []
  });
  
  const [committedSettings, setCommittedSettings] = useState({ filters: { ...filters }, horizon: draftHorizon, industryPrompt: draftIndustryPrompt, audience: draftAudience, triggerToken: 0 });
  const [forecastStartMonth, setForecastStartMonth] = useState('2025-08');
  const [activeTab, setActiveTab] = useState<'future' | 'quality' | 'inventory' | 'financials' | 'pareto' | 'volatility'>('future');
  
  const [aiInsight, setAiInsight] = useState('Analyze context to generate insights...');
  const [narrativeText, setNarrativeText] = useState('Business narrative pending analysis...');
  const [anomalyRca, setAnomalyRca] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRcaLoading, setIsRcaLoading] = useState(false);
  const [marketAdj, setMarketAdj] = useState<MarketAdjustment | null>(null);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState<OnePagerData | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [chartZoom, setChartZoom] = useState({ startIndex: 0, endIndex: 0 });
  const [historicalDataEndDate, setHistoricalDataEndDate] = useState('2024-05-01'); // End date for historical data filtering (matches SAMPLE_DATA end date)
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Sticky Notes state
  const [draftNoteDate, setDraftNoteDate] = useState('');
  const [draftNoteContent, setDraftNoteContent] = useState('');

  const histUploadRef = useRef<HTMLInputElement>(null);
  const attrUploadRef = useRef<HTMLInputElement>(null);
  const invUploadRef = useRef<HTMLInputElement>(null);
  const prodUploadRef = useRef<HTMLInputElement>(null);

  const handleRunAnalysis = () => setCommittedSettings({ filters: { ...filters }, horizon: draftHorizon, industryPrompt: draftIndustryPrompt, audience: draftAudience, triggerToken: !committedSettings.triggerToken });

  const handleAddShock = () => {
    if (!draftShockMonth || !draftShockDescription || draftShockPercentage === 0) return;
    if (draftShockPercentage < -75 || draftShockPercentage > 100) return;
    const newShock: MarketShock = {
      id: Date.now().toString(),
      month: draftShockMonth,
      description: draftShockDescription,
      percentageChange: draftShockPercentage
    };
    setFilters({ ...filters, shocks: [...filters.shocks, newShock] });
    setDraftShockMonth('');
    setDraftShockDescription('');
    setDraftShockPercentage(0);
  };

  const handleDeleteShock = (id: string) => {
    setFilters({ ...filters, shocks: filters.shocks.filter(s => s.id !== id) });
  };

  const handleAddNote = () => {
    if (!draftNoteDate || !draftNoteContent.trim()) return;
    const newNote = { id: Date.now().toString(), date: draftNoteDate, content: draftNoteContent.trim() };
    setFilters({ ...filters, stickyNotes: [...filters.stickyNotes, newNote] });
    setDraftNoteDate('');
    setDraftNoteContent('');
  };

  const handleDeleteNote = (id: string) => {
    setFilters({ ...filters, stickyNotes: filters.stickyNotes.filter(n => n.id !== id) });
  };

  const handleFileUpload = (type: 'hist' | 'inv' | 'attr' | 'prod', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    
    // Clear any previous errors
    setUploadError(null);
    const reader = new FileReader();
    
    console.log(`📤 Starting upload: ${type} file (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim().length > 0); // Filter empty lines
      
      console.log(`📋 Total lines: ${lines.length} (including header)`);
      
      // Process data in chunks to avoid UI blocking
      const processChunk = (startIdx: number) => {
        const chunkSize = 5000;
        const endIdx = Math.min(startIdx + chunkSize, lines.length);
        const chunk = lines.slice(startIdx, endIdx);
        
        try {
          if (type === 'hist') {
            const newData = chunk
              .filter(l => l.trim().length > 0 && l.includes(','))
              .map((line, idx) => {
                const p = line.split(',').map(s => s.trim()); 
                if (idx < 2) console.log(`  📝 Row ${idx}: ${p.join(' | ')}`); // Log first 2 data rows
                return { 
                  date: normalizeDateFormat(p[2]),  // Normalize date to YYYY-MM-01 format
                  sku: p[1],   // Column 1 is the SKU
                  category: p[0],  // Column 0 is the category
                  quantity: parseInt(p[3]) || 0,  // Column 3 is the quantity
                  type: 'hist' as const
                };
              })
              .filter(d => d.sku && d.date && d.quantity > 0);
            if (newData.length > 0) {
              setData(prev => [...prev, ...newData]);
              setHasUserUploadedData(prev => ({ ...prev, hist: true }));
              console.log(`✅ Processed ${newData.length} hist records (chunk ${startIdx}-${endIdx}):`, newData.slice(0, 2)); // Log first 2 records
            } else if (startIdx === 1) {
              // Show error only on first chunk if no valid data found
              setUploadError({ type: 'hist', message: 'Sales CSV format error. Expected: category, sku, date (YYYY-MM-DD), quantity' });
              console.warn(`⚠️ No valid hist records found. Check format: category, sku, date, quantity`);
            }
          } else if (type === 'inv') {
            const newInv = chunk
              .filter(l => l.trim().length > 0 && l.includes(','))
              .map(line => {
                const p = line.split(',').map(s => s.trim()); 
                return { 
                  sku: p[0], 
                  onHand: parseInt(p[1]) || 0, 
                  lastUpdated: new Date().toISOString(),
                  type: 'inv' as const
                } as InventoryLevel;
              })
              .filter(d => d.sku);
            if (newInv.length > 0) {
              setInventory(prev => [...prev, ...newInv]);
              setHasUserUploadedData(prev => ({ ...prev, inv: true }));
              console.log(`✅ Processed ${newInv.length} inventory records (chunk ${startIdx}-${endIdx})`);
            } else if (startIdx === 1) {
              setUploadError({ type: 'inv', message: 'Inventory CSV format error. Expected: sku, onHand' });
              console.warn(`⚠️ No valid inventory records found. Check format: sku, onHand`);
            }
          } else if (type === 'attr') {
            const newAttr = chunk
              .filter(l => l.trim().length > 0 && l.includes(','))
              .map(line => {
                const p = line.split(',').map(s => s.trim()); 
                return { 
                  sku: p[0], 
                  category: p[1], 
                  leadTimeDays: parseInt(p[2]) || 30, 
                  unitCost: parseFloat(p[3]) || 10, 
                  sellingPrice: parseFloat(p[4]) || 15, 
                  serviceLevel: parseFloat(p[5]) || 0.95,
                  type: 'attr' as const
                } as ProductAttribute;
              })
              .filter(d => d.sku);
            if (newAttr.length > 0) {
              setAttributes(prev => [...prev, ...newAttr]);
              setHasUserUploadedData(prev => ({ ...prev, attr: true }));
              console.log(`✅ Processed ${newAttr.length} attribute records (chunk ${startIdx}-${endIdx})`);
            } else if (startIdx === 1) {
              setUploadError({ type: 'attr', message: 'Attributes CSV format error. Expected: sku, category, leadTimeDays, unitCost, sellingPrice, serviceLevel' });
              console.warn(`⚠️ No valid attribute records found. Check format.`);
            }
          } else if (type === 'prod') {
            const newPlans = chunk
              .filter(l => l.trim().length > 0 && l.includes(','))
              .map(line => {
                const p = line.split(',').map(s => s.trim()); 
                const quantity = parseInt(p[2]) || 0;
                if (quantity <= 0) return null;
                return { 
                  id: `${Date.now()}-${Math.random()}`, 
                  sku: p[0], 
                  date: p[1], 
                  quantity, 
                  type: (p[3] || 'production') as 'production' | 'po'
                } as ProductionPlan;
              })
              .filter((p): p is ProductionPlan => p !== null);
            if (newPlans.length > 0) {
              setFilters(f => ({ ...f, productionPlans: [...f.productionPlans, ...newPlans] }));
              setHasUserUploadedData(prev => ({ ...prev, prod: true }));
              console.log(`✅ Processed ${newPlans.length} production plan records (chunk ${startIdx}-${endIdx})`);
            } else if (startIdx === 1) {
              setUploadError({ type: 'prod', message: 'Production CSV format error. Expected: sku, date, quantity, type (production|po)' });
              console.warn(`⚠️ No valid production records found. Check format.`);
            }
          }
        } catch (err) {
          console.error(`❌ Error processing ${type} chunk:`, err);
        }
        
        // Schedule next chunk if there are more lines
        if (endIdx < lines.length) {
          requestAnimationFrame(() => processChunk(endIdx));
        } else {
          console.log(`🎉 Upload complete: ${type}`);
          if (type === 'hist') {
            console.log(`💡 Click "Run Analysis" to refresh forecasts with your new data`);
          }
        }
      };
      
      // Start chunked processing (skip header row at index 0)
      processChunk(1);
    };
    
    reader.onerror = () => {
      console.error(`❌ Error reading file: ${file.name}`);
    };
    
    reader.readAsText(file);
  };

  // Compute available SKUs from data
  const availableSKUs = useMemo(() => {
    const skus = Array.from(new Set(data.map(d => d.sku))).sort();
    console.log(`📊 Available SKUs from data: ${skus.join(', ')}`);
    return skus;
  }, [data]);

  // When real data is uploaded, suggest updating historicalDataEndDate to the latest real data date
  useEffect(() => {
    if (hasUserUploadedData.hist && data.length > 0) {
      // Find the latest date in the real data (excluding sample data)
      const sampleSkuSet = new Set(SKUS);
      const realDataPoints = data.filter(d => !sampleSkuSet.has(d.sku));
      
      if (realDataPoints.length > 0) {
        const latestRealDate = realDataPoints.reduce((max, d) => d.date > max ? d.date : max, realDataPoints[0].date);
        setHistoricalDataEndDate(latestRealDate);
        console.log(`📅 Updated historicalDataEndDate to latest real data date: ${latestRealDate}`);
      }
    }
  }, [hasUserUploadedData.hist]);

  // Compute available categories from data
  const availableCategories = useMemo(() => {
    const cats = Array.from(new Set(data.map(d => d.category).filter(c => c))).sort();
    console.log(`📂 Available categories from data: ${cats.join(', ')}`);
    return ['All', ...cats];
  }, [data]);

  // Update filter to include available SKUs and handle sample data exclusion
  useEffect(() => {
    if (availableSKUs.length > 0) {
      let skusToUse = availableSKUs;
      
      // If real data has been uploaded, exclude sample SKUs
      if (hasUserUploadedData.hist) {
        const sampleSkuSet = new Set(SKUS);
        const realSkus = availableSKUs.filter(sku => !sampleSkuSet.has(sku));
        if (realSkus.length > 0) {
          skusToUse = realSkus;
          console.log(`🔄 Real data detected: excluding ${sampleSkuSet.size} sample SKUs, using ${realSkus.length} real SKUs`);
        }
      } else {
        console.log(`🔄 Using all available SKUs: ${availableSKUs.join(', ')}`);
      }
      
      // Create fresh filter state with determined SKUs and reset category
      setFilters(f => ({ 
        ...f, 
        skus: skusToUse,
        category: 'All'  // Reset category to All to avoid filtering out new data categories
      }));
      
      // Also update committed settings so chart immediately shows correct data
      setCommittedSettings(cs => ({ 
        ...cs, 
        filters: { 
          ...cs.filters, 
          skus: skusToUse,
          category: 'All'  // Reset category in committed settings too
        }
      }));
    }
  }, [availableSKUs, hasUserUploadedData.hist]);

  // Note: Auto-trigger removed - user should click 'Run Analysis' button after uploading data
  // This ensures the new SKUs and categories are properly selected first

  const processedData = useMemo(() => {
    let d = committedSettings.filters.applyAnomalyCleaning ? cleanAnomalies(data) : data;
    const filtered = d.filter(item => {
      const itemDate = new Date(item.date).getTime();
      const start = new Date(committedSettings.filters.startDate).getTime();
      const end = new Date(historicalDataEndDate).getTime();
      const matchesDate = itemDate >= start && itemDate <= end;
      const matchesSku = committedSettings.filters.skus.length === 0 || committedSettings.filters.skus.includes(item.sku);
      const matchesCategory = committedSettings.filters.category === 'All' || item.category === committedSettings.filters.category;
      return matchesDate && matchesSku && matchesCategory;
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    // Log which SKUs are actually in processedData
    const skusInProcessed = Array.from(new Set(filtered.map(d => d.sku))).sort();
    console.log(`📋 processedData: ${filtered.length} points, SKUs in data: [${skusInProcessed.join(', ')}], filter SKUs: [${committedSettings.filters.skus.join(', ')}]`);
    return filtered;
  }, [data, committedSettings, historicalDataEndDate]);

  const aggregatedData = useMemo(() => {
    const map = new Map<string, number>();
    processedData.forEach(d => map.set(d.date, (map.get(d.date) || 0) + d.quantity));
    const result = Array.from(map.entries()).map(([date, quantity]) => ({ date, quantity, sku: 'ALL', category: 'ALL' } as DataPoint)).sort((a, b) => a.date.localeCompare(b.date));
    
    // Log actual quantity values
    const avgQty = result.length > 0 ? Math.round(result.reduce((s, r) => s + r.quantity, 0) / result.length) : 0;
    const minQty = result.length > 0 ? Math.min(...result.map(r => r.quantity)) : 0;
    const maxQty = result.length > 0 ? Math.max(...result.map(r => r.quantity)) : 0;
    const sampleValues = result.slice(0, 3).map(r => `${r.date}:${r.quantity}`).join(', ');
    
    console.log(`📊 aggregatedData: ${result.length} points, avg: ${avgQty}, min: ${minQty}, max: ${maxQty}, sample: [${sampleValues}]`);
    return result;
  }, [processedData]);

  const stats = useMemo(() => {
    const values = aggregatedData.map(d => d.quantity);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const std = values.length > 0 ? Math.sqrt(values.reduce((sq, x) => sq + Math.pow(x - avg, 2), 0) / values.length) : 0;
    return { avg, std };
  }, [aggregatedData]);

  const futureForecast = useMemo(() => {
    if (processedData.length === 0) return [];
    
    // Get unique SKUs from filtered data
    const uniqueSkus = Array.from(new Set(processedData.map(d => d.sku))).sort();
    console.log(`🎯 Per-SKU forecasting for: [${uniqueSkus.join(', ')}], total processedData points: ${processedData.length}`);
    
    // Parse user-specified forecast start month
    const [year, month] = forecastStartMonth.split('-').map(Number);
    const forecastStartDate = new Date(year, month - 1, 1);
    
    // Calculate forecast for each SKU separately, then aggregate
    const allSkuForecasts: Map<string, Map<string, ForecastPoint>> = new Map();
    
    uniqueSkus.forEach(sku => {
      // Filter data to just this SKU
      const skuData = processedData.filter(d => d.sku === sku);
      if (skuData.length === 0) {
        console.log(`⚠️ SKU ${sku}: No data found in processedData`);
        return;
      }
      
      // Sort by date
      skuData.sort((a, b) => a.date.localeCompare(b.date));
      
      console.log(`📊 SKU ${sku}: ${skuData.length} historical points, date range: ${skuData[0].date} to ${skuData[skuData.length-1].date}, historicalDataEndDate: ${historicalDataEndDate}`);
      
      // Calculate forecast for this SKU
      const skuForecast = calculateForecast(
        skuData, 
        committedSettings.horizon, 
        historicalDataEndDate,
        'monthly', 
        committedSettings.filters.confidenceLevel, 
        committedSettings.filters.methodology, 
        hwMethod, 
        autoDetectHW
      );
      
      console.log(`📈 SKU ${sku}: calculateForecast returned ${skuForecast.length} points (${skuForecast.filter(p => !p.isForecast).length} hist, ${skuForecast.filter(p => p.isForecast).length} forecast)`);
      
      // Store forecast points - dates are already normalized from calculateForecast
      const dateMap = new Map<string, ForecastPoint>();
      skuForecast.forEach(p => {
        dateMap.set(p.date, p);
      });
      
      console.log(`🗓️ SKU ${sku}: dateMap has ${dateMap.size} unique dates`);
      if (uniqueSkus.length === 1) {
        // Extra logging if only one SKU for debugging
        const forecastDates = Array.from(dateMap.keys()).filter(d => dateMap.get(d)?.isForecast).slice(0, 5);
        console.log(`   Sample forecast dates: [${forecastDates.join(', ')}]`);
      }
      
      allSkuForecasts.set(sku, dateMap);
    });
    
    // Debug: Show boundary between historical and forecast for each SKU before aggregation
    if (uniqueSkus.length <= 5) {
      allSkuForecasts.forEach((dateMap, sku) => {
        const sortedDates = Array.from(dateMap.keys()).sort();
        const histPoints = Array.from(dateMap.values()).filter(p => !p.isForecast);
        const forecastPoints = Array.from(dateMap.values()).filter(p => p.isForecast);
        if (histPoints.length > 0 || forecastPoints.length > 0) {
          const lastHist = histPoints[histPoints.length-1];
          const firstForecast = forecastPoints[0];
          console.log(`  SKU ${sku}: hist ends at ${lastHist?.date || 'N/A'}, forecast starts at ${firstForecast?.date || 'N/A'}`);
        }
      });
    }

    // Aggregate all SKU forecasts by date
    const aggregatedMap = new Map<string, ForecastPoint>();
    let totalDatesFromAllSkus = 0;
    
    allSkuForecasts.forEach((dateMap, sku) => {
      totalDatesFromAllSkus += dateMap.size;
      dateMap.forEach((point, date) => {
        if (!aggregatedMap.has(date)) {
          aggregatedMap.set(date, {
            date,
            historical: 0,
            forecast: 0,
            lowerBound: 0,
            upperBound: 0,
            isForecast: point.isForecast,
            actualQuantity: 0,
            projectedInventory: 0,
            reorderPoint: 0,
            safetyStock: 0,
            projectedRevenue: 0,
            projectedMargin: 0,
            inventoryValue: 0
          });
        }
        
        const agg = aggregatedMap.get(date)!;
        agg.forecast = (agg.forecast || 0) + (point.forecast || 0);
        agg.historical = (agg.historical || 0) + (point.historical || 0);
        agg.lowerBound = (agg.lowerBound || 0) + (point.lowerBound || 0);
        agg.upperBound = (agg.upperBound || 0) + (point.upperBound || 0);
      });
    });
    
    let result = Array.from(aggregatedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`📈 Aggregated ${uniqueSkus.length} SKU forecasts: ${result.length} total unique dates (combined from ${totalDatesFromAllSkus} SKU dates)`);
    console.log(`   Breakdown: ${result.filter(p => !p.isForecast).length} historical, ${result.filter(p => p.isForecast).length} forecast`);
    
    if (uniqueSkus.length === 1) {
      // For single SKU debugging, show all forecast dates
      const forecastPoints = result.filter(p => p.isForecast);
      const forecastDatesAndValues = forecastPoints.slice(0, 8).map(p => `${p.date}:${p.forecast}`).join(', ');
      console.log(`   Sample forecast values: [${forecastDatesAndValues}]`);
    }
    
    // Apply market adjustments and shocks
    if (committedSettings.filters.includeExternalTrends && marketAdj) {
      result = result.map(p => p.isForecast ? { ...p, forecast: Math.round(p.forecast * marketAdj.multiplier) } : p);
    }
    result = applyMarketShocks(result, committedSettings.filters.shocks);
    
    // Calculate supply chain metrics
    const currentInv = inventory.filter(i => committedSettings.filters.skus.includes(i.sku)).reduce((s, i) => s + i.onHand, 0);
    const metricsResult = calculateSupplyChainMetrics(
      result, 
      stats.std, 
      committedSettings.filters.globalLeadTime, 
      committedSettings.filters.globalServiceLevel, 
      currentInv, 
      scenarios, 
      committedSettings.filters.showLeadTimeOffset,
      committedSettings.filters.supplierVolatility,
      attributes,
      committedSettings.filters.productionPlans
    );
    
    // Log the forecast values
    const historicalVals = metricsResult.filter(p => !p.isForecast).slice(-3);
    const forecastVals = metricsResult.filter(p => p.isForecast).slice(0, 3);
    const historicalSample = historicalVals.map(p => `${p.date}:${p.historical || p.forecast}`).join(', ');
    const forecastSample = forecastVals.map(p => `${p.date}:${p.scenarioForecast || p.forecast}`).join(', ');
    console.log(`📈 Per-SKU Chart data - Historical (last 3): [${historicalSample}], Forecast (first 3): [${forecastSample}]`);
    
    return metricsResult;
  }, [processedData, committedSettings, marketAdj, stats.std, inventory, scenarios, attributes, forecastStartMonth]);

  const financialStats = useMemo(() => {
    const forecastOnly = futureForecast.filter(f => f.isForecast);
    const totalRevenue = Math.round(forecastOnly.reduce((s, f) => s + (f.projectedRevenue || 0), 0));
    const totalMargin = Math.round(forecastOnly.reduce((s, f) => s + (f.projectedMargin || 0), 0));
    const avgInventoryValue = Math.round(forecastOnly.reduce((s, f) => s + (f.inventoryValue || 0), 0) / (forecastOnly.length || 1));
    const valueAtRisk = Math.round(totalRevenue * (committedSettings.filters.supplierVolatility * 0.25));
    return { totalRevenue, totalMargin, avgInventoryValue, valueAtRisk };
  }, [futureForecast, committedSettings]);

  // Calculate worst SKUs from FULL unfiltered dataset (not affected by filters)
  const worstSkusGlobal = useMemo(() => {
    try {
      if (aggregatedData.length <= 8) return [];
      
      // Use ALL data (not filtered), only by date range
      const fullSkuDataMap = new Map<string, DataPoint[]>();
      data.forEach(d => {
        if (!fullSkuDataMap.has(d.sku)) {
          fullSkuDataMap.set(d.sku, []);
        }
        fullSkuDataMap.get(d.sku)!.push(d);
      });

      const skuMetrics: Array<{sku: string, mape: number, rmse: number, bias: number, accuracy: number, forecastCount: number}> = [];

      fullSkuDataMap.forEach((skuData, sku) => {
        if (skuData.length < 18) return; // Need min 18 months for 70/30 split
        
        const sorted = [...skuData].sort((a, b) => a.date.localeCompare(b.date));
        const splitIdx = Math.floor(sorted.length * 0.7);
        const train = sorted.slice(0, splitIdx);
        const test = sorted.slice(splitIdx);

        if (train.length < 12 || test.length === 0) return;

        try {
          const trainEndDate = train[train.length - 1].date;
          const forecast = calculateForecast(
            train,
            test.length,
            trainEndDate,
            'monthly',
            committedSettings.filters.confidenceLevel,
            committedSettings.filters.methodology,
            hwMethod,
            autoDetectHW
          );

          const forecastMap = new Map<string, number>();
          forecast.filter(f => f.isForecast).forEach(f => {
            forecastMap.set(f.date, f.forecast || 0);
          });

          const testActuals: number[] = [];
          const testForecasts: number[] = [];

          test.forEach(d => {
            const date = normalizeDateFormat(d.date);
            const forecastVal = forecastMap.get(date);
            if (forecastVal !== undefined) {
              testActuals.push(d.quantity);
              testForecasts.push(forecastVal);
            }
          });

          if (testActuals.length > 0) {
            const m = calculateMetrics(testActuals, testForecasts, 1, 1);
            if (m && typeof m.mape === 'number' && !isNaN(m.mape)) {
              skuMetrics.push({
                sku,
                mape: m.mape,
                rmse: m.rmse,
                bias: m.bias,
                accuracy: m.accuracy,
                forecastCount: testActuals.length
              });
            }
          }
        } catch (e) {
          // Skip this SKU if forecast calculation fails
        }
      });

      return skuMetrics.sort((a, b) => b.mape - a.mape).slice(0, 10);
    } catch (e) {
      console.warn('Error calculating global worst SKUs:', e);
      return [];
    }
  }, [data, committedSettings, hwMethod, autoDetectHW]);

  const backtestResults = useMemo(() => {
    try {
      if (aggregatedData.length <= 8 || processedData.length === 0) return { comparisonData: [], metrics: null, modelComparison: [], backtestForecast: [], worstSkus: worstSkusGlobal };
      
      // Split training/test at SKU level, not aggregated level
      const skuDataMap = new Map<string, DataPoint[]>();
      processedData.forEach(d => {
        if (!skuDataMap.has(d.sku)) {
          skuDataMap.set(d.sku, []);
        }
        skuDataMap.get(d.sku)!.push(d);
      });

    // For each SKU, do 6-month backtest
    const skuSplitForecasts = new Map<string, { train: DataPoint[]; test: DataPoint[]; forecast: ForecastPoint[] }>();
    skuDataMap.forEach((skuData, sku) => {
      if (skuData.length <= 8) return; // Skip if too few data points
      
      const splitIndex = skuData.length - 6;
      const trainData = skuData.slice(0, splitIndex);
      const testData = skuData.slice(splitIndex);
      const trainEndDate = trainData[trainData.length - 1].date;
      
      const forecast = calculateForecast(
        trainData, 
        6, 
        trainEndDate,
        'monthly', 
        committedSettings.filters.confidenceLevel, 
        committedSettings.filters.methodology,
        hwMethod,
        autoDetectHW
      );
      
      skuSplitForecasts.set(sku, { train: trainData, test: testData, forecast });
    });

    // If no SKUs passed backtest, return empty
    if (skuSplitForecasts.size === 0) {
      return { comparisonData: [], metrics: null, modelComparison: [], backtestForecast: [] };
    }
    const forecastByDate = new Map<string, number[]>();
    const actualByDate = new Map<string, number[]>();
    
    skuSplitForecasts.forEach(({ test, forecast }) => {
      const forecastMap = new Map<string, number>();
      forecast.filter(f => f.isForecast).forEach(f => {
        forecastMap.set(f.date, f.forecast || 0);
      });
      
      test.forEach(d => {
        const date = normalizeDateFormat(d.date);
        const forecastVal = forecastMap.get(date) || 0;
        
        if (!forecastByDate.has(date)) forecastByDate.set(date, []);
        if (!actualByDate.has(date)) actualByDate.set(date, []);
        
        forecastByDate.get(date)!.push(forecastVal);
        actualByDate.get(date)!.push(d.quantity);
      });
    });

    // Average forecasts and actuals by date
    const backtestOnly: any[] = [];
    const sortedDates = Array.from(forecastByDate.keys()).sort();
    
    sortedDates.forEach((date, i) => {
      const forecastVals = forecastByDate.get(date) || [];
      const actualVals = actualByDate.get(date) || [];
      
      const avgForecast = forecastVals.length > 0 ? Math.round(forecastVals.reduce((a, b) => a + b, 0) / forecastVals.length) : 0;
      const avgActual = actualVals.length > 0 ? Math.round(actualVals.reduce((a, b) => a + b, 0) / actualVals.length) : 0;
      
      backtestOnly.push({
        date,
        forecast: avgForecast,
        actual: avgActual,
        isForecast: true
      });
    });

    // Calculate metrics on aggregated actuals vs aggregated forecasts
    const allActuals = Array.from(actualByDate.values()).flatMap(arr => arr);
    const allForecasts = Array.from(forecastByDate.values()).flatMap(arr => arr);
    
    if (allActuals.length === 0 || allForecasts.length === 0) {
      return { comparisonData: backtestOnly, metrics: null, modelComparison: [], backtestForecast: [] };
    }
    
    const metrics = calculateMetrics(allActuals, allForecasts, 1, 1);
    
    // Model comparison (compare all methods on aggregated data from backtesting)
    const modelComparison = Object.values(ForecastMethodology).map(m => {
      const methodForecasts: number[] = [];
      
      skuSplitForecasts.forEach(({ train }) => {
        try {
          const trainEndDate = train[train.length - 1].date;
          const f = calculateForecast(train, 6, trainEndDate, 'monthly', committedSettings.filters.confidenceLevel, m, hwMethod, false)
            .filter(x => x.isForecast)
            .map(x => x.forecast || 0);
          methodForecasts.push(...f);
        } catch (e) {
          console.warn(`Error calculating forecast for method ${m}:`, e);
        }
      });
      
      if (methodForecasts.length === 0) {
        return { method: m, mape: null, accuracy: null, rmse: null, bias: null };
      }
      
      const mtr = calculateMetrics(allActuals, methodForecasts, 1, 1);
      return { method: m, mape: mtr.mape, accuracy: mtr.accuracy, rmse: mtr.rmse, bias: mtr.bias };
    });

    const currentMethodMetrics = modelComparison.find(m => m.method === committedSettings.filters.methodology);
    
    // Build aggregate forecast for display
    const aggregateForecast = backtestOnly.map(b => ({
      date: b.date,
      forecast: b.forecast,
      historical: b.actual,
      isForecast: true
    }));
    
    return { comparisonData: backtestOnly, metrics, modelComparison, backtestForecast: aggregateForecast, worstSkus: worstSkusGlobal };
    } catch (e) {
      console.error('Error in backtestResults:', e);
      return { comparisonData: [], metrics: null, modelComparison: [], backtestForecast: [], worstSkus: worstSkusGlobal };
    }
  }, [processedData, committedSettings, hwMethod, autoDetectHW, worstSkusGlobal]);

  const runRca = async () => {
    setIsRcaLoading(true);
    const outliers = aggregatedData.filter(d => Math.abs(d.quantity - stats.avg) > stats.std * 1.5);
    const analysis = await getAnomalyAnalysis(committedSettings.filters.aiProvider, committedSettings.industryPrompt, outliers.slice(-5));
    setAnomalyRca(analysis);
    setIsRcaLoading(false);
  };

  const handleExport = () => {
    // Calculate SKU-level forecast data using processed data (up to historicalDataEndDate)
    const skuDataMap = new Map<string, DataPoint[]>();
    processedData.forEach(d => {
      if (!skuDataMap.has(d.sku)) {
        skuDataMap.set(d.sku, []);
      }
      skuDataMap.get(d.sku)!.push(d);
    });

    // Calculate forecast for each SKU
    const skuForecasts = new Map<string, ForecastPoint[]>();
    const skuHWMethods = new Map<string, string>(); // Track which HW method was used for each SKU
    skuDataMap.forEach((skuData, sku) => {
      const forecast = calculateForecast(
        skuData, 
        committedSettings.horizon, 
        historicalDataEndDate,
        'monthly', 
        committedSettings.filters.confidenceLevel, 
        committedSettings.filters.methodology,
        hwMethod,
        autoDetectHW
      );
      skuForecasts.set(sku, forecast);
      
      // Track which HW method was actually used
      if (committedSettings.filters.methodology === ForecastMethodology.HOLT_WINTERS) {
        if (autoDetectHW) {
          const detectedMethod = detectHWMethod(skuData.map(d => d.quantity));
          skuHWMethods.set(sku, `Holt-Winters (${detectedMethod.charAt(0).toUpperCase() + detectedMethod.slice(1)})`);
        } else {
          skuHWMethods.set(sku, `Holt-Winters (${hwMethod.charAt(0).toUpperCase() + hwMethod.slice(1)})`);
        }
      } else {
        skuHWMethods.set(sku, committedSettings.filters.methodology);
      }
    });

    // Build a map of ALL historical sales data (including data beyond historicalDataEndDate for forecast attainment)
    const allHistoricalMap = new Map<string, Map<string, number>>(); // sku -> (date -> quantity)
    data.forEach(d => {
      if (!allHistoricalMap.has(d.sku)) {
        allHistoricalMap.set(d.sku, new Map());
      }
      const dateMap = allHistoricalMap.get(d.sku)!;
      dateMap.set(normalizeDateFormat(d.date), (dateMap.get(normalizeDateFormat(d.date)) || 0) + d.quantity);
    });

    // Build export rows: SKU | Date | Forecasted Quantity | Historic Sales Quantity | Forecast Methodology
    const exportRows: string[] = [];
    const csvHeaders = 'SKU,Date,Forecasted Quantity,Historic Sales Quantity,Forecast Methodology';
    exportRows.push(csvHeaders);

    // Collect all forecast dates
    const allForecastDates = new Set<string>();
    skuForecasts.forEach(forecast => {
      forecast.forEach(point => {
        if (point.isForecast) {
          allForecastDates.add(point.date);
        }
      });
    });

    const sortedDates = Array.from(allForecastDates).sort();
    
    // Get all SKUs - exclude sample SKUs if real data has been uploaded
    let allSkus = Array.from(skuForecasts.keys()).sort();
    if (hasUserUploadedData.hist) {
      // Only include SKUs from actual uploaded data, exclude sample SKUs
      const sampleSkuSet = new Set(SKUS);
      allSkus = allSkus.filter(sku => !sampleSkuSet.has(sku));
    }

    // Generate CSV rows
    allSkus.forEach(sku => {
      const skuForecastMap = new Map<string, number>();
      const skuForecast = skuForecasts.get(sku);
      if (skuForecast) {
        skuForecast.forEach(point => {
          if (point.isForecast) {
            skuForecastMap.set(point.date, point.forecast || 0);
          }
        });
      }

      const skuHistoricalMap = allHistoricalMap.get(sku) || new Map();
      const methodologyLabel = skuHWMethods.get(sku) || committedSettings.filters.methodology;

      sortedDates.forEach(date => {
        const forecastedQty = skuForecastMap.get(date) || '';
        const historicalQty = skuHistoricalMap.get(date) || '';
        const row = [sku, date, forecastedQty, historicalQty, methodologyLabel].join(',');
        exportRows.push(row);
      });
    });

    const csvContent = exportRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename: DateOfExport_ForecastMethodology.csv
    const now = new Date();
    const exportDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const methodology = committedSettings.filters.methodology.split(' (')[0].replace(/\s+/g, '_');
    const filename = `${exportDate}_${methodology}.csv`;
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`✅ Exported SKU-level forecast with attainment: ${filename} (${allSkus.length} SKUs)`);
  };

  const paretoResults = useMemo(() => {
    // Optimization: Only compute Pareto for selected SKUs + category filter
    const skuMap = new Map<string, number>();
    data.forEach(d => {
       const matchesCategory = committedSettings.filters.category === 'All' || d.category === committedSettings.filters.category;
       const matchesSku = committedSettings.filters.skus.length === 0 || committedSettings.filters.skus.includes(d.sku);
       if (matchesCategory && matchesSku) {
         skuMap.set(d.sku, (skuMap.get(d.sku) || 0) + d.quantity);
       }
    });
    return runParetoAnalysis(Array.from(skuMap.entries()).map(([sku, totalVolume]) => ({ sku, totalVolume })));
  }, [data, committedSettings.filters.category, committedSettings.filters.skus]);

  const volatilityResults = useMemo(() => {
    // Optimization: Only compute volatility for selected SKUs + category filter
    const skuVolatility = new Map<string, { sku: string; volatility: number; avgQuantity: number; stdDev: number }>();
    const skuDataMap = new Map<string, number[]>();
    
    data.forEach(d => {
      const matchesCategory = committedSettings.filters.category === 'All' || d.category === committedSettings.filters.category;
      const matchesSku = committedSettings.filters.skus.length === 0 || committedSettings.filters.skus.includes(d.sku);
      if (matchesCategory && matchesSku) {
        if (!skuDataMap.has(d.sku)) skuDataMap.set(d.sku, []);
        skuDataMap.get(d.sku)!.push(d.quantity);
      }
    });

    skuDataMap.forEach((quantities, sku) => {
      const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length;
      const variance = quantities.reduce((sum, q) => sum + Math.pow(q - avg, 2), 0) / quantities.length;
      const stdDev = Math.sqrt(variance);
      const cv = avg > 0 ? (stdDev / avg) * 100 : 0; // Coefficient of Variation
      skuVolatility.set(sku, { sku, volatility: cv, avgQuantity: avg, stdDev });
    });

    return Array.from(skuVolatility.values()).sort((a, b) => b.volatility - a.volatility);
  }, [data, committedSettings.filters.category, committedSettings.filters.skus]);

  const inventoryAlerts = useMemo(() => {
    return futureForecast.filter(p => 
      p.isForecast && 
      p.projectedInventory !== undefined && 
      p.safetyStock !== undefined && 
      (p.projectedInventory < 0 || p.projectedInventory < p.safetyStock)
    ).map(point => ({
      date: point.date,
      projectedInventory: point.projectedInventory!,
      safetyStock: point.safetyStock!,
      isCritical: point.projectedInventory! < 0,
      totalProduction: futureForecast.filter(f => f.isForecast && f.date <= point.date).reduce((sum, f) => sum + (f.incomingProduction || 0), 0),
      totalDemand: futureForecast.filter(f => f.isForecast && f.date <= point.date).reduce((sum, f) => sum + f.forecast, 0)
    }));
  }, [futureForecast]);

  const dashboardContext = useMemo(() => {
    const financials = `Revenue: $${formatNumber(financialStats.totalRevenue)}. Risk: $${formatNumber(financialStats.valueAtRisk)}.`;
    return `Dashboard state: Business "${committedSettings.industryPrompt}". Accuracy: ${backtestResults.metrics?.accuracy.toFixed(1)}%. ${financials}`;
  }, [committedSettings, backtestResults, financialStats]);

  const handleGenerateReport = async () => { 
    setIsReportOpen(true); 
    setIsReportLoading(true); 
    try { 
      const data = await getOnePagerReport(committedSettings.filters.aiProvider, dashboardContext, committedSettings.audience); 
      setReportData(data); 
    } catch (e) { console.error(e); } 
    finally { setIsReportLoading(false); } 
  };

  // Initialize chart zoom range when forecast data changes
  useEffect(() => {
    if (futureForecast.length > 0) {
      setChartZoom({ startIndex: 0, endIndex: Math.max(40, futureForecast.length - 1) });
    }
  }, [futureForecast]);

  // Handle scroll wheel zoom on chart
  // Initialize chart zoom on futureForecast change
  useEffect(() => {
    if (futureForecast.length > 0) {
      setChartZoom({ startIndex: 0, endIndex: Math.max(40, futureForecast.length - 1) });
    }
  }, [futureForecast.length]);

  useEffect(() => {
    if (!committedSettings.triggerToken) return;
    const runAI = async () => {
      setIsLoading(true);
      const [insights, narrative] = await Promise.all([
        getIndustryInsights(committedSettings.filters.aiProvider, committedSettings.industryPrompt, `Avg: ${Math.round(stats.avg)}. Accuracy: ${backtestResults.metrics?.accuracy.toFixed(1)}%`),
        getNarrativeSummary(committedSettings.filters.aiProvider, committedSettings.industryPrompt, stats.avg, stats.avg, committedSettings.horizon, committedSettings.audience, committedSettings.filters.skus)
      ]);
      setAiInsight(insights);
      setNarrativeText(narrative);
      if (committedSettings.filters.includeExternalTrends) {
        const adj = await getMarketTrendAdjustment(committedSettings.filters.aiProvider, committedSettings.industryPrompt);
        setMarketAdj(adj);
      } else {
        setMarketAdj(null);
      }
      setIsLoading(false);
    };
    runAI();
  }, [committedSettings.triggerToken]);

  const handleApplyFilters = () => {
    setCommittedSettings(cs => ({
      ...cs,
      filters: filters
    }));
  };

  const filtersHaveChanged = JSON.stringify(filters) !== JSON.stringify(committedSettings.filters);

  const toggleSku = (sku: string) => {
    setFilters(f => {
      const isSelected = f.skus.includes(sku);
      if (isSelected) {
        return { ...f, skus: f.skus.filter(s => s !== sku) };
      } else {
        return { ...f, skus: [...f.skus, sku] };
      }
    });
  };

  const selectAllSkus = () => setFilters(f => ({ ...f, skus: availableSKUs }));
  const clearSkus = () => setFilters(f => ({ ...f, skus: [] }));

  return (
    <div className="h-screen flex flex-col lg:flex-row items-stretch bg-slate-950 font-sans text-slate-100 overflow-hidden">
      <aside className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-5 flex flex-col gap-4 overflow-y-auto z-30 shadow-2xl shrink-0">
        <div className="mb-2">
          {/* Refined SSA & Company Brand Logo with Serif Font */}
          <svg viewBox="0 0 350 50" className="w-full h-auto text-white" xmlns="http://www.w3.org/2000/svg">
            <g stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="square">
              {/* The Bracket [ */}
              <path d="M12 10 H4 V40 H12" /> 
              {/* The Up-Pointing Arrow ↗ */}
              <path d="M8 35 L32 11" /> 
              <path d="M20 11 H32 V23" /> 
            </g>
            <text x="48" y="36" fontFamily="'Times New Roman', Times, serif" fontWeight="600" fontSize="26" fill="currentColor" letterSpacing="0.02em">SSA & COMPANY</text>
          </svg>
          <div className="flex items-center gap-2 mt-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
            <Zap size={10} className="text-indigo-400" /> Advanced Forecasting Engine
          </div>
        </div>

        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Database size={10}/> Data Console</h3>
            <button onClick={() => setIsSchemaModalOpen(true)} className="text-[8px] font-black uppercase text-indigo-400 hover:underline">Schema Guide</button>
          </div>
          {uploadError && (
            <div className="p-3 bg-red-950 border border-red-700 rounded-lg text-[8px] text-red-200 flex items-start gap-2">
              <X size={12} className="mt-0.5 flex-shrink-0"/>
              <div className="flex-1">
                <div className="font-bold">{uploadError.type.toUpperCase()} Format Error</div>
                <div>{uploadError.message}</div>
              </div>
              <button onClick={() => setUploadError(null)} className="text-red-300 hover:text-red-100">
                <X size={10}/>
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => histUploadRef.current?.click()} disabled={data.some(d => d.type === 'hist')} className={`p-2 rounded-lg flex flex-col items-center gap-1 group transition-all ${
              data.some(d => d.type === 'hist') 
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-indigo-500'
            }`}>
              {data.some(d => d.type === 'hist') ? (
                <Check size={12} className="text-indigo-400"/>
              ) : (
                <FileText size={12} className="text-indigo-400 group-hover:scale-110 transition-transform"/>
              )}
              <span className="text-[7px] font-black uppercase">Sales</span>
            </button>
            <button onClick={() => attrUploadRef.current?.click()} disabled={hasUserUploadedData.attr} className={`p-2 rounded-lg flex flex-col items-center gap-1 group transition-all ${
              hasUserUploadedData.attr
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-emerald-500'
            }`}>
              {hasUserUploadedData.attr ? (
                <Check size={12} className="text-emerald-400"/>
              ) : (
                <Truck size={12} className="text-emerald-400 group-hover:scale-110 transition-transform"/>
              )}
              <span className="text-[7px] font-black uppercase">Parts</span>
            </button>
            <button onClick={() => invUploadRef.current?.click()} disabled={hasUserUploadedData.inv} className={`p-2 rounded-lg flex flex-col items-center gap-1 group transition-all ${
              hasUserUploadedData.inv
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-orange-500'
            }`}>
              {hasUserUploadedData.inv ? (
                <Check size={12} className="text-orange-400"/>
              ) : (
                <Package size={12} className="text-orange-400 group-hover:scale-110 transition-transform"/>
              )}
              <span className="text-[7px] font-black uppercase">Stock</span>
            </button>
            <button onClick={() => prodUploadRef.current?.click()} disabled={committedSettings.filters.productionPlans.length > 0} className={`p-2 rounded-lg flex flex-col items-center gap-1 group transition-all ${
              committedSettings.filters.productionPlans.length > 0 
                ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-cyan-500'
            }`}>
              {committedSettings.filters.productionPlans.length > 0 ? (
                <Check size={12} className="text-cyan-400"/>
              ) : (
                <Zap size={12} className="text-cyan-400 group-hover:scale-110 transition-transform"/>
              )}
              <span className="text-[7px] font-black uppercase">Prod/PO</span>
            </button>
          </div>
          <p className="text-[7px] text-slate-600 font-medium italic px-1">Upload finished goods production plans or open purchase orders</p>
          <input type="file" ref={histUploadRef} className="hidden" onChange={e => handleFileUpload('hist', e)} />
          <input type="file" ref={attrUploadRef} className="hidden" onChange={e => handleFileUpload('attr', e)} />
          <input type="file" ref={invUploadRef} className="hidden" onChange={e => handleFileUpload('inv', e)} />
          <input type="file" ref={prodUploadRef} className="hidden" onChange={e => handleFileUpload('prod', e)} />
        </section>

        <section className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Cpu size={10}/> AI Orchestrator</h3>
          <div className="space-y-2">
            <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-200 outline-none hover:border-indigo-500 transition-all" value={filters.aiProvider} onChange={e => setFilters(f => ({...f, aiProvider: e.target.value as AiProvider}))}>
              {Object.entries(AiProvider)
                .filter(([key]) => key !== 'GEMINI')
                .map(([key, value]) => (
                  <option key={key} value={value}>{value}</option>
                ))}
            </select>
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Audience Profile</label>
              <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-200 outline-none hover:border-emerald-500 transition-all" value={draftAudience} onChange={e => setDraftAudience(e.target.value as AudienceType)}>
                {Object.entries(AudienceType).map(([key, value]) => (
                  <option key={key} value={value}>{value}</option>
                ))}
              </select>
              <p className="text-[7px] text-slate-600 font-medium italic">Insights tailored to your role</p>
            </div>
            <textarea className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-400 font-medium outline-none resize-none h-16 focus:border-indigo-500" placeholder="Industry context..." value={draftIndustryPrompt} onChange={e => setDraftIndustryPrompt(e.target.value)} />
            <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex flex-col"><span className="text-[8px] font-black text-slate-500 uppercase">Market Search</span><span className="text-[7px] text-slate-600 font-bold uppercase tracking-tighter">Live Web Grounding</span></div>
              <button onClick={() => setFilters(f => ({...f, includeExternalTrends: !f.includeExternalTrends}))} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${filters.includeExternalTrends ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <span className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-white transition-transform ${filters.includeExternalTrends ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Calendar size={10}/> Forecast Scope</h3>
          <div className="space-y-2.5 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest"><span>Horizon</span><span className="text-indigo-400">{draftHorizon}M</span></div>
            <input type="range" min="1" max="24" className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" value={draftHorizon} onChange={e => setDraftHorizon(Number(e.target.value))} />
            
            <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest"><span>Confidence</span><span className="text-emerald-400">{filters.confidenceLevel}%</span></div>
            <input type="range" min="80" max="99" step="5" className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" value={filters.confidenceLevel} onChange={e => setFilters(f => ({...f, confidenceLevel: Number(e.target.value)}))} />
            
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Primary Model</label>
                <InfoTooltip 
                  title="Model Library" 
                  content={
                    <div className="space-y-4">
                      {Object.entries(METHOD_DESCRIPTIONS).map(([k,v]) => (
                        <div key={k} className="p-2 rounded-xl bg-slate-950/50 border border-slate-800/50 hover:border-indigo-500/30 transition-all">
                          <p className="font-black text-indigo-400 uppercase text-[9px] mb-1">{k.split(' (')[0]}</p>
                          <p className="text-[9px] text-slate-400 leading-relaxed font-medium">{v}</p>
                        </div>
                      ))}
                    </div>
                  } 
                />
              </div>
              <select className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-bold text-slate-200 outline-none" value={filters.methodology} onChange={e => setFilters(f => ({...f, methodology: e.target.value as ForecastMethodology}))}>
                {Object.values(ForecastMethodology).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            {filters.methodology === ForecastMethodology.HOLT_WINTERS && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-300">Auto-Detect Variant</label>
                  <button
                    onClick={() => setAutoDetectHW(!autoDetectHW)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      autoDetectHW ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoDetectHW ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 italic">
                  {autoDetectHW
                    ? '✓ Automatically selects additive/multiplicative per SKU based on data'
                    : '○ Manual selection below'}
                </p>
                
                {!autoDetectHW && (
                  <>
                    <label className="text-[10px] font-bold text-slate-300 block mt-2">Manual Override</label>
                    <select className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-bold text-slate-200 outline-none" value={hwMethod} onChange={e => setHwMethod(e.target.value as 'additive' | 'multiplicative')}>
                      <option value="multiplicative">Multiplicative (Steady-State Products)</option>
                      <option value="additive">Additive (Growth/Sparse Products)</option>
                    </select>
                    <p className="text-[9px] text-slate-500 italic">
                      {hwMethod === 'multiplicative' 
                        ? '✓ For products with consistent seasonality and stable patterns'
                        : '✓ For new products, growth ramp-ups, or sparse early demand'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={10}/> Resiliency Simulator</h3>
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
             <div className="flex justify-between items-center">
                <span className="text-[8px] font-black text-slate-500 uppercase">Supplier Volatility</span>
                <span className={`text-[10px] font-black ${filters.supplierVolatility > 0.5 ? 'text-orange-400' : 'text-indigo-400'}`}>+{(filters.supplierVolatility * 100).toFixed(0)}%</span>
             </div>
             <input type="range" min="0" max="1" step="0.05" className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" value={filters.supplierVolatility} onChange={e => setFilters(f => ({...f, supplierVolatility: Number(e.target.value)}))} />
          </div>
        </section>

        <section className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={10}/> Market Disruptions</h3>
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="space-y-2">
              <label className="text-[8px] font-black text-slate-500 uppercase block">Month</label>
              <input type="month" className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-200 outline-none" value={draftShockMonth} onChange={e => setDraftShockMonth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[8px] font-black text-slate-500 uppercase block">Description</label>
              <input type="text" placeholder="e.g., Holiday Promotion" className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-200 placeholder-slate-600 outline-none" value={draftShockDescription} onChange={e => setDraftShockDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[8px] font-black text-slate-500 uppercase block">% Change ({draftShockPercentage > 0 ? '+' : ''}{draftShockPercentage}%)</label>
              <input type="number" min="-75" max="100" className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-200 outline-none" value={draftShockPercentage} onChange={e => setDraftShockPercentage(Number(e.target.value))} />
              <span className="text-[8px] text-slate-500">Range: -75% to +100%</span>
            </div>
            <button onClick={handleAddShock} disabled={!draftShockMonth || !draftShockDescription || draftShockPercentage === 0 || draftShockPercentage < -75 || draftShockPercentage > 100} className="w-full py-2 px-3 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-indigo-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Plus size={12}/> Add Shock</button>
            
            {filters.shocks.length > 0 && (
              <div className="border-t border-slate-800 pt-3 space-y-2 max-h-32 overflow-y-auto">
                {filters.shocks.map(shock => (
                  <div key={shock.id} className="p-2 bg-slate-900 rounded border border-slate-700 flex justify-between items-center group hover:border-slate-600 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-slate-300 truncate">{shock.month} • {shock.description}</p>
                      <p className={`text-[8px] font-black ${shock.percentageChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{shock.percentageChange > 0 ? '+' : ''}{shock.percentageChange}%</p>
                    </div>
                    <button onClick={() => handleDeleteShock(shock.id)} className="ml-2 text-slate-500 hover:text-red-400 transition-all"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="mt-auto pt-3 border-t border-slate-800 space-y-3">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Historical Data End Date</label>
            <input 
              type="date" 
              value={historicalDataEndDate}
              onChange={(e) => {
                setHistoricalDataEndDate(e.target.value);
                // Auto-adjust forecast start month to be after this date
                const endDate = new Date(e.target.value);
                const nextMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);
                const forecastMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
                setForecastStartMonth(forecastMonth);
              }}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-100 outline-none focus:border-emerald-500 transition-all"
            />
            <p className="text-[7px] text-slate-600 font-medium italic">Last date to include in historical analysis</p>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Forecast Start Month</label>
            <input 
              type="month" 
              value={forecastStartMonth}
              onChange={(e) => setForecastStartMonth(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-100 outline-none focus:border-indigo-500 transition-all"
            />
          </div>
          <button onClick={handleRunAnalysis} disabled={isLoading} className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-all ${isLoading ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-indigo-600/10'}`}>
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />} {isLoading ? "Syncing..." : "Run Analysis"}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 bg-slate-950 relative">
        <section className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-6 rounded-[2.5rem] grid grid-cols-1 lg:grid-cols-2 gap-8 shadow-2xl animate-in fade-in duration-500 relative z-40">
          <div className="w-full">
            <MultiSearchableSelect 
              options={availableSKUs}
              selected={filters.skus}
              onToggle={toggleSku}
              onSelectAll={selectAllSkus}
              onClear={clearSkus}
              label="Entity Selector (SKU)"
              icon={<Filter size={12} className="text-indigo-400" />}
            />
          </div>

          <div className="w-full">
            <SearchableSelect 
              options={availableCategories}
              value={filters.category}
              onChange={(val) => setFilters(f => ({ ...f, category: val }))}
              placeholder="All Categories"
              label="Category Search"
              icon={<Search size={12} className="text-emerald-400" />}
            />
          </div>

          <div className="w-full flex flex-col gap-2">
            <button
              onClick={handleApplyFilters}
              disabled={!filtersHaveChanged}
              className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                filtersHaveChanged
                  ? 'bg-indigo-600 border border-indigo-500 text-white hover:bg-indigo-700 shadow-lg'
                  : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
              }`}
            >
              <Check size={14} /> Apply Filters
            </button>
            {filtersHaveChanged && (
              <p className="text-[8px] text-amber-400 font-bold text-center">Filters modified • Click to apply</p>
            )}
          </div>
        </section>

        <header className="bg-slate-900 p-4 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
            {['future', 'inventory', 'financials', 'quality', 'pareto', 'volatility'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} disabled={!committedSettings.triggerToken} className="px-5 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all disabled:opacity-50"><Download size={14}/> Export CSV</button>
            <button onClick={handleGenerateReport} disabled={!committedSettings.triggerToken} className="px-5 py-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600/20 transition-all disabled:opacity-50"><FileOutput size={14}/> Generate Brief</button>
          </div>
        </header>

        {!committedSettings.triggerToken ? (
          <div className="flex flex-col items-center justify-center py-32 bg-slate-900/50 border-2 border-slate-800 border-dashed rounded-[3rem]">
            <div className="p-5 bg-indigo-500/10 rounded-full mb-6 border border-indigo-500/20 animate-pulse"><Cpu className="text-indigo-400" size={40}/></div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Engine Inactive</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Select your entities and click <span className="text-indigo-400">'Run Analysis'</span> to calculate projections.</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            {activeTab === 'future' && (
              <div className="space-y-6">
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl min-h-[160px] flex flex-col relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 shrink-0"><div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><BrainCircuit size={18} className="text-indigo-400" /></div><h3 className="text-sm font-black text-white uppercase tracking-widest">Strategic Intelligence</h3></div>
                    <div className="text-slate-300 text-[11px] leading-relaxed font-medium overflow-y-auto pr-2 flex-1">{isLoading ? "Analyzing factors..." : aiInsight}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl min-h-[160px] flex flex-col">
                    <div className="flex items-center gap-3 mb-4 shrink-0"><div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><MessageSquare size={18} className="text-emerald-400" /></div><h3 className="text-sm font-black text-white uppercase tracking-widest">Operational Narrative</h3></div>
                    <div className="text-slate-300 text-[11px] leading-relaxed font-medium italic overflow-y-auto pr-2 flex-1">{isLoading ? "Writing outlook..." : narrativeText}</div>
                  </div>
                </section>

                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl relative">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h2 className="text-lg font-black text-white uppercase tracking-tighter">Consolidated Demand Trend</h2>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-3 px-4 py-1.5 bg-indigo-600/10 border border-indigo-500/20 rounded-full">
                        <Zap size={12} className="text-indigo-400" />
                        <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Model: {committedSettings.filters.methodology.split(' (')[0]}</span>
                      </div>
                      <button onClick={() => setChartZoom({ startIndex: 0, endIndex: Math.max(40, futureForecast.length - 1) })} className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-slate-300 transition-all">Reset Zoom</button>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-700/50">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Zoom Range</label>
                      <span className="text-[8px] text-slate-500">{chartZoom.startIndex} - {chartZoom.endIndex}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max={Math.max(0, futureForecast.length - 1)} value={chartZoom.startIndex} onChange={(e) => {
                        const newStart = parseInt(e.target.value);
                        setChartZoom(prev => ({ startIndex: newStart, endIndex: Math.max(newStart + 10, prev.endIndex) }));
                      }} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                      <input type="range" min="0" max={Math.max(0, futureForecast.length - 1)} value={chartZoom.endIndex} onChange={(e) => {
                        const newEnd = parseInt(e.target.value);
                        setChartZoom(prev => ({ startIndex: Math.min(newEnd - 10, prev.startIndex), endIndex: newEnd }));
                      }} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                    </div>
                  </div>
                  <div className="h-[400px] w-full" ref={chartContainerRef}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={[...downsampleData(futureForecast.slice(chartZoom.startIndex, chartZoom.endIndex + 1), 1000)].sort((a, b) => a.date.localeCompare(b.date))} margin={{ left: 10, right: 10, top: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}}
                          tickFormatter={formatDateForDisplay}
                        />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => formatNumber(val)} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} />
                        <Tooltip content={<CustomTrendTooltip />} />
                        <Area type="monotone" dataKey="historical" name="Historical Quantity" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" />
                        
                        {committedSettings.filters.confidenceLevel && (
                          <>
                            <Area type="monotone" dataKey="upperBound" name="Upper Bound Quantity" stroke="none" fill="#ef4444" fillOpacity={0.08} />
                            <Area type="monotone" dataKey="lowerBound" name="Lower Bound Quantity" stroke="none" fill="#ef4444" fillOpacity={0.08} />
                          </>
                        )}
                        <Line type="monotone" dataKey="scenarioForecast" name="Forecasted Quantity" stroke="#ef4444" strokeWidth={4} dot={{r: 4, fill: '#ef4444'}} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={16} className="text-amber-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Sticky Notes</h3>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-3">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Date</label>
                        <input type="date" className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-200 outline-none focus:border-amber-500 transition-all" value={draftNoteDate} onChange={e => setDraftNoteDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Note</label>
                        <textarea className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-200 placeholder-slate-600 outline-none resize-none h-20 focus:border-amber-500 transition-all" placeholder="Add your annotation..." value={draftNoteContent} onChange={e => setDraftNoteContent(e.target.value)} />
                      </div>
                      <button onClick={handleAddNote} disabled={!draftNoteDate || !draftNoteContent.trim()} className="w-full py-2 px-3 bg-amber-600/20 border border-amber-500/30 text-amber-400 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-amber-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Plus size={12}/> Add Note</button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {filters.stickyNotes.length === 0 ? (
                        <p className="text-[8px] text-slate-600 italic text-center py-4">No notes yet</p>
                      ) : (
                        filters.stickyNotes.map(note => (
                          <div key={note.id} className="p-3 bg-slate-950 rounded border border-slate-700 group hover:border-amber-500/30 transition-all">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <p className="text-[9px] font-bold text-amber-400">{note.date}</p>
                              <button onClick={() => handleDeleteNote(note.id)} className="text-slate-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                            </div>
                            <p className="text-[9px] text-slate-300 leading-relaxed">{note.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'financials' && (
              <div className="space-y-6">
                 <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricsCard label="Total Revenue" value={formatCurrency(financialStats.totalRevenue)} description="Projected sales value" />
                  <MetricsCard label="Gross Margin" value={formatCurrency(financialStats.totalMargin)} description="Contribution margin estimation" />
                  <MetricsCard label="Inventory Value" value={formatCurrency(financialStats.avgInventoryValue)} description="Working capital tied in stock" />
                  <MetricsCard label="Profit at Risk" value={formatCurrency(financialStats.valueAtRisk)} description="Estimated stockout liability" trend="down" />
                </section>
                <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Financial Growth Projection ($ Nearest Dollar)</h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={[...downsampleData(futureForecast.filter(f => f.isForecast), 1000)].sort((a, b) => a.date.localeCompare(b.date))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis 
                          dataKey="date" 
                          tick={{fontSize: 9}}
                          tickFormatter={formatDateForDisplay}
                        />
                        <YAxis tickFormatter={(val) => `$${formatNumber(val)}`} tick={{fontSize: 9}} />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px'}} 
                          formatter={(val: number) => [formatCurrency(val), 'Value']}
                        />
                        <Bar dataKey="projectedRevenue" name="Revenue" fill="#6366f1" radius={[6,6,0,0]} barSize={35} />
                        <Area type="monotone" dataKey="projectedMargin" name="Margin" fill="#10b981" stroke="#10b981" fillOpacity={0.2} strokeWidth={3} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'quality' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricsCard label="Accuracy (Backtest)" value={`${backtestResults.metrics?.accuracy.toFixed(1)}%`} description="Confidence against 6M holdout" />
                  <MetricsCard label="MAPE" value={`${backtestResults.metrics?.mape.toFixed(1)}%`} description="Mean Absolute Percentage Error" />
                  <MetricsCard label="RMSE" value={formatNumber(backtestResults.metrics?.rmse || 0)} description="Root Mean Square Error" />
                  <MetricsCard label="Bias Score" value={`${(backtestResults.metrics?.bias || 0).toFixed(1)}%`} description="Historical over/under skew" trend={backtestResults.metrics?.bias! > 0 ? "up" : "down"} />
                </section>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <section className="lg:col-span-8 bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Historical Model Backtesting (6M Split)</h3>
                    </div>
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={[...downsampleData(backtestResults.comparisonData || [], 500)].sort((a, b) => a.date.localeCompare(b.date))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis 
                            dataKey="date" 
                            tick={{fontSize: 9}}
                            tickFormatter={formatDateForDisplay}
                          />
                          <YAxis tickFormatter={(val) => formatNumber(val)} tick={{fontSize: 9}} />
                          <Tooltip 
                            contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px'}} 
                            formatter={(val: number) => [formatNumber(val), 'Volume']}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}} />
                          <Bar dataKey="actual" name="Historical Actuals" fill="#6366f1" radius={[4,4,0,0]} barSize={25} />
                          <Line type="monotone" dataKey="forecast" name="Simulated Past Forecast" stroke="#fb923c" strokeWidth={3} dot={{r: 4}} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                  
                  <section className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl flex-1">
                       <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Methodology Benchmark</h3>
                       <div className="space-y-3">
                         {backtestResults.modelComparison.sort((a,b)=>b.accuracy-a.accuracy).map(m => (
                           <div key={m.method} className={`p-3 rounded-xl border ${m.method === committedSettings.filters.methodology ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-slate-950 border-slate-800'}`}>
                             <div className="flex justify-between items-center mb-1">
                               <span className="text-[9px] font-black uppercase text-slate-300">{m.method.split(' (')[0]}</span>
                               <span className="text-[10px] font-black text-indigo-400">{m.accuracy.toFixed(1)}%</span>
                             </div>
                             <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                               <div className="bg-indigo-500 h-full" style={{width: `${m.accuracy}%`}} />
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                    <button onClick={runRca} disabled={isRcaLoading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/10 transition-all disabled:opacity-50">
                      {isRcaLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Run Anomaly RCA
                    </button>
                  </section>
                </div>
                
                {backtestResults.worstSkus && backtestResults.worstSkus.length > 0 && (
                  <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Highest Error SKUs (Bottom 10)</h3>
                      <span className="text-xs text-slate-400">Ranked by MAPE</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-3 px-4 font-black text-slate-300 uppercase tracking-widest">SKU</th>
                            <th className="text-right py-3 px-4 font-black text-slate-300 uppercase tracking-widest">MAPE</th>
                            <th className="text-right py-3 px-4 font-black text-slate-300 uppercase tracking-widest">Accuracy</th>
                            <th className="text-right py-3 px-4 font-black text-slate-300 uppercase tracking-widest">RMSE</th>
                            <th className="text-right py-3 px-4 font-black text-slate-300 uppercase tracking-widest">Bias %</th>
                            <th className="text-right py-3 px-4 font-black text-slate-300 uppercase tracking-widest">Forecasts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backtestResults.worstSkus.map((sku, idx) => (
                            <tr key={sku.sku} className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${idx < 3 ? 'bg-red-500/5' : ''}`}>
                              <td className="py-3 px-4 font-black text-indigo-400">{sku.sku}</td>
                              <td className="text-right py-3 px-4 font-bold text-red-400">{sku.mape.toFixed(1)}%</td>
                              <td className="text-right py-3 px-4 font-bold text-slate-300">{sku.accuracy.toFixed(1)}%</td>
                              <td className="text-right py-3 px-4 text-slate-400">{formatNumber(sku.rmse)}</td>
                              <td className="text-right py-3 px-4 text-slate-400">{sku.bias.toFixed(1)}%</td>
                              <td className="text-right py-3 px-4 text-slate-400">{sku.forecastCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
                
                {anomalyRca && (
                  <section className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-300">
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Sparkles size={14}/> Root Cause Analysis Results</h3>
                    <div className="text-slate-300 text-xs leading-relaxed font-medium">{anomalyRca}</div>
                  </section>
                )}
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <MetricsCard label="On-Hand" value={formatNumber(inventory.filter(i => committedSettings.filters.skus.includes(i.sku)).reduce((s, i) => s + i.onHand, 0))} description="Current stock aggregation" />
                   <MetricsCard label="Safety Stock" value={formatNumber(futureForecast[0]?.safetyStock || 0)} description="Standard deviation buffer" />
                   <MetricsCard label="Reorder Point" value={formatNumber(futureForecast[0]?.reorderPoint || 0)} description="Replenishment trigger" />
                </section>
                <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Inventory Depletion Simulator</h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={[...downsampleData(futureForecast.filter(f => f.isForecast), 1000)].sort((a, b) => a.date.localeCompare(b.date))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis 
                          dataKey="date" 
                          tick={{fontSize: 9}}
                          tickFormatter={formatDateForDisplay}
                        />
                        <YAxis tickFormatter={(val) => formatNumber(val)} tick={{fontSize: 9}} />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px'}} 
                          formatter={(val: number) => [formatNumber(val), 'Items']}
                        />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{fontSize: '10px', fontWeight: 900}} />
                        <Area type="monotone" dataKey="projectedInventory" name="Proj. Stock" fill="#6366f1" stroke="#6366f1" fillOpacity={0.1} strokeWidth={2} />
                        <Line type="stepAfter" dataKey="reorderPoint" name="ROP" stroke="#fb923c" strokeWidth={2} strokeDasharray="5 5" />
                        <Line type="stepAfter" dataKey="safetyStock" name="Safety Stock" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-400"/>
                      Inventory Alerts
                    </h3>
                    {inventoryAlerts.length > 0 && (
                      <button 
                        onClick={() => {
                          const currentOnHand = inventory.filter(i => committedSettings.filters.skus.includes(i.sku)).reduce((s, i) => s + i.onHand, 0);
                          exportAlerts(futureForecast, currentOnHand, `alerts_${committedSettings.industryPrompt.replace(/\s+/g, '_').toLowerCase()}`);
                        }}
                        className="px-3 py-1.5 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-red-600/30 transition-all"
                      >
                        📥 Export Alerts
                      </button>
                    )}
                  </div>
                  {inventoryAlerts.length === 0 ? (
                    <p className="text-[10px] text-emerald-400 italic">✓ All inventory levels healthy</p>
                  ) : (
                    <div className="space-y-2">
                      {inventoryAlerts.slice(0, 5).map((alert, i) => (
                        <div key={i} className={`p-3 rounded-lg border ${alert.isCritical ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                          <div className="flex items-start gap-2">
                            <div className={`text-lg font-black ${alert.isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                              {alert.isCritical ? '✕' : '⚠'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-bold text-slate-200">
                                {alert.isCritical ? 'STOCKOUT RISK' : 'SAFETY STOCK BREACH'}
                              </p>
                              <p className="text-[8px] text-slate-400 mt-0.5">
                                {alert.date}: {formatNumber(alert.projectedInventory)} units (min: {formatNumber(alert.safetyStock)})
                              </p>
                              <p className="text-[8px] text-slate-500 mt-1">
                                Production: {formatNumber(alert.totalProduction)} | Demand: {formatNumber(alert.totalDemand)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {inventoryAlerts.length > 5 && <p className="text-[8px] text-slate-500 italic text-center">+{inventoryAlerts.length - 5} more alerts</p>}
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'pareto' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">ABC Pareto Stratification</h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={downsampleData(paretoResults, 15)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="sku" angle={-45} textAnchor="end" tick={{fontSize: 8}} />
                        <YAxis tickFormatter={(val) => formatNumber(val)} tick={{fontSize: 9}} />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', color: '#ffffff'}} 
                          formatter={(val: number) => [formatNumber(val), 'Volume']}
                          labelStyle={{color: '#ffffff'}}
                        />
                        <Bar dataKey="totalVolume" name="Volume">
                          {paretoResults.map((entry, index) => <Cell key={index} fill={entry.grade === 'A' ? '#6366f1' : entry.grade === 'B' ? '#fb923c' : '#475569'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="lg:col-span-4 bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col gap-5">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Priority Logic</h3>
                  {['A', 'B', 'C'].map(grade => (
                    <div key={grade} className="p-5 bg-slate-950 border border-slate-800 rounded-[2.5rem] flex justify-between items-center group hover:border-indigo-500/50 transition-all">
                      <span className={`text-2xl font-black ${grade === 'A' ? 'text-indigo-400' : grade === 'B' ? 'text-orange-400' : 'text-slate-500'}`}>Class {grade}</span>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-slate-500 block">Count</span>
                        <span className="text-sm font-bold text-slate-200">{formatNumber(paretoResults.filter(p => p.grade === grade).length)} SKUs</span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-auto p-5 bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] flex gap-3">
                    <ShieldCheck size={20} className="text-indigo-400 shrink-0" />
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase">Replenishment focus should be prioritized for Class A items to optimize working capital turnover.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'volatility' && (
              <div className="space-y-6">
                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">SKU Volatility Analysis</h3>
                  <p className="text-[10px] text-slate-400 mb-6 font-medium">Coefficient of Variation - Higher values indicate more unpredictable demand patterns</p>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={downsampleData(volatilityResults, 15)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                        <XAxis type="number" tickFormatter={(val) => `${val.toFixed(0)}%`} tick={{fontSize: 9}} />
                        <YAxis dataKey="sku" type="category" width={60} tick={{fontSize: 9}} />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', color: '#ffffff', border: '1px solid #1e293b'}} 
                          formatter={(val: number, name) => [`${val.toFixed(2)}%`, 'Volatility']}
                          labelStyle={{color: '#ffffff'}}
                          wrapperStyle={{color: '#ffffff'}}
                          cursor={{fill: 'rgba(255, 255, 255, 0.1)'}}
                        />
                        <Bar dataKey="volatility" name="Volatility %">
                          {volatilityResults.slice(0, 15).map((entry, index) => {
                            const color = entry.volatility > 50 ? '#ef4444' : entry.volatility > 30 ? '#fb923c' : '#6366f1';
                            return <Cell key={index} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Volatility Ranking (All SKUs)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left p-3 text-slate-500 font-black uppercase">SKU</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Volatility %</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Avg Qty</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Std Dev</th>
                          <th className="text-center p-3 text-slate-500 font-black uppercase">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volatilityResults.map((item, i) => (
                          <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all">
                            <td className="p-3 text-slate-300 font-bold">{item.sku}</td>
                            <td className="text-right p-3 text-slate-300">{item.volatility.toFixed(2)}%</td>
                            <td className="text-right p-3 text-slate-400">{formatNumber(item.avgQuantity)}</td>
                            <td className="text-right p-3 text-slate-400">{formatNumber(item.stdDev)}</td>
                            <td className="text-center p-3">
                              <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${item.volatility > 50 ? 'bg-red-500/20 text-red-400' : item.volatility > 30 ? 'bg-orange-500/20 text-orange-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                {item.volatility > 50 ? 'High' : item.volatility > 30 ? 'Medium' : 'Low'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
        
        <ChatAgent provider={committedSettings.filters.aiProvider} audience={committedSettings.audience} context={dashboardContext} hasRunAnalysis={committedSettings.triggerToken} />
        <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} data={reportData} isLoading={isReportLoading} />
        <SchemaModal isOpen={isSchemaModalOpen} onClose={() => setIsSchemaModalOpen(false)} />
      </main>
    </div>
  );
};

export default App;