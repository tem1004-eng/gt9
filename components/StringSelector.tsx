import React from 'react';
import { STANDARD_TUNING } from '../constants';
import { Lock, AlertTriangle } from 'lucide-react';

interface StringSelectorProps {
  selectedStringIndex: number | null;
  detectedStringIndex: number | null;
  isManualMode: boolean;
  onSelectString: (index: number) => void;
}

const StringSelector: React.FC<StringSelectorProps> = ({ selectedStringIndex, detectedStringIndex, isManualMode, onSelectString }) => {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex justify-center gap-1.5 md:gap-3 mt-2 flex-wrap">
        {STANDARD_TUNING.map((s, idx) => {
          // 1. Target (User Selected) - Always Purple in Manual Mode
          const isSelected = selectedStringIndex === idx;
          const isLocked = isSelected && isManualMode;

          // 2. Detected (Audio Input) - Yellow if different from Target in Manual Mode
          //    In Auto Mode, this follows standard selection.
          const isDetected = isManualMode && detectedStringIndex === idx && idx !== selectedStringIndex;

          // Calculate string number: 6 down to 1
          const stringNumber = 6 - idx;
          
          return (
            <div key={`${s.note}${s.octave}-${idx}`} className="flex flex-col items-center gap-1">
                <span className={`text-[10px] md:text-xs font-medium transition-colors ${isSelected ? 'text-emerald-400' : isDetected ? 'text-yellow-400' : 'text-slate-500'}`}>
                    {stringNumber}번줄
                </span>
                <button 
                    onClick={() => onSelectString(idx)}
                    className={`
                        relative flex flex-col items-center justify-center w-12 h-16 md:w-14 md:h-20 rounded-xl border-2 transition-all duration-200 cursor-pointer active:scale-95
                        ${isLocked 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.6)] scale-105 z-10' 
                            : isDetected
                                ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.4)] z-0'
                                : isSelected
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                    : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:bg-slate-700/50 hover:border-slate-500'
                        }
                    `}
                    title={isLocked ? "Target String (Locked)" : isDetected ? "Current Pitch Detected" : "Click to select"}
                >
                    {isLocked && (
                        <div className="absolute top-1 right-1">
                            <Lock size={10} className="text-indigo-200" />
                        </div>
                    )}
                    {isDetected && !isLocked && (
                        <div className="absolute top-1 right-1 animate-pulse">
                             <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,1)]"></div>
                        </div>
                    )}
                    <span className={`text-xl md:text-2xl font-bold`}>
                        {s.note}
                    </span>
                    <span className="text-[10px] font-mono opacity-80">{s.label}</span>
                </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StringSelector;