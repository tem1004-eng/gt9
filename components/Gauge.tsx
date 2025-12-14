import React from 'react';

interface GaugeProps {
  cents: number;
  isActive: boolean;
  targetLabel?: string; // e.g. "A2"
}

const Gauge: React.FC<GaugeProps> = ({ cents, isActive, targetLabel }) => {
  // Clamp cents between -50 and 50 for display bounds
  const clampedCents = Math.max(-50, Math.min(50, cents));
  
  // Convert -50..50 range to 0..100% position
  const positionPercent = ((clampedCents + 50) / 100) * 100;

  const isPerfect = isActive && Math.abs(cents) <= 3;
  
  // Determine feedback message & styles
  let feedbackMessage = "";
  
  // Base Styles - Default to Yellow LED Glow for "Ready" state
  let containerClass = "border-yellow-500 bg-slate-900 shadow-[0_0_50px_-10px_rgba(234,179,8,0.4)]"; 
  let needleColor = "bg-slate-700 opacity-50"; 
  let feedbackBoxClass = "bg-slate-800 text-slate-400 border border-slate-700";
  
  if (isActive) {
    if (isPerfect) {
      feedbackMessage = "완벽합니다! (Perfect)";
      // GREEN LED GLOW
      containerClass = "border-emerald-400 bg-slate-900 shadow-[0_0_80px_-10px_rgba(52,211,153,0.7)] z-10 scale-[1.02]";
      needleColor = "bg-emerald-400 shadow-[0_0_15px_#34d399] w-1.5"; // Turns Green
      feedbackBoxClass = "bg-emerald-600 text-white shadow-[0_0_40px_rgba(5,150,105,0.6)] font-bold scale-105 border-emerald-400";
    } 
    // EXTREME LOW (<= -45)
    else if (cents <= -45) {
      feedbackMessage = "많이 낮으니 많이 조여서 높여주세요";
      // INTENSE RED
      containerClass = "border-red-600 bg-slate-900 shadow-[0_0_80px_-5px_rgba(220,38,38,0.9)] z-10";
      needleColor = "bg-red-600 shadow-[0_0_15px_rgba(239,68,68,1)] w-1.5";
      feedbackBoxClass = "bg-red-700 text-white animate-pulse shadow-[0_0_50px_rgba(185,28,28,0.7)] border-red-600 font-bold border-2";
    }
    // TOO LOW (-45 < cents < -10)
    else if (cents > -45 && cents < -10) {
      feedbackMessage = "너무 낮습니다 (Too Low)";
      // RED LED GLOW
      containerClass = "border-red-500 bg-slate-900 shadow-[0_0_60px_-10px_rgba(239,68,68,0.6)] z-10";
      needleColor = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]";
      feedbackBoxClass = "bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] border-red-500";
    } 
    // TUNE UP (-10 <= cents < -3)
    else if (cents >= -10 && cents < -3) {
      feedbackMessage = "조금만 더 올리세요 (Tune Up)";
      // AMBER LED GLOW
      containerClass = "border-amber-400 bg-slate-900 shadow-[0_0_60px_-10px_rgba(251,191,36,0.6)] z-10";
      needleColor = "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]";
      feedbackBoxClass = "bg-amber-600 text-white shadow-[0_0_30px_rgba(217,119,6,0.5)] border-amber-400";
    } 
    // EXTREME HIGH (>= 45)
    else if (cents >= 45) {
      feedbackMessage = "많이 높으니 많이 풀어서 낮춰주세요";
      // INTENSE RED
      containerClass = "border-red-600 bg-slate-900 shadow-[0_0_80px_-5px_rgba(220,38,38,0.9)] z-10";
      needleColor = "bg-red-600 shadow-[0_0_15px_rgba(239,68,68,1)] w-1.5";
      feedbackBoxClass = "bg-red-700 text-white animate-pulse shadow-[0_0_50px_rgba(185,28,28,0.7)] border-red-600 font-bold border-2";
    }
    // TOO HIGH (10 < cents < 45)
    else if (cents > 10 && cents < 45) {
      feedbackMessage = "너무 높습니다 (Too High)";
      // RED LED GLOW
      containerClass = "border-red-500 bg-slate-900 shadow-[0_0_60px_-10px_rgba(239,68,68,0.6)] z-10";
      needleColor = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]";
      feedbackBoxClass = "bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] border-red-500";
    } 
    // TUNE DOWN (3 < cents <= 10)
    else if (cents > 3 && cents <= 10) {
      feedbackMessage = "조금만 더 낮추세요 (Tune Down)";
      // AMBER LED GLOW
      containerClass = "border-amber-400 bg-slate-900 shadow-[0_0_60px_-10px_rgba(251,191,36,0.6)] z-10";
      needleColor = "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]";
      feedbackBoxClass = "bg-amber-600 text-white shadow-[0_0_30px_rgba(217,119,6,0.5)] border-amber-400";
    }
  } else {
    feedbackMessage = "줄을 선택하거나 튜닝 시작 버튼을 누르세요";
    // INACTIVE STATE: Yellow LED Glow
    containerClass = "border-yellow-500 bg-slate-900 shadow-[0_0_50px_-5px_rgba(234,179,8,0.4)]";
    needleColor = "bg-slate-700 opacity-40";
  }

  // Generate ruler ticks - Finer granularity (every 2 cents)
  const renderTicks = () => {
    const ticks = [];
    // Step by 2 to get 5 ticks per 10-cent block
    for (let i = -50; i <= 50; i += 2) {
      const isCenter = i === 0;
      const isMajor = i % 10 === 0; // -50, -40, -30...
      
      const leftPos = ((i + 50) / 100) * 100;
      
      let heightClass = 'h-1.5 md:h-2'; // Minor ticks
      let widthClass = 'w-px';
      let colorClass = 'bg-slate-600';
      
      if (isCenter) {
        heightClass = 'h-full';
        widthClass = 'w-0.5';
        colorClass = 'bg-emerald-500/50';
      } else if (isMajor) {
        heightClass = 'h-3 md:h-5'; // Major ticks
        widthClass = 'w-0.5';
        colorClass = 'bg-slate-400';
      }

      ticks.push(
        <div 
          key={i} 
          className={`absolute bottom-0 transform -translate-x-1/2 ${heightClass} ${widthClass} ${colorClass}`}
          style={{ left: `${leftPos}%` }}
        />
      );

      // Add numbers for major ticks
      if (isMajor && !isCenter) {
        const showLabel = Math.abs(i) % 10 === 0; // Show all 10s
        if (showLabel) {
            ticks.push(
                <div 
                    key={`label-${i}`}
                    className="absolute bottom-4 md:bottom-6 transform -translate-x-1/2 text-[9px] md:text-[10px] text-slate-500 font-mono select-none"
                    style={{ left: `${leftPos}%` }}
                >
                    {i > 0 ? `+${i}` : i}
                </div>
            );
        }
      }
    }
    return ticks;
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 md:gap-8 mt-4">
      
      {/* Modern Ruler Gauge */}
      <div className={`relative w-full h-24 md:h-32 rounded-lg border-2 transition-all duration-300 overflow-hidden ${containerClass}`}>
        
        {/* Safe Zone Background (Center Highlight) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[6%] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent z-0"></div>
        
        {/* Target Note Label (Center) */}
        {isActive && targetLabel && (
           <div className="absolute top-2 left-1/2 -translate-x-1/2 z-0">
             <span className={`text-4xl md:text-5xl font-black tracking-tighter opacity-20 ${isPerfect ? 'text-emerald-400' : 'text-slate-400'}`}>
               {targetLabel}
             </span>
           </div>
        )}

        {/* Digital Cents Readout - NEW for Fine Tuning */}
        {isActive && (
            <div className={`absolute bottom-2 right-4 font-mono font-bold text-lg md:text-xl tracking-wider transition-colors z-20 ${isPerfect ? "text-emerald-400" : "text-slate-400"}`}>
                {cents > 0 ? "+" : ""}{cents.toFixed(1)}
                <span className="text-xs ml-1 opacity-50">¢</span>
            </div>
        )}

        {/* Ticks & Labels */}
        <div className="absolute inset-0 z-10 pointer-events-none">
            {renderTicks()}
        </div>
        
        {/* Center Triangle Indicator (Fixed) */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-emerald-500 z-20"></div>

        {/* Moving Sound Line (The Needle) */}
        <div 
            className={`absolute top-0 bottom-0 w-1 z-30 transition-all duration-75 ease-linear transform -translate-x-1/2 ${needleColor}`}
            style={{ left: `${isActive ? positionPercent : 50}%` }}
        >
        </div>
      </div>

      {/* Feedback Box */}
      <div className={`w-full max-w-lg p-3 rounded-xl text-center text-base md:text-lg transition-all duration-300 flex items-center justify-center min-h-[50px] md:min-h-[60px] ${feedbackBoxClass}`}>
        {feedbackMessage}
      </div>

    </div>
  );
};

export default Gauge;