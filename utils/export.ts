
import { ForecastPoint, MarketShock, StickyNote } from '../types';

export const exportToCSV = (data: ForecastPoint[], filename: string, shocks?: MarketShock[], stickyNotes?: StickyNote[]) => {
  const headers = ['Date', 'Historical', 'Forecast', 'Lower Bound', 'Upper Bound', 'Safety Stock', 'Reorder Point', 'Projected Inventory', 'Notes', 'Market Disruption'];
  
  // Build maps for quick lookup
  const shockMap = new Map<string, string>();
  if (shocks) {
    shocks.forEach(shock => {
      const shockDate = shock.month; // "YYYY-MM"
      shockMap.set(shockDate, `${shock.description} (${shock.percentageChange > 0 ? '+' : ''}${shock.percentageChange}%)`);
    });
  }
  
  const noteMap = new Map<string, string>();
  if (stickyNotes) {
    stickyNotes.forEach(note => {
      noteMap.set(note.date, note.content);
    });
  }
  
  const csvRows = data.map(p => {
    const dateYearMonth = p.date.substring(0, 7); // "YYYY-MM"
    const disruption = shockMap.get(dateYearMonth) || '';
    const note = noteMap.get(p.date) || '';
    
    return [
      p.date,
      p.historical ?? '',
      p.forecast,
      p.lowerBound ?? '',
      p.upperBound ?? '',
      p.safetyStock ?? '',
      p.reorderPoint ?? '',
      p.projectedInventory ?? '',
      note,
      disruption
    ].join(',');
  });

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

export const exportBulkCSV = (dataBySkus: Map<string, ForecastPoint[]>, filename: string, shocks?: MarketShock[], stickyNotes?: StickyNote[]) => {
  if (dataBySkus.size === 0) return;

  // Build maps for quick lookup
  const shockMap = new Map<string, string>();
  if (shocks) {
    shocks.forEach(shock => {
      const shockDate = shock.month;
      shockMap.set(shockDate, `${shock.description} (${shock.percentageChange > 0 ? '+' : ''}${shock.percentageChange}%)`);
    });
  }
  
  const noteMap = new Map<string, string>();
  if (stickyNotes) {
    stickyNotes.forEach(note => {
      noteMap.set(note.date, note.content);
    });
  }

  // Collect all unique dates
  const allDates = new Set<string>();
  dataBySkus.forEach(points => {
    points.forEach(p => allDates.add(p.date));
  });
  const sortedDates = Array.from(allDates).sort();

  // Build headers: Date, then for each SKU: SKU_Forecast, SKU_Historical, SKU_LowerBound, SKU_UpperBound, Notes, Market Disruption
  const headers = ['Date', ...Array.from(dataBySkus.keys()).flatMap(sku => [
    `${sku}_Forecast`,
    `${sku}_Historical`,
    `${sku}_LowerBound`,
    `${sku}_UpperBound`,
    `${sku}_SafetyStock`
  ]), 'Notes', 'Market Disruption'];

  // Build rows
  const csvRows = sortedDates.map(date => {
    const row: (string | number)[] = [date];
    
    // Add data for each SKU
    dataBySkus.forEach(points => {
      const point = points.find(p => p.date === date);
      if (point) {
        row.push(point.forecast ?? '');
        row.push(point.historical ?? '');
        row.push(point.lowerBound ?? '');
        row.push(point.upperBound ?? '');
        row.push(point.safetyStock ?? '');
      } else {
        row.push('', '', '', '', '');
      }
    });

    // Add notes and disruptions
    const dateYearMonth = date.substring(0, 7);
    row.push(noteMap.get(date) || '');
    row.push(shockMap.get(dateYearMonth) || '');

    return row.map(v => {
      const str = String(v);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',');
  });

  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_bulk.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
