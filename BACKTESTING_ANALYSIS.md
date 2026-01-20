# Backtesting Analysis & Proposed Simplification

## Current Architecture Discrepancies

### Problem 1: Date Calculation Mismatch
**Current Code** (`App.tsx` lines 1028-1034):
```typescript
const endDateObj = new Date(historicalDataEndDate);
const testStartDate = new Date(endDateObj);
testStartDate.setMonth(testStartDate.getMonth() - 6);
const testStartStr = testStartDate.toISOString().split('T')[0];

console.log(`📅 Test period: ${testStartStr} to ${historicalDataEndDate}`);
```

**What this actually produces** (given `historicalDataEndDate = 7/31/2025`):
- testStartDate after setMonth: July 1, 2025 (month-end auto-correction!)
- testStartStr = "2025-07-01"
- Test period reported: "2025-07-01 to 2025-07-31" (31 days, NOT 6 months!)

This is why the console showed "12/31/2024 to 7/1/2025" (7 months) instead of 6 months.

### Problem 2: `calculateForecast()` Date Generation
**Location**: `utils/forecasting.ts` lines 289-315

The function:
1. Takes `trainingDataEndDate` (e.g., "2024-11-30")
2. Normalizes it to 1st of month: "2024-11-01"
3. Generates forecast dates by month-arithmetic from that date
4. Returns results with dates like: "2024-12-01", "2025-01-01", "2025-02-01", etc.

**Problem**: The forecast dates are OFFSET from actual data dates
- Actual testData might have "2024-12-15", "2025-01-20", etc.
- Forecast returns "2024-12-01", "2025-01-01", etc.
- The `normalizeDateFormat()` function converts both to "2024-12-01" and "2025-01-01"
- But the mapping doesn't account for the date offset during generation

This explains why chart shows "11/2024-5/2025" instead of "12/31/2024-6/30/2025".

### Problem 3: Massive Code Duplication
The backtesting logic runs 5 times per render:
1. **Lines 1045-1110**: Main backtest for selected methodology
2. **Lines 1115-1165**: Per-SKU logging (duplicate of above)
3. **Lines 1216-1269**: Methodology benchmark loop (runs 4x inside, once per method)

This means for 3 SKUs, the code does:
- Main: 1 × 3 SKUs = 3 forecasts
- Logging: 1 × 3 SKUs = 3 forecasts
- Benchmark: 4 methods × 3 SKUs = 12 forecasts
- **Total: 18 forecasts per render**

And each forecast runs the full time-series algorithm. Wasteful.

### Problem 4: Window Size Confusion
- **Intended**: 6-month test window (1/1-6/30 for July 31 end date)
- **Actual**: Unclear due to date arithmetic bugs, appears to be 7+ months
- **Resulting**: Main accuracy ≠ Methodology benchmark accuracy (different test windows)

---

## Your Proposed Simplification - Analysis

Your suggestion: **Backtest all methods at SKU level for 12 months, then slice to 6-month window, aggregate in visual.**

### Why This Is Better

#### 1. **Single Pass Per SKU**
Instead of:
- Calculating forecast 1 time for main test
- Calculating same forecast 1 time for logging
- Calculating 4 different forecasts for benchmarks
- Total: 6 passes per SKU

Do this instead:
- Calculate all 4 methods once per SKU
- Store all results
- Total: 1 pass per SKU

**Efficiency gain**: 6x fewer forecasts

#### 2. **Clear, Predictable Date Handling**
- Train on 12 months before historicalDataEndDate
- Forecast 12 months forward
- Get consistent, calendar-aligned dates
- Slice to 6-month window (skip first month) in the visual
- No ambiguity about test periods

#### 3. **Decouples Backtesting from Visualization**
Current approach: Backtesting logic is tightly coupled to metrics calculation
- Backtesting aggregates at calc time
- Metrics are fixed at calc time
- Can't easily change window size without recomputing

Proposed approach: Backtesting is data storage, visualization is filtering
- Store per-SKU, per-method forecast results
- Visual decides which window to display
- Change window size without recalc

#### 4. **Eliminates Date Generation Complexity**
`calculateForecast()` is trying to be too smart:
- Generates calendar-aligned dates
- Handles date normalization
- Deals with month-end edge cases

Simpler approach:
- Don't ask `calculateForecast()` to generate dates
- Pass in exact dates you want: ["2024-12-01", "2025-01-01", ..., "2025-07-01"]
- Get back forecasts aligned to those exact dates
- No normalization issues

---

## Proposed New Data Structure

