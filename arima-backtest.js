/**
 * ARIMA Backtest: Compare app vs reference implementation
 * Training: 9/2022 - 12/2024 (27 months)
 * Forecast Period: 1/2025 - 6/2025 (6 months)
 * Actual Values: 31, 59, 39, 29, 35, 47
 */

import fs from 'fs';

// 10CH data through 12/2024 (training data)
const training = [
  3, 8, 17, 12, 62, 62, 57, 27, 24, 20, 35, 27,  // 2022 Sep-Dec, 2023 Jan-Nov
  24, 41, 16, 11, 20, 27, 34, 27, 46, 18, 21, 16, // 2023 Dec, 2024 Jan-Nov
  33, 27, 21, 21 // 2024 Dec
];

// Actual values from CSV (1/2025 - 6/2025)
const actual = [31, 59, 39, 29, 35, 47];

console.log(`Training Data: ${training.length} months (9/2022 - 12/2024)`);
console.log(`Actual Values (1/2025 - 6/2025): [${actual.join(', ')}]\n`);

// ============ APP'S ARIMA ============
function arimaApp(values, horizon) {
  const n = values.length;
  const forecast = [];
  let currentVal = values[n-1];
  const arCoefficient = 0.85;

  for (let i = 1; i <= horizon; i++) {
    const mean = values.reduce((a,b) => a+b, 0) / n;
    currentVal = mean + arCoefficient * (currentVal - mean);
    forecast.push(Math.max(0, Math.round(currentVal)));
  }
  return forecast;
}

// ============ REFERENCE ARIMA ============
function arimaReference(values, horizon) {
  const n = values.length;
  
  // First difference
  const diffs = [];
  for (let i = 1; i < n; i++) {
    diffs.push(values[i] - values[i-1]);
  }
  
  // AR(1) on differences
  const diffMean = diffs.reduce((a, b) => a + b) / diffs.length;
  let numerator = 0, denominator = 0;
  for (let i = 1; i < diffs.length; i++) {
    numerator += (diffs[i-1] - diffMean) * (diffs[i] - diffMean);
    denominator += Math.pow(diffs[i-1] - diffMean, 2);
  }
  const phi = numerator / denominator;
  
  const forecast = [];
  let lastValue = values[n-1];
  let lastDiff = diffs[diffs.length - 1];
  
  for (let i = 1; i <= horizon; i++) {
    const nextDiff = diffMean + phi * (lastDiff - diffMean);
    const nextValue = lastValue + nextDiff;
    const f = Math.max(0, Math.round(nextValue));
    forecast.push(f);
    lastValue = nextValue;
    lastDiff = nextDiff;
  }
  return forecast;
}

// Generate forecasts
const forecastApp = arimaApp(training, 6);
const forecastRef = arimaReference(training, 6);

console.log('=== FORECASTS ===\n');
console.log('Month       | Actual | App ARIMA | Ref ARIMA | App Err | Ref Err');
console.log('------------|--------|-----------|-----------|---------|--------');

const months = ['Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025'];
let appErrors = 0, refErrors = 0;
let appAbsErrors = [], refAbsErrors = [];
let appSqErrors = [], refSqErrors = [];

for (let i = 0; i < 6; i++) {
  const appErr = Math.abs(forecastApp[i] - actual[i]);
  const refErr = Math.abs(forecastRef[i] - actual[i]);
  appAbsErrors.push(appErr);
  refAbsErrors.push(refErr);
  appSqErrors.push(appErr * appErr);
  refSqErrors.push(refErr * refErr);
  
  console.log(`${months[i].padEnd(11)}| ${String(actual[i]).padStart(6)} | ${String(forecastApp[i]).padStart(9)} | ${String(forecastRef[i]).padStart(9)} | ${String(appErr).padStart(7)} | ${String(refErr).padStart(7)}`);
}

// Calculate metrics
const mae_app = appAbsErrors.reduce((a, b) => a + b) / 6;
const mae_ref = refAbsErrors.reduce((a, b) => a + b) / 6;
const rmse_app = Math.sqrt(appSqErrors.reduce((a, b) => a + b) / 6);
const rmse_ref = Math.sqrt(refSqErrors.reduce((a, b) => a + b) / 6);
const mape_app = (appAbsErrors.reduce((a, b) => a + b) / actual.reduce((a, b) => a + b)) * 100;
const mape_ref = (refAbsErrors.reduce((a, b) => a + b) / actual.reduce((a, b) => a + b)) * 100;

console.log('\n=== ACCURACY METRICS ===\n');
console.log(`MAE  (Mean Absolute Error):`);
console.log(`  App ARIMA:  ${mae_app.toFixed(2)}`);
console.log(`  Ref ARIMA:  ${mae_ref.toFixed(2)}`);
console.log(`  Winner: ${mae_app < mae_ref ? '✓ App' : '✓ Reference'} (${Math.abs(mae_app - mae_ref).toFixed(2)} better)\n`);

console.log(`RMSE (Root Mean Squared Error):`);
console.log(`  App ARIMA:  ${rmse_app.toFixed(2)}`);
console.log(`  Ref ARIMA:  ${rmse_ref.toFixed(2)}`);
console.log(`  Winner: ${rmse_app < rmse_ref ? '✓ App' : '✓ Reference'} (${Math.abs(rmse_app - rmse_ref).toFixed(2)} better)\n`);

console.log(`MAPE (Mean Absolute Percentage Error):`);
console.log(`  App ARIMA:  ${mape_app.toFixed(1)}%`);
console.log(`  Ref ARIMA:  ${mape_ref.toFixed(1)}%`);
console.log(`  Winner: ${mape_app < mape_ref ? '✓ App' : '✓ Reference'} (${Math.abs(mape_app - mape_ref).toFixed(1)}% better)\n`);

// Overall assessment
const appWins = (mae_app < mae_ref ? 1 : 0) + (rmse_app < rmse_ref ? 1 : 0) + (mape_app < mape_ref ? 1 : 0);
const refWins = 3 - appWins;

console.log('=== RECOMMENDATION ===\n');
console.log(`App ARIMA wins: ${appWins}/3 metrics`);
console.log(`Reference ARIMA wins: ${refWins}/3 metrics\n`);

if (refWins >= 2) {
  console.log('→ USE REFERENCE ARIMA (Differencing-based)');
  console.log(`  Better captures trend and momentum in the data.`);
} else if (appWins >= 2) {
  console.log('→ KEEP APP ARIMA');
  console.log(`  Mean-reversion approach works better for this data.`);
} else {
  console.log('→ ROUGHLY EQUIVALENT');
  console.log(`  Consider which approach is more appropriate for supply chain forecasting.`);
}
