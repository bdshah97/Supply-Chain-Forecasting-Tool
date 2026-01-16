
import { DataPoint, ForecastPoint, ForecastMetrics, ForecastMethodology, MarketShock, TimeInterval } from '../types';

/**
 * Statistics Helpers
 */
const getStdDev = (values: number[]) => {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(values.reduce((sq, x) => sq + Math.pow(x - mean, 2), 0) / n);
};

const getZMultiplier = (conf: number) => {
  // Precision mapping for statistical confidence levels
  if (conf >= 99) return 2.576;
  if (conf >= 95) return 1.96;
  if (conf >= 90) return 1.645;
  if (conf >= 85) return 1.44;
  if (conf >= 80) return 1.28;
  return 1.96; // Default to 95%
};

/**
 * Auto-detect best Holt-Winters variant (Additive vs Multiplicative)
 * Based on data characteristics: coefficient of variation, early sparsity, and trend strength
 */
export const detectHWMethod = (values: number[]): 'additive' | 'multiplicative' => {
  if (values.length < 4) return 'multiplicative'; // Default for very small datasets
  
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  
  // 1. Coefficient of Variation (volatility relative to mean)
  const stdDev = getStdDev(values);
  const cv = mean > 0 ? stdDev / mean : 0;
  
  // 2. Early Sparsity (% of very low/zero values in first 25% of data)
  const earlyDataSize = Math.ceil(n * 0.25);
  const earlyValues = values.slice(0, earlyDataSize);
  const lowValueThreshold = mean * 0.2; // Values below 20% of mean are considered "low"
  const sparseCount = earlyValues.filter(v => v === 0 || v < lowValueThreshold).length;
  const earlySparsity = earlyValues.length > 0 ? sparseCount / earlyValues.length : 0;
  
  // 3. Trend Strength (slope of linear regression)
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const trendStrength = Math.abs(slope) / (mean > 0 ? mean : 1); // Normalized slope
  
  // Decision logic
  // Use ADDITIVE if:
  // - High volatility (CV > 0.5) OR
  // - Sparse early data (>40% zeros/lows) OR
  // - Strong growth trend (trend > 0.05 normalized)
  if (cv > 0.5 || earlySparsity > 0.4 || trendStrength > 0.05) {
    return 'additive';
  }
  
  return 'multiplicative';
};

/**
 * Apply Market Shocks to Forecasts
 */
export const applyMarketShocks = (forecastPoints: ForecastPoint[], shocks: MarketShock[]): ForecastPoint[] => {
  if (shocks.length === 0) return forecastPoints;
  
  return forecastPoints.map(point => {
    const shock = shocks.find(s => s.month === point.date.substring(0, 7)); // Extract YYYY-MM from date
    if (shock && point.isForecast) {
      const multiplier = 1 + (shock.percentageChange / 100);
      return {
        ...point,
        forecast: Math.round(point.forecast * multiplier),
        scenarioForecast: point.scenarioForecast ? Math.round(point.scenarioForecast * multiplier) : undefined,
        projectedInventory: point.projectedInventory ? Math.round(point.projectedInventory * multiplier) : undefined,
        projectedRevenue: point.projectedRevenue ? Math.round(point.projectedRevenue * multiplier) : undefined,
        projectedMargin: point.projectedMargin ? Math.round(point.projectedMargin * multiplier) : undefined
      };
    }
    return point;
  });
};

/**
 * Anomaly Cleaning (Outlier Smoothing)
 */
export const cleanAnomalies = (data: DataPoint[]): DataPoint[] => {
  const values = data.map(d => d.quantity);
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const std = getStdDev(values);
  
  return data.map(d => {
    const isAnomaly = Math.abs(d.quantity - mean) > 2.5 * std;
    return isAnomaly ? { ...d, quantity: Math.round(mean) } : d;
  });
};

/**
 * Holt-Winters Additive (Better for sparse/volatile data or products with growth ramp-ups)
 */
