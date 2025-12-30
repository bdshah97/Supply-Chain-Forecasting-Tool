
import { DataPoint, ForecastPoint, ForecastMetrics, ForecastMethodology } from '../types';

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
 * Holt-Winters Implementation (Base Triple Smoothing)
 */
const runHoltWinters = (values: number[], horizon: number, L: number): number[] => {
  const alpha = 0.3, beta = 0.1, gamma = 0.2;
  let level = values[0];
  let trend = values[1] - values[0];
  const seasonal = new Array(L).fill(1);
  for (let i = 0; i < Math.min(values.length, L); i++) seasonal[i] = values[i] / (level || 1);
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const prevLevel = level;
    level = alpha * (value / (seasonal[i % L] || 1)) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[i % L] = gamma * (value / (level || 1)) + (1 - gamma) * seasonal[i % L];
  }
  
  const forecast = [];
  for (let i = 1; i <= horizon; i++) {
    forecast.push(Math.max(0, (level + i * trend) * seasonal[(values.length + i - 1) % L]));
  }
  return forecast;
};

/**
 * Prophet-Inspired Simulation (Additive Trend + Stronger Seasonality)
 */
const runProphet = (values: number[], horizon: number): number[] => {
  const n = values.length;
  // Use last year's pattern more aggressively
  const forecast = [];
  const recentValues = values.slice(-12);
  const avgGrowth = (values[n-1] - values[0]) / n;

  for (let i = 1; i <= horizon; i++) {
    const seasonalBase = recentValues[(i - 1) % 12];
    // Add slightly more bullish trend for Prophet simulation
    const simulatedVal = seasonalBase + (avgGrowth * 1.2 * i);
    forecast.push(Math.max(0, simulatedVal));
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
  interval: 'monthly' = 'monthly',
  confidenceLevel: number = 95,
  method: ForecastMethodology = ForecastMethodology.HOLT_WINTERS
): ForecastPoint[] => {
  if (historicalData.length < 3) return [];
  const values = historicalData.map(d => d.quantity);
  const n = values.length;
  const L = 12; // Monthly seasonality

  let forecastValues: number[];
  switch (method) {
    case ForecastMethodology.LINEAR: forecastValues = runLinear(values, horizon); break;
    case ForecastMethodology.PROPHET: forecastValues = runProphet(values, horizon); break;
    case ForecastMethodology.ARIMA: forecastValues = runArima(values, horizon); break;
    case ForecastMethodology.HOLT_WINTERS:
    default: forecastValues = runHoltWinters(values, horizon, L); break;
  }

  const results: ForecastPoint[] = historicalData.map(d => ({
    date: d.date, historical: d.quantity, forecast: d.quantity, isForecast: false
  }));

  const multiplier = getZMultiplier(confidenceLevel);
  const stdDev = getStdDev(values);
  const lastDate = new Date(historicalData[n - 1].date);

  forecastValues.forEach((val, i) => {
    const step = i + 1;
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(lastDate.getMonth() + step);

    const uncertainty = multiplier * stdDev * Math.sqrt(step) * 0.4;
    results.push({
      date: forecastDate.toISOString().split('T')[0],
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
