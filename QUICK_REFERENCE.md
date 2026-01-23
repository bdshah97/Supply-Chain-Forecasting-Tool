# Quick Reference Card - Share This With New AI Chat

## Project: Supply Chain Forecasting Tool (SCPT)

**Current State**: Stable ✅  
**Build Time**: 5.35s | **Errors**: 0  
**Lines of Code**: 3543 (App.tsx) | **Framework**: React 19 + TypeScript + Vite

---

## 🎯 TLDR - What This App Does

Combines **statistical demand forecasting** (4 methods) with **supply chain optimization** (safety stock, ABC segmentation, inventory projections) and **portfolio analysis** (volatility ranking, classification changes).

---

## 📋 The 5 Main Pages (Tabs)

| Tab | Purpose | Key Output |
|-----|---------|-----------|
| **Future** | Demand forecasting | Forecast CSV, anomaly detection |
| **Financials** | Cost & production planning | Production integration, scenarios |
| **Quality** | Forecast accuracy | Backtest metrics, MAE/RMSE/MAPE |
| **Inventory** | Stock projections | Alert generation, stockout warnings |
| **Sandbox** ⭐ | Consolidated analytics | Portfolio matrix + volatility table |

---

## 🏆 Sandbox Page (Most Important Tab)

### 3 Components:
1. **Portfolio Transformation Matrix** - Shows how SKU classes (A/B/C) shift from historical to forecasted
   - 3-column layout: Historical Volumes | Category Shifts | Forecasted Volumes
   - Stacked bar charts (flat rectangles, no curves)
   - Color-coded: Indigo (A), Orange (B), Slate (C)

2. **SKU Volatility Chart** - Compares demand predictability
   - Horizontal bars: Historic vs. Projected volatility
   - Top 15 SKUs shown
   - Color: Blue (historic), Red (projected)

3. **Consolidated Table** - 6-column analysis with CSV export
   - Columns: SKU | ABC | Volatility % | Risk | ABC Change | Volatility Change
   - Export filename: `sku-volatility-portfolio-mix-YYYY-MM-DD.csv`

---

## 🧮 Key Formulas (You'll See These in Code)

```
Safety Stock = Z-Score × StdDev × √(LeadTime)
Reorder Point = (AvgDaily × LeadTime) + SafetyStock
ABC Grades = A (top 80% volume), B (next 15%), C (bottom 5%)
Volatility = StdDev / Mean (Coefficient of Variation)
```

---

## 📊 4 Forecasting Methods

| Method | Best For | Handles Seasonality? |
|--------|----------|---------------------|
| **Holt-Winters** | Seasonal goods (electronics) | ✅ Yes |
| **Prophet** | Organic growth + disruptions | ⚠️ Optional |
| **ARIMA** | Stable commodities | ❌ No |
| **Linear Regression** | Trend identification | ✅ Linear only |

All return: `[{date, forecast, lower, upper, actual?}]`

---

## 📁 Key Files (Go Here First)

**FOR CODE CHANGES:**
- `App.tsx` (3543 lines) - ALL UI + state management
- `utils/supplyChain.ts` - ABC logic, safety stock, production integration
- `utils/forecasting.ts` - The 4 forecasting algorithms
- `types.ts` - All TypeScript interfaces

**FOR UNDERSTANDING DESIGN:**
- `TECHNICAL_GUIDE.md` - Formulas, algorithms, architecture
- `README.md` - User workflows, data formats
- `SYSTEM_PROMPT_FOR_AI.md` - Complete dev reference (420+ lines)

---

## 🎨 Color System (Memorize These)

```
ABC Classification:
  A = #6366f1 (Indigo) - Critical
  B = #fb923c (Orange) - Important
  C = #475569 (Slate) - Low Priority

Risk Levels:
  High (>50%) = #ef4444 (Red)
  Medium (30-50%) = #fb923c (Orange)
  Low (<30%) = #6366f1 (Indigo)

Cards: bg-slate-900 | Borders: border-slate-800
```

---

## 📥 Data Import Formats

### Sales Data (Tab: Future)
```
Date,SKU,Category,Quantity
2024-01-15,SKU-101,Electronics,500
```
✅ Date formats: YYYY-MM-DD, M/D/YYYY, MM/DD/YYYY, MM-DD-YYYY

### Production Plans (Tab: Financials)
```
SKU,Date,Quantity,Type
SKU-101,2024-06-15,600,production
SKU-101,2024-07-10,500,po
```

---

## 💾 Export Formats

1. **Forecast CSV** - Columns: Date, SKU, Forecast, Lower CI, Upper CI
2. **Alert CSV** - Stockout/Safety stock warnings with puts/takes
3. **Volatility Table** - 6 columns (SKU | ABC | Vol % | Risk | Changes)
4. **Bulk Export** - All SKUs, all forecast periods

---

## ⚠️ Critical Things to Know

1. **Dates**: Always YYYY-MM-DD internally (normalize on input)
2. **CSV Export**: Always quote all cells `"value"`
3. **Charts**: Use custom `content` prop for tooltips (not `formatter`)
4. **State**: Separate `committedSettings` (UI) from `draftSettings` (forms)
5. **Portfolio Table**: Compare FULL history vs. FORECAST period separately
6. **Production Plans**: Date-match exactly (no tolerance)
7. **Volatility**: Handle zero-mean edge cases
8. **Pareto**: Always sort by volume descending, recalculate cumulative %
9. **App Size**: 3543 lines - keep related features grouped
10. **Stacked Charts**: Flat bars (no radius={[8,8,0,0]})

---

## 🔧 Common Tasks

### To Add a New Chart
1. Use ResponsiveContainer + Recharts component
2. Custom tooltip with `content={({ active, payload }) => ...}`
3. Format axes with tick formatters
4. Add to appropriate tab section

### To Add an Export
1. Map data → array of arrays (headers + rows)
2. Quote all CSV cells
3. Create Blob with `type: 'text/csv'`
4. Use date-stamped filename
5. Add button near data section

### To Add a New Tab
1. Update `TabType` in types.ts
2. Add to tab navigation buttons (~line 2447)
3. Add conditional render `{activeTab === 'new-tab' && (...)}`
4. Update TECHNICAL_GUIDE.md

---

## 🧪 Build & Test

```bash
npm run build  # Takes ~5-6 seconds, produces 992 kB unminified

# Expected output:
✓ 2340 modules transformed
✓ built in 5.35s
```

---

## 🎓 For Developers New to This Project

**Read in this order:**
1. This card (overview)
2. README.md (user workflows)
3. SYSTEM_PROMPT_FOR_AI.md (architecture & implementation guide)
4. TECHNICAL_GUIDE.md (algorithms & formulas)
5. Relevant section in App.tsx

---

## 📞 When Requesting Changes

**Always provide:**
- ✅ Clear description of feature/change
- ✅ Which tab affected
- ✅ Input/output format
- ✅ Mockup or reference (if visual)
- ✅ Any data dependencies

**Include link to:** SYSTEM_PROMPT_FOR_AI.md for context

---

**Last Updated**: January 22, 2026  
**Version**: 1.0  
**Status**: Production Ready ✅