const runHoltWintersAdditive = (values: number[], horizon: number, L: number): number[] => {
  const alpha = 0.3, beta = 0.1, gamma = 0.05; // Reduced gamma to prevent extreme seasonal dips
  const n = values.length;
  
  const level0 = values.reduce((a, b) => a + b, 0) / n || 1;
  let level = level0;
  let trend = 0;
  const seasonal = new Array(L).fill(0);
  
  for (let i = 0; i < Math.min(L, n); i++) {
    seasonal[i] = values[i] - level0;
  }
  
  for (let i = 0; i < n; i++) {
    const value = values[i];
    const prevLevel = level;
    level = alpha * (value - seasonal[i % L]) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[i % L] = gamma * (value - level) + (1 - gamma) * seasonal[i % L];
  }
  
  const forecast = [];
  for (let i = 1; i <= horizon; i++) {
    forecast.push(Math.max(0, level + i * trend + seasonal[(n + i - 1) % L]));
  }
  return forecast;
};

/**
 * Holt-Winters Multiplicative (Better for steady-state products with consistent seasonality)
 */
const runHoltWintersMultiplicative = (values: number[], horizon: number, L: number): number[] => {
  const alpha = 0.3, beta = 0.1, gamma = 0.05; // Reduced gamma to prevent extreme seasonal dips
  const n = values.length;
  
  // Initialize level as average of first complete cycle
  const initPeriod = Math.min(L, n);
  const level0 = values.slice(0, initPeriod).reduce((a, b) => a + b, 0) / initPeriod || 1;
  
  let level = level0;
  let trend = (values[Math.min(L - 1, n - 1)] - values[0]) / Math.min(L, n - 1) || 0;
  const seasonal = new Array(L).fill(1);
  
  // Initialize seasonal factors
  for (let i = 0; i < initPeriod; i++) {
    seasonal[i] = values[i] / level0;
  }
  
  for (let i = 0; i < n; i++) {
    const value = values[i];
    const prevLevel = level;
    level = alpha * (value / (seasonal[i % L] || 1)) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[i % L] = gamma * (value / (level || 1)) + (1 - gamma) * seasonal[i % L];
  }
  
  const forecast = [];
  for (let i = 1; i <= horizon; i++) {
    forecast.push(Math.max(0, (level + i * trend) * seasonal[(n + i - 1) % L]));
  }
  return forecast;
};

/**
 * Wrapper to choose between HW methods
 */
const runHoltWinters = (values: number[], horizon: number, L: number, method: 'additive' | 'multiplicative' = 'multiplicative'): number[] => {
  return method === 'additive' 
    ? runHoltWintersAdditive(values, horizon, L)
    : runHoltWintersMultiplicative(values, horizon, L);
};

/**
 * Prophet-Inspired Simulation (Additive Trend + Full History Seasonality)
 */
const runProphet = (values: number[], horizon: number): number[] => {
  const n = values.length;
  const L = 12; // Monthly seasonality
  const forecast = [];
  
  // Calculate trend from all available data
  const avgGrowth = (values[n-1] - values[0]) / n;
  
  // Calculate seasonal factors from all data
  const mean = values.reduce((a, b) => a + b) / n;
  const seasonal = Array(L).fill(0);
  for (let i = 0; i < n; i++) {
    seasonal[i % L] += (values[i] - mean);
  }
  for (let i = 0; i < L; i++) {
    seasonal[i] /= Math.ceil(n / L);
  }

  for (let i = 1; i <= horizon; i++) {
    const seasonalBase = seasonal[(i - 1) % 12];
    // Add slightly bullish trend for Prophet simulation
    const simulatedVal = seasonalBase + mean + (avgGrowth * 1.2 * i);
    forecast.push(Math.max(0, Math.round(simulatedVal)));
  }
  return forecast;
};

/**
 * ARIMA Simulation (Auto-Regressive, focusing on last few lags)
 */
