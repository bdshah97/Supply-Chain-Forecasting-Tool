<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Supply Chain Forecasting Tool

An AI-powered predictive supply chain management platform with demand forecasting, inventory optimization, and production planning integration.

## Features

- **4 Forecasting Methods**: Holt-Winters, Prophet, ARIMA, and Linear Regression with automatic accuracy backtesting
- **Inventory Depletion Simulator**: Real-time visualization of projected stock levels with safety stock thresholds
- **Production Plan Integration**: Upload finished goods production orders or open purchase orders to factor into inventory projections
- **Inventory Alerts**: Automatic detection of stockout risks and safety stock breaches with export capability
- **Market Disruption Modeling**: Inject demand shocks (promotions, supply chain events) to stress-test forecasts
- **Sandbox Analysis Hub**: Consolidated analytics page combining ABC portfolio analysis with volatility metrics
  - **Portfolio Transformation Matrix**: 3-column visualization (Historical | Category Shifts | Forecasted) showing ABC distribution changes
  - **SKU Volatility Chart**: Interactive bar chart comparing historic vs. projected demand patterns
  - **Consolidated SKU Analysis Table**: 6-column table with volatility rankings, risk levels, ABC classification changes, and CSV export
- **ABC Pareto Analysis**: Automatic segmentation of SKUs by volume (Class A/B/C priority) with custom tooltips
- **Multi-AI Support**: Leverage Claude 3.5, OpenAI GPT-4o, or Gemini for industry-specific insights
- **Role-Based Insights**: Tailored recommendations for Plant Managers, Demand Planners, Sales, and Executives
- **Bulk Export**: Export all SKU forecasts, volatility rankings, and portfolio analysis in one consolidated CSV

## Run Locally

**Prerequisites:** Node.js 16+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your API keys in [.env.local](.env.local):
   - `GEMINI_API_KEY` (required for Gemini)
   - `OPENAI_API_KEY` (optional, for OpenAI GPT support)
   - `ANTHROPIC_API_KEY` (optional, for Claude support)

3. Run the app:
   ```bash
   npm run dev
   ```

## Data Upload Format

### Historical Sales Data
```
Date,SKU,Category,Quantity
2024-01-15,SKU-101,Electronics,500
2024-01-15,SKU-102,Automotive,350
```

**Date Format Support:** The app accepts dates in multiple formats:
- `YYYY-MM-DD` (2024-01-15) ✅
- `M/D/YYYY` (1/15/2024) ✅
- `MM/DD/YYYY` (01/15/2024) ✅
- `MM-DD-YYYY` (01-15-2024) ✅

### Product Attributes
```
SKU,Category,LeadTimeDays,UnitCost,SellingPrice,ServiceLevel
SKU-101,Electronics,30,100,150,0.95
SKU-102,Automotive,45,200,300,0.95
```

### Current Inventory Levels
```
SKU,OnHand,LastUpdated
SKU-101,1500,2024-05-01
SKU-102,2200,2024-05-01
```

### Production Plans & Open POs
```
SKU,Date,Quantity,Type
SKU-101,2024-06-15,600,production
SKU-101,2024-07-10,500,po
SKU-102,2024-06-20,450,po
SKU-102,2024-07-25,700,production
```
**Format Notes:**
- **Date**: Arrival date in YYYY-MM-DD, M/D/YYYY, MM/DD/YYYY, or MM-DD-YYYY format
- **Quantity**: Number of units
- **Type**: Either `production` (completed goods) or `po` (open purchase order)
- Supports both past and future production plans for accurate projections

## Inventory Alerts & Export

When inventory is projected to dip below safety stock or go negative, the system generates alerts with:
- **Stockout Risk Date**: When inventory hits critical levels
- **Current On-Hand**: Starting inventory balance
- **Projected Inventory**: Inventory level at risk date
- **Production Scheduled**: Total production units up to the alert date
- **Demand Expected**: Total demand expected up to the alert date

Export alerts as CSV to share with planning and procurement teams.

## Key Workflows

### Scenario 1: Planning for Seasonal Demand
1. Upload historical sales (shows demand seasonality)
2. Select forecasting method (recommend Holt-Winters for seasonal goods)
3. Review projected inventory chart
4. Upload production plan to see if current capacity meets demand
5. If alerts appear, export and adjust production schedules

### Scenario 2: Managing Supply Chain Risk
1. Adjust "Supplier Volatility" slider to simulate delayed lead times
2. Monitor safety stock level changes
3. Review SKU Volatility ranking to identify high-variance products
4. Apply market disruptions (e.g., -25% demand shock) to stress-test
5. Export alerts to prepare contingency plans

### Scenario 3: Cross-SKU Analysis (Sandbox Page)
1. Navigate to **Sandbox** tab for consolidated analysis
2. View **Portfolio Transformation Matrix** to see how SKU classifications shift from historical to forecasted
3. Review **SKU Volatility Chart** comparing historic vs. projected demand patterns
4. Use **Consolidated Analysis Table** to identify high-volatility and at-risk SKUs
5. Export volatility & portfolio mix data for Excel/Power BI analysis
6. Adjust replenishment strategies per SKU class and volatility profile

## Technical Documentation

See [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md) for:
- Detailed forecasting algorithm explanations
- Supply chain calculation formulas
- AI service integration patterns
- Production plan calculation flow
- Type definitions and data schemas

## File Structure

```
src/
├── components/          # React UI components
├── services/           # AI API integrations (Claude, Gemini, OpenAI)
├── utils/              # Core forecasting, supply chain, and export logic
├── App.tsx             # Main application component
├── types.ts            # TypeScript interfaces
└── constants.ts        # Sample data and configuration
```

## License

MIT

