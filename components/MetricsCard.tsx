
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricsCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  description: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricsCard: React.FC<MetricsCardProps> = ({ label, value, suffix, description, trend }) => {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';

  return (
    <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-xl transition-all hover:border-indigo-500/50 group relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
          {trend && (
            <div className={`p-1 rounded-lg ${isPositive ? 'text-emerald-400 bg-emerald-500/10' : isNegative ? 'text-orange-400 bg-orange-500/10' : 'text-slate-500 bg-slate-800'}`}>
              {isPositive ? <ArrowUpRight size={12} /> : isNegative ? <ArrowDownRight size={12} /> : <Minus size={12} />}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <h3 className="text-3xl font-black text-slate-100 group-hover:text-indigo-400 transition-colors tracking-tighter">{value}</h3>
          {suffix && <span className="text-xs font-bold text-slate-500">{suffix}</span>}
        </div>
        <p className="text-[9px] text-slate-500 mt-3 font-bold uppercase tracking-wide leading-tight">{description}</p>
      </div>
      {/* Subtle background glow on hover */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-600/5 rounded-full blur-2xl group-hover:bg-indigo-600/10 transition-colors" />
    </div>
  );
};

export default MetricsCard;
