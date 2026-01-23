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
import { DataPoint, FilterState, TimeInterval, ForecastMethodology, ProductAttribute, InventoryLevel, Scenario, AiProvider, AudienceType, OnePagerData, MarketShock, ProductionPlan, BacktestResults, ForecastPoint } from './types';
import { calculateForecast, calculateMetrics, cleanAnomalies, applyMarketShocks, detectHWMethod } from './utils/forecasting';
import { calculateSupplyChainMetrics, calculateSupplyChainMetricsPerSku, runParetoAnalysis } from './utils/supplyChain';
import { exportToCSV, exportBulkCSV, exportAlerts } from './utils/export';
import { getIndustryInsights, getMarketTrendAdjustment, MarketAdjustment, getNarrativeSummary, getOnePagerReport, getAnomalyAnalysis, getMethodologyAssessment } from './services/aiService';
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
    // Always try to parse as string first to avoid timezone issues
    let dateString = dateStr;
    
    if (dateStr instanceof Date) {
      // Format Date object as ISO string
      dateString = dateStr.toISOString().split('T')[0];
    }
    
    // Parse YYYY-MM-DD format string
    if (typeof dateString === 'string') {
      const parts = dateString.split('-');
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

// Helper: Parse date in multiple formats (M/D/YYYY, MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY)
const parseDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  dateStr = dateStr.trim();
  
  // Try YYYY-MM-DD format (already normalized)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try M/D/YYYY, MM/DD/YYYY, M/DD/YYYY, MM/D/YYYY (slash format)
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Try MM-DD-YYYY, M-D-YYYY (dash format)
  const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const month = dashMatch[1].padStart(2, '0');
    const day = dashMatch[2].padStart(2, '0');
    const year = dashMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Try Date constructor as fallback for other formats
  const dateObj = new Date(dateStr);
  if (!isNaN(dateObj.getTime())) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return '';
};

