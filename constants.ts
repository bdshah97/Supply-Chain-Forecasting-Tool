
import { DataPoint, ProductAttribute, InventoryLevel } from './types';

export const SKUS = ['SKU-101', 'SKU-102', 'SKU-205', 'SKU-309', 'SKU-440'];
export const CATEGORIES = ['Electronics', 'Automotive', 'Consumer Goods', 'Industrial'];

export const generateSampleData = (): DataPoint[] => {
  const data: DataPoint[] = [];
  const start = new Date('2021-01-01');
  const end = new Date('2024-05-01');
  
  SKUS.forEach((sku, idx) => {
    // Consistent category assignment for sample data
    const category = CATEGORIES[idx % CATEGORIES.length];
    const baseQuantity = 100 + Math.random() * 500;
    const trend = 0.5 + Math.random() * 1.5;
    
    let current = new Date(start);
    while (current <= end) {
      const month = current.getMonth();
      const seasonalFactor = 1 + Math.sin((month / 12) * Math.PI * 2) * 0.2 + (month > 9 ? 0.3 : 0);
      const randomNoise = (Math.random() - 0.5) * 50;
      const monthsSinceStart = (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth());
      const quantity = Math.max(0, Math.round((baseQuantity + monthsSinceStart * trend) * seasonalFactor + randomNoise));
      
      data.push({ date: current.toISOString().split('T')[0], sku, category, quantity });
      current.setMonth(current.getMonth() + 1);
    }
  });
  return data;
};

export const SAMPLE_ATTRIBUTES: ProductAttribute[] = SKUS.map((sku, idx) => {
  const unitCost = 10 + Math.random() * 200;
  return {
    sku,
    category: CATEGORIES[idx % CATEGORIES.length],
    leadTimeDays: 15 + Math.floor(Math.random() * 45),
    unitCost,
    sellingPrice: unitCost * 1.5,
    serviceLevel: 0.95
  };
});

export const SAMPLE_INVENTORY: InventoryLevel[] = SKUS.map(sku => ({
  sku,
  onHand: 500 + Math.floor(Math.random() * 2000),
  lastUpdated: '2024-05-01'
}));

export const SAMPLE_DATA = generateSampleData();
export const DEFAULT_INTERVAL = 'monthly';
export const DEFAULT_HORIZON = 12;
