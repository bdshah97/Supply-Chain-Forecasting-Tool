import * as fs from 'fs';
import { DataPoint, ForecastPoint, ForecastMethodology } from './types';
import { calculateForecast } from './utils/forecasting';

// Read CSV
const csvContent = fs.readFileSync('./Big Tex Historical Sales.csv', 'utf-8');
const lines = csvContent.split('\n');
const data: Record<string, DataPoint[]> = {};

// Parse CSV
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const [category, sku, dateStr, quantity] = line.split(',');
  const qty = parseInt(quantity, 10);
  
  // Convert M/D/YYYY to YYYY-MM-01
  const [month, day, year] = dateStr.split('/');
  const normalizedDate = `${year}-${month.padStart(2, '0')}-01`;
  
  if (!data[sku]) data[sku] = [];
  data[sku].push({ 
    sku, 
    category, 
    date: normalizedDate, 
    quantity: qty 
  });
}

// Sort each SKU by date
Object.keys(data).forEach(sku => {
  data[sku].sort((a, b) => a.date.localeCompare(b.date));
});

// Select 3 SKUs: 10CH, 10DM, and one more
const selectedSkus = ['10CH', '10DM'];
// Find a third SKU with good data
const thirdSku = Object.keys(data).find(sku => 
  sku !== '10CH' && sku !== '10DM' && data[sku].length > 20
);
if (thirdSku) selectedSkus.push(thirdSku);

console.log(`\n=== HOLT-WINTERS FORECAST TEST ===`);
console.log(`Historical End Date: 2025-07-31`);
console.log(`Forecast Period: 2025-08-01 to 2026-07-01 (12 months)\n`);

selectedSkus.forEach(sku => {
  const skuData = data[sku];
  
  // Filter to data up to 2025-07-31
  const filteredData = skuData.filter(d => d.date <= '2025-07-31');
  
  if (filteredData.length === 0) {
    console.log(`SKU ${sku}: No data through 2025-07-31`);
    return;
  }
  
  console.log(`\n--- SKU ${sku} ---`);
  console.log(`Data Points: ${filteredData.length} (${filteredData[0].date} to ${filteredData[filteredData.length - 1].date})`);
  
  const forecast = calculateForecast(
    filteredData,
    12,
    'monthly',
    95,
    ForecastMethodology.HOLT_WINTERS,
    'multiplicative',
    false,
    '2025-07-31'
  );
  
  // Show only forecast points (8/2025 to 7/2026)
  const forecastPoints = forecast.filter(p => p.isForecast);
  
  console.log(`\nForecasted Values (8/2025 - 7/2026):`);
  console.log(`Date        | Forecast | Lower Bound | Upper Bound`);
  console.log(`------------|----------|-------------|------------`);
  
  forecastPoints.forEach(p => {
    const displayDate = p.date.substring(0, 7).replace('-', '/');
    console.log(
      `${displayDate}-01  |   ${String(p.forecast).padStart(5)}   |   ${String(p.lowerBound).padStart(5)}    |   ${String(p.upperBound).padStart(5)}`
    );
  });
});
