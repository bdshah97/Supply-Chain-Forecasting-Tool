# Supply Chain Forecasting Tool - System Prompt for AI Development

**Last Updated:** January 22, 2026  
**Build Status:** ✅ Stable (3543 lines, Zero TypeScript errors)  
**Framework:** React 19 + TypeScript + Vite + Recharts

---

## 1. PROJECT OVERVIEW

### Purpose
Supply Chain Forecasting Tool (SCPT) is an AI-powered predictive supply chain management platform enabling demand forecasting, inventory optimization, production planning, and portfolio analysis through 4 distinct forecasting methodologies.

### Core Value Proposition
- **Dual-layer Analysis**: Combines statistical forecasting with supply chain optimization
- **Portfolio Intelligence**: ABC segmentation with volatility ranking and transformation tracking
- **Production Integration**: Real-time inventory projections factoring incoming POs and production orders
- **Enterprise AI**: Multi-provider support (Claude, OpenAI, Gemini) with role-based insights

### Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Recharts
- **Build**: Vite (6.59s production builds)
- **Charting**: Recharts with custom tooltip components
- **APIs**: Gemini, OpenAI, Anthropic (via services/aiService.ts)
- **Export**: CSV with date-stamped filenames

---

## 2. APPLICATION ARCHITECTURE

### File Structure & Key Components

```
App.tsx (3543 lines)
├── Main state management (5 tabs: Future, Financials, Quality, Inventory, Sandbox)
├── Data upload handlers (CSV parsing, date normalization, CSV formatting)
├── Forecast & metrics calculation orchestration
├── AI service integration (industry insights, market adjustments, RCA)
├── Chart rendering with custom tooltips
└── Export functionality for alerts, forecasts, bulk data, and analysis tables

components/
├── ChatAgent.tsx          # AI chat interface with context awareness
├── ReportModal.tsx        # Print-optimized executive one-pager
├── MetricsCard.tsx        # KPI display components
├── InfoTooltip.tsx        # Portal-based hover tooltips with hover-bridge
└── ReportModal.tsx        # Print-friendly modal for one-pager reports

services/
├── aiService.ts           # Gemini/OpenAI/Claude integration patterns
└── geminiService.ts       # Direct Gemini API calls with search grounding

utils/
├── forecasting.ts         # 4 forecasting methods (HW, Prophet, ARIMA, LR)
├── supplyChain.ts         # Safety stock, ROP, ABC Pareto, production integration
├── export.ts              # CSV export formatters for all data types
└── (optional) Type helpers & validation utilities

types.ts                    # TypeScript interfaces for all data structures
constants.ts               # Sample data (SKUS, CATEGORIES, SAMPLE_DATA)
```

---

## 3. CORE FUNCTIONALITY

### 3.1 The 5 Tabs

#### Tab 1: **Future** (Demand Forecasting)
- Upload historical sales data (Date, SKU, Category, Quantity)
- Select forecasting method (Holt-Winters, Prophet, ARIMA, Linear Regression)
- Adjust time horizon (1-36 months)
- View forecast vs. actual with confidence intervals
- Anomaly detection overlay
- Export bulk forecast CSV

**Key Files**: utils/forecasting.ts, App.tsx (lines ~2264-2367)

#### Tab 2: **Financials** (Cost & Production)
- Production plan upload (SKU, Date, Quantity, Type: production|po)
- Scenario modeling (adjust costs, volumes, lead times)
- Production capacity planning
- Financial projections integration

**Key Files**: App.tsx (lines ~2368-2486), Production Plan handling

#### Tab 3: **Quality** (Accuracy & Backtesting)
- Forecast accuracy metrics (MAE, RMSE, MAPE)
- Method comparison backtesting
- Confidence interval tracking
- Accuracy trend visualization

**Key Files**: utils/forecasting.ts (backtesting logic), App.tsx (~2487-2657)

#### Tab 4: **Inventory** (Depletion & Alerts)
- Safety stock calculations (Z-score method)
- Current inventory input
- Projected depletion visualization
- Stockout risk detection
- Alert export with detail visibility (puts/takes breakdown)
- Production plan factoring

**Key Files**: utils/supplyChain.ts, App.tsx (~2658-2738)

#### Tab 5: **Sandbox** (Consolidated Analytics) ⭐ NEW
- **Analysis Period Memo**: Historical window + forecast period dates
- **ABC Analysis - Portfolio Transformation Matrix**: 3-column layout
  - Historical ABC distribution (stacked bar chart, flat bars)
  - Category shifts (centered badges with arrows)
  - Forecasted ABC distribution
  - Custom tooltips with percentage breakdowns
