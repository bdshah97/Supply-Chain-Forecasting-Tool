
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

interface InfoTooltipProps {
  content: string | React.ReactNode;
  title?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, title }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Position the tooltip to the right of the trigger to avoid immediate overlap
      setCoords({
        top: rect.top,
        left: rect.left,
      });
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    updatePosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    // Small delay to allow mouse to move from icon to tooltip content
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, 250);
  };

  const handleContentEnter = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  };

  useEffect(() => {
    if (isVisible) {
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [isVisible]);

  return (
    <div className="inline-block ml-2" ref={triggerRef}>
      <div 
        className={`cursor-help transition-all flex items-center justify-center p-1 rounded-full ${isVisible ? 'bg-indigo-600 text-white scale-110' : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsVisible(!isVisible)}
      >
        <Info size={14} />
      </div>

      {isVisible && createPortal(
        <div 
          className="fixed z-[3000] pointer-events-none"
          style={{ 
            top: `${coords.top}px`, 
            left: `${coords.left}px`,
            // Offset slightly to the left to "bridge" the gap between sidebar and main area
            transform: 'translate(24px, -20px)' 
          }}
        >
          <div 
            onMouseEnter={handleContentEnter}
            onMouseLeave={handleMouseLeave}
            className="w-72 p-5 bg-slate-900/98 border border-slate-700 rounded-[2rem] shadow-2xl text-[11px] text-slate-300 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl pointer-events-auto"
          >
            {title && (
              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                <div className="font-black text-[10px] uppercase tracking-[0.2em] text-white flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {title}
                </div>
                <X size={12} className="text-slate-500 cursor-pointer hover:text-white" onClick={() => setIsVisible(false)} />
              </div>
            )}
            <div className="leading-relaxed whitespace-normal font-medium">
              {content}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-center">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Methodology Library</span>
              <span className="text-[8px] font-bold text-indigo-400">SSA & COMPANY</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default InfoTooltip;
