# Visual Field Mapping Documentation

This document maps each visual/chart in the application back to its data sources, filtering logic, and date parameters. This helps identify where date windows and field references diverge across different visualizations.

---

## Data Flow Architecture

### 1. Raw Data Sources
- **`data`** (state): Combined historical actual data
  - Source: `App.tsx` line 360 (useState)
  - Populated by: CSV uploads (hist) + sample data (SAMPLE_DATA)
  - Structure: `DataPoint[]` = `{date, sku, category, quantity}`
  - Format: Dates stored as YYYY-MM-DD strings, normalized to YYYY-MM-01 via `normalizeDateFormat()`

### 2. Processed Data
- **`processedData`** (useMemo): Anomaly-cleaned version of `data`
  - Source: `App.tsx` line 703
  - Applied when: `committedSettings.filters.applyAnomalyCleaning === true`
  - Used for: All forecasting calculations
  - Date handling: Inherits from `data`

### 3. Per-SKU Forecasts
- **`skuLevelForecasts`** (useMemo): Per-SKU forecast maps
  - Source: `App.tsx` line 757
  - Calculated from: `data` + `committedSettings` + `historicalDataEndDate`
  - Dependencies: `[data, committedSettings, marketAdj, stats.std, inventory, scenarios, attributes, forecastStartMonth, historicalDataEndDate]`
  - What it does:
    1. Filters `data` by each SKU in `committedSettings.filters.skus`
    2. Calls `calculateForecast(...)` for each SKU
    3. Enriches with supply chain metrics (inventory, safety stock)
    4. Returns: `Map<string, ForecastPoint[]>`
  - Date handling: Uses `historicalDataEndDate` as the training cutoff
  
### 4. Aggregated Forecast
- **`aggregatedForecast`** (useMemo): Cross-SKU aggregation of all forecasts
  - Source: `App.tsx` line 825
  - Calculated from: `skuLevelForecasts`
  - Process: Sums all SKU forecasts by date
  - Used by:
    - Consolidated Demand Trend chart (line 1945)
    - Inventory Depletion Simulator (line 2255)
    - Financial projections
  - Date range: Includes all dates from all SKU forecasts (historical + future)

### 5. Backtesting Results
- **`backtestResults`** (useMemo): Model accuracy metrics + comparison data
  - Source: `App.tsx` line 1016
  - Dependencies: `[data, committedSettings, hwMethod, autoDetectHW, worstSkusGlobal, historicalDataEndDate, marketAdj]`
  - Test period calculation:
    - **Test Start**: `historicalDataEndDate` - 7 months
    - **Test End**: `historicalDataEndDate` - 1 month (= 6-month test window)
    - ⚠️ **CRITICAL**: This is the test window for both main backtest AND methodology benchmarks
  - What it does:
    1. For each SKU in `committedSettings.filters.skus`:
       - Split data: `trainData` (before testStartStr) + `testData` (testStartStr to testEndStr)
       - Calculate forecast on trainData, forecast length = testData.length
       - Compare forecast to actuals in testData
    2. Aggregate metrics across all SKUs
       - Accuracy = (1 - |TotalActual - TotalForecast| / TotalActual) × 100
       - wMAPE, RMSE, Bias calculated similarly
    3. Build `comparisonData`: Map of {date, actual, forecast} for chart display
    4. Calculate methodology benchmarks: Test all 4 methods on SAME test window
  - Returns:
    - `comparisonData`: Used for Historical Model Backtesting chart
    - `metrics`: Accuracy, MAPE, RMSE, Bias (displayed in metric cards)
    - `modelComparison`: Array of {method, accuracy} for each methodology
    - `testDateRange`: {start: testStartStr, end: testEndStr} (displayed on Quality page)

### 6. Worst SKUs
- **`worstSkusGlobal`** (useMemo): SKUs with highest forecast error
  - Source: `App.tsx` line 936
  - Dependencies: `[data, committedSettings, hwMethod, autoDetectHW]`
  - Note: **Does NOT include `historicalDataEndDate`** - uses full data split (70% train, 30% test)
  - Used by: Export worst SKU data, worst SKUs section in Quality tab

---

## Visual Mapping

### TAB: FUTURE FORECASTS

#### 1. Strategic Intelligence & Operational Narrative
- **Location**: `App.tsx` lines 1905-1916
- **Data Source**: `aiInsight`, `narrativeText` state variables
- **Filters**: None (AI-generated narrative)
- **Date Parameters**: None explicit (generated from current state)

#### 2. Consolidated Demand Trend (Chart)
- **Location**: `App.tsx` lines 1922-1977
- **Title**: "Consolidated Demand Trend"
- **Data Source**: `aggregatedForecast`
- **Filters Applied**:
  - SKU filter: `committedSettings.filters.skus`
  - Manual chart zoom: `chartZoom.startIndex` to `chartZoom.endIndex`
- **Date Range**: 
  - Full: All dates in `aggregatedForecast` (historical + forecast)
  - Displayed: Subset based on chart zoom sliders