- **SKU Volatility Chart**: Historic vs. Projected (horizontal bars, top 15)
- **Consolidated Volatility & Portfolio Mix Table**: 6-column export-enabled table
  - SKU | ABC | Volatility % | Risk | ABC Change | Volatility Change
  - Color-coded badges (risk levels, change direction)
  - CSV export: `sku-volatility-portfolio-mix-YYYY-MM-DD.csv`

**Key Files**: App.tsx (lines ~3123-3540), utils/supplyChain.ts

---

### 3.2 Forecasting Methods

All methods return array of ForecastPoint objects: `{date, forecast, lower, upper, actual}`

| Method | Algorithm | Use Case | Seasonality | Trend |
|--------|-----------|----------|-------------|-------|
| **Holt-Winters** | Triple Exponential Smoothing | Seasonal goods (electronics, consumer) | ✅ Yes | ✅ Yes |
| **Prophet** | Additive decomposition + robust outlier handling | Organic growth + disruptions | ⚠️ Optional | ✅ Yes |
| **ARIMA** | Auto-regressive + integrated moving average | Stable commodities, high volume | ❌ No | ✅ Yes |
| **Linear Regression** | OLS fit with trend line | Structural drift identification | ❌ No | ✅ Yes |

**Key Files**: utils/forecasting.ts (calculateForecast, detectHWMethod, cleanAnomalies functions)

---

### 3.3 Supply Chain Calculations

#### Safety Stock Formula
```
SafetyStock = Z-Score * StdDev * √(LeadTime)
where Z = service level (0.95 = 1.645, 0.90 = 1.28)
```

#### Reorder Point (ROP)
```
ROP = (AvgDailyDemand × LeadTime) + SafetyStock
```

#### ABC Pareto Segmentation
```
1. Sort SKUs by volume (descending)
2. Calculate cumulative percentage
3. Assign: A (0-80%), B (80-95%), C (95-100%)
```

#### Portfolio Transformation Tracking
```
For each SKU:
  historicalClass = ABC grade from full demand history
  forecastClass = ABC grade from forecast period
  classChange = historicalClass → forecastClass (A→B, no change, C→A, etc.)
  volatilityChange = comparison of CV risk levels
```

#### Production Plan Integration
```
For each forecast date:
  projectedInventory = previousInventory
  projectedInventory -= forecastDemand[date]
  projectedInventory += sum(productionPlans where date matches)
  if projectedInventory < 0: STOCKOUT_ALERT
  if projectedInventory < safetyStock: SAFETY_STOCK_ALERT
```

**Key Files**: utils/supplyChain.ts

---

### 3.4 Data Structures (types.ts)

#### Critical Interfaces
```typescript
interface ForecastPoint {
  date: string;
  forecast: number;
  lower: number;
  upper: number;
  actual?: number;
}

interface SupplyChainMetrics {
  sku: string;
  avgDailyDemand: number;
  safetyStock: number;
  reorderPoint: number;
  projectedInventory: number[];  // Array for each forecast period
  projectedStockouts: { date: string; type: 'critical' | 'warning' }[];
}

interface ParetoItem {
  sku: string;
  totalVolume: number;
  grade: 'A' | 'B' | 'C';
  percentOfTotal: number;
}

interface VolatilityResult {
  sku: string;
  volatility: number;  // Coefficient of Variation %
  avgQuantity: number;
  stdDev: number;
  risk: 'Low' | 'Medium' | 'High';
}

interface PortfolioChange {
  sku: string;
  historicalClass: 'A' | 'B' | 'C';
  forecastClass: 'A' | 'B' | 'C';
  classChange: string;  // e.g. "A → B"
  volatilityChange: string;  // e.g. "Low → High"
}

interface ProductionPlan {
  id: string;
  sku: string;
  date: string;  // YYYY-MM-DD format
  quantity: number;
  type: 'production' | 'po';
}
```

---

## 4. DESIGN SYSTEM & UI PATTERNS

### Color Palette
```
ABC Classifications:
  - Class A: #6366f1 (Indigo)
  - Class B: #fb923c (Orange)
  - Class C: #475569 (Slate)

Risk Levels:
  - High (>50% volatility): #ef4444 (Red)
  - Medium (30-50%): #fb923c (Orange)
  - Low (<30%): #6366f1 (Indigo)

Backgrounds:
  - Cards: bg-slate-900
  - Borders: border-slate-800
  - Text: text-white/slate-300/slate-500
  - Semi-transparent: {color}/20 (e.g., bg-indigo-500/20)
```

