/**
 * Comprehensive ARIMA Backtest: All Methodologies
 * Training: 9/2022 - 12/2024 (27 months)
 * Test/Actual: 1/2025 - 6/2025 (6 months)
 * Actual Values from 10CH export: [31, 59, 39, 29, 35, 47]
 */

import fs from 'fs';

// 10CH training data through 12/2024
const training = [
  3, 8, 17, 12, 62, 62, 57, 27, 24, 20, 35, 27,  // 2022 Sep-Dec, 2023 Jan-Nov
  24, 41, 16, 11, 20, 27, 34, 27, 46, 18, 21, 16, // 2023 Dec, 2024 Jan-Nov
  33, 27, 21, 21 // 2024 Dec
];

// Actual observed values 1/2025 - 6/2025
const actual = [31, 59, 39, 29, 35, 47];

// Stats
const mean = training.reduce((a, b) => a + b) / training.length;
const variance = training.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / training.length;
const stdDev = Math.sqrt(variance);
const n = training.length;

console.log(`Training Data: ${n} months (9/2022 - 12/2024)`);
console.log(`Test Period: 6 months (1/2025 - 6/2025)`);
console.log(`Actual Values: [${actual.join(', ')}]\n`);

// ============ HOLT-WINTERS ADDITIVE ============
function hwAdditive(values, horizon) {
  const L = 12, alpha = 0.3, beta = 0.1, gamma = 0.05;
  let level = values.slice(0, L).reduce((a, b) => a + b) / L;
  let trend = (values[L] - values[0]) / L;
  let seasonal = Array.from({ length: L }, (_, i) => values[i] - level);

  for (let i = L; i < values.length; i++) {
    const y = values[i];
    const lastLevel = level;
    level = alpha * (y - seasonal[i % L]) + (1 - alpha) * (lastLevel + trend);
    trend = beta * (level - lastLevel) + (1 - beta) * trend;
    seasonal[i % L] = gamma * (y - level) + (1 - gamma) * seasonal[i % L];
  }

  const forecast = [];
  for (let h = 1; h <= horizon; h++) {
    const idx = (values.length - L + h - 1) % L;
    forecast.push(Math.max(0, Math.round(level + (h * trend) + seasonal[idx])));
  }
  return forecast;
}

// ============ HOLT-WINTERS MULTIPLICATIVE ============
function hwMultiplicative(values, horizon) {
  const L = 12, alpha = 0.3, beta = 0.1, gamma = 0.05;
  let level = values.slice(0, L).reduce((a, b) => a + b) / L;
  let trend = (values[L] - values[0]) / L;
  let seasonal = Array.from({ length: L }, (_, i) => values[i] / level);

  for (let i = L; i < values.length; i++) {
    const y = values[i];
    const lastLevel = level;
    level = alpha * (y / seasonal[i % L]) + (1 - alpha) * (lastLevel + trend);
    trend = beta * (level - lastLevel) + (1 - beta) * trend;
    seasonal[i % L] = gamma * (y / level) + (1 - gamma) * seasonal[i % L];
  }

  const forecast = [];
  for (let h = 1; h <= horizon; h++) {
    const idx = (values.length - L + h - 1) % L;
    forecast.push(Math.max(0, Math.round((level + (h * trend)) * seasonal[idx])));
  }
  return forecast;
}

