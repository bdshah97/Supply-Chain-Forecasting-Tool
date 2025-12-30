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
import { DataPoint, FilterState, TimeInterval, ForecastMethodology, ProductAttribute, InventoryLevel, Scenario, AiProvider, AudienceType, OnePagerData } from './types';
import { calculateForecast, calculateMetrics, cleanAnomalies } from './utils/forecasting';
import { calculateSupplyChainMetrics, runParetoAnalysis } from './utils/supplyChain';
import { exportToCSV } from './utils/export';
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

const METHOD_DESCRIPTIONS: Record<ForecastMethodology, string> = {
  [ForecastMethodology.HOLT_WINTERS]: "Triple exponential smoothing (Level, Trend, Seasonality). Best for distinct seasonal patterns.",
  [ForecastMethodology.PROPHET]: "Additive model decomposition. Robust against missing data and outliers.",
  [ForecastMethodology.ARIMA]: "Focuses on autocorrelation and moving averages. Best for stable, trending demand.",
  [ForecastMethodology.LINEAR]: "Simple regression fitting a straight line. Ideal for long-term structural drift identification."
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
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [draftIndustryPrompt, setDraftIndustryPrompt] = useState('Global manufacturer of industrial sensors');
  const [draftHorizon, setDraftHorizon] = useState(DEFAULT_HORIZON);
  const [draftAudience, setDraftAudience] = useState<AudienceType>(AudienceType.EXECUTIVE);
  const [filters, setFilters] = useState<FilterState>({
    startDate: '2021-01-01', endDate: '2024-05-01', skus: SKUS, category: 'All',
    confidenceLevel: 95, methodology: ForecastMethodology.HOLT_WINTERS,
    includeExternalTrends: false, globalLeadTime: 30, globalServiceLevel: 0.95,
    applyAnomalyCleaning: false, showLeadTimeOffset: false, aiProvider: AiProvider.GEMINI,
    supplierVolatility: 0
  });
  
  const [committedSettings, setCommittedSettings] = useState({ filters: { ...filters }, horizon: draftHorizon, industryPrompt: draftIndustryPrompt, audience: draftAudience, triggerToken: 0 });
  const [activeTab, setActiveTab] = useState<'future' | 'quality' | 'inventory' | 'financials' | 'pareto'>('future');
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

  const histUploadRef = useRef<HTMLInputElement>(null);
  const attrUploadRef = useRef<HTMLInputElement>(null);
  const invUploadRef = useRef<HTMLInputElement>(null);

  const handleRunAnalysis = () => setCommittedSettings({ filters: { ...filters }, horizon: draftHorizon, industryPrompt: draftIndustryPrompt, audience: draftAudience, triggerToken: Date.now() });

  const handleFileUpload = (type: 'hist' | 'inv' | 'attr', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (type === 'hist') {
        const newData = lines.slice(1).filter(l => l.includes(',')).map(line => {
          const p = line.split(','); return { date: p[0].trim(), sku: p[1].trim(), category: p[2].trim(), quantity: parseInt(p[3].trim()) || 0 };
        });
        if (newData.length > 0) setData(newData);
      } else if (type === 'inv') {
        const newInv = lines.slice(1).filter(l => l.includes(',')).map(line => {
          const p = line.split(','); return { sku: p[0].trim(), onHand: parseInt(p[1].trim()) || 0, lastUpdated: new Date().toISOString() } as InventoryLevel;
        });
        if (newInv.length > 0) setInventory(newInv);
      } else if (type === 'attr') {
        const newAttr = lines.slice(1).filter(l => l.includes(',')).map(line => {
          const p = line.split(','); return { sku: p[0].trim(), category: p[1].trim(), leadTimeDays: parseInt(p[2].trim()) || 30, unitCost: parseFloat(p[3].trim()) || 10, sellingPrice: parseFloat(p[4].trim()) || 15, serviceLevel: parseFloat(p[5].trim()) || 0.95 } as ProductAttribute;
        });
        if (newAttr.length > 0) setAttributes(newAttr);
      }
    };
    reader.readAsText(file);
  };

  const processedData = useMemo(() => {
    let d = committedSettings.filters.applyAnomalyCleaning ? cleanAnomalies(data) : data;
    return d.filter(item => {
      const itemDate = new Date(item.date).getTime();
      const start = new Date(committedSettings.filters.startDate).getTime();
      const end = new Date(committedSettings.filters.endDate).getTime();
      const matchesDate = itemDate >= start && itemDate <= end;
      const matchesSku = committedSettings.filters.skus.length === 0 || committedSettings.filters.skus.includes(item.sku);
      const matchesCategory = committedSettings.filters.category === 'All' || item.category === committedSettings.filters.category;
      return matchesDate && matchesSku && matchesCategory;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, committedSettings]);

  const aggregatedData = useMemo(() => {
    const map = new Map<string, number>();
    processedData.forEach(d => map.set(d.date, (map.get(d.date) || 0) + d.quantity));
    return Array.from(map.entries()).map(([date, quantity]) => ({ date, quantity, sku: 'ALL', category: 'ALL' } as DataPoint)).sort((a, b) => a.date.localeCompare(b.date));
  }, [processedData]);

  const stats = useMemo(() => {
    const values = aggregatedData.map(d => d.quantity);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const std = values.length > 0 ? Math.sqrt(values.reduce((sq, x) => sq + Math.pow(x - avg, 2), 0) / values.length) : 0;
    return { avg, std };
  }, [aggregatedData]);

  const futureForecast = useMemo(() => {
    if (aggregatedData.length === 0) return [];
    let raw = calculateForecast(aggregatedData, committedSettings.horizon, 'monthly', committedSettings.filters.confidenceLevel, committedSettings.filters.methodology);
    if (committedSettings.filters.includeExternalTrends && marketAdj) {
      raw = raw.map(p => p.isForecast ? { ...p, forecast: Math.round(p.forecast * marketAdj.multiplier) } : p);
    }
    const currentInv = inventory.filter(i => committedSettings.filters.skus.includes(i.sku)).reduce((s, i) => s + i.onHand, 0);
    return calculateSupplyChainMetrics(
      raw, 
      stats.std, 
      committedSettings.filters.globalLeadTime, 
      committedSettings.filters.globalServiceLevel, 
      currentInv, 
      scenarios, 
      committedSettings.filters.showLeadTimeOffset,
      committedSettings.filters.supplierVolatility,
      attributes
    );
  }, [aggregatedData, committedSettings, marketAdj, stats.std, inventory, scenarios, attributes]);

  const financialStats = useMemo(() => {
    const forecastOnly = futureForecast.filter(f => f.isForecast);
    const totalRevenue = Math.round(forecastOnly.reduce((s, f) => s + (f.projectedRevenue || 0), 0));
    const totalMargin = Math.round(forecastOnly.reduce((s, f) => s + (f.projectedMargin || 0), 0));
    const avgInventoryValue = Math.round(forecastOnly.reduce((s, f) => s + (f.inventoryValue || 0), 0) / (forecastOnly.length || 1));
    const valueAtRisk = Math.round(totalRevenue * (committedSettings.filters.supplierVolatility * 0.25));
    return { totalRevenue, totalMargin, avgInventoryValue, valueAtRisk };
  }, [futureForecast, committedSettings]);

  const backtestResults = useMemo(() => {
    if (aggregatedData.length <= 8) return { comparisonData: [], metrics: null, modelComparison: [], backtestForecast: [] };
    const splitIndex = aggregatedData.length - 6;
    const trainData = aggregatedData.slice(0, splitIndex);
    const actualTestData = aggregatedData.slice(splitIndex);

    const testForecast = calculateForecast(trainData, 6, 'monthly', committedSettings.filters.confidenceLevel, committedSettings.filters.methodology);
    const backtestOnly = testForecast.filter(f => f.isForecast).map((f, i) => ({
      ...f,
      actual: actualTestData[i]?.quantity || null
    }));

    const modelComparison = Object.values(ForecastMethodology).map(m => {
      const f = calculateForecast(trainData, 6, 'monthly', committedSettings.filters.confidenceLevel, m).filter(x => x.isForecast).map(x => x.forecast);
      const mtr = calculateMetrics(actualTestData.map(d => d.quantity), f, 1, 1);
      return { method: m, mape: mtr.mape, accuracy: mtr.accuracy, rmse: mtr.rmse, bias: mtr.bias };
    });

    const currentMethodMetrics = modelComparison.find(m => m.method === committedSettings.filters.methodology);
    return { comparisonData: backtestOnly, metrics: currentMethodMetrics || null, modelComparison, backtestForecast: testForecast };
  }, [aggregatedData, committedSettings]);

  const runRca = async () => {
    setIsRcaLoading(true);
    const outliers = aggregatedData.filter(d => Math.abs(d.quantity - stats.avg) > stats.std * 1.5);
    const analysis = await getAnomalyAnalysis(committedSettings.filters.aiProvider, committedSettings.industryPrompt, outliers.slice(-5));
    setAnomalyRca(analysis);
    setIsRcaLoading(false);
  };

  const handleExport = () => {
    exportToCSV(futureForecast, `forecast_${committedSettings.industryPrompt.replace(/\s+/g, '_').toLowerCase()}`);
  };

  const paretoResults = useMemo(() => {
    const skuMap = new Map<string, number>();
    data.forEach(d => {
       const matchesCategory = committedSettings.filters.category === 'All' || d.category === committedSettings.filters.category;
       if (matchesCategory) {
         skuMap.set(d.sku, (skuMap.get(d.sku) || 0) + d.quantity);
       }
    });
    return runParetoAnalysis(Array.from(skuMap.entries()).map(([sku, totalVolume]) => ({ sku, totalVolume })));
  }, [data, committedSettings.filters.category]);

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

  useEffect(() => {
    if (committedSettings.triggerToken === 0) return;
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

  const selectAllSkus = () => setFilters(f => ({ ...f, skus: SKUS }));
  const clearSkus = () => setFilters(f => ({ ...f, skus: [] }));

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950 font-sans text-slate-100 overflow-hidden">
      <aside className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-5 flex flex-col gap-4 h-screen overflow-y-auto no-scrollbar z-30 shadow-2xl shrink-0">
        <div className="mb-2">
          {/* Refined SSA & Company Brand Logo with Serif Font */}
          <svg viewBox="0 0 350 50" className="w-full h-auto text-[#002855]" xmlns="http://www.w3.org/2000/svg">
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
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => histUploadRef.current?.click()} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:border-indigo-500 transition-all flex flex-col items-center gap-1 group">
              <FileText size={12} className="text-indigo-400 group-hover:scale-110 transition-transform"/><span className="text-[7px] font-black uppercase">Sales</span>
            </button>
            <button onClick={() => attrUploadRef.current?.click()} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:border-emerald-500 transition-all flex flex-col items-center gap-1 group">
              <Truck size={12} className="text-emerald-400 group-hover:scale-110 transition-transform"/><span className="text-[7px] font-black uppercase">Parts</span>
            </button>
            <button onClick={() => invUploadRef.current?.click()} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:border-orange-500 transition-all flex flex-col items-center gap-1 group">
              <Package size={12} className="text-orange-400 group-hover:scale-110 transition-transform"/><span className="text-[7px] font-black uppercase">Stock</span>
            </button>
          </div>
          <input type="file" ref={histUploadRef} className="hidden" onChange={e => handleFileUpload('hist', e)} />
          <input type="file" ref={attrUploadRef} className="hidden" onChange={e => handleFileUpload('attr', e)} />
          <input type="file" ref={invUploadRef} className="hidden" onChange={e => handleFileUpload('inv', e)} />
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

        <div className="mt-auto pt-3 border-t border-slate-800">
          <button onClick={handleRunAnalysis} disabled={isLoading} className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-all ${isLoading ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-indigo-600/10'}`}>
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />} {isLoading ? "Syncing..." : "Run Analysis"}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 bg-slate-950 no-scrollbar relative">
        <header className="bg-slate-900 p-4 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
            {['future', 'inventory', 'financials', 'quality', 'pareto'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} disabled={committedSettings.triggerToken === 0} className="px-5 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all disabled:opacity-50"><Download size={14}/> Export CSV</button>
            <button onClick={handleGenerateReport} disabled={committedSettings.triggerToken === 0} className="px-5 py-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600/20 transition-all disabled:opacity-50"><FileOutput size={14}/> Generate Brief</button>
          </div>
        </header>

        <section className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-6 rounded-[2.5rem] grid grid-cols-1 lg:grid-cols-2 gap-8 shadow-2xl animate-in fade-in duration-500 relative z-40">
           <div className="w-full">
              <MultiSearchableSelect 
                options={SKUS}
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
                options={CATEGORIES}
                value={filters.category}
                onChange={(val) => setFilters(f => ({ ...f, category: val }))}
                placeholder="All Categories"
                label="Category Search"
                icon={<Search size={12} className="text-emerald-400" />}
              />
           </div>
        </section>

        {committedSettings.triggerToken === 0 ? (
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
                    <div className="flex items-center gap-3 px-4 py-1.5 bg-indigo-600/10 border border-indigo-500/20 rounded-full">
                      <Zap size={12} className="text-indigo-400" />
                      <span className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Model: {committedSettings.filters.methodology.split(' (')[0]}</span>
                    </div>
                  </div>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={futureForecast} margin={{ left: 10, right: 10, top: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b', fontWeight: 700}} />
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
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={futureForecast.filter(f => f.isForecast)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="date" tick={{fontSize: 9}} />
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
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={backtestResults.comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                          <XAxis dataKey="date" tick={{fontSize: 9}} />
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
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={futureForecast.filter(f => f.isForecast)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="date" tick={{fontSize: 9}} />
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
              </div>
            )}

            {activeTab === 'pareto' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">ABC Pareto Stratification</h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={paretoResults.slice(0, 15)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="sku" angle={-45} textAnchor="end" tick={{fontSize: 8}} />
                        <YAxis tickFormatter={(val) => formatNumber(val)} tick={{fontSize: 9}} />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px'}} 
                          formatter={(val: number) => [formatNumber(val), 'Volume']}
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
          </div>
        )}
        
        <ChatAgent provider={committedSettings.filters.aiProvider} audience={committedSettings.audience} context={dashboardContext} />
        <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} data={reportData} isLoading={isReportLoading} />
        <SchemaModal isOpen={isSchemaModalOpen} onClose={() => setIsSchemaModalOpen(false)} />
      </main>
    </div>
  );
};

export default App;