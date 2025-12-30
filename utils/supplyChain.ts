
import { ForecastPoint, Scenario, ProductAttribute } from '../types';

export const getZScore = (serviceLevel: number): number => {
  if (serviceLevel >= 0.999) return 3.09;
  if (serviceLevel >= 0.99) return 2.33;
  if (serviceLevel >= 0.98) return 2.05;
  if (serviceLevel >= 0.95) return 1.645;
  if (serviceLevel >= 0.90) return 1.28;
  if (serviceLevel >= 0.85) return 1.04;
  if (serviceLevel >= 0.80) return 0.84;
  return 0.5;
};

export const calculateSupplyChainMetrics = (
  forecast: ForecastPoint[],
  historicalStdDev: number,
  leadTimeDays: number,
  serviceLevel: number,
  onHand: number,
  scenarios: Scenario[] = [],
  showOffset: boolean = false,
  volatilityMultiplier: number = 0,
  attributes: ProductAttribute[] = []
): ForecastPoint[] => {
  const z = getZScore(serviceLevel);
  
  // Adjust lead time based on supplier volatility (resiliency stress test)
  const adjustedLeadTime = leadTimeDays * (1 + volatilityMultiplier);
  const leadTimePeriods = adjustedLeadTime / 30;
  
  // Safety stock expands as volatility increases
  const safetyStock = Math.round(z * historicalStdDev * Math.sqrt(leadTimePeriods));
  
  const forecastOnly = forecast.filter(f => f.isForecast);
  const forecastAvg = forecastOnly.reduce((sum, f) => sum + f.forecast, 0) / (forecastOnly.length || 1);
  const avgDailyDemand = forecastAvg / 30;
  const reorderPoint = Math.round((avgDailyDemand * adjustedLeadTime) + safetyStock);

  // Financial Context
  const avgPrice = attributes.length > 0 ? attributes.reduce((s, a) => s + a.sellingPrice, 0) / attributes.length : 150;
  const avgCost = attributes.length > 0 ? attributes.reduce((s, a) => s + a.unitCost, 0) / attributes.length : 100;

  let runningInventory = onHand;
  let forecastCounter = 0;

  return forecast.map(p => {
    let scenarioVal = p.forecast;
    if (p.isForecast) {
      forecastCounter++;
      const activeScenario = scenarios.find(s => s.month === forecastCounter);
      if (activeScenario) scenarioVal = Math.round(scenarioVal * activeScenario.multiplier);
      runningInventory -= scenarioVal;
    }

    let offsetDate = p.date;
    if (showOffset && p.isForecast) {
      const d = new Date(p.date);
      d.setDate(d.getDate() - leadTimeDays);
      offsetDate = d.toISOString().split('T')[0];
    }

    return {
      ...p,
      date: offsetDate,
      scenarioForecast: p.isForecast ? scenarioVal : undefined,
      safetyStock,
      reorderPoint,
      projectedInventory: p.isForecast ? runningInventory : onHand,
      // Round to nearest dollar
      projectedRevenue: p.isForecast ? Math.round(scenarioVal * avgPrice) : undefined,
      projectedMargin: p.isForecast ? Math.round(scenarioVal * (avgPrice - avgCost)) : undefined,
      inventoryValue: Math.round((p.isForecast ? runningInventory : onHand) * avgCost)
    };
  });
};

export const runParetoAnalysis = (skuData: { sku: string; totalVolume: number }[]) => {
  const sorted = [...skuData].sort((a, b) => b.totalVolume - a.totalVolume);
  const total = sorted.reduce((s, x) => s + x.totalVolume, 0);
  let cumulative = 0;
  
  return sorted.map(item => {
    cumulative += item.totalVolume;
    const perc = (cumulative / (total || 1)) * 100;
    let grade = 'C';
    if (perc <= 80) grade = 'A';
    else if (perc <= 95) grade = 'B';
    return { ...item, grade, share: (item.totalVolume / (total || 1)) * 100 };
  });
};