- **Date Format**: Normalized to YYYY-MM-01, displayed as M/YYYY via `formatDateForDisplay()`
- **Lines Plotted**:
  - Blue line: Historical actuals (where `isForecast === false`)
  - Red line: Forecasted quantity (where `isForecast === true`)
  - Confidence bands: Upper/lower bounds around forecast
- **Methodology**: Shows currently selected model from `committedSettings.filters.methodology`

---

### TAB: FINANCIALS

#### 3. Metric Cards (Total Revenue, Gross Margin, Inventory Value, Profit at Risk)
- **Location**: `App.tsx` lines 2009-2014
- **Data Source**: `financialStats` useMemo
- **Calculation Logic** (`App.tsx` lines 895-927):
  - Iterates through `skuLevelForecasts` (not aggregated)
  - Sums `projectedRevenue` + `projectedMargin` for all forecast periods
  - Only includes points where `isForecast === true`
  - Sums across ALL forecast months (not date-bounded)
- **Filters**: 
  - SKU filter: `committedSettings.filters.skus`
  - No date range restriction (sums all forecast periods)
- **Date Parameters**: None (sums entire forecast horizon)

#### 4. Financial Growth Projection (Chart)
- **Location**: `App.tsx` lines 2019-2095
- **Title**: "Financial Growth Projection ($ Nearest Dollar)"
- **Data Source**: `monthlyFinancialData`
- **How `monthlyFinancialData` is Built**:
  - Source: `App.tsx` line 965 (useMemo, dependencies: `[aggregatedForecast, inventory, skuLevelForecasts, committedSettings]`)
  - Logic:
    1. Groups `aggregatedForecast` by month/year
    2. For each date, calculates COGS and Margin from per-SKU data
    3. Creates stacked bar entries: {date, cogs, margin}
  - **Date Range**: All dates in `aggregatedForecast` (historical + future)
  - **Filters**: SKU filter via `committedSettings.filters.skus`
