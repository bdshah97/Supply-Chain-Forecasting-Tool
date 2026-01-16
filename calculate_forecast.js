// Quick HW calculation for validation
const values = [1, 1, 63, 210, 390, 277, 263, 375, 375, 262, 165, 301, 268, 629, 592, 454, 446, 288, 98, 10];
const L = 12;
const alpha = 0.3, beta = 0.1, gamma = 0.2;
const n = values.length;

// Initialize
const level0 = values.reduce((a,b) => a+b, 0) / n || 1;
console.log('Initial level:', level0.toFixed(2));

let level = level0;
let trend = 0;
const seasonal = new Array(L).fill(0);

// Initialize seasonal
for (let i = 0; i < Math.min(L, n); i++) {
  seasonal[i] = values[i] - level0;
}
console.log('Initial seasonal deviations:');
seasonal.forEach((s, i) => console.log(`  Month ${i}: ${s.toFixed(2)}`));

// Update
for (let i = 0; i < n; i++) {
  const value = values[i];
  const prevLevel = level;
  level = alpha * (value - seasonal[i % L]) + (1 - alpha) * (level + trend);
  trend = beta * (level - prevLevel) + (1 - beta) * trend;
  seasonal[i % L] = gamma * (value - level) + (1 - gamma) * seasonal[i % L];
}

console.log('\nFinal state after processing all data:');
console.log('Level:', level.toFixed(2));
console.log('Trend:', trend.toFixed(2));
console.log('Final seasonal deviations:');
seasonal.forEach((s, i) => console.log(`  Month ${i}: ${s.toFixed(2)}`));

// Forecast 12 months (Aug 2025 - Jul 2026)
console.log('\nForecast (12 months from 8/2025):');
const monthNames = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
const forecast = [];
for (let i = 1; i <= 12; i++) {
  const f = Math.max(0, level + i * trend + seasonal[(n + i - 1) % L]);
  forecast.push(f);
  console.log(`  ${monthNames[i-1]} 2025/2026: ${f.toFixed(0)}`);
}
