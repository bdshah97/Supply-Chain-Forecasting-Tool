# SupplyChain Predictor Pro: Technical Specifications

This document serves as a technical manual for the SSA & Company Predictive Forecasting Engine, detailing the architectural logic and AI integration patterns.

## 1. Core Forecasting Engines (`utils/forecasting.ts`)

The application supports four distinct mathematical models to handle varying demand profiles:

- **Holt-Winters (Triple Exponential Smoothing)**:
  - *Logic*: Smooths Level, Trend, and Seasonality indices.
  - *Use Case*: High-seasonality goods (e.g., consumer electronics).
- **Prophet-Inspired (Additive)**:
  - *Logic*: Decomposes time series into trend and seasonal components with robust handling of missing data points and outliers.
- **ARIMA (Auto-Regressive Integrated Moving Average)**:
  - *Logic*: Focuses on self-correcting autocorrelation.
  - *Use Case*: Stable commodities with high volume and predictable growth.
- **Linear Regression**:
  - *Logic*: Ordinary Least Squares (OLS) fit.
  - *Use Case*: Identifying long-term structural drift.

## 2. Supply Chain Logic (`utils/supplyChain.ts`)

Proprietary logic for operationalizing statistical forecasts:

- **Safety Stock Calculation**: `SafetyStock = Z * StdDev * SQRT(LeadTime)`.
- **Reorder Point (ROP)**: `ROP = (AvgDailyDemand * LeadTime) + SafetyStock`.
- **ABC Pareto Stratification**: Automatically segments SKUs by volume:
  - **Class A**: Top 80% of volume (Critical focus).
  - **Class B**: Next 15%.
  - **Class C**: Final 5% (Low priority stock).
- **Resiliency Simulator**: Stress-tests the chain by applying `Supplier Volatility` multipliers to lead times and safety stock requirements.

### Production Plans & Open POs Integration

The inventory projection system now factors in **incoming production and open purchase orders** for accurate supply-demand reconciliation:

#### Data Structure
```typescript
interface ProductionPlan {
  id: string;
  sku: string;
  date: string;           // Arrival date (YYYY-MM-DD format)
  quantity: number;       // Units arriving
  type: 'production' | 'po';  // Production order or open PO
}
```

#### Inventory Calculation Flow
1. **Load Production Plans**: Users upload CSV with format: `SKU,Date,Quantity,Type`
2. **Integrate into Forecast**: `calculateSupplyChainMetrics()` processes each forecast period:
   ```
   For each forecast date:
     runningInventory -= forecast_demand
     runningInventory += sum_of_production_for_that_date
     projectedInventory = runningInventory
   ```
3. **Alert Generation**: The system automatically flags:
   - **STOCKOUT RISK**: When `projectedInventory < 0` (critical)
   - **SAFETY STOCK BREACH**: When `projectedInventory < safetyStock` (warning)
4. **Export Capability**: Users can export inventory alerts with detailed visibility:
   - Current On-Hand inventory
   - Projected inventory at risk date
   - Total production scheduled to that date
   - Total demand expected to that date
   - This allows business users to understand the "puts and takes" driving the alert

#### Example Calculation
```
Current On-Hand: 1,000 units
Production Plan: 500 units on 2024-06-15
Forecast Demand: 800 units/month

June Projection:
  Starting: 1,000
  - Demand: 800
  + Production (6/15): 500
  = 700 units (healthy)

July Projection:
  Starting: 700
  - Demand: 800
  = -100 units (CRITICAL ALERT)
```


## 3. Gemini AI Integration (`services/aiService.ts`)

The app leverages Gemini 3 Flash for context-aware intelligence. Below are the key prompt templates used:

### A. Strategic Intelligence
> "Provide exactly 3 concise sentences of strategic insight for this business: {prompt}. Data Summary: {stats}. Requirement: 1. Key market factor. 2. Recommended action. 3. Primary risk. Format as a single paragraph."

### B. Market Trend Adjustment (Grounding)
Uses `googleSearch` to identify real-world economic shifts:
> "Research current market trends for: {prompt}. Return JSON with: multiplier (number), reasoning (string)."

### C. Operational Narrative
Tailors the summary based on the selected **Audience Type**:
> "Write a professional 3-sentence narrative for a {audience} regarding: {prompt}. Trend: {trend} by {diff}% over {horizon} months. Audience Focus: {audienceGuidance}."

### D. Anomaly Root Cause Analysis (RCA)
> "Analyze these supply chain anomalies for a business in the {industry} sector: {outliers}. Provide a professional explanation of potential external root causes specific to this industry."

## 4. UI Architecture

- **Portal-based Tooltips**: Custom `InfoTooltip` uses React Portals to prevent clipping in the sidebar and implements a "hover bridge" to eliminate flickering.
- **Multi-Searchable Selects**: Custom dropdowns with fuzzy-matching for handling high-cardinality SKU lists.
- **Presentation Mode**: The `ReportModal` uses CSS `@media print` overrides to generate a pixel-perfect "One-Pager Executive Memo" as a high-fidelity slide.

## 5. Environment Variables
- `process.env.API_KEY`: Mandatory key for Gemini API access.
- `OPENAI_API_KEY`: Optional fallback for secondary provider tests.
- `ANTHROPIC_API_KEY`: Optional fallback for secondary provider tests.
