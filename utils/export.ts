
import { ForecastPoint, MarketShock, StickyNote } from '../types';

export const exportToCSV = (data: ForecastPoint[], filename: string, shocks?: MarketShock[], stickyNotes?: StickyNote[]) => {
  try {
    const headers = ['Date', 'Type', 'Quantity', 'Lower Bound', 'Upper Bound', 'Safety Stock', 'Reorder Point', 'Projected Inventory', 'Notes', 'Market Disruption'];
    
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
      const type = p.isForecast ? 'Forecast' : 'Historical';
      
      return [
        p.date,
        type,
        p.forecast ?? '',
        p.lower ?? '',
        p.upper ?? '',
        p.safetyStock ?? '',
        p.reorderPoint ?? '',
        p.projectedInventory ?? '',
        note,
        disruption
      ].map(val => {
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`✅ Exported CSV: ${filename}.csv`);
  } catch (error) {
    console.error('❌ Export failed:', error);
    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const exportBulkCSV = (dataBySkus: Map<string, ForecastPoint[]>, filename: string, shocks?: MarketShock[], stickyNotes?: StickyNote[]) => {
  try {
    if (dataBySkus.size === 0) {
      console.warn('⚠️ No data to export: dataBySkus is empty');
      alert('No forecast data available to export. Please generate a forecast first.');
      return;
    }

    // Count total data points
    let totalPoints = 0;
    dataBySkus.forEach(points => totalPoints += points.length);
    console.log(`📊 Exporting ${totalPoints} data points from ${dataBySkus.size} SKU(s)`);

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
      console.log(`📌 Found ${stickyNotes.length} notes`);
    } else {
      console.log(`📌 No notes provided (optional)`);
    }

    // Collect all unique dates
    const allDates = new Set<string>();
    dataBySkus.forEach(points => {
      points.forEach(p => allDates.add(p.date));
    });
    const sortedDates = Array.from(allDates).sort();

    // Build headers: Date, then for each SKU: SKU_Forecast, SKU_Lower, SKU_Upper, SKU_SafetyStock
    const headers = ['Date', ...Array.from(dataBySkus.keys()).flatMap(sku => [
      `${sku}_Forecast`,
      `${sku}_Lower`,
      `${sku}_Upper`,
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
          row.push(point.lower ?? '');
          row.push(point.upper ?? '');
          row.push(point.safetyStock ?? '');
        } else {
          row.push('', '', '', '');
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
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${filename}_bulk.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`✅ Exported bulk CSV: ${filename}_bulk.csv`);
  } catch (error) {
    console.error('❌ Export failed:', error);
    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const exportAlerts = (
  forecast: ForecastPoint[],
  currentOnHand: number,
  filename: string
) => {
  try {
    const headers = ['SKU', 'Current On-Hand', 'Projected Inventory', 'Alert Date', 'Production (to date)', 'Demand (to date)'];
    
    // Get all alerts (where inventory dips below safety stock or goes negative)
    const alerts = forecast.filter(p => 
      p.isForecast && 
      p.projectedInventory !== undefined && 
      p.safetyStock !== undefined && 
      (p.projectedInventory < 0 || p.projectedInventory < p.safetyStock)
    );

    if (alerts.length === 0) {
      alert('No inventory alerts to export');
      return;
    }

    const csvRows = alerts.map(alertPoint => {
      // Calculate total production and demand up to this alert date
      const forecastUpToAlert = forecast.filter(f => f.date <= alertPoint.date);
      const totalProduction = forecastUpToAlert.reduce((sum, f) => sum + (f.incomingProduction || 0), 0);
      const totalDemand = forecastUpToAlert.reduce((sum, f) => sum + f.forecast, 0);

      return [
        'Multi-SKU', // Since we don't track SKU in the alert, we use a generic label
        currentOnHand,
        alertPoint.projectedInventory ?? 0,
        alertPoint.date,
        totalProduction,
        totalDemand
      ].map(val => {
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${filename}_alerts.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`✅ Exported alerts CSV: ${filename}_alerts.csv`);
  } catch (error) {
    console.error('❌ Export failed:', error);
    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