### Chart Styling
- **Stacked Bars**: Flat rectangles (no radius on first bar)
- **Tooltips**: Dark background (bg-slate-950), border (border-slate-700), semi-transparent divs
- **Axis Labels**: Font size 11-12px, bold white text
- **Grid**: Dashed lines (#1e293b color), visible on appropriate axes
- **Legend**: Font size 10px, bold text

### Table Styling
- **Header**: text-slate-500, font-black, uppercase
- **Rows**: border-b border-slate-800/50, hover:bg-slate-800/30
- **Badges**: px-2 py-1, rounded-full, text-[8px], font-black, uppercase
- **Export Button**: bg-emerald-600, border-emerald-500, hover:bg-emerald-700

---

## 5. AI INTEGRATION PATTERNS (aiService.ts)

### Gemini Integration
```typescript
// Example: Get Industry Insights
const insights = await getIndustryInsights(industry, prompt, stats);

// Example: Market Trend Adjustment with Web Search
const adjustment = await getMarketTrendAdjustment(industry, category);
// Returns: { multiplier: 1.15, reasoning: "...", source: "..." }

// Example: Narrative Summary (role-specific)
const narrative = await getNarrativeSummary(
  industry,
  audience: 'Executive' | 'Demand Planner' | 'Plant Manager' | 'Sales',
  prompt,
  trend,
  diff,
  horizon
);
```

### Fallback Behavior
- Claude (ANTHROPIC_API_KEY)
- OpenAI (OPENAI_API_KEY)
- Gemini (GEMINI_API_KEY) - default/required
- All return string responses

---

## 6. DATA IMPORT FORMATS

### Historical Sales (Tab: Future)
```
Date,SKU,Category,Quantity
2024-01-15,SKU-101,Electronics,500
2024-01-15,SKU-102,Automotive,350
```
✅ Supported Date Formats: YYYY-MM-DD, M/D/YYYY, MM/DD/YYYY, MM-DD-YYYY

### Product Attributes
```
SKU,Category,LeadTimeDays,UnitCost,SellingPrice,ServiceLevel
SKU-101,Electronics,30,100,150,0.95
SKU-102,Automotive,45,200,300,0.95
```

### Current Inventory
```
SKU,OnHand,LastUpdated
SKU-101,1500,2024-05-01
SKU-102,2200,2024-05-01
```

### Production Plans & Open POs (Tab: Financials)
```
SKU,Date,Quantity,Type
SKU-101,2024-06-15,600,production
SKU-101,2024-07-10,500,po
SKU-102,2024-06-20,450,po
```

---

## 7. EXPORT OUTPUTS

### Forecast CSV
Columns: Date, SKU, Forecast, Lower CI, Upper CI, Actual (if backtest)

### Inventory Alerts CSV
Columns: SKU, Alert Type, Stockout Date, Current On-Hand, Projected Inventory, Production Scheduled, Demand Expected

### Volatility & Portfolio Mix CSV
Columns: SKU, ABC Class, Volatility %, Risk, ABC Change, Volatility Change
Format: Date-stamped filename `sku-volatility-portfolio-mix-YYYY-MM-DD.csv`

### Bulk Forecast Export
All SKUs with all forecast points (date range filtered)

---

## 8. COMMON PATTERNS & CONVENTIONS

### Date Normalization
- All dates stored as YYYY-MM-DD strings (not Date objects)
- Use `normalizeDateFormat()` for user inputs
- Use `parseDate()` for flexible input parsing

### CSV Export Pattern
```typescript
const headers = ['Column1', 'Column2', ...];
const rows = data.map(item => [item.field1, item.field2, ...]);
const csvContent = [headers, ...rows]
  .map(row => row.map(cell => `"${cell}"`).join(','))
  .join('\n');
const blob = new Blob([csvContent], { type: 'text/csv' });
const link = document.createElement('a');
link.href = URL.createObjectURL(blob);
link.download = `filename-${new Date().toISOString().split('T')[0]}.csv`;
link.click();
```

### Custom Tooltip Pattern (Recharts)
```typescript
content={({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg text-xs space-y-1">
      <p className="text-white font-bold mb-2">{data.label}</p>
      <p className="text-slate-400">Value: <span className="text-blue-400 font-bold">{data.value}</span></p>
    </div>
  );
}}
```

### State Management Pattern
```typescript
// Use committed settings for UI state
const [committedSettings, setCommittedSettings] = useState({
  filters: { aiProvider: 'gemini', ... },
  audience: 'Executive',
  horizon: 12,
  ...
});

// Use draft settings for form inputs
const [draftSettings, setDraftSettings] = useState({...});
```

---

## 9. TESTING & BUILD

### Build Command
```bash
npm run build  # Vite build (currently ~6.59s, 992.19 kB unminified)
```

### Known Build Warnings
- Chunk size > 500kB (monolithic codebase, consider dynamic imports if needed)
- This is acceptable for current scope

### Error Checking
```bash
npm run build  # Returns 0 exit code on success
```

---

## 10. CRITICAL CONSTRAINTS & GOTCHAS

### ⚠️ Important Notes for New Development

1. **Line Count**: App.tsx is 3543 lines. Keep related features grouped to minimize refactoring.

2. **Tab Type**: `activeTab` must be strictly typed:
   ```typescript
   type TabType = 'future' | 'quality' | 'inventory' | 'financials' | 'sku-analysis' | 'sandbox';
   ```

3. **Date Formatting**: Always use YYYY-MM-DD internally. User inputs parsed at entry point.

4. **Volatility Calculations**: Coefficient of Variation (CV) = StdDev / Mean. Must handle zero-mean edge cases.

5. **Portfolio Transformation**: Must compare historical (full dataset) vs. forecasted (forecast period) classifications separately.

6. **Production Integration**: Production plans must be date-matched exactly (no tolerance). Use normalized YYYY-MM-DD format.

7. **ABC Sorting**: Always sort by volume descending, then recalculate cumulative %.

8. **CSV Export Quoting**: Always quote all cells to handle commas and special characters.

9. **Recharts Customization**: Use `content` prop for tooltips (not `formatter`). Use `Cell` for individual bar colors in BarChart.

10. **Custom Badges**: Use width/height constraints (e.g., w-9 h-9) to prevent text overflow. Use flexbox centering.

---

## 11. RECENT CHANGES (Jan 22, 2026)

✅ **Sandbox Page Launch**
- Consolidated ABC Analysis + Volatility metrics in single page
- Portfolio Transformation Matrix with 3-column layout
- SKU Volatility Chart (historic vs. projected)
- Consolidated Table with 6 columns and CSV export

✅ **Chart Improvements**
- Removed rounded corners from stacked bars (flat rectangles)
- Enhanced tooltips with percentage breakdowns
- Optimized axis labels for readability

✅ **Export Enhancement**
- Consolidated table CSV export with date-stamped filename
- Format: `sku-volatility-portfolio-mix-YYYY-MM-DD.csv`

---

## 12. COMMON REQUESTS & IMPLEMENTATION NOTES

### Add a New Chart
1. Use ResponsiveContainer + Recharts component (BarChart, LineChart, etc.)
2. Implement custom tooltip with `content` prop
3. Format axis labels with tick formatters
4. Add to appropriate tab section with section header

### Add a New Export
1. Map data to array of arrays (headers + rows)
2. Quote all cells in CSV formatters
3. Create Blob with `type: 'text/csv'`
4. Use date-stamped filename format
5. Add button near related data section

### Modify ABC Classification
1. Edit `runParetoAnalysis()` in utils/supplyChain.ts
2. Update percentages if changing thresholds (currently 80/15/5)
3. Re-test portfolio transformation calculations
4. Update TECHNICAL_GUIDE.md with new thresholds

### Add a New Tab
1. Add to `TabType` union in types.ts
2. Add to `setActiveTab` useState initialization
3. Add button to tab navigation (line ~2447)
4. Add conditional render `{activeTab === 'new-tab' && ( ... )}`
5. Group all new-tab logic in dedicated section
6. Update TECHNICAL_GUIDE.md with new tab description

---

## 13. FILES TO REFERENCE FOR NEW WORK

**Always Read These First:**
- [App.tsx](App.tsx) - Main component (3543 lines, all UI + state)
- [types.ts](types.ts) - All TypeScript interfaces
- [utils/supplyChain.ts](utils/supplyChain.ts) - ABC Pareto, safety stock, production integration
- [utils/forecasting.ts](utils/forecasting.ts) - 4 forecasting methods
- [services/aiService.ts](services/aiService.ts) - AI integration patterns

**Reference For Context:**
- [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md) - Formulas, algorithms, UI architecture
- [README.md](README.md) - User workflows, data formats
- [constants.ts](constants.ts) - Sample data structure

---

## 14. HOW TO USE THIS PROMPT

### For Feature Requests
1. Provide clear description of desired behavior
2. Specify which tab/section affected
3. Define input/output format
4. Include mockup or reference if possible
5. Mention any data dependencies

### For Bug Fixes
1. Describe the observed behavior
2. Provide reproduction steps
3. Share error message if available
4. Specify which browser/OS if UI-related

### For Refactoring
1. Identify the scope (specific section or global)
2. Explain the desired outcome
3. List acceptance criteria
4. Note any backward compatibility needs

### For Performance Optimization
1. Identify slow area(s)
2. Share performance metrics if available
3. Specify acceptable performance target
4. Note any user-facing features that might be affected

---

**Version:** v1.0  
**Last Updated:** January 22, 2026  
**Next Review Date:** As needed based on major feature additions