const runArima = (values: number[], horizon: number): number[] => {
  const n = values.length;
  const forecast = [];
  let currentVal = values[n-1];
  const arCoefficient = 0.85; // Strong AR factor

  for (let i = 1; i <= horizon; i++) {
    // Regress towards the long term mean
    const mean = values.reduce((a,b) => a+b, 0) / n;
    currentVal = mean + arCoefficient * (currentVal - mean);
    forecast.push(Math.max(0, currentVal));
  }
  return forecast;
};

const runLinear = (values: number[], horizon: number): number[] => {
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) { sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i; }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const forecast = [];
  for (let i = 1; i <= horizon; i++) forecast.push(Math.max(0, slope * (n + i - 1) + intercept));
  return forecast;
};

export const calculateForecast = (
  historicalData: DataPoint[],
  horizon: number,
  trainingDataEndDate: string,
  interval: 'monthly' = 'monthly',
  confidenceLevel: number = 95,
  method: ForecastMethodology = ForecastMethodology.HOLT_WINTERS,
  hwMethod: 'additive' | 'multiplicative' = 'multiplicative',
  autoDetectHW: boolean = false
): ForecastPoint[] => {
  if (historicalData.length < 3 || !trainingDataEndDate) return [];

  // Split data: training (through trainingDataEndDate) and all historical (for display)
  const trainingData = historicalData.filter(d => d.date <= trainingDataEndDate);
  if (trainingData.length < 3) return [];

  const values = trainingData.map(d => d.quantity);
  const L = 12; // Monthly seasonality

  // Auto-detect HW method if requested
  let effectiveHWMethod = hwMethod;
  if (method === ForecastMethodology.HOLT_WINTERS && autoDetectHW) {
    effectiveHWMethod = detectHWMethod(values);
  }

  let forecastValues: number[];
  switch (method) {
    case ForecastMethodology.LINEAR: forecastValues = runLinear(values, horizon); break;
    case ForecastMethodology.PROPHET: forecastValues = runProphet(values, horizon); break;
    case ForecastMethodology.ARIMA: forecastValues = runArima(values, horizon); break;
    case ForecastMethodology.HOLT_WINTERS:
    default: forecastValues = runHoltWinters(values, horizon, L, effectiveHWMethod); break;
  }

  // Return all historical data points (even those after trainingDataEndDate)
  const results: ForecastPoint[] = historicalData.map(d => ({
    date: d.date,
    historical: d.quantity,
    forecast: d.quantity,
    isForecast: d.date > trainingDataEndDate // Mark based on training boundary
  }));

  // Generate forecast starting from month after trainingDataEndDate
  const multiplier = getZMultiplier(confidenceLevel);
  const stdDev = getStdDev(values);
  
  // Normalize lastDate to 1st of month to avoid day-of-month issues during month arithmetic
  const lastDate = new Date(trainingDataEndDate);
  lastDate.setDate(1); // Set to 1st of month to prevent month-skipping during arithmetic

  forecastValues.forEach((val, i) => {
    const step = i + 1;
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(lastDate.getMonth() + step);

    const uncertainty = multiplier * stdDev * Math.sqrt(step) * 0.4;
    const normalizedDate = forecastDate.toISOString().split('T')[0].substring(0, 7) + '-01';
    results.push({
      date: normalizedDate,
      forecast: Math.round(val),
      lowerBound: Math.max(0, Math.round(val - uncertainty)),
      upperBound: Math.round(val + uncertainty),
      isForecast: true
    });
  });

  return results;
};