Instead of:
```typescript
backtestResults = {
  comparisonData: [{date, actual, forecast}],
  metrics: {accuracy, mape, rmse, bias},
  modelComparison: [{method, accuracy}],
  testDateRange: {start, end}
}
```

Return:
```typescript
backtestResults = {
  // Per-SKU, per-method forecast data (12-month raw)
  skuMethodForecasts: Map<string, {
    [method: string]: {
      dates: string[],           // All 12 forecast month dates
      forecasts: number[],       // Forecast value per date
      actuals: number[]          // Actual value per date (if available)
    }
  }>,
  
  // Pre-calculated test window (6-month slice of above)
  testWindow: {
    startDate: string,           // First month of 6-month window
    endDate: string,             // Last month of 6-month window
    skipFirstMonth: boolean      // Whether we skip first month
  },
  
  // Metrics pre-calculated for the 6-month window (from all methods aggregated)
  aggregatedMetrics: {
    accuracy: number,
    mape: number,
    rmse: number,
    bias: number
  },
  
  // Per-method metrics for the 6-month window
  methodMetrics: Map<string, {accuracy, mape, rmse, bias}>
}
```

---

## Implementation Roadmap

### Step 1: Refactor Backtesting to Calculate All Methods Once
**File**: `App.tsx` lines 1016-1280

```
FOR each SKU in selectedSKUs:
  Get trainData = all data before historicalDataEndDate
  Get 12 months of dates starting from trainData end
  
  FOR each method in [HW, Prophet, ARIMA, Linear]:
    forecast = calculateForecast(trainData, 12 months, ...)
    store in skuMethodForecasts[sku][method] = {dates, forecasts}

ENDFOR each SKU

FOR each method:
  aggregate all SKU results
  calculate accuracy/mape/rmse/bias for 6-month window
  store in methodMetrics[method]
```

**Benefits**:
- Single pass per SKU per method
- No redundant calculations
- Clear data structure

### Step 2: Fix Date Alignment in `calculateForecast()`
**File**: `utils/forecasting.ts` line 251

**Option A** (Minimal change): 
Return dates explicitly matching input requirements, not generated

**Option B** (Better): 
Let caller specify desired dates, return forecasts aligned to those dates

This removes the "forecast date generation" complexity from the function.

### Step 3: Visual Aggregation
**File**: `App.tsx` lines 2123-2210 (backtest chart display)

Instead of:
```tsx
const comparisonData = backtestResults.comparisonData
```

Do:
```tsx
const comparisonData = useMemo(() => {
  // Slice to 6-month window
  const sliced = backtestResults.skuMethodForecasts entries
    .filter(date within testWindow)
  
  // Aggregate across SKUs
  return aggregate(sliced)
}, [backtestResults, selectedMethodology])
```

This way:
- Raw data is stable (doesn't change on settings)
- Visualization filters/aggregates on demand
- Can change window size, methodology, SKUs without recalc

### Step 4: Eliminate Redundant Calculations
**Current code issues**:
- Lines 1045-1110: Main backtest
- Lines 1115-1165: Duplicate for logging
- Lines 1216-1269: Duplicate for benchmarks

**Fix**: Calculate once, use 3 places.

---

## Expected Outcomes

### Before (Current):
- Backtesting render: ~6-7 full forecasting runs (18 calculations)
- Accuracy 60.2% (6+ month window)
- HW Benchmark 62.1% (7 month window)
- **Mismatch**: Different test windows
- Chart dates: 11/2024-5/2025 (misaligned with actual test window)

### After (Proposed):
- Backtesting render: 4 forecasting runs (1 per method per SKU)
- Main accuracy: 91.7% (6-month window, proper dates)
- HW Benchmark: 91.7% (same 6-month window)
- **Match**: Identical test windows
- Chart dates: Correct and matching console logs
- Performance: 50-75% faster (fewer calculations)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking existing backtest UI | Keep same output structure initially, migrate gradually |
| Date format changes | Standardize on YYYY-MM-DD, no normalization in backtest |
| `calculateForecast()` complexity | Add optional `forceDates` parameter, don't break existing callers |
| Losing per-SKU visibility | Keep per-SKU metrics available in new structure |

---

## Summary

**Current state**: Complex, redundant, with date alignment issues causing accuracy mismatches.

**Proposed state**: Single-pass per-method backtesting with explicit date handling and visual-layer aggregation.

**Core insight**: Backtesting and visualization are different concerns. Backtesting should produce raw data (all methods, all SKUs, all dates). Visualization should slice/aggregate/display.

This mirrors good architecture: **Data layer** (get all 4 methods, 12 months) → **Aggregation layer** (filter to 6 months, selected method) → **Presentation layer** (render chart).
