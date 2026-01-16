/**
 * Manual Holt-Winters Forecast for 10CH
 * Historical data: 9/2022 - 7/2025 (35 months)
 * Forecast: 8/2025 - 7/2026 (12 months)
 * Method: Holt-Winters Additive
 */

// Extract 10CH data through 7/2025
const data_10CH = [
  { date: "2022-09-01", qty: 3 },
  { date: "2022-10-01", qty: 8 },
  { date: "2022-11-01", qty: 17 },
  { date: "2022-12-01", qty: 12 },
  { date: "2023-01-01", qty: 62 },
  { date: "2023-02-01", qty: 62 },
  { date: "2023-03-01", qty: 57 },
  { date: "2023-04-01", qty: 27 },
  { date: "2023-05-01", qty: 24 },
  { date: "2023-06-01", qty: 20 },
  { date: "2023-07-01", qty: 35 },
  { date: "2023-08-01", qty: 27 },
  { date: "2023-09-01", qty: 24 },
  { date: "2023-10-01", qty: 41 },
  { date: "2023-11-01", qty: 16 },
  { date: "2023-12-01", qty: 11 },
  { date: "2024-01-01", qty: 20 },
  { date: "2024-02-01", qty: 27 },
  { date: "2024-03-01", qty: 34 },
  { date: "2024-04-01", qty: 27 },
  { date: "2024-05-01", qty: 46 },
  { date: "2024-06-01", qty: 18 },
  { date: "2024-07-01", qty: 21 },
  { date: "2024-08-01", qty: 16 },
  { date: "2024-09-01", qty: 33 },
  { date: "2024-10-01", qty: 27 },
  { date: "2024-11-01", qty: 21 },
  { date: "2024-12-01", qty: 21 },
  { date: "2025-01-01", qty: 31 },
  { date: "2025-02-01", qty: 59 },
  { date: "2025-03-01", qty: 39 },
  { date: "2025-04-01", qty: 29 },
  { date: "2025-05-01", qty: 35 },
  { date: "2025-06-01", qty: 47 },
  { date: "2025-07-01", qty: 28 },
];

const values = data_10CH.map(d => d.qty);
const n = values.length;

console.log("=== 10CH HOLT-WINTERS FORECAST ===");
console.log(`Historical data points: ${n}`);
console.log(`Data range: ${data_10CH[0].date} to ${data_10CH[n-1].date}`);
console.log(`Values: [${values.join(', ')}]\n`);

// Calculate coefficient of variability
const mean = values.reduce((a, b) => a + b, 0) / n;
let variance = 0;
values.forEach(v => {
  variance += Math.pow(v - mean, 2);
});
variance /= n;
const stdDev = Math.sqrt(variance);
const cv = stdDev / mean; // Coefficient of Variability

console.log(`Mean: ${mean.toFixed(2)}`);
console.log(`Std Dev: ${stdDev.toFixed(2)}`);
console.log(`CV: ${cv.toFixed(4)}`);
console.log(`Method: ${cv < 0.3 ? 'Additive' : 'Multiplicative'} (CV < 0.3 suggests Additive)\n`);

// Holt-Winters ADDITIVE parameters
const L = 12; // Monthly seasonality
const alpha = 0.3;
const beta = 0.1;
const gamma = 0.05;
const horizon = 12;

console.log("Holt-Winters Additive Parameters:");
console.log(`  L (seasonality): ${L}`);
console.log(`  alpha (level): ${alpha}`);
console.log(`  beta (trend): ${beta}`);
console.log(`  gamma (seasonal): ${gamma}\n`);

// Initialize with first L values
let level = 0;
let trend = 0;
let seasonal = Array(L).fill(0);

// Initialize level as average of first L values
for (let i = 0; i < L; i++) {
  level += values[i];
}
level /= L;

// Initialize trend as average change
trend = (values[L] - values[0]) / L;

// Initialize seasonal factors
for (let i = 0; i < L; i++) {
  seasonal[i] = values[i] - level;
}

console.log(`Initial level: ${level.toFixed(2)}`);
console.log(`Initial trend: ${trend.toFixed(4)}`);
console.log(`Initial seasonal factors: [${seasonal.map(s => s.toFixed(2)).join(', ')}]\n`);

// Fit the model to all historical data
for (let i = L; i < n; i++) {
  const y = values[i];
  const seasonalComponent = seasonal[i % L];
  const lastLevel = level;
  
  // Update level
  level = alpha * (y - seasonalComponent) + (1 - alpha) * (lastLevel + trend);
  
  // Update trend
  trend = beta * (level - lastLevel) + (1 - beta) * trend;
  
  // Update seasonal factor
  seasonal[i % L] = gamma * (y - level) + (1 - gamma) * seasonalComponent;
}

console.log("After fitting to all historical data:");
console.log(`  Final level: ${level.toFixed(2)}`);
console.log(`  Final trend: ${trend.toFixed(4)}`);
console.log(`  Final seasonal factors: [${seasonal.map(s => s.toFixed(2)).join(', ')}]\n`);

// Generate forecasts for next 12 months
const forecasts = [];
const stdDevForUncertainty = stdDev;
const zMultiplier = 1.96; // 95% confidence interval

console.log("12-Month Forecast (8/2025 - 7/2026):");
console.log("Month       | Forecast | Lower Bound | Upper Bound");
console.log("------------|----------|-------------|-------------");

for (let h = 1; h <= horizon; h++) {
  const seasonalIdx = (n - L + h - 1) % L;
  const forecast = level + (h * trend) + seasonal[seasonalIdx];
  const forecastRounded = Math.max(0, Math.round(forecast));
  
  const uncertainty = zMultiplier * stdDevForUncertainty * Math.sqrt(h) * 0.4;
  const lowerBound = Math.max(0, Math.round(forecast - uncertainty));
  const upperBound = Math.round(forecast + uncertainty);
  
  // Generate date: 8/2025 = 2025-08-01, then 2025-09-01, ..., 2026-07-01
  const forecastDate = new Date(2025, 7, 1); // August 2025
  forecastDate.setMonth(forecastDate.getMonth() + (h - 1));
  const dateStr = forecastDate.toISOString().split('T')[0].substring(0, 7).replace('-', '/') + '-01';
  
  forecasts.push({
    date: dateStr,
    forecast: forecastRounded,
    lower: lowerBound,
    upper: upperBound
  });
  
  console.log(`${dateStr}  |   ${String(forecastRounded).padStart(5)}   |   ${String(lowerBound).padStart(5)}    |   ${String(upperBound).padStart(5)}`);
}

console.log("\n=== COMPARISON TABLE ===");
console.log("Date        | Forecast | Lower Bound | Upper Bound");
console.log("------------|----------|-------------|-------------");
forecasts.forEach(f => {
  console.log(`${f.date}  |   ${String(f.forecast).padStart(5)}   |   ${String(f.lower).padStart(5)}    |   ${String(f.upper).padStart(5)}`);
});