- **Chart Elements**:
  - Red bars (#D97B7F): COGS (Cost of Goods Sold)
  - Green bars (#C1EFD5): Margin (Gross Margin)
  - Labels: $X,XXK format with white boxes above bars
  - Legend: Top-right corner
  - Y-axis: Formatted with commas ($XXXK)

---

### TAB: QUALITY

#### 5. Metric Cards (Accuracy, MAPE, RMSE, Bias Score)
- **Location**: `App.tsx` lines 2114-2120
- **Data Source**: `backtestResults.metrics`
- **Calculation Logic** (`App.tsx` lines 1100-1210):
  - **Test Period**:
    - Start: `historicalDataEndDate` - 7 months
    - End: `historicalDataEndDate` - 1 month
    - Window: 6 months
  - **Process**:
    1. For each SKU in `committedSettings.filters.skus`
    2. Split: trainData (before testStart) + testData (testStart to testEnd)
    3. Generate forecast on trainData, length = testData.length
    4. Compare forecast to testData actuals
    5. Aggregate across all SKUs:
       - Accuracy = (1 - |TotalActual - TotalForecast| / TotalActual) × 100
       - wMAPE = Σ|A-F| / Σ|A| × 100
       - RMSE = √(Σ(A-F)² / n)
       - Bias = (TotalForecast - TotalActual) / TotalActual × 100
  - **Filters**: 
    - SKU filter: `committedSettings.filters.skus`
    - Date window: Fixed 6-month lookback from `historicalDataEndDate`
  - **Tooltips**: Descriptions for each metric (lines 2114-2120)

#### 6. Historical Model Backtesting Chart (6M Split)
- **Location**: `App.tsx` lines 2123-2175
- **Title**: "Historical Model Backtesting (6M Split)"
- **Data Source**: `backtestResults.comparisonData`
- **Date Range**:
  - **Test Period**: testStartStr to testEndStr (6 months)
  - Calculated: `historicalDataEndDate` - 7 to `historicalDataEndDate` - 1 months
  - Example: If historicalDataEndDate = 7/31/2025, test period = 12/31/2024 to 6/30/2025
- **Date Format**: YYYY-MM-DD normalized to YYYY-MM-01, displayed as M/YYYY
- **Chart Lines**:
  - Blue line: Historical actual demand (testData quantities)
  - Orange line: Simulated forecast (calculated on trainData)
  - Tooltip: Shows accuracy for each month
- **Filters**: 
  - SKU filter: `committedSettings.filters.skus`
  - Date range: Fixed 6-month test window
- **Note**: This chart may show different dates (11/2024-5/2025) due to date normalization in `calculateForecast()`

#### 7. Methodology Benchmark (Bar Chart)
- **Location**: `App.tsx` lines 2176-2210
- **Data Source**: `backtestResults.modelComparison`
- **Calculation Logic** (`App.tsx` lines 1213-1269):
  - Tests ALL 4 methodologies on the SAME test period
  - Test Period: testStartStr to testEndStr (6 months, same as metric cards)
  - For each methodology:
    1. Split data: trainData (before testStart) + testData (testStart to testEnd)
    2. Calculate forecast using that methodology
    3. Compare to testData actuals
    4. Store: {method, accuracy}
  - ⚠️ **CRITICAL**: Lines 1227-1231 filter testData using `historicalDataEndDate`
    - **BUG NOTED**: Should use `testEndStr` instead, not `historicalDataEndDate`
    - Current code: `dt <= new Date(historicalDataEndDate).getTime()` (7 months)
    - Should be: `dt <= new Date(testEndStr).getTime()` (6 months)
    - This causes methodology benchmark to use 7-month window while main backtest uses 6-month
- **Filters**: SKU filter via `committedSettings.filters.skus`
- **Chart**: Horizontal bars showing each method's accuracy

#### 8. Backtest Data Range Display
- **Location**: `App.tsx` line 2135
- **Data Source**: `backtestResults.testDateRange`
- **Display Format**: "Backtest Data Range: YYYY-MM-DD to YYYY-MM-DD"
- **Calculation**: `{start: testStartStr, end: testEndStr}` from backtestResults

---

### TAB: INVENTORY

#### 9. Metric Cards (On-Hand, Safety Stock, Reorder Point)
- **Location**: `App.tsx` lines 2252-2254
- **Data Sources**:
  - On-Hand: `inventory` array filtered by `committedSettings.filters.skus`
  - Safety Stock: `aggregatedForecast[0]?.safetyStock`
  - Reorder Point: `aggregatedForecast[0]?.reorderPoint`
- **Date Parameters**: Uses first point of `aggregatedForecast`
- **Filters**: SKU filter only

#### 10. Inventory Depletion Simulator (Chart)
- **Location**: `App.tsx` lines 2255-2290
- **Title**: "Inventory Depletion Simulator"
- **Data Source**: `aggregatedForecast.filter(f => f.isForecast)`
- **Date Range**: All forecast period dates (future only, `isForecast === true`)
- **Filters**: SKU filter via `committedSettings.filters.skus`
- **Lines**:
  - Blue area: Projected inventory (`projectedInventory`)
  - Orange dashed line: Reorder Point (ROP)
  - Red dashed line: Safety Stock threshold

---

## Key Date Parameters Summary

| Visual | Test/Display Window | Start Calculation | End Calculation | Size | Source |
|--------|-------------------|-------------------|-----------------|------|--------|
| Consolidated Demand | All historical + forecast | Data minimum | forecast horizon end | Variable | `aggregatedForecast` |
| Financial Growth | All historical + forecast | Data minimum | forecast horizon end | Variable | `aggregatedForecast` |
| Backtest Metrics (cards) | 6-month holdout | historicalDataEndDate - 7mo | historicalDataEndDate - 1mo | 6mo | `backtestResults` |
| Backtest Chart | 6-month holdout | historicalDataEndDate - 7mo | historicalDataEndDate - 1mo | 6mo | `backtestResults.comparisonData` |
| Methodology Benchmark | 7-month (BUG) | historicalDataEndDate - 7mo | historicalDataEndDate | 7mo | `backtestResults.modelComparison` |
| Inventory Depletion | Forecast period only | forecastStartMonth | forecast horizon end | 12mo | `aggregatedForecast` (filtered to isForecast) |

---

## Known Issues

### Issue 1: Methodology Benchmark Date Window Mismatch
- **Location**: `App.tsx` line 1227
- **Problem**: 
  - Backtest metrics use: `testEndStr` (= historicalDataEndDate - 1 month)
  - Methodology benchmark uses: `historicalDataEndDate` (= 1 month later)
  - This creates a 7-month test window for benchmarks vs 6-month for main metrics
  - **Result**: Accuracy values don't match between main display and methodology benchmark
- **Fix Needed**: Line 1227 should filter on `testEndStr` instead of `historicalDataEndDate`

### Issue 2: Backtest Chart Date Mismatch (11/2024-5/2025 vs 12/31-6/30)
- **Location**: `comparisonData` building logic (`App.tsx` lines 1087-1110)
- **Problem**:
  - Test period is correctly calculated as 12/31/2024 - 6/30/2025
  - But `calculateForecast()` generates forecasts with its own date sequence
  - Dates don't align between testData actual dates and forecast dates
  - **Result**: Chart shows 11/2024-5/2025 even though test period is 12/31-6/30
- **Root Cause**: `calculateForecast()` generates dates starting from month after training end, doesn't align to actual calendar dates

---

## Filter Dependencies

All visuals respect the `committedSettings.filters` object:
```typescript
filters: {
  skus: string[],           // Selected SKUs to include
  methodology: ForecastMethodology,  // Selected forecasting method
  confidenceLevel: number,   // Confidence interval percentage
  includeExternalTrends: boolean,   // Apply market adjustments
  supplierVolatility: number,      // Volatility adjustment
  applyAnomalyCleaning: boolean,   // Clean anomalies in data
  category: string,         // Product category filter
  // ... other fields
}
```

Only exception: `worstSkusGlobal` uses full data (70/30 split), not filtered to selected SKUs.

---

## Date Format Normalization

All dates normalized via `normalizeDateFormat()` → YYYY-MM-01
Display format via `formatDateForDisplay()` → M/YYYY (e.g., "7/2025")

This normalization can cause date alignment issues when actual data has specific day-of-month values (e.g., 2025-01-15) that get normalized to 2025-01-01.