export const calculateMetrics = (actual: number[], forecast: number[], unitCost: number, sellingPrice: number): ForecastMetrics => {
  let sumAbsError = 0, sumSqError = 0, sumActual = 0, sumError = 0;
  const n = Math.min(actual.length, forecast.length);
  for (let i = 0; i < n; i++) {
    const error = forecast[i] - actual[i];
    sumError += error;
    sumAbsError += Math.abs(error);
    sumSqError += error * error;
    sumActual += actual[i];
  }
  const mape = n > 0 ? (sumAbsError / sumActual) * 100 : 0;
  return {
    mape,
    rmse: Math.sqrt(sumSqError / (n || 1)),
    bias: (sumError / (sumActual || 1)) * 100,
    mad: sumAbsError / (n || 1),
    accuracy: Math.max(0, 100 - mape),
    holdingCostRisk: 0,
    stockoutRevenueRisk: 0
  };
};

/**
 * Aggregate then Allocate methodology:
 * 1. Forecast total demand (sum of all SKUs)
 * 2. Calculate historical SKU mix (each SKU's % of total)
 * 3. Allocate forecast using historical mix
 * Better for multi-SKU portfolios with sparse, low-volume items
 */
export const calculateForecastAggregateAllocate = (
  historicalData: DataPoint[],
  horizon: number,
  timeInterval: TimeInterval,
  confidenceLevel: number,
  hwMethod: 'additive' | 'multiplicative' = 'multiplicative'
): ForecastPoint[] => {
  if (historicalData.length === 0) return [];
  
  // Calculate total demand by date (aggregate)
  const aggregateByDate = new Map<string, number>();
  const skuMixByDate = new Map<string, Map<string, number>>(); // date -> (sku -> quantity)
  
  historicalData.forEach(d => {
    const date = d.date;
    aggregateByDate.set(date, (aggregateByDate.get(date) || 0) + d.quantity);
    
    if (!skuMixByDate.has(date)) {
      skuMixByDate.set(date, new Map());
    }
    skuMixByDate.get(date)!.set(d.sku, d.quantity);
  });
  
  // Create aggregate data sorted by date
  const aggregateData: DataPoint[] = Array.from(aggregateByDate.entries())
    .map(([date, quantity]) => ({ date, quantity, sku: 'ALL', category: 'ALL' }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Forecast the aggregate using Holt-Winters
  const aggregateForecast = runHoltWinters(
    aggregateData.map(d => d.quantity), 
    horizon, 
    12, // Use 12-month seasonality for aggregate
    hwMethod
  );
  
  // Calculate average historical SKU mix percentages
  const skuMixPercentage = new Map<string, number>();
  const uniqueSkus = new Set(historicalData.map(d => d.sku));
  
  uniqueSkus.forEach(sku => {
    const skuTotal = historicalData
      .filter(d => d.sku === sku)
      .reduce((sum, d) => sum + d.quantity, 0);
    const overallTotal = historicalData.reduce((sum, d) => sum + d.quantity, 0);
    skuMixPercentage.set(sku, overallTotal > 0 ? skuTotal / overallTotal : 0);
  });
  
  // Build results: historical actual + forecast with SKU allocation
  const results: ForecastPoint[] = aggregateData.map(d => ({
    date: d.date,
    historical: d.quantity,
    forecast: d.quantity,
    lowerBound: d.quantity,
    upperBound: d.quantity,
    isForecast: false
  }));
  
  // Add forecast periods with SKU allocation
  const lastDate = new Date(aggregateData[aggregateData.length - 1].date);
  const multiplier = getZMultiplier(confidenceLevel);
  const stdDev = getStdDev(aggregateData.map(d => d.quantity));
  
  aggregateForecast.forEach((aggValue, idx) => {
    const step = idx + 1;
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(lastDate.getMonth() + step);
    const normalizedDate = forecastDate.toISOString().split('T')[0].substring(0, 7) + '-01';
    
    const uncertainty = multiplier * stdDev * Math.sqrt(step) * 0.4;
    
    results.push({
      date: normalizedDate,
      forecast: Math.round(aggValue),
      lowerBound: Math.max(0, Math.round(aggValue - uncertainty)),
      upperBound: Math.round(aggValue + uncertainty),
      isForecast: true
    });
  });
  
  return results;
};