// ============ LINEAR REGRESSION ============
function linear(values, horizon) {
  const x = Array.from({ length: values.length }, (_, i) => i + 1);
  const xMean = x.reduce((a, b) => a + b) / values.length;
  const yMean = mean;
  
  let numerator = 0, denominator = 0;
  for (let i = 0; i < values.length; i++) {
    numerator += (x[i] - xMean) * (values[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }
  
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  const forecast = [];
  for (let h = 1; h <= horizon; h++) {
    forecast.push(Math.max(0, Math.round(intercept + slope * (values.length + h))));
  }
  return forecast;
}

// ============ PROPHET (Reference: Full History) ============
function prophetReference(values, horizon) {
  const L = 12;
  const avgGrowth = (values[values.length-1] - values[0]) / values.length;
  const mean_val = values.reduce((a, b) => a + b) / values.length;
  const seasonal = Array(L).fill(0);
  
  for (let i = 0; i < values.length; i++) {
    seasonal[i % L] += (values[i] - mean_val);
  }
  for (let i = 0; i < L; i++) {
    seasonal[i] /= Math.ceil(values.length / L);
  }

  const forecast = [];
  for (let i = 1; i <= horizon; i++) {
    const seasonalBase = seasonal[(i - 1) % 12];
    const simulatedVal = seasonalBase + mean_val + (avgGrowth * 1.2 * i);
    forecast.push(Math.max(0, Math.round(simulatedVal)));
  }
  return forecast;
}

// ============ PROPHET (App: Last 12 months) ============
function prophetApp(values, horizon) {
  const recentValues = values.slice(-12);
  const avgGrowth = (values[values.length-1] - values[0]) / values.length;

  const forecast = [];
  for (let i = 1; i <= horizon; i++) {
    const seasonalBase = recentValues[(i - 1) % 12];
    const simulatedVal = seasonalBase + (avgGrowth * 1.2 * i);
    forecast.push(Math.max(0, Math.round(simulatedVal)));
  }
  return forecast;
}

// ============ ARIMA (Reference: Differencing) ============
function arimaReference(values, horizon) {
  const diffs = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(values[i] - values[i-1]);
  }
  
  const diffMean = diffs.reduce((a, b) => a + b) / diffs.length;
  let numerator = 0, denominator = 0;
  for (let i = 1; i < diffs.length; i++) {
    numerator += (diffs[i-1] - diffMean) * (diffs[i] - diffMean);
    denominator += Math.pow(diffs[i-1] - diffMean, 2);
  }
  const phi = numerator / denominator;
  
  const forecast = [];
  let lastValue = values[values.length-1];
  let lastDiff = diffs[diffs.length - 1];
  
  for (let i = 1; i <= horizon; i++) {
    const nextDiff = diffMean + phi * (lastDiff - diffMean);
    const nextValue = lastValue + nextDiff;
    forecast.push(Math.max(0, Math.round(nextValue)));
    lastValue = nextValue;
    lastDiff = nextDiff;
  }
  return forecast;
}

// ============ ARIMA (App: Mean Reversion) ============
function arimaApp(values, horizon) {
  const forecast = [];
  let currentVal = values[values.length-1];
  const arCoefficient = 0.85;
  const mean = values.reduce((a,b) => a+b, 0) / values.length;

  for (let i = 1; i <= horizon; i++) {
    currentVal = mean + arCoefficient * (currentVal - mean);
    forecast.push(Math.max(0, Math.round(currentVal)));
  }
  return forecast;
}

// Generate all forecasts
const forecasts = {
  'HW Additive': hwAdditive(training, 6),
  'HW Multiplicative': hwMultiplicative(training, 6),
  'Linear': linear(training, 6),
  'Prophet (Reference)': prophetReference(training, 6),
  'Prophet (App)': prophetApp(training, 6),
  'ARIMA (Reference)': arimaReference(training, 6),
  'ARIMA (App)': arimaApp(training, 6),
};

// Calculate metrics
function calcMetrics(forecast, actual) {
  const mae = forecast.reduce((sum, f, i) => sum + Math.abs(f - actual[i]), 0) / forecast.length;
  const rmse = Math.sqrt(forecast.reduce((sum, f, i) => sum + Math.pow(f - actual[i], 2), 0) / forecast.length);
  const mape = (forecast.reduce((sum, f, i) => sum + Math.abs(f - actual[i]), 0) / actual.reduce((a, b) => a + b)) * 100;
  return { mae, rmse, mape };
}

const results = {};
Object.entries(forecasts).forEach(([name, forecast]) => {
  results[name] = calcMetrics(forecast, actual);
});

// Display results
console.log('=== FORECAST COMPARISON ===\n');
console.log('Month       | Actual | HW Add | HW Mul | Linear | Prophet(Ref) | Prophet(App) | ARIMA(Ref) | ARIMA(App)');
console.log('------------|--------|--------|--------|--------|-------------|-------------|-----------|----------');

const months = ['Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025'];
for (let i = 0; i < 6; i++) {
  let row = `${months[i].padEnd(11)}| ${String(actual[i]).padStart(6)} | `;
  row += `${String(forecasts['HW Additive'][i]).padStart(6)} | `;
  row += `${String(forecasts['HW Multiplicative'][i]).padStart(6)} | `;
  row += `${String(forecasts['Linear'][i]).padStart(6)} | `;
  row += `${String(forecasts['Prophet (Reference)'][i]).padStart(11)} | `;
  row += `${String(forecasts['Prophet (App)'][i]).padStart(12)} | `;
  row += `${String(forecasts['ARIMA (Reference)'][i]).padStart(9)} | `;
  row += `${String(forecasts['ARIMA (App)'][i]).padStart(9)}`;
  console.log(row);
}

// Accuracy summary
console.log('\n=== ACCURACY METRICS ===\n');
console.log('Methodology                | MAE  | RMSE | MAPE');
console.log('---------------------------|------|------|--------');

// Sort by MAPE
const sorted = Object.entries(results).sort((a, b) => a[1].mape - b[1].mape);
sorted.forEach(([name, metrics]) => {
  console.log(`${name.padEnd(27)}| ${metrics.mae.toFixed(1).padStart(4)} | ${metrics.rmse.toFixed(1).padStart(4)} | ${metrics.mape.toFixed(1).padStart(5)}%`);
});

// Recommendations
console.log('\n=== RANKINGS BY METRIC ===\n');
const sortedByMae = Object.entries(results).sort((a, b) => a[1].mae - b[1].mae);
const sortedByRmse = Object.entries(results).sort((a, b) => a[1].rmse - b[1].rmse);
const sortedByMape = Object.entries(results).sort((a, b) => a[1].mape - b[1].mape);

console.log('Best by MAE (Mean Absolute Error):');
sortedByMae.slice(0, 3).forEach((e, i) => console.log(`  ${i+1}. ${e[0]} (${e[1].mae.toFixed(1)})`));

console.log('\nBest by RMSE (Root Mean Squared Error):');
sortedByRmse.slice(0, 3).forEach((e, i) => console.log(`  ${i+1}. ${e[0]} (${e[1].rmse.toFixed(1)})`));

console.log('\nBest by MAPE (Mean Absolute Percentage Error):');
sortedByMape.slice(0, 3).forEach((e, i) => console.log(`  ${i+1}. ${e[0]} (${e[1].mape.toFixed(1)}%)`));

// App vs Reference comparison
console.log('\n=== APP vs REFERENCE COMPARISON ===\n');
const prophetAppErr = results['Prophet (App)'].mape;
const prophetRefErr = results['Prophet (Reference)'].mape;
const arimaAppErr = results['ARIMA (App)'].mape;
const arimaRefErr = results['ARIMA (Reference)'].mape;

console.log('Prophet:');
console.log(`  App:       ${prophetAppErr.toFixed(1)}% MAPE`);
console.log(`  Reference: ${prophetRefErr.toFixed(1)}% MAPE`);
console.log(`  Better: ${prophetAppErr < prophetRefErr ? '✓ App' : '✓ Reference'} (${Math.abs(prophetAppErr - prophetRefErr).toFixed(1)}% difference)\n`);

console.log('ARIMA:');
console.log(`  App:       ${arimaAppErr.toFixed(1)}% MAPE`);
console.log(`  Reference: ${arimaRefErr.toFixed(1)}% MAPE`);
console.log(`  Better: ${arimaAppErr < arimaRefErr ? '✓ App' : '✓ Reference'} (${Math.abs(arimaAppErr - arimaRefErr).toFixed(1)}% difference)\n`);