// Helper: Format date for display (ensures consistent date formatting)
const formatDateForDisplay = (dateStr: any): string => {
  if (!dateStr) return '';
  
  // First - try manual parsing from YYYY-MM-DD format (timezone-safe)
  const parts = String(dateStr).split('-');
  if (parts.length >= 2) {
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[0], 10);
    if (!isNaN(month) && !isNaN(year)) {
      return `${month}/${year}`;
    }
  }
  
  // If already in MM/YYYY format, return as-is
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    return dateStr;
  }
  
  // Handle if already a Date object (fallback)
  if (dateStr instanceof Date) {
    return `${dateStr.getMonth() + 1}/${dateStr.getFullYear()}`;
  }
  
  // Convert string to Date if possible (fallback)
  const dateObj = new Date(dateStr);
  if (!isNaN(dateObj.getTime())) {
    return `${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
  }
  
  return '';
};

// Helper: Filter comparison data to 6 months before forecast start date, skipping the immediate month (for quality page)
const getQualityPageData = (comparisonData: any[], forecastStartDate: string): any[] => {
  if (!comparisonData || comparisonData.length === 0) return [];
  
  // Parse forecast start date (format: YYYY-MM-DD)
  const [forecastYear, forecastMonth, forecastDay] = forecastStartDate.split('-').map(Number);
  if (!forecastYear || !forecastMonth) return comparisonData;
  
  // Calculate 7 months back from forecast start (to get Jan in 8/1/2025 example)
  let backMonth = forecastMonth - 7;
  let backYear = forecastYear;
  if (backMonth <= 0) {
    backMonth += 12;
    backYear -= 1;
  }
  
  // Calculate month right before forecast (to exclude)
  let excludeMonth = forecastMonth - 1;
  let excludeYear = forecastYear;
  if (excludeMonth <= 0) {
    excludeMonth += 12;
    excludeYear -= 1;
  }
  
  // Filter: include dates >= 7-months-back and < 1-month-before-forecast
  // This gives us 6 months (e.g., Feb-Jun when forecast is Aug)
  return comparisonData.filter(d => {
    const [year, month] = d.date.split('-').map(Number);
    if (!year || !month) return false;
    
    // Date must be >= back window start (7 months back)
    if (year < backYear) return false;
    if (year === backYear && month < backMonth) return false;
    
    // Date must be < month right before forecast (exclude that month)
    if (year > excludeYear) return false;
    if (year === excludeYear && month >= excludeMonth) return false;
    
    return true;
  });
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
  const [forecastStartMonth, setForecastStartMonth] = useState('2025-08-01');
  const [activeTab, setActiveTab] = useState<'future' | 'quality' | 'inventory' | 'financials' | 'sku-analysis' | 'sandbox'>('future');
  
  const [aiInsight, setAiInsight] = useState('Analyze context to generate insights...');
  const [narrativeText, setNarrativeText] = useState('Business narrative pending analysis...');
  const [anomalyRca, setAnomalyRca] = useState<string | null>(null);
  const [qualityNarrative, setQualityNarrative] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRcaLoading, setIsRcaLoading] = useState(false);
  const [isQualityNarrativeLoading, setIsQualityNarrativeLoading] = useState(false);
  const [marketAdj, setMarketAdj] = useState<MarketAdjustment | null>(null);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState<OnePagerData | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [chartZoom, setChartZoom] = useState({ startIndex: 0, endIndex: 0 });
  const [backtestChartZoom, setBacktestChartZoom] = useState({ startIndex: 0, endIndex: 0 });
  const [volatilityChartZoom, setVolatilityChartZoom] = useState({ startIndex: 0, endIndex: 7 });
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
                  date: normalizeDateFormat(parseDate(p[2])),  // Parse multiple date formats, then normalize
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
              setUploadError({ type: 'hist', message: 'Sales CSV format error. Expected: category, sku, date (YYYY-MM-DD, M/D/YYYY, or MM/DD/YYYY), quantity' });
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
            // Proper CSV parser that respects quoted fields
            const parseCSVLine = (line: string): string[] => {
              const result: string[] = [];
              let current = '';
              let insideQuotes = false;
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                  insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                  result.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              result.push(current.trim());
              return result;
            };
            
            const cleanCurrency = (val: string) => {
              // Remove quotes, dollar signs, commas, and spaces
              return val.replace(/["'$,\s]/g, '').trim();
            };

            const newAttr = chunk
              .filter(l => l.trim().length > 0 && l.includes(','))
              .map(line => {
                const p = parseCSVLine(line);
                
                return { 
                  sku: p[0], 
                  category: p[1], 
                  leadTimeDays: parseInt(p[2]) || 30, 
                  sellingPrice: parseFloat(cleanCurrency(p[3])) || 150,  // p[3] is sellingPrice
                  unitCost: parseFloat(cleanCurrency(p[4])) || 100,       // p[4] is unitCost
                  serviceLevel: parseFloat(p[5]) || 0.95,
                  type: 'attr' as const
                } as ProductAttribute;
              })
              .filter(d => d.sku);
            if (newAttr.length > 0) {
              setAttributes(prev => [...prev, ...newAttr]);
              setHasUserUploadedData(prev => ({ ...prev, attr: true }));
              console.log(`✅ Processed ${newAttr.length} attribute records (chunk ${startIdx}-${endIdx}):`, newAttr.slice(0, 2));
            } else if (startIdx === 1) {
              setUploadError({ type: 'attr', message: 'Attributes CSV format error. Expected: sku, category, leadTimeDays, sellingPrice, unitCost, serviceLevel' });
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
    let skus = Array.from(new Set(data.map(d => d.sku))).sort() as string[];
    
    // If real data has been uploaded, exclude sample SKUs from the list
    if (hasUserUploadedData.hist) {
      const sampleSkuSet = new Set(SKUS);
      skus = skus.filter((sku: string) => !sampleSkuSet.has(sku));
    }
    
    console.log(`📊 Available SKUs from data: ${skus.join(', ')}`);
    return skus;
  }, [data, hasUserUploadedData.hist]);

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
    let filteredData = data;
    
    // If real data has been uploaded, exclude sample data
    if (hasUserUploadedData.hist) {
      const sampleSkuSet = new Set(SKUS);
      filteredData = data.filter(d => !sampleSkuSet.has(d.sku));
    }
    
    const cats = Array.from(new Set(filteredData.map(d => d.category).filter(c => c))).sort();
    console.log(`📂 Available categories from data: ${cats.join(', ')}`);
    return ['All', ...cats];
  }, [data, hasUserUploadedData.hist]);

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

  const skuLevelForecasts = useMemo(() => {
    // Get unique SKUs from filter selections (not from processedData) to respect slicer and include all forecast periods
    const uniqueSkus = committedSettings.filters.skus.length > 0 
      ? committedSettings.filters.skus 
      : Array.from(new Set(data.map(d => d.sku))).sort();
    
    console.log(`🎯 Per-SKU forecasting for: [${uniqueSkus.join(', ')}]`);
    
    const skuLevelForecasts = new Map<string, ForecastPoint[]>();
    
    uniqueSkus.forEach(sku => {
      // Get full historical data from complete dataset (not processedData) for accurate forecasting
      const skuData = data.filter(d => d.sku === sku && new Date(d.date).getTime() <= new Date(historicalDataEndDate).getTime()).sort((a, b) => a.date.localeCompare(b.date));
      
      if (skuData.length === 0) {
        console.log(`⚠️ SKU ${sku}: No historical data found`);
        return;
      }
      
      console.log(`📊 SKU ${sku}: ${skuData.length} historical points, date range: ${skuData[0].date} to ${skuData[skuData.length-1].date}`);
      
      // Calculate forecast for this SKU
      let skuForecast = calculateForecast(
        skuData, 
        committedSettings.horizon, 
        historicalDataEndDate,
        'monthly', 
        committedSettings.filters.confidenceLevel, 
        committedSettings.filters.methodology, 
        hwMethod, 
        autoDetectHW
      );
      
      console.log(`📈 SKU ${sku}: calculateForecast returned ${skuForecast.length} points`);
      
      // Apply market adjustments per-SKU
      if (committedSettings.filters.includeExternalTrends && marketAdj) {
        skuForecast = skuForecast.map(p => p.isForecast ? { ...p, forecast: Math.round(p.forecast * marketAdj.multiplier) } : p);
      }
      skuForecast = applyMarketShocks(skuForecast, committedSettings.filters.shocks);
      
      // Get per-SKU inventory on-hand
      const skuInv = inventory.find(i => i.sku === sku)?.onHand || 0;
      
      // Get per-SKU attributes for accurate pricing
      const skuAttribute = attributes.find(a => a.sku === sku);
      console.log(`💰 SKU ${sku}: Found attribute:`, skuAttribute ? `Price=$${skuAttribute.sellingPrice}, Cost=$${skuAttribute.unitCost}` : 'NOT FOUND - using defaults');
      
      // Calculate supply chain metrics with per-SKU pricing
      const enrichedForecast = calculateSupplyChainMetricsPerSku(
        skuForecast,
        sku,
        stats.std,
        committedSettings.filters.globalLeadTime,
        committedSettings.filters.globalServiceLevel,
        skuInv,
        skuAttribute,
        scenarios,
        committedSettings.filters.showLeadTimeOffset,
        committedSettings.filters.supplierVolatility,
        committedSettings.filters.productionPlans
      );
      
      const forecastOnly = enrichedForecast.filter(f => f.isForecast);
      const totalForecastQty = forecastOnly.reduce((s, f) => s + (f.scenarioForecast || 0), 0);
      const totalRevenue = forecastOnly.reduce((s, f) => s + (f.projectedRevenue || 0), 0);
      console.log(`✅ SKU ${sku}: ${totalForecastQty} units forecast, $${totalRevenue} projected revenue`);
      
      skuLevelForecasts.set(sku, enrichedForecast);
      console.log(`✅ SKU ${sku}: Enriched with supply chain metrics`);
    });
    
    return skuLevelForecasts;
  }, [data, committedSettings, marketAdj, stats.std, inventory, scenarios, attributes, forecastStartMonth, historicalDataEndDate]);

  // Create SKU-level tabular data for ABC and volatility analysis
  const skuLevelData = useMemo(() => {
    const skuTable: Array<{
      sku: string;
      historicalVolume: number;
      forecastedVolume: number;
      historicalMonthly: number[];
      forecastedMonthly: number[];
    }> = [];

    skuLevelForecasts.forEach((forecastPoints, sku) => {
      // Separate historical and forecast points
      const historicalPoints = forecastPoints.filter(f => !f.isForecast && f.historical !== undefined);
      const forecastPointsOnly = forecastPoints.filter(f => f.isForecast);

      // Extract last N months of historical data where N = forecast horizon (tie volatility window to forecast horizon)
      const lookbackMonths = committedSettings.horizon || 12;
      const cutoffDate = new Date(historicalDataEndDate);
      cutoffDate.setMonth(cutoffDate.getMonth() - lookbackMonths);
      const cutoffTime = cutoffDate.getTime();
      const historicalMonthly = historicalPoints
        .filter(p => new Date(p.date).getTime() >= cutoffTime)
        .map(p => p.historical || 0);

      // Extract all forecast months
      const forecastedMonthly = forecastPointsOnly.map(p => p.forecast || 0);

      const historicalVolume = historicalMonthly.reduce((a, b) => a + b, 0);
      const forecastedVolume = forecastedMonthly.reduce((a, b) => a + b, 0);

      skuTable.push({
        sku,
        historicalVolume,
        forecastedVolume,
        historicalMonthly,
        forecastedMonthly
      });
    });

    return skuTable;
  }, [skuLevelForecasts, historicalDataEndDate, committedSettings.horizon]);

  // Aggregate per-SKU forecasts for display on cross-SKU charts
  const aggregatedForecast = useMemo(() => {
    const aggregatedMap = new Map<string, ForecastPoint>();
    
    skuLevelForecasts.forEach((skuForecasts, sku) => {
      skuForecasts.forEach(point => {
        if (!aggregatedMap.has(point.date)) {
          aggregatedMap.set(point.date, {
            date: point.date,
            forecast: 0,
            historical: 0,
            lowerBound: 0,
            upperBound: 0,
            isForecast: point.isForecast,
            projectedInventory: 0,
            safetyStock: 0,
            reorderPoint: 0,
            scenarioForecast: undefined,
            projectedRevenue: 0,
            projectedMargin: 0,
            inventoryValue: 0
          });
        }
        
        const agg = aggregatedMap.get(point.date)!;
        agg.forecast = (agg.forecast || 0) + (point.forecast || 0);
        
        // Aggregate scenarioForecast only for forecast periods
        if (point.isForecast && point.scenarioForecast !== undefined) {
          agg.scenarioForecast = (agg.scenarioForecast || 0) + point.scenarioForecast;
        }
        
        // Only include historical values for non-forecast periods
        if (!point.isForecast) {
          agg.historical = (agg.historical || 0) + (point.historical || 0);
        } else {
          agg.historical = undefined;
        }
        
        agg.lowerBound = (agg.lowerBound || 0) + (point.lowerBound || 0);
        agg.upperBound = (agg.upperBound || 0) + (point.upperBound || 0);
        agg.projectedInventory = (agg.projectedInventory || 0) + (point.projectedInventory || 0);
        agg.safetyStock = Math.max(agg.safetyStock || 0, point.safetyStock || 0);
        agg.reorderPoint = Math.max(agg.reorderPoint || 0, point.reorderPoint || 0);
        agg.projectedRevenue = (agg.projectedRevenue || 0) + (point.projectedRevenue || 0);
        agg.projectedMargin = (agg.projectedMargin || 0) + (point.projectedMargin || 0);
        agg.inventoryValue = (agg.inventoryValue || 0) + (point.inventoryValue || 0);
      });
    });
    
    return Array.from(aggregatedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [skuLevelForecasts]);

  const futureForecast = aggregatedForecast;

  // Calculate financial stats from per-SKU forecasts (not aggregated)
  const financialStats = useMemo(() => {
    let totalRevenue = 0;
    let totalMargin = 0;
    let totalInventoryValue = 0;
    let forecastMonthCount = 0;

    // Iterate through each SKU's forecast and sum the financial metrics
    skuLevelForecasts.forEach((skuForecasts, sku) => {
      let skuRevenue = 0;
      let skuMargin = 0;
      skuForecasts.forEach(point => {
        if (point.isForecast) {
          totalRevenue += point.projectedRevenue || 0;
          totalMargin += point.projectedMargin || 0;
          totalInventoryValue += point.inventoryValue || 0;
          skuRevenue += point.projectedRevenue || 0;
          skuMargin += point.projectedMargin || 0;
          forecastMonthCount++;
        }
      });
      console.log(`💼 Financial - SKU ${sku}: Revenue=$${skuRevenue}, Margin=$${skuMargin}`);
    });

    const avgInventoryValue = forecastMonthCount > 0 ? Math.round(totalInventoryValue / forecastMonthCount) : 0;
    const valueAtRisk = Math.round(totalRevenue * (committedSettings.filters.supplierVolatility * 0.25));
    
    console.log(`💹 FINAL TOTALS: Revenue=$${totalRevenue}, Margin=$${totalMargin}, Forecast Months=${forecastMonthCount}`);
    
    return { 
      totalRevenue: Math.round(totalRevenue), 
      totalMargin: Math.round(totalMargin), 
      avgInventoryValue, 
      valueAtRisk 
    };
  }, [skuLevelForecasts, committedSettings]);

  // Create monthly financial breakdown for stacked bar chart (COGS + Margin)
  const monthlyFinancialData = useMemo(() => {
    const monthlyMap = new Map<string, {date: string, cogs: number, margin: number, revenue: number}>();
    
    skuLevelForecasts.forEach((skuForecasts, sku) => {
      const skuAttribute = attributes.find(a => a.sku === sku);
      const unitCost = skuAttribute?.unitCost ?? 100;
      
      skuForecasts.forEach(point => {
        if (point.isForecast && point.scenarioForecast !== undefined) {
          if (!monthlyMap.has(point.date)) {
            monthlyMap.set(point.date, { date: point.date, cogs: 0, margin: 0, revenue: 0 });
          }
          
          const monthly = monthlyMap.get(point.date)!;
          const qty = point.scenarioForecast || 0;
          const skuCogs = Math.round(qty * unitCost);
          const skuMargin = (point.projectedMargin || 0);
          
          monthly.cogs += skuCogs;
          monthly.margin += skuMargin;
          monthly.revenue += (skuCogs + skuMargin);
        }
      });
    });
    
    return Array.from(monthlyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [skuLevelForecasts, attributes]);

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
      // Get unique SKUs from filter (same as forecast)
      const uniqueSkus = committedSettings.filters.skus.length > 0 
        ? committedSettings.filters.skus 
        : Array.from(new Set(data.map(d => d.sku))).sort();

      if (uniqueSkus.length === 0 || data.length < 18) {
        return { 
          skuMethodForecasts: new Map(),
          testWindow: { startDate: '', endDate: '', skipFirstMonth: true },
          aggregatedMetrics: null,
          methodMetrics: new Map(),
          comparisonData: [],
          worstSkus: worstSkusGlobal
        };
      }

      // Calculate test period: 12 months back from historicalDataEndDate, minus 1 month buffer (= 6-month test window)
      // Use forecastStartMonth as anchor point for backtest window
      // Parse as YYYY-MM-DD format (from date input) and extract year/month
      const [forecastYear, forecastMonth] = forecastStartMonth.substring(0, 7).split('-');
      const forecastDate = new Date(parseInt(forecastYear), parseInt(forecastMonth) - 1, 1, 0, 0, 0, 0);
      
      const testEndDate = new Date(parseInt(forecastYear), parseInt(forecastMonth) - 1 - 1, 1, 0, 0, 0, 0); // 1 month before forecast start
      const testEndStr = testEndDate.toISOString().split('T')[0];
      
      const testStartDate = new Date(parseInt(forecastYear), parseInt(forecastMonth) - 1 - 12, 1, 0, 0, 0, 0); // 12 months before forecast start = 12-month window
      const testStartStr = testStartDate.toISOString().split('T')[0];

      
      console.log(`📊 Backtesting for SKUs: [${uniqueSkus.join(', ')}]`);
      console.log(`📅 forecastStartMonth: ${forecastStartMonth}, Parsed as: ${forecastDate.toISOString().split('T')[0]}`);
      console.log(`📅 Test period: ${testStartStr} to ${testEndStr} (12 months anchored on forecastStartMonth)`);

      // Per-SKU, per-method forecast data (12 months)
      const skuMethodForecasts = new Map<string, Map<string, any>>();
      
      // All actuals and forecasts for aggregated metric calculation (6-month window only)
      const allMethods = [
        ForecastMethodology.HOLT_WINTERS,
        ForecastMethodology.PROPHET,
        ForecastMethodology.ARIMA,
        ForecastMethodology.LINEAR
      ];

      const testStartTime = new Date(testStartStr).getTime();
      // Extend testEndTime by 24 hours (add milliseconds) to include the full end month
      const testEndTime = new Date(testEndStr).getTime() + (24 * 60 * 60 * 1000);

      // Phase 1: Calculate all 4 methods for each SKU
      uniqueSkus.forEach(sku => {
        const skuData = data
          .filter(d => d.sku === sku)
          .sort((a, b) => a.date.localeCompare(b.date));

        if (skuData.length < 18) {
          console.log(`⚠️ SKU ${sku}: Not enough data (${skuData.length} points)`);
          return;
        }

        console.log(`📊 SKU ${sku} data range: ${skuData[0].date} to ${skuData[skuData.length - 1].date}`);

        // Training data: everything before test start
        const trainData = skuData.filter(d => new Date(d.date).getTime() < testStartTime);
        if (trainData.length < 6) {
          console.log(`⚠️ SKU ${sku}: Insufficient training data (${trainData.length} points)`);
          return;
        }

        // Get all actual data points (for matching with forecasts)
        const trainEndDate = trainData[trainData.length - 1].date;
        
        const skuMethods = new Map<string, any>();
        
        // For each methodology, generate 13-month forecast (12-month test window + 1 month buffer)
        // Calculate all 4 methods
        [ForecastMethodology.HOLT_WINTERS, ForecastMethodology.PROPHET, ForecastMethodology.ARIMA, ForecastMethodology.LINEAR].forEach(method => {
          let forecast = calculateForecast(
            trainData,
            13, // Forecast 13 months to cover full 12-month test window
            trainEndDate,
            'monthly',
            committedSettings.filters.confidenceLevel,
            method,
            hwMethod,
            autoDetectHW
          );

          // Apply market adjustments
          if (committedSettings.filters.includeExternalTrends && marketAdj) {
            forecast = forecast.map(p => p.isForecast ? { ...p, forecast: Math.round(p.forecast * marketAdj.multiplier) } : p);
          }

          // Extract forecast values and dates
          const forecastDates = forecast.filter(f => f.isForecast).map(f => f.date);
          const forecastVals = forecast.filter(f => f.isForecast).map(f => f.forecast || 0);
          
          // Match actual values to forecast dates
          const actualVals = forecastDates.map(fDate => {
            const normalized = normalizeDateFormat(fDate);
            const match = skuData.find(d => normalizeDateFormat(d.date) === normalized);
            return match ? match.quantity : 0;
          });

          skuMethods.set(method, {
            dates: forecastDates,
            forecasts: forecastVals,
            actuals: actualVals
          });
        });

        skuMethodForecasts.set(sku, skuMethods);
        const methodData = skuMethods.get(ForecastMethodology.HOLT_WINTERS);
        if (methodData) {
          console.log(`✅ SKU ${sku}: Calculated 4 methodologies (13-month forecast). Dates: ${methodData.dates[0]} to ${methodData.dates[methodData.dates.length - 1]} (${methodData.dates.length} points)`);
        } else {
          console.log(`✅ SKU ${sku}: Calculated 4 methodologies (13-month forecast)`);
        }
      });

      if (skuMethodForecasts.size === 0) {
        return {
          skuMethodForecasts: new Map(),
          testWindow: { startDate: testStartStr, endDate: testEndStr, skipFirstMonth: true },
          aggregatedMetrics: null,
          methodMetrics: new Map(),
          comparisonData: [],
          worstSkus: worstSkusGlobal
        };
      }

      // Phase 2: Calculate metrics for 6-month test window across all methods
      const methodMetrics = new Map<string, any>();
      let aggregatedActuals: number[] = [];
      let aggregatedForecasts: number[] = [];

      allMethods.forEach(method => {
        const methodActuals: number[] = [];
        const methodForecasts: number[] = [];

        skuMethodForecasts.forEach((skuMethods, sku) => {
          const methodData = skuMethods.get(method);
          if (!methodData) return;

          // Slice to 6-month test window
          methodData.dates.forEach((date, idx) => {
            const dt = new Date(date).getTime();
            if (dt >= testStartTime && dt <= testEndTime) {
              methodActuals.push(methodData.actuals[idx] || 0);
              methodForecasts.push(methodData.forecasts[idx] || 0);
            }
          });
        });

        if (methodActuals.length > 0) {
          const methodTotal = methodActuals.reduce((a, b) => a + b, 0);
          const methodForecastTotal = methodForecasts.reduce((a, b) => a + b, 0);
          
          // Calculate metrics
          let wMAPENum = 0, wMAPEDen = 0;
          methodActuals.forEach((actual, i) => {
            wMAPENum += Math.abs(actual - methodForecasts[i]);
            wMAPEDen += Math.abs(actual);
          });
          const mape = wMAPEDen > 0 ? (wMAPENum / wMAPEDen) * 100 : 0;

          let sumSqErr = 0;
          methodActuals.forEach((actual, i) => {
            sumSqErr += Math.pow(actual - methodForecasts[i], 2);
          });
          const rmse = Math.sqrt(sumSqErr / methodActuals.length);

          const accuracy = Math.max(0, Math.min(100, (1 - Math.abs(methodTotal - methodForecastTotal) / Math.max(methodTotal, 1)) * 100));
          const bias = ((methodForecastTotal - methodTotal) / Math.max(methodTotal, 1)) * 100;

          methodMetrics.set(method, { accuracy, mape, rmse, bias });

          // Accumulate for aggregated metrics
          aggregatedActuals.push(...methodActuals);
          aggregatedForecasts.push(...methodForecasts);

          console.log(`  └─ ${method}: Accuracy=${accuracy.toFixed(1)}%, MAPE=${mape.toFixed(1)}%, RMSE=${rmse.toFixed(0)}, Bias=${bias.toFixed(1)}%`);
        }
      });

      // Calculate aggregated metrics (using selected methodology's 6-month window)
      let aggregatedMetrics: any = null;
      const selectedMethodData = skuMethodForecasts.values().next().value?.get(committedSettings.filters.methodology);
      if (selectedMethodData) {
        const selectedActuals: number[] = [];
        const selectedForecasts: number[] = [];

        skuMethodForecasts.forEach((skuMethods, sku) => {
          const methodData = skuMethods.get(committedSettings.filters.methodology);
          if (!methodData) return;

          methodData.dates.forEach((date, idx) => {
            const dt = new Date(date).getTime();
            if (dt >= testStartTime && dt <= testEndTime) {
              selectedActuals.push(methodData.actuals[idx] || 0);
              selectedForecasts.push(methodData.forecasts[idx] || 0);
            }
          });
        });

        if (selectedActuals.length > 0) {
          const selectedTotal = selectedActuals.reduce((a, b) => a + b, 0);
          const selectedForecastTotal = selectedForecasts.reduce((a, b) => a + b, 0);

          let wMAPENum = 0, wMAPEDen = 0;
          selectedActuals.forEach((actual, i) => {
            wMAPENum += Math.abs(actual - selectedForecasts[i]);
            wMAPEDen += Math.abs(actual);
          });
          const mape = wMAPEDen > 0 ? (wMAPENum / wMAPEDen) * 100 : 0;

          let sumSqErr = 0;
          selectedActuals.forEach((actual, i) => {
            sumSqErr += Math.pow(actual - selectedForecasts[i], 2);
          });
          const rmse = Math.sqrt(sumSqErr / selectedActuals.length);

          const accuracy = Math.max(0, Math.min(100, (1 - Math.abs(selectedTotal - selectedForecastTotal) / Math.max(selectedTotal, 1)) * 100));
          const bias = ((selectedForecastTotal - selectedTotal) / Math.max(selectedTotal, 1)) * 100;

          aggregatedMetrics = { accuracy, mape, rmse, bias };

          console.log(`💼 Aggregated (${committedSettings.filters.methodology}): Accuracy=${accuracy.toFixed(1)}%, MAPE=${mape.toFixed(1)}%, RMSE=${rmse.toFixed(0)}, Bias=${bias.toFixed(1)}%`);
        }
      }

      // Phase 3: Build comparison data for chart (12-month window, aggregated across SKUs)
      // Include ALL forecast dates within test window, even if actual data is missing
      const comparisonByDate = new Map<string, {actual: number, forecast: number}>();

      skuMethodForecasts.forEach((skuMethods, sku) => {
        const methodData = skuMethods.get(committedSettings.filters.methodology);
        if (!methodData) return;

        methodData.dates.forEach((date, idx) => {
          const dt = new Date(date).getTime();
          if (dt >= testStartTime && dt <= testEndTime) {
            const normalized = normalizeDateFormat(date);
            if (!comparisonByDate.has(normalized)) {
              comparisonByDate.set(normalized, {actual: 0, forecast: 0});
            }
            const entry = comparisonByDate.get(normalized)!;
            entry.actual += methodData.actuals[idx] || 0;
            entry.forecast += methodData.forecasts[idx] || 0;
          }
        });
      });

      const comparisonData = Array.from(comparisonByDate.entries())
        .map(([date, {actual, forecast}]) => ({date, actual, forecast}))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (comparisonData.length > 0) {
        console.log(`📊 Comparison data: ${comparisonData.length} dates`);
        console.log(`   First: ${comparisonData[0].date}, Last: ${comparisonData[comparisonData.length - 1].date}`);
      }

      // Phase 4: Calculate metrics for 6-month quality page window
      const qualityPageData = comparisonData.filter(d => {
        const [year, month] = d.date.split('-').map(Number);
        const [forecastYear, forecastMonth] = forecastStartMonth.substring(0, 7).split('-').map(Number);
        if (!year || !month || !forecastYear || !forecastMonth) return false;
        
        // Calculate 7 months back and exclude month (same logic as getQualityPageData)
        let backMonth = forecastMonth - 7;
        let backYear = forecastYear;
        if (backMonth <= 0) {
          backMonth += 12;
          backYear -= 1;
        }
        
        let excludeMonth = forecastMonth - 1;
        let excludeYear = forecastYear;
        if (excludeMonth <= 0) {
          excludeMonth += 12;
          excludeYear -= 1;
        }
        
        if (year < backYear) return false;
        if (year === backYear && month < backMonth) return false;
        if (year > excludeYear) return false;
        if (year === excludeYear && month >= excludeMonth) return false;
        
        return true;
      });

      // Calculate aggregated metrics for 6-month window
      let qualityPageMetrics: any = null;
      const qualityPageActuals = qualityPageData.map(d => d.actual);
      const qualityPageForecasts = qualityPageData.map(d => d.forecast);
      
      if (qualityPageActuals.length > 0) {
        const qualityTotal = qualityPageActuals.reduce((a, b) => a + b, 0);
        const qualityForecastTotal = qualityPageForecasts.reduce((a, b) => a + b, 0);

        let wMAPENum = 0, wMAPEDen = 0;
        qualityPageActuals.forEach((actual, i) => {
          wMAPENum += Math.abs(actual - qualityPageForecasts[i]);
          wMAPEDen += Math.abs(actual);
        });
        const mape = wMAPEDen > 0 ? (wMAPENum / wMAPEDen) * 100 : 0;

        let sumSqErr = 0;
        qualityPageActuals.forEach((actual, i) => {
          sumSqErr += Math.pow(actual - qualityPageForecasts[i], 2);
        });
        const rmse = Math.sqrt(sumSqErr / qualityPageActuals.length);

        const accuracy = Math.max(0, Math.min(100, (1 - Math.abs(qualityTotal - qualityForecastTotal) / Math.max(qualityTotal, 1)) * 100));
        const bias = ((qualityForecastTotal - qualityTotal) / Math.max(qualityTotal, 1)) * 100;

        qualityPageMetrics = { accuracy, mape, rmse, bias };
        console.log(`📋 Quality Page Metrics (6-month): Accuracy=${accuracy.toFixed(1)}%, MAPE=${mape.toFixed(1)}%, RMSE=${rmse.toFixed(0)}, Bias=${bias.toFixed(1)}%`);
      }

      // Calculate method metrics for 6-month quality page window
      const qualityPageMethodMetrics = new Map<string, any>();
      allMethods.forEach(method => {
        const methodActuals: number[] = [];
        const methodForecasts: number[] = [];

        skuMethodForecasts.forEach((skuMethods, sku) => {
          const methodData = skuMethods.get(method);
          if (!methodData) return;

          methodData.dates.forEach((date, idx) => {
            const normalized = normalizeDateFormat(date);
            const qpData = qualityPageData.find(d => d.date === normalized);
            if (qpData) {
              methodActuals.push(methodData.actuals[idx] || 0);
              methodForecasts.push(methodData.forecasts[idx] || 0);
            }
          });
        });

        if (methodActuals.length > 0) {
          const methodTotal = methodActuals.reduce((a, b) => a + b, 0);
          const methodForecastTotal = methodForecasts.reduce((a, b) => a + b, 0);
          
          let wMAPENum = 0, wMAPEDen = 0;
          methodActuals.forEach((actual, i) => {
            wMAPENum += Math.abs(actual - methodForecasts[i]);
            wMAPEDen += Math.abs(actual);
          });
          const mape = wMAPEDen > 0 ? (wMAPENum / wMAPEDen) * 100 : 0;

          let sumSqErr = 0;
          methodActuals.forEach((actual, i) => {
            sumSqErr += Math.pow(actual - methodForecasts[i], 2);
          });
          const rmse = Math.sqrt(sumSqErr / methodActuals.length);

          const accuracy = Math.max(0, Math.min(100, (1 - Math.abs(methodTotal - methodForecastTotal) / Math.max(methodTotal, 1)) * 100));
          const bias = ((methodForecastTotal - methodTotal) / Math.max(methodTotal, 1)) * 100;

          qualityPageMethodMetrics.set(method, { accuracy, mape, rmse, bias });
        }
      });

      return {
        skuMethodForecasts,
        testWindow: { startDate: testStartStr, endDate: testEndStr, skipFirstMonth: true },
        aggregatedMetrics,
        methodMetrics,
        qualityPageMetrics,
        qualityPageMethodMetrics,
        comparisonData,
        worstSkus: worstSkusGlobal
      };
    } catch (e) {
      console.error('Error in backtestResults:', e);
      return {
        skuMethodForecasts: new Map(),
        testWindow: { startDate: '', endDate: '', skipFirstMonth: true },
        aggregatedMetrics: null,
        methodMetrics: new Map(),
        qualityPageMetrics: null,
        qualityPageMethodMetrics: new Map(),
        comparisonData: [],
        worstSkus: worstSkusGlobal
      };
    }
  }, [data, committedSettings, hwMethod, autoDetectHW, historicalDataEndDate, marketAdj]);

  const generateQualityNarrative = async () => {
    setIsQualityNarrativeLoading(true);
    try {
      // Gather metrics from all methodologies
      const methodMetricsData = Array.from(backtestResults.methodMetrics?.entries() || []);
      const selectedMethodName = committedSettings.filters.methodology.split(' (')[0];
      const selectedMetrics = backtestResults.methodMetrics?.get(committedSettings.filters.methodology);

      const metricsInfo = methodMetricsData
        .map(([method, metrics]) => {
          const methodName = method.split(' (')[0];
          return `- ${methodName}: Accuracy ${metrics.accuracy.toFixed(1)}%, MAPE ${metrics.mape.toFixed(1)}%, RMSE ${metrics.rmse.toFixed(0)}, Bias ${metrics.bias.toFixed(1)}%`;
        })
        .join('\n');

      const qualityPrompt = `You are a supply chain analytics expert providing executive-level insights on forecast methodology performance. Based on the following backtest metrics across a 6-month validation window, provide a concise narrative assessment.

METHODOLOGY COMPARISON:
${metricsInfo}

SELECTED METHODOLOGY: ${selectedMethodName}
- Accuracy: ${selectedMetrics?.accuracy.toFixed(1) || 'N/A'}%
- MAPE: ${selectedMetrics?.mape.toFixed(1) || 'N/A'}% (Mean Absolute Percentage Error - measures average forecast error as % of actual)
- RMSE: ${selectedMetrics?.rmse.toFixed(0) || 'N/A'} (Root Mean Square Error - penalizes large deviations more heavily)
- Bias: ${selectedMetrics?.bias.toFixed(1) || 'N/A'}% (positive = over-forecasting, negative = under-forecasting)

Provide a 3-4 sentence narrative that:
1. Explains briefly how the selected methodology works
2. Assesses its performance in this validation window vs alternatives
3. Highlights any concerns (e.g., bias direction, MAPE threshold, consistency across SKUs)
4. Compares key strengths against competing methodologies

Keep it technical but accessible. Do not include targets or recommendations.`;

      const narrative = await getNarrativeSummary(
        committedSettings.filters.aiProvider, 
        qualityPrompt,
        stats.avg,
        futureForecast.length > 0 ? futureForecast.reduce((sum, f) => sum + (f.forecast || 0), 0) / futureForecast.length : 0,
        committedSettings.horizon,
        committedSettings.audience,
        committedSettings.filters.skus
      );
      setQualityNarrative(narrative);
    } catch (error) {
      console.error('Error generating quality narrative:', error);
      setQualityNarrative('Unable to generate narrative. Please try again.');
    } finally {
      setIsQualityNarrativeLoading(false);
    }
  };

  const runRca = async () => {
    setIsRcaLoading(true);
    
    try {
      const outliers = aggregatedData.filter(d => Math.abs(d.quantity - stats.avg) > stats.std * 1.5);
      const analysis = await getAnomalyAnalysis(committedSettings.filters.aiProvider, committedSettings.industryPrompt, outliers.slice(-5));
      setAnomalyRca(analysis);
    } catch (error) {
      console.error('Error in RCA analysis:', error);
    } finally {
      setIsRcaLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsReportLoading(true);
    try {
      const contextSummary = `Portfolio Status: ${paretoResults.length} SKUs analyzed, ${futureForecast.filter(f => f.isForecast).length} forecast periods. Forecast methodology: ${committedSettings.filters.methodology}`;
      const report = await getOnePagerReport(committedSettings.filters.aiProvider, contextSummary, committedSettings.audience);
      setReportData(report);
      setIsReportOpen(true);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsReportLoading(false);
    }
  };

  const handleExportWorstSkus = () => {
    // Export forecasted volumes by month for worst SKUs only
    const worstSkuNames = backtestResults.worstSkus.map(s => s.sku);
    
    if (worstSkuNames.length === 0) {
      alert('No worst SKUs to export');
      return;
    }

    const exportRows: string[] = [];
    const csvHeaders = 'SKU,Month,Forecasted Volume';
    exportRows.push(csvHeaders);

    // Collect all forecast dates
    const allForecastDates = new Set<string>();
    skuLevelForecasts.forEach(forecast => {
      forecast.forEach(point => {
        if (point.isForecast) {
          allForecastDates.add(point.date);
        }
      });
    });

    const sortedDates = Array.from(allForecastDates).sort();

    // Export only worst SKUs
    worstSkuNames.forEach(sku => {
      const skuForecastMap = new Map<string, number>();
      const skuForecast = skuLevelForecasts.get(sku);
      if (skuForecast) {
        skuForecast.forEach(point => {
          if (point.isForecast) {
            skuForecastMap.set(point.date, point.forecast || 0);
          }
        });
      }

      sortedDates.forEach(date => {
        const forecastedQty = skuForecastMap.get(date) || '';
        if (forecastedQty !== '') {
          const row = [sku, date, forecastedQty].join(',');
          exportRows.push(row);
        }
      });
    });

    const csvContent = exportRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const exportDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `${exportDate}_worst-skus-forecast.csv`;
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`✅ Exported worst SKUs forecast: ${filename} (${worstSkuNames.length} SKUs)`);
  };

  const handleExportBacktestDetail = () => {
    // Export detailed backtest comparison for 6-month quality page window only
    if (!backtestResults.skuMethodForecasts || backtestResults.skuMethodForecasts.size === 0) {
      alert('No backtest data to export');
      return;
    }

    // Filter to 6-month quality page window
    const qualityPageDates = new Set<string>();
    const [forecastYear, forecastMonth] = forecastStartMonth.substring(0, 7).split('-').map(Number);
    
    let backMonth = forecastMonth - 7;
    let backYear = forecastYear;
    if (backMonth <= 0) {
      backMonth += 12;
      backYear -= 1;
    }
    
    let excludeMonth = forecastMonth - 1;
    let excludeYear = forecastYear;
    if (excludeMonth <= 0) {
      excludeMonth += 12;
      excludeYear -= 1;
    }

    backtestResults.skuMethodForecasts.forEach((skuMethods) => {
      const selectedMethodData = skuMethods.get(committedSettings.filters.methodology);
      if (!selectedMethodData) return;
      
      selectedMethodData.dates.forEach((date) => {
        const [year, month] = date.split('-').map(Number);
        if (!year || !month) return;
        
        if (year < backYear) return;
        if (year === backYear && month < backMonth) return;
        if (year > excludeYear) return;
        if (year === excludeYear && month >= excludeMonth) return;
        
        qualityPageDates.add(normalizeDateFormat(date));
      });
    });

    const exportRows: string[] = [];
    const csvHeaders = [
      'Date',
      'SKU',
      'Actual',
      'HW Forecast',
      'Prophet Forecast',
      'ARIMA Forecast',
      'Linear Forecast',
      'Selected Method Forecast',
      'Selected Method',
      'HW Error %',
      'Prophet Error %',
      'ARIMA Error %',
      'Linear Error %'
    ].join(',');
    exportRows.push(csvHeaders);

    // Iterate through each SKU
    backtestResults.skuMethodForecasts.forEach((skuMethods, sku) => {
      const selectedMethodData = skuMethods.get(committedSettings.filters.methodology);
      if (!selectedMethodData) return;

      selectedMethodData.dates.forEach((date, idx) => {
        const normalized = normalizeDateFormat(date);
        
        // Only include rows within quality page 6-month window
        if (qualityPageDates.has(normalized)) {
          const actual = selectedMethodData.actuals[idx] || 0;
          
          // Get forecasts from all methods
          const hwData = skuMethods.get(ForecastMethodology.HOLT_WINTERS);
          const prophetData = skuMethods.get(ForecastMethodology.PROPHET);
          const arimaData = skuMethods.get(ForecastMethodology.ARIMA);
          const linearData = skuMethods.get(ForecastMethodology.LINEAR);

          const hwForecast = hwData?.forecasts[idx] || 0;
          const prophetForecast = prophetData?.forecasts[idx] || 0;
          const arimaForecast = arimaData?.forecasts[idx] || 0;
          const linearForecast = linearData?.forecasts[idx] || 0;
          const selectedForecast = selectedMethodData.forecasts[idx] || 0;

          // Calculate error percentages
          const calculateError = (forecast: number, actual: number) => {
            return actual > 0 ? (((forecast - actual) / actual) * 100).toFixed(1) : '0';
          };

          const row = [
            date,
            sku,
            actual.toFixed(0),
            hwForecast.toFixed(0),
            prophetForecast.toFixed(0),
            arimaForecast.toFixed(0),
            linearForecast.toFixed(0),
            selectedForecast.toFixed(0),
            committedSettings.filters.methodology.split(' (')[0],
            calculateError(hwForecast, actual),
            calculateError(prophetForecast, actual),
            calculateError(arimaForecast, actual),
            calculateError(linearForecast, actual)
          ].join(',');
          
          exportRows.push(row);
        }
      });
    });

    const csvContent = exportRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const exportDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `${exportDate}_backtest-detail-6m.csv`;
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`✅ Exported backtest detail (6-month): ${filename} (${backtestResults.skuMethodForecasts.size} SKUs, ${exportRows.length - 1} data rows)`);
  };

  const handleExport = () => {
    // Use skuLevelForecasts directly - already per-SKU level
    const skuHWMethods = new Map<string, string>();
    
    skuLevelForecasts.forEach((forecast, sku) => {
      const skuData = processedData.filter(d => d.sku === sku);
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

    // Build a map of ALL historical sales data
    const allHistoricalMap = new Map<string, Map<string, number>>();
    data.forEach(d => {
      if (!allHistoricalMap.has(d.sku)) {
        allHistoricalMap.set(d.sku, new Map());
      }
      const dateMap = allHistoricalMap.get(d.sku)!;
      dateMap.set(normalizeDateFormat(d.date), (dateMap.get(normalizeDateFormat(d.date)) || 0) + d.quantity);
    });

    const exportRows: string[] = [];
    const csvHeaders = 'SKU,Date,Forecasted Quantity,Historic Sales Quantity,Forecast Methodology';
    exportRows.push(csvHeaders);

    // Collect all forecast dates from all SKUs
    const allForecastDates = new Set<string>();
    skuLevelForecasts.forEach(forecast => {
      forecast.forEach(point => {
        if (point.isForecast) {
          allForecastDates.add(point.date);
        }
      });
    });

    const sortedDates = Array.from(allForecastDates).sort();
    
    let allSkus = Array.from(skuLevelForecasts.keys()).sort() as string[];
    if (hasUserUploadedData.hist) {
      const sampleSkuSet = new Set(SKUS);
      allSkus = allSkus.filter((sku: string) => !sampleSkuSet.has(sku));
    }

    allSkus.forEach((sku: string) => {
      const skuForecastMap = new Map<string, number>();
      const skuForecast = skuLevelForecasts.get(sku);
      if (skuForecast) {
        skuForecast.forEach(point => {
          if (point.isForecast) {
            skuForecastMap.set(point.date, point.forecast || 0);
          }
        });
      }

      const skuHistoricalMap = allHistoricalMap.get(sku as string) || new Map();
      const methodologyLabel = skuHWMethods.get(sku as string) || committedSettings.filters.methodology;

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
    // Calculate Pareto based on historical volumes - use all SKUs with both historical and forecast data
    const skuMap = new Map<string, number>();
    skuLevelData.forEach(item => {
      const matchesCategory = committedSettings.filters.category === 'All' || true; // TODO: Add category field to skuLevelData if needed
      const matchesSku = committedSettings.filters.skus.length === 0 || committedSettings.filters.skus.includes(item.sku);
      if (matchesCategory && matchesSku) {
        skuMap.set(item.sku, item.historicalVolume);
      }
    });
    return runParetoAnalysis(Array.from(skuMap.entries()).map(([sku, totalVolume]) => ({ sku, totalVolume })));
  }, [skuLevelData, committedSettings.filters.category, committedSettings.filters.skus]);

  const forecastParetoResults = useMemo(() => {
    // Calculate Pareto based on forecasted volumes - use UNION of all SKUs from both datasets
    const allSkus = new Set([...paretoResults.map(p => p.sku), ...skuLevelData.map(s => s.sku)]);
    const skuMap = new Map<string, number>();
    
    allSkus.forEach(sku => {
      const matchesCategory = committedSettings.filters.category === 'All' || true;
      const matchesSku = committedSettings.filters.skus.length === 0 || committedSettings.filters.skus.includes(sku);
      if (matchesCategory && matchesSku) {
        const skuData = skuLevelData.find(s => s.sku === sku);
        skuMap.set(sku, skuData?.forecastedVolume || 0);
      }
    });
    return runParetoAnalysis(Array.from(skuMap.entries()).map(([sku, totalVolume]) => ({ sku, totalVolume })));
  }, [skuLevelData, paretoResults, committedSettings.filters.category, committedSettings.filters.skus]);

  const volatilityResults = useMemo(() => {
    // Calculate volatility based on last N months of historical data using SKU-level table
    const skuVolatility = new Map<string, { sku: string; volatility: number; avgQuantity: number; stdDev: number }>();
    
    skuLevelData.forEach(item => {
      const matchesCategory = committedSettings.filters.category === 'All' || true; // TODO: Add category field to skuLevelData if needed
      const matchesSku = committedSettings.filters.skus.length === 0 || committedSettings.filters.skus.includes(item.sku);
      if (matchesCategory && matchesSku && item.historicalMonthly.length > 0) {
        const quantities = item.historicalMonthly;
        const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length;
        const variance = quantities.reduce((sum, q) => sum + Math.pow(q - avg, 2), 0) / quantities.length;
        const stdDev = Math.sqrt(variance);
        const cv = avg > 0 ? (stdDev / avg) * 100 : 0; // Coefficient of Variation
        skuVolatility.set(item.sku, { sku: item.sku, volatility: cv, avgQuantity: avg, stdDev });
      }
    });

    return Array.from(skuVolatility.values()).sort((a, b) => b.volatility - a.volatility);
  }, [skuLevelData, committedSettings.filters.category, committedSettings.filters.skus]);

  const forecastVolatilityResults = useMemo(() => {
    // Calculate volatility based on forecast data using SKU-level table
    const skuVolatility = new Map<string, { sku: string; volatility: number; avgQuantity: number; stdDev: number }>();
    
    skuLevelData.forEach(item => {
      const matchesCategory = committedSettings.filters.category === 'All' || true; // TODO: Add category field to skuLevelData if needed
      const matchesSku = committedSettings.filters.skus.length === 0 || committedSettings.filters.skus.includes(item.sku);
      if (matchesCategory && matchesSku && item.forecastedMonthly.length > 0) {
        const quantities = item.forecastedMonthly;
        const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length;
        const variance = quantities.reduce((sum, q) => sum + Math.pow(q - avg, 2), 0) / quantities.length;
        const stdDev = Math.sqrt(variance);
        const cv = avg > 0 ? (stdDev / avg) * 100 : 0;
        skuVolatility.set(item.sku, { sku: item.sku, volatility: cv, avgQuantity: avg, stdDev });
      }
    });

    return Array.from(skuVolatility.values()).sort((a, b) => b.volatility - a.volatility);
  }, [skuLevelData, committedSettings.filters.category, committedSettings.filters.skus]);

  const portfolioChanges = useMemo(() => {
    // Compare historical vs forecast ABC classifications and volatility
    const changes: any[] = [];
    const allSkus = new Set([...paretoResults.map(p => p.sku), ...forecastParetoResults.map(p => p.sku)]);
    
    allSkus.forEach(sku => {
      const historicalPareto = paretoResults.find(p => p.sku === sku);
      const forecastPareto = forecastParetoResults.find(p => p.sku === sku);
      const historicalVolatility = volatilityResults.find(v => v.sku === sku);
      const forecastVolatility = forecastVolatilityResults.find(v => v.sku === sku);
      
      const classChanged = historicalPareto?.grade !== forecastPareto?.grade;
      const volatilityRiskChanged = historicalVolatility && forecastVolatility && 
        ((historicalVolatility.volatility > 50 ? 'High' : historicalVolatility.volatility > 30 ? 'Medium' : 'Low') !== 
         (forecastVolatility.volatility > 50 ? 'High' : forecastVolatility.volatility > 30 ? 'Medium' : 'Low'));
      
      if (classChanged || volatilityRiskChanged) {
        changes.push({
          sku,
          historicalClass: historicalPareto?.grade || 'N/A',
          forecastClass: forecastPareto?.grade || 'N/A',
          classChange: classChanged ? `${historicalPareto?.grade || 'N/A'} → ${forecastPareto?.grade || 'N/A'}` : 'No change',
          historicalVolatilityRisk: historicalVolatility ? (historicalVolatility.volatility > 50 ? 'High' : historicalVolatility.volatility > 30 ? 'Medium' : 'Low') : 'N/A',
          forecastVolatilityRisk: forecastVolatility ? (forecastVolatility.volatility > 50 ? 'High' : forecastVolatility.volatility > 30 ? 'Medium' : 'Low') : 'N/A',
          volatilityChange: volatilityRiskChanged ? `${historicalVolatility?.volatility.toFixed(1) || 'N/A'}% → ${forecastVolatility?.volatility.toFixed(1) || 'N/A'}%` : 'No change'
        });
      }
    });
    
    return changes;
  }, [paretoResults, forecastParetoResults, volatilityResults, forecastVolatilityResults]);

  // Calculate portfolio transformation matrix with volume shifts
  const transformationMatrix = useMemo(() => {
    const matrix: Array<{ from: string; to: string; count: number; volumeShift: number }> = [];
    
    // Track all possible transitions (exclude no-change transitions)
    ['A', 'B', 'C'].forEach(from => {
      ['A', 'B', 'C'].forEach(to => {
        // Skip if from === to (no actual change)
        if (from === to) return;
        
        const skusInTransition = portfolioChanges.filter(p => p.historicalClass === from && p.forecastClass === to);
        if (skusInTransition.length > 0) {
          const volumeShift = skusInTransition.reduce((sum, p) => {
            const histVol = paretoResults.find(r => r.sku === p.sku)?.totalVolume || 0;
            const foreVol = forecastParetoResults.find(r => r.sku === p.sku)?.totalVolume || 0;
            return sum + (foreVol - histVol);
          }, 0);
          
          // Only include if there are actual changes (count > 0 and non-zero volume shift)
          if (skusInTransition.length > 0 && volumeShift !== 0) {
            matrix.push({
              from,
              to,
              count: skusInTransition.length,
              volumeShift
            });
          }
        }
      });
    });
    
    return matrix;
  }, [portfolioChanges, paretoResults, forecastParetoResults]);

  // Initialize chart zoom range when forecast data changes
  useEffect(() => {
    if (aggregatedForecast.length > 0) {
      setChartZoom({ startIndex: 0, endIndex: Math.max(40, aggregatedForecast.length - 1) });
    }
  }, [aggregatedForecast]);

  // Initialize backtest chart zoom when backtest data changes
  useEffect(() => {
    if (backtestResults.comparisonData && backtestResults.comparisonData.length > 0) {
      setBacktestChartZoom({ startIndex: 0, endIndex: backtestResults.comparisonData.length - 1 });
    }
  }, [backtestResults.comparisonData]);

  // Handle scroll wheel zoom on chart
  // Initialize chart zoom on aggregatedForecast change
  useEffect(() => {
    if (aggregatedForecast.length > 0) {
      setChartZoom({ startIndex: 0, endIndex: Math.max(40, aggregatedForecast.length - 1) });
    }
  }, [aggregatedForecast.length]);

  useEffect(() => {
    if (!committedSettings.triggerToken) return;
    const runAI = async () => {
      setIsLoading(true);
      const [insights, narrative, qualityNarrative] = await Promise.all([
        getIndustryInsights(committedSettings.filters.aiProvider, committedSettings.industryPrompt, `Avg: ${Math.round(stats.avg)}. Accuracy: ${backtestResults.metrics?.accuracy.toFixed(1)}%`),
        getNarrativeSummary(committedSettings.filters.aiProvider, committedSettings.industryPrompt, stats.avg, stats.avg, committedSettings.horizon, committedSettings.audience, committedSettings.filters.skus),
        (async () => {
          try {
            const methodMetricsData = Array.from(backtestResults.methodMetrics?.entries() || []);
            const selectedMethodName = committedSettings.filters.methodology.split(' (')[0];
            const selectedMetrics = backtestResults.methodMetrics?.get(committedSettings.filters.methodology);
            const metricsInfo = methodMetricsData
              .map(([method, metrics]) => {
                const methodName = method.split(' (')[0];
                return `- ${methodName}: Accuracy ${metrics.accuracy.toFixed(1)}%, MAPE ${metrics.mape.toFixed(1)}%, RMSE ${metrics.rmse.toFixed(0)}, Bias ${metrics.bias.toFixed(1)}%`;
              })
              .join('\n');
            return await getMethodologyAssessment(committedSettings.filters.aiProvider, selectedMethodName, selectedMetrics, metricsInfo);
          } catch (error) {
            console.error('Error generating quality narrative:', error);
            return null;
          }
        })()
      ]);
      setAiInsight(insights);
      setNarrativeText(narrative);
      setQualityNarrative(qualityNarrative || '');
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
                // Auto-adjust forecast start date to be after this date (1st of next month)
                const endDate = new Date(e.target.value);
                const nextMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);
                const forecastDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
                setForecastStartMonth(forecastDate);
              }}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-100 outline-none focus:border-emerald-500 transition-all"
            />
            <p className="text-[7px] text-slate-600 font-medium italic">Last date to include in historical analysis</p>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Forecast Start Date</label>
            <input 
              type="date" 
              value={forecastStartMonth}
              onChange={(e) => setForecastStartMonth(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-100 outline-none focus:border-indigo-500 transition-all"
            />
            <p className="text-[7px] text-slate-600 font-medium italic">Start date for forecast period</p>
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
            {['future', 'inventory', 'financials', 'quality', 'sku-analysis', 'sandbox'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab === 'sku-analysis' ? 'SKU Analysis' : tab === 'sandbox' ? 'Sandbox' : tab}
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
                      <button onClick={() => setChartZoom({ startIndex: 0, endIndex: Math.max(40, aggregatedForecast.length - 1) })} className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-slate-300 transition-all">Reset Zoom</button>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-700/50">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Zoom Range</label>
                      <span className="text-[8px] text-slate-500">{chartZoom.startIndex} - {chartZoom.endIndex}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max={Math.max(0, aggregatedForecast.length - 1)} value={chartZoom.startIndex} onChange={(e) => {
                        const newStart = parseInt(e.target.value);
                        setChartZoom(prev => ({ startIndex: newStart, endIndex: Math.max(newStart + 10, prev.endIndex) }));
                      }} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                      <input type="range" min="0" max={Math.max(0, aggregatedForecast.length - 1)} value={chartZoom.endIndex} onChange={(e) => {
                        const newEnd = parseInt(e.target.value);
                        setChartZoom(prev => ({ startIndex: Math.min(newEnd - 10, prev.startIndex), endIndex: newEnd }));
                      }} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                    </div>
                  </div>
                  <div className="h-[400px] w-full" ref={chartContainerRef}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={[...downsampleData(aggregatedForecast.slice(chartZoom.startIndex, chartZoom.endIndex + 1), 1000)].sort((a, b) => a.date.localeCompare(b.date))} margin={{ left: 10, right: 10, top: 20 }}>
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
                      <BarChart data={monthlyFinancialData} margin={{ top: 20, right: 10, left: 10, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis 
                          dataKey="date" 
                          tick={{fontSize: 12, fill: '#ffffff', fontWeight: 'bold'}}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tickFormatter={formatDateForDisplay}
                        />
                        <YAxis 
                          tickFormatter={(val) => `$${(val / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}K`} 
                          tick={{fontSize: 12, fill: '#ffffff', fontWeight: 'bold'}} 
                        />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155'}} 
                          content={({active, payload}: any) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 shadow-xl">
                                  <p className="text-white text-[10px] font-bold mb-2">{formatDateForDisplay(data.date)}</p>
                                  <p className="text-amber-300 text-[9px] font-bold">Revenue: {formatCurrency(data.revenue)}</p>
                                  <p className="text-red-400 text-[9px] font-semibold">COGS: {formatCurrency(data.cogs)}</p>
                                  <p className="text-emerald-400 text-[9px] font-semibold">Margin: {formatCurrency(data.margin)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          height={24}
                          align="right"
                          iconType="square"
                          wrapperStyle={{fontSize: '13px', fontWeight: 900, textTransform: 'uppercase'}}
                        />
                        <Bar 
                          dataKey="cogs" 
                          name="Cost of Goods Sold" 
                          fill="#D97B7F"
                          stroke="#000000"
                          strokeWidth={1}
                          fillOpacity={1}
                          stackId="a"
                          radius={[0,0,0,0]}
                          label={(props: any) => {
                            const {x, y, width, height, value} = props;
                            const cogsK = formatNumber(Math.round(value / 1000));
                            const labelX = x + width / 2;
                            const labelY = y + height / 2 - 8;
                            return (
                              <g>
                                <rect x={labelX - 30} y={labelY - 10} width={60} height={22} fill="#ffffff" rx={3} />
                                <text 
                                  x={labelX} 
                                  y={labelY + 6} 
                                  textAnchor="middle" 
                                  fill="#000000" 
                                  fontSize={13}
                                  fontWeight="bold"
                                >
                                  ${cogsK}K
                                </text>
                              </g>
                            );
                          }}
                        />
                        <Bar 
                          dataKey="margin" 
                          name="Gross Margin" 
                          fill="#C1EFD5"
                          stroke="#000000"
                          strokeWidth={1}
                          fillOpacity={1}
                          stackId="a"
                          radius={[6,6,0,0]}
                          label={(props: any) => {
                            const {x, y, width, height, value} = props;
                            const marginK = formatNumber(Math.round(value / 1000));
                            const labelX = x + width / 2;
                            const labelY = y - 18;
                            return (
                              <g>
                                <rect x={labelX - 30} y={labelY - 10} width={60} height={22} fill="#ffffff" rx={3} />
                                <text 
                                  x={labelX} 
                                  y={labelY + 6} 
                                  textAnchor="middle" 
                                  fill="#000000" 
                                  fontSize={13}
                                  fontWeight="bold"
                                >
                                  ${marginK}K
                                </text>
                              </g>
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'quality' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* AI-Generated Quality Narrative */}
                <section className="bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-indigo-500/30 rounded-2xl p-8 shadow-lg">
                  <div className="mb-4">
                    <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Sparkles size={16} /> Methodology Assessment
                    </h2>
                    <p className="text-xs text-slate-400">AI-powered analysis of {committedSettings.filters.methodology.split(' (')[0]} performance vs competing methods</p>
                  </div>
                  {qualityNarrative ? (
                    <div className="text-slate-200 text-xs leading-relaxed font-medium">{qualityNarrative}</div>
                  ) : (
                    <div className="text-slate-400 text-xs italic">Run Analysis to generate AI-powered insights on methodology performance</div>
                  )}
                </section>

                {/* Quality Metrics & Chart Section */}

                <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricsCard label="Accuracy (Backtest)" value={`${backtestResults.qualityPageMetrics?.accuracy.toFixed(1) || 'N/A'}%`} description="Confidence against 6M holdout" tooltip="Percentage of total volume correctly forecast. Higher is better (100% = perfect)." />
                  <MetricsCard label="MAPE" value={`${backtestResults.qualityPageMetrics?.mape.toFixed(1) || 'N/A'}%`} description="Mean Absolute Percentage Error" tooltip="Average percentage difference between forecast and actual. Lower is better. <10% is excellent." />
                  <MetricsCard label="RMSE" value={formatNumber(backtestResults.qualityPageMetrics?.rmse || 0)} description="Root Mean Square Error" tooltip="Magnitude of forecast errors in absolute units. Lower is better. Penalizes large errors." />
                  <MetricsCard label="Bias Score" value={`${(backtestResults.qualityPageMetrics?.bias || 0).toFixed(1)}%`} description="Historical over/under skew" tooltip="% over/under forecast. Negative = under-forecast, Positive = over-forecast. Close to 0% is best." trend={backtestResults.qualityPageMetrics?.bias! > 0 ? "up" : "down"} />
                </section>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <section className="lg:col-span-8 bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Backtest Performance</h3>
                      <button onClick={() => setBacktestChartZoom({ startIndex: 0, endIndex: Math.max(0, (getQualityPageData(backtestResults.comparisonData || [], forecastStartMonth)?.length || 1) - 1) })} className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-slate-300 transition-all">Reset Zoom</button>
                    </div>
                    {backtestResults.comparisonData && backtestResults.comparisonData.length > 0 && (
                      <div className="bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-700/50">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Zoom Range</label>
                          <span className="text-[8px] text-slate-500">{backtestChartZoom.startIndex} - {backtestChartZoom.endIndex}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="range" min="0" max={Math.max(0, (getQualityPageData(backtestResults.comparisonData || [], forecastStartMonth)?.length || 1) - 1)} value={backtestChartZoom.startIndex} onChange={(e) => {
                            const newStart = parseInt(e.target.value);
                            setBacktestChartZoom(prev => ({ startIndex: newStart, endIndex: Math.max(newStart + 2, prev.endIndex) }));
                          }} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                          <input type="range" min="0" max={Math.max(0, (getQualityPageData(backtestResults.comparisonData || [], forecastStartMonth)?.length || 1) - 1)} value={backtestChartZoom.endIndex} onChange={(e) => {
                            const newEnd = parseInt(e.target.value);
                            setBacktestChartZoom(prev => ({ startIndex: Math.min(newEnd - 2, prev.startIndex), endIndex: newEnd }));
                          }} className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                        </div>
                      </div>
                    )}
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={[...(getQualityPageData(backtestResults.comparisonData || [], forecastStartMonth).slice(backtestChartZoom.startIndex, backtestChartZoom.endIndex + 1))].sort((a, b) => a.date.localeCompare(b.date))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis 
                            dataKey="date" 
                            tick={{fontSize: 12, fill: '#ffffff', fontWeight: 'bold'}}
                            tickFormatter={formatDateForDisplay}
                          />
                          <YAxis tickFormatter={(val) => formatNumber(val)} tick={{fontSize: 12, fill: '#ffffff', fontWeight: 'bold'}} />
                          <Tooltip 
                            contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155'}} 
                            content={(props: any) => {
                              if (!props.active || !props.payload || !props.payload.length) return null;
                              const payload = props.payload[0]?.payload;
                              if (!payload) return null;
                              const {actual, forecast} = payload;
                              const accuracy = actual && forecast ? Math.max(0, Math.min(100, (1 - Math.abs(actual - forecast) / Math.max(actual, 1)) * 100)) : 0;
                              return (
                                <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg text-xs space-y-1">
                                  <p className="text-white font-bold mb-2">{formatDateForDisplay(payload.date)}</p>
                                  <p className="text-slate-400">Actuals: <span className="text-blue-400 font-bold">{formatNumber(actual || 0)}</span></p>
                                  <p className="text-slate-400">Forecast ({committedSettings.filters.methodology.split(' (')[0]}): <span className="text-red-400 font-bold">{formatNumber(forecast || 0)}</span></p>
                                  <p className="text-slate-400">Accuracy: <span className="text-emerald-400 font-bold">{accuracy.toFixed(1)}%</span></p>
                                </div>
                              );
                            }}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}} />
                          <Bar dataKey="actual" name="Actual Demand" fill="#3b82f6" radius={[4,4,0,0]} barSize={30} />
                          <Line type="monotone" dataKey="forecast" name={`Forecast (${committedSettings.filters.methodology.split(' (')[0]})`} stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="lg:col-span-4 flex flex-col gap-6">
                    {backtestResults.testWindow?.startDate && (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-700">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Backtest Window</p>
                        <p className="text-[10px] text-slate-300">{backtestResults.testWindow.startDate} to {backtestResults.testWindow.endDate}</p>
                        <p className="text-[8px] text-slate-500 mt-1">6-month holdout period (1-month buffer excluded)</p>
                      </div>
                    )}
                    <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl flex-1">
                       <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Methodology Benchmark</h3>
                       <div className="space-y-3">
                         {Array.from(backtestResults.qualityPageMethodMetrics?.entries() || backtestResults.methodMetrics.entries())
                           .sort((a, b) => (b[1].accuracy || 0) - (a[1].accuracy || 0))
                           .map(([method, metrics]) => (
                           <div key={method} className={`p-3 rounded-xl border ${method === committedSettings.filters.methodology ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-slate-950 border-slate-800'}`}>
                             <div className="flex justify-between items-center mb-1">
                               <span className="text-[9px] font-black uppercase text-slate-300">{method.split(' (')[0]}</span>
                               <span className="text-[10px] font-black text-indigo-400">{metrics.accuracy?.toFixed(1) || 'N/A'}%</span>
                             </div>
                             <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                               <div className="bg-indigo-500 h-full" style={{width: `${metrics.accuracy || 0}%`}} />
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

                {/* Highest Error SKUs - moved after backtest performance */}
                <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Highest Error SKUs (Bottom 10)</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">Ranked by MAPE</span>
                      <button onClick={handleExportWorstSkus} className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all"><Download size={14}/> Export Forecast</button>
                    </div>
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

                {/* 6-Month Backtest Analysis Ribbon - moved to bottom */}
                <div className="bg-gradient-to-r from-indigo-600/20 to-emerald-600/20 border border-indigo-500/30 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">📊 6-Month Backtest Analysis</p>
                      <p className="text-base font-black text-white mb-1">
                        {getQualityPageData(backtestResults.comparisonData || [], forecastStartMonth)[0]?.date} to {getQualityPageData(backtestResults.comparisonData || [], forecastStartMonth)[getQualityPageData(backtestResults.comparisonData || [], forecastStartMonth).length - 1]?.date}
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Filtered to 6-month period preceding forecast start date. Includes accuracy, MAPE, RMSE, bias metrics and methodology benchmarks.
                      </p>
                    </div>
                    <button 
                      onClick={handleExportBacktestDetail}
                      className="flex-shrink-0 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 whitespace-nowrap"
                    >
                      <Download size={14} /> 
                      Export Detail
                    </button>
                  </div>
                </div>

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
                   <MetricsCard label="Safety Stock" value={formatNumber(aggregatedForecast[0]?.safetyStock || 0)} description="Standard deviation buffer" />
                   <MetricsCard label="Reorder Point" value={formatNumber(aggregatedForecast[0]?.reorderPoint || 0)} description="Replenishment trigger" />
                </section>
                <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Inventory Depletion Simulator</h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={[...downsampleData(aggregatedForecast.filter(f => f.isForecast), 1000)].sort((a, b) => a.date.localeCompare(b.date))}>
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
                  </div>
                  <p className="text-[10px] text-emerald-400 italic">✓ All inventory levels healthy</p>
                </section>
              </div>
            )}

            {activeTab === 'sku-analysis' && (
              <div className="space-y-6">
                {/* Date Range Indicator */}
                <div className="bg-gradient-to-r from-indigo-600/20 to-emerald-600/20 border border-indigo-500/30 rounded-2xl p-4 shadow-lg">
                  <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">📅 Analysis Period</p>
                  <p className="text-sm font-bold text-white">Historical Data: Full Dataset | Classifications based on complete demand history</p>
                </div>

                {/* ABC Pareto Stratification */}
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
                            content={(props: any) => {
                              if (!props.active || !props.payload || !props.payload.length) return null;
                              const payload = props.payload[0]?.payload;
                              if (!payload) return null;
                              return (
                                <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg text-xs space-y-1">
                                  <p className="text-white font-bold mb-2">{payload.sku}</p>
                                  <p className="text-slate-400">Volume: <span className="text-blue-400 font-bold">{formatNumber(payload.totalVolume)}</span></p>
                                  <p className="text-slate-400">Classification: <span className={`font-bold ${payload.grade === 'A' ? 'text-indigo-400' : payload.grade === 'B' ? 'text-orange-400' : 'text-slate-400'}`}>Class {payload.grade}</span></p>
                                </div>
                              );
                            }}
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

                {/* Volatility Analysis - moved underneath Pareto */}
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
                          content={(props: any) => {
                            if (!props.active || !props.payload || !props.payload.length) return null;
                            const payload = props.payload[0]?.payload;
                            if (!payload) return null;
                            return (
                              <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg text-xs space-y-1">
                                <p className="text-white font-bold mb-2">{payload.sku}</p>
                                <p className="text-slate-400">Volatility: <span className="text-orange-400 font-bold">{payload.volatility.toFixed(2)}%</span></p>
                                <p className="text-slate-400">Avg Qty: <span className="text-slate-300 font-bold">{formatNumber(payload.avgQuantity)}</span></p>
                                <p className="text-slate-400">Std Dev: <span className="text-slate-300 font-bold">{formatNumber(payload.stdDev)}</span></p>
                              </div>
                            );
                          }}
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
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Classification</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Volume</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Volatility %</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Avg Qty</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Std Dev</th>
                          <th className="text-center p-3 text-slate-500 font-black uppercase">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volatilityResults.map((item, i) => {
                          const paretoItem = paretoResults.find(p => p.sku === item.sku);
                          const classification = paretoItem?.grade || 'N/A';
                          const volume = paretoItem?.totalVolume || 0;
                          return (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all">
                              <td className="p-3 text-slate-300 font-bold">{item.sku}</td>
                              <td className="text-right p-3">
                                <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${classification === 'A' ? 'bg-indigo-500/20 text-indigo-400' : classification === 'B' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                  Class {classification}
                                </span>
                              </td>
                              <td className="text-right p-3 text-slate-400">{formatNumber(volume)}</td>
                              <td className="text-right p-3 text-slate-300">{item.volatility.toFixed(2)}%</td>
                              <td className="text-right p-3 text-slate-400">{formatNumber(item.avgQuantity)}</td>
                              <td className="text-right p-3 text-slate-400">{formatNumber(item.stdDev)}</td>
                              <td className="text-center p-3">
                                <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${item.volatility > 50 ? 'bg-red-500/20 text-red-400' : item.volatility > 30 ? 'bg-orange-500/20 text-orange-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                  {item.volatility > 50 ? 'High' : item.volatility > 30 ? 'Medium' : 'Low'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Portfolio Mix Changes - Historical vs Forecast */}
                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Portfolio Mix Changes</h3>
                  <p className="text-[10px] text-slate-400 mb-6 font-medium">Historical vs Forecast - SKUs that will shift in classification or volatility profile</p>
                  {portfolioChanges.length === 0 ? (
                    <div className="text-slate-400 text-xs italic py-8 text-center">No significant changes between historical and forecast portfolios</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[9px]">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="text-left p-3 text-slate-500 font-black uppercase">SKU</th>
                            <th className="text-center p-3 text-slate-500 font-black uppercase">ABC Change</th>
                            <th className="text-center p-3 text-slate-500 font-black uppercase">Volatility Risk Change</th>
                            <th className="text-left p-3 text-slate-500 font-black uppercase">Impact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolioChanges.map((change, i) => {
                            const isClassDowngrade = (change.historicalClass === 'A' && change.forecastClass === 'B') || 
                                                     (change.historicalClass === 'A' && change.forecastClass === 'C') || 
                                                     (change.historicalClass === 'B' && change.forecastClass === 'C');
                            const isClassUpgrade = (change.historicalClass === 'B' && change.forecastClass === 'A') || 
                                                   (change.historicalClass === 'C' && change.forecastClass === 'A') || 
                                                   (change.historicalClass === 'C' && change.forecastClass === 'B');
                            const isVolatilityWorse = ['Low', 'Medium'].includes(change.historicalVolatilityRisk) && change.forecastVolatilityRisk === 'High';
                            
                            return (
                              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all">
                                <td className="p-3 text-slate-300 font-bold">{change.sku}</td>
                                <td className="text-center p-3">
                                  {change.classChange !== 'No change' ? (
                                    <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase inline-block ${isClassDowngrade ? 'bg-red-500/20 text-red-400' : isClassUpgrade ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                      {change.classChange}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 text-[8px]">-</span>
                                  )}
                                </td>
                                <td className="text-center p-3">
                                  {change.volatilityChange !== 'No change' ? (
                                    <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase inline-block ${isVolatilityWorse ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                      {change.volatilityChange}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 text-[8px]">-</span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-400 text-[8px]">
                                  {isClassDowngrade && 'Priority decrease - reduce safety stock'}
                                  {isClassUpgrade && 'Priority increase - boost planning'}
                                  {isVolatilityWorse && !isClassDowngrade && !isClassUpgrade && 'Increased volatility expected - monitor closely'}
                                  {!isClassDowngrade && !isClassUpgrade && !isVolatilityWorse && 'Risk profile change'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'sandbox' && (
              <div className="space-y-6">
                {/* Analysis Period Memo */}
                <section className="bg-gradient-to-r from-slate-950 to-slate-900 p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                      <Calendar size={20} className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Analysis Period</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Historical Data Window</p>
                          <p className="text-sm text-slate-200">
                            <span className="text-blue-400 font-bold">{new Date(new Date(historicalDataEndDate).getTime() - committedSettings.horizon * 30.44 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            <span className="text-slate-500 mx-2">→</span>
                            <span className="text-blue-400 font-bold">{new Date(historicalDataEndDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          </p>
                          <p className="text-[9px] text-slate-500">({committedSettings.horizon} months) • Basis for volatility calculations</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Forecast Period</p>
                          <p className="text-sm text-slate-200">
                            <span className="text-emerald-400 font-bold">{new Date(forecastStartMonth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            <span className="text-slate-500 mx-2">→</span>
                            <span className="text-emerald-400 font-bold">{new Date(new Date(forecastStartMonth).getTime() + committedSettings.horizon * 30.44 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          </p>
                          <p className="text-[9px] text-slate-500">({committedSettings.horizon} months) • Forecast horizon</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Portfolio Transformation Matrix */}
                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">ABC Analysis - Portfolio Transformation</h3>
                  {/* Reorganized Portfolio Matrix: Charts on top, Counts below */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Historical Column */}
                    <div className="space-y-4">
                      {/* Historical Title - Centered */}
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest text-center">Historical</h4>
                      
                      {/* Historical Stacked Chart */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={[
                            {
                              period: 'Volume',
                              A: paretoResults.filter(p => p.grade === 'A').reduce((sum, p) => sum + (p.totalVolume || 0), 0),
                              B: paretoResults.filter(p => p.grade === 'B').reduce((sum, p) => sum + (p.totalVolume || 0), 0),
                              C: paretoResults.filter(p => p.grade === 'C').reduce((sum, p) => sum + (p.totalVolume || 0), 0)
                            }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="period" stroke="#ffffff" tick={{fontSize: 11, fontWeight: 'bold'}} />
                            <YAxis stroke="#ffffff" tick={{fontSize: 10, fontWeight: 'bold', fill: '#ffffff'}} tickFormatter={(value) => {
                              return value >= 1000000 ? `${(value / 1000000).toFixed(0)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString();
                            }} />
                            <Tooltip 
                              contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '8px'}}
                              labelStyle={{color: '#ffffff', fontSize: '10px', fontWeight: 'bold'}}
                              content={({ active, payload }: any) => {
                                if (active && payload && payload.length > 0) {
                                  const data = payload[0].payload;
                                  const total = (data.A || 0) + (data.B || 0) + (data.C || 0);
                                  return (
                                    <div className="bg-slate-950 border border-slate-700 rounded p-2 text-[9px] space-y-1">
                                      <div className="text-slate-300 font-bold mb-1">Volume Breakdown:</div>
                                      {['A', 'B', 'C'].map(cls => {
                                        const value = data[cls] || 0;
                                        const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                                        const color = cls === 'A' ? '#6366f1' : cls === 'B' ? '#fb923c' : '#475569';
                                        return (
                                          <div key={cls} style={{color}}>
                                            Class {cls}: {formatNumber(value)} ({percent}%)
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                            <Bar dataKey="A" stackId="volume" fill="#6366f1" name="Class A" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="B" stackId="volume" fill="#fb923c" name="Class B" />
                            <Bar dataKey="C" stackId="volume" fill="#475569" name="Class C" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Historical Counts */}
                      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                        <div className="space-y-4">
                          {['A', 'B', 'C'].map(grade => {
                            const count = paretoResults.filter(p => p.grade === grade).length;
                            const volume = paretoResults.filter(p => p.grade === grade).reduce((sum, p) => sum + (p.totalVolume || 0), 0);
                            const color = grade === 'A' ? '#6366f1' : grade === 'B' ? '#fb923c' : '#475569';
                            return (
                              <div key={grade} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded" style={{backgroundColor: color}} />
                                  <div>
                                    <p className="text-[12px] font-black text-white">Class {grade}</p>
                                    <p className="text-[9px] text-slate-400">{formatNumber(volume)}</p>
                                  </div>
                                </div>
                                <span className="text-[16px] font-black text-white">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Category Shifts Column - Centered & Expanded */}
                    <div className="flex flex-col items-center h-full">
                      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 w-full h-full flex flex-col">
                        <h4 className="text-[11px] font-black text-white uppercase tracking-widest text-center mb-5">Category Shifts</h4>
                        <div className="space-y-4 flex-1 flex flex-col justify-start">
                          {transformationMatrix.length === 0 ? (
                            <p className="text-[10px] text-slate-500 italic text-center">No category changes</p>
                          ) : (
                            transformationMatrix.map((shift, idx) => (
                              <div key={idx} className="bg-slate-900 p-4 rounded-lg border border-slate-700 group relative cursor-help">
                                <div className="flex items-center justify-center mb-2">
                                  <span className="text-[10px] font-bold text-slate-300 flex items-center gap-2">
                                    <span className={`flex items-center justify-center w-9 h-9 rounded text-[13px] font-black ${shift.from === 'A' ? 'bg-indigo-600' : shift.from === 'B' ? 'bg-orange-600' : 'bg-slate-600'}`}>{shift.from}</span>
                                    <span className="text-[18px] leading-none">→</span>
                                    <span className={`flex items-center justify-center w-9 h-9 rounded text-[13px] font-black ${shift.to === 'A' ? 'bg-indigo-600' : shift.to === 'B' ? 'bg-orange-600' : 'bg-slate-600'}`}>{shift.to}</span>
                                  </span>
                                </div>
                                <p className="text-[12px] font-black text-indigo-400 text-center">{shift.count} SKU{shift.count !== 1 ? 's' : ''}</p>
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-950 border border-slate-700 rounded text-[9px] text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                                  Volume: {shift.volumeShift > 0 ? '+' : ''}{formatNumber(shift.volumeShift)}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Forecasted Column */}
                    <div className="space-y-4">
                      {/* Forecasted Title - Centered */}
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest text-center">Forecasted</h4>
                      
                      {/* Forecasted Stacked Chart */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={[
                            {
                              period: 'Volume',
                              A: forecastParetoResults.filter(p => p.grade === 'A').reduce((sum, p) => sum + (p.totalVolume || 0), 0),
                              B: forecastParetoResults.filter(p => p.grade === 'B').reduce((sum, p) => sum + (p.totalVolume || 0), 0),
                              C: forecastParetoResults.filter(p => p.grade === 'C').reduce((sum, p) => sum + (p.totalVolume || 0), 0)
                            }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="period" stroke="#ffffff" tick={{fontSize: 11, fontWeight: 'bold'}} />
                            <YAxis stroke="#ffffff" tick={{fontSize: 10, fontWeight: 'bold', fill: '#ffffff'}} tickFormatter={(value) => {
                              return value >= 1000000 ? `${(value / 1000000).toFixed(0)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString();
                            }} />
                            <Tooltip 
                              contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '8px'}}
                              labelStyle={{color: '#ffffff', fontSize: '10px', fontWeight: 'bold'}}
                              content={({ active, payload }: any) => {
                                if (active && payload && payload.length > 0) {
                                  const data = payload[0].payload;
                                  const total = (data.A || 0) + (data.B || 0) + (data.C || 0);
                                  return (
                                    <div className="bg-slate-950 border border-slate-700 rounded p-2 text-[9px] space-y-1">
                                      <div className="text-slate-300 font-bold mb-1">Volume Breakdown:</div>
                                      {['A', 'B', 'C'].map(cls => {
                                        const value = data[cls] || 0;
                                        const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                                        const color = cls === 'A' ? '#6366f1' : cls === 'B' ? '#fb923c' : '#475569';
                                        return (
                                          <div key={cls} style={{color}}>
                                            Class {cls}: {formatNumber(value)} ({percent}%)
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                            <Bar dataKey="A" stackId="volume" fill="#6366f1" name="Class A" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="B" stackId="volume" fill="#fb923c" name="Class B" />
                            <Bar dataKey="C" stackId="volume" fill="#475569" name="Class C" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Forecasted Counts */}
                      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                        <div className="space-y-4">
                          {['A', 'B', 'C'].map(grade => {
                            const count = forecastParetoResults.filter(p => p.grade === grade).length;
                            const volume = forecastParetoResults.filter(p => p.grade === grade).reduce((sum, p) => sum + (p.totalVolume || 0), 0);
                            const color = grade === 'A' ? '#6366f1' : grade === 'B' ? '#fb923c' : '#475569';
                            return (
                              <div key={grade} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded" style={{backgroundColor: color}} />
                                  <div>
                                    <p className="text-[12px] font-black text-white">Class {grade}</p>
                                    <p className="text-[9px] text-slate-400">{formatNumber(volume)}</p>
                                  </div>
                                </div>
                                <span className="text-[16px] font-black text-white">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* SKU Volatility Comparison - Historical vs Projected */}
                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">SKU Volatility Analysis</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Coefficient of Variation - Historic vs Projected demand patterns</p>
                    </div>
                    <button onClick={() => setVolatilityChartZoom({ startIndex: 0, endIndex: Math.min(7, volatilityResults.length - 1) })} className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-slate-300 transition-all">Reset Zoom</button>
                  </div>
                  {volatilityResults.length > 0 && (
                    <div className="bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-700/50">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Zoom Range</label>
                        <span className="text-[8px] text-slate-500">{volatilityChartZoom.startIndex + 1} - {Math.min(volatilityChartZoom.endIndex + 1, volatilityResults.length)} of {volatilityResults.length} SKUs</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min="0" 
                          max={Math.max(0, volatilityResults.length - 1)} 
                          value={volatilityChartZoom.startIndex} 
                          onChange={(e) => {
                            const newStart = parseInt(e.target.value);
                            setVolatilityChartZoom(prev => ({ startIndex: newStart, endIndex: Math.max(newStart + 7, prev.endIndex) }));
                          }} 
                          className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                        />
                        <input 
                          type="range" 
                          min="0" 
                          max={Math.max(0, volatilityResults.length - 1)} 
                          value={volatilityChartZoom.endIndex} 
                          onChange={(e) => {
                            const newEnd = parseInt(e.target.value);
                            setVolatilityChartZoom(prev => ({ startIndex: Math.max(0, Math.min(newEnd - 7, prev.startIndex)), endIndex: newEnd }));
                          }} 
                          className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                        />
                      </div>
                    </div>
                  )}
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={volatilityResults.slice(volatilityChartZoom.startIndex, volatilityChartZoom.endIndex + 1).map(item => {
                          const forecastItem = forecastVolatilityResults.find(f => f.sku === item.sku);
                          return {
                            sku: item.sku,
                            Historic: item.volatility,
                            Projected: forecastItem?.volatility || 0
                          };
                        })}
                        layout="vertical"
                        barGap="20%"
                        barCategoryGap="30%"
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                        <XAxis type="number" tickFormatter={(val) => `${val.toFixed(0)}%`} tick={{fontSize: 12, fill: '#ffffff', fontWeight: 'bold'}} />
                        <YAxis dataKey="sku" type="category" width={60} tick={{fontSize: 12, fill: '#ffffff', fontWeight: 'bold'}} />
                        <Tooltip 
                          content={(props: any) => {
                            if (!props.active || !props.payload || !props.payload.length) return null;
                            const payload = props.payload[0]?.payload;
                            if (!payload) return null;
                            return (
                              <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg text-xs space-y-1">
                                <p className="text-white font-bold mb-2">{payload.sku}</p>
                                <p className="text-slate-400">Historic Volatility: <span className="text-blue-400 font-bold">{payload.Historic.toFixed(2)}%</span></p>
                                <p className="text-slate-400">Projected Volatility: <span className="text-red-400 font-bold">{payload.Projected.toFixed(2)}%</span></p>
                                <p className="text-slate-400">Change: <span className={`font-bold ${payload.Projected > payload.Historic ? 'text-red-400' : 'text-emerald-400'}`}>{(payload.Projected - payload.Historic).toFixed(2)}%</span></p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="Historic" fill="#3b82f6" name="Historic" />
                        <Bar dataKey="Projected" fill="#ef4444" name="Projected" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Consolidated Volatility & Portfolio Mix Table */}
                <section className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">SKU Analysis - Volatility & Portfolio Mix</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Consolidated view of volatility rankings with portfolio transformation insights</p>
                    </div>
                    <button 
                      onClick={() => {
                        const headers = ['SKU', 'ABC Class', 'Volatility %', 'Risk', 'ABC Change', 'Volatility Change'];
                        const rows = volatilityResults.map(item => {
                          const paretoItem = paretoResults.find(p => p.sku === item.sku);
                          const portChange = portfolioChanges.find(p => p.sku === item.sku);
                          return [
                            item.sku,
                            paretoItem?.grade || 'N/A',
                            item.volatility.toFixed(2),
                            item.volatility > 50 ? 'High' : item.volatility > 30 ? 'Medium' : 'Low',
                            portChange?.classChange || 'No change',
                            portChange?.volatilityChange || 'No change'
                          ];
                        });
                        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `sku-volatility-portfolio-mix-${new Date().toISOString().split('T')[0]}.csv`;
                        link.click();
                      }}
                      className="px-4 py-2 bg-emerald-600 border border-emerald-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px]">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left p-3 text-slate-500 font-black uppercase">SKU</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">ABC</th>
                          <th className="text-right p-3 text-slate-500 font-black uppercase">Volatility %</th>
                          <th className="text-center p-3 text-slate-500 font-black uppercase">Risk</th>
                          <th className="text-center p-3 text-slate-500 font-black uppercase">ABC Change</th>
                          <th className="text-center p-3 text-slate-500 font-black uppercase">Volatility Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volatilityResults.map((item, i) => {
                          const paretoItem = paretoResults.find(p => p.sku === item.sku);
                          const portChange = portfolioChanges.find(p => p.sku === item.sku);
                          const classification = paretoItem?.grade || 'N/A';
                          const isClassDowngrade = portChange && ((portChange.historicalClass === 'A' && portChange.forecastClass === 'B') || 
                                                   (portChange.historicalClass === 'A' && portChange.forecastClass === 'C') || 
                                                   (portChange.historicalClass === 'B' && portChange.forecastClass === 'C'));
                          const isClassUpgrade = portChange && ((portChange.historicalClass === 'B' && portChange.forecastClass === 'A') || 
                                                   (portChange.historicalClass === 'C' && portChange.forecastClass === 'A') || 
                                                   (portChange.historicalClass === 'C' && portChange.forecastClass === 'B'));
                          const isVolatilityWorse = portChange && ['Low', 'Medium'].includes(portChange.historicalVolatilityRisk) && portChange.forecastVolatilityRisk === 'High';
                          
                          return (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all">
                              <td className="p-3 text-slate-300 font-bold">{item.sku}</td>
                              <td className="text-right p-3">
                                <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${classification === 'A' ? 'bg-indigo-500/20 text-indigo-400' : classification === 'B' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                  {classification}
                                </span>
                              </td>
                              <td className="text-right p-3 text-slate-300 font-bold">{item.volatility.toFixed(2)}%</td>
                              <td className="text-center p-3">
                                <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${item.volatility > 50 ? 'bg-red-500/20 text-red-400' : item.volatility > 30 ? 'bg-orange-500/20 text-orange-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                  {item.volatility > 50 ? 'High' : item.volatility > 30 ? 'Medium' : 'Low'}
                                </span>
                              </td>
                              <td className="text-center p-3">
                                {portChange?.classChange && portChange.classChange !== 'No change' ? (
                                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${isClassDowngrade ? 'bg-red-500/20 text-red-400' : isClassUpgrade ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                    {portChange.classChange}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[8px]">-</span>
                                )}
                              </td>
                              <td className="text-center p-3">
                                {portChange?.volatilityChange && portChange.volatilityChange !== 'No change' ? (
                                  <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${isVolatilityWorse ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                    {portChange.volatilityChange}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[8px]">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
        
        <ChatAgent provider={committedSettings.filters.aiProvider} audience={committedSettings.audience} context={{}} hasRunAnalysis={committedSettings.triggerToken} />
        <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} data={reportData} isLoading={isReportLoading} />
        <SchemaModal isOpen={isSchemaModalOpen} onClose={() => setIsSchemaModalOpen(false)} />
      </main>
    </div>
  );
};

export default App;