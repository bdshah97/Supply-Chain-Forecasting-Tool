
import { ForecastPoint } from '../types';

export const exportToCSV = (data: ForecastPoint[], filename: string) => {
  const headers = ['Date', 'Historical', 'Forecast', 'Lower Bound', 'Upper Bound', 'Safety Stock', 'Reorder Point', 'Projected Inventory'];
  const csvRows = data.map(p => [
    p.date,
    p.historical ?? '',
    p.forecast,
    p.lowerBound ?? '',
    p.upperBound ?? '',
    p.safetyStock ?? '',
    p.reorderPoint ?? '',
    p.projectedInventory ?? ''
  ].join(','));

  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
