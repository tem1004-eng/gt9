import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Settings, Volume2 } from 'lucide-react';
import Gauge from './components/Gauge';
import StringSelector from './components/StringSelector';
import GuitarTech from './components/GuitarTech';
import { TunerState, NoteData } from './types';
import { STANDARD_TUNING } from './constants';
import { autoCorrelate, getNoteFromFrequency, playTone } from './services/audioUtils';

function App() {
  const [tunerState, setTunerState] = useState<TunerState>(TunerState.INACTIVE);
  const [currentNote, setCurrentNote] = useState<NoteData | null>(null);
  const [volume, setVolume] = useState<number>(0);
  
  const [targetStringIndex, setTargetStringIndex] = useState<number | null>(null);
  const [detectedStringIndex, setDetectedStringIndex] = useState<number | null>(null); // Real-time detected string
  const [isManualMode, setIsManualMode] = useState<boolean>(false);

  const [gaugeCents, setGaugeCents] = useState<number>(0);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const requestRef = useRef<number>();
  
  // -- STABILITY & SMOOTHING REFS --
  const currentCentsRef = useRef<number>(0);
  const pitchHistoryRef = useRef<number[]>([]); // For Median Filter
  const lastStringIndexRef = useRef<number | null>(null);

  const startListening = async () => {
    if (tunerState === TunerState.LISTENING) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
            latency: 0
        } as any
      });
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 48000 // Force high sample rate if possible
      });
      const analyser = audioContext.createAnalyser();
      
      // EXTREME PRECISION: 8192 samples
      // This provides roughly 5.8Hz bin resolution in raw FFT, 
      // but enables sub-cent precision in Autocorrelation time-domain analysis.
      analyser.fftSize = 8192; 
      analyser.smoothingTimeConstant = 0.8;
      
      const source = audioContext.createMediaStreamSource(stream);
      // Aggressive Low-pass to isolate fundamental frequency
      const biquadFilter = audioContext.createBiquadFilter();
      biquadFilter.type = "lowpass";
      biquadFilter.frequency.value = 800; // Guitar fundamentals are < 330Hz (High E), harmonics > 1kHz interfere

      source.connect(biquadFilter);
      biquadFilter.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      
      setTunerState(TunerState.LISTENING);
      updatePitch();
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      setTunerState(TunerState.ERROR);
    }
  };

  const stopListening = () => {
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    setTunerState(TunerState.INACTIVE);
    setCurrentNote(null);
    setVolume(0);
    setGaugeCents(0);
    currentCentsRef.current = 0;
    pitchHistoryRef.current = [];
    setDetectedStringIndex(null);
    if (!isManualMode) {
        setTargetStringIndex(null);
        lastStringIndexRef.current = null;
    }
  };

  const getMedian = (values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted[mid];
  };

  const updatePitch = useCallback(() => {
    if (!analyserRef.current) return;
    
    const buffer = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buffer);
    
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);
    const newVolume = Math.min(rms * 8, 1); // Boost visual volume
    setVolume(newVolume);

    // Strict Noise Gate
    if (newVolume > 0.05) {
        const rawFrequency = autoCorrelate(buffer, audioContextRef.current?.sampleRate || 48000);
        
        if (rawFrequency > -1) {
            // -- STABILITY: Median Filter --
            // Increase history size for stability in "Extreme" mode
            pitchHistoryRef.current.push(rawFrequency);
            if (pitchHistoryRef.current.length > 8) pitchHistoryRef.current.shift();
            
            const stableFrequency = getMedian(pitchHistoryRef.current);

            // 1. Always find the closest string (Pure Auto Logic)
            let closestIndex = -1;
            let minDiffCents = Infinity;
            STANDARD_TUNING.forEach((str, idx) => {
                const diff = 1200 * Math.log2(stableFrequency / str.frequency);
                if (Math.abs(diff) < Math.abs(minDiffCents)) {
                    minDiffCents = diff;
                    closestIndex = idx;
                }
            });
            
            // Update detected string state (for UI feedback)
            setDetectedStringIndex(prev => prev !== closestIndex ? closestIndex : prev);

            // 2. Determine Active Target & Calculation Logic
            let activeIndex = -1;
            let calculatedCents = 0;

            if (isManualMode && targetStringIndex !== null) {
                // MANUAL MODE: Force calculation against the selected string
                activeIndex = targetStringIndex;
                const targetString = STANDARD_TUNING[activeIndex];
                calculatedCents = 1200 * Math.log2(stableFrequency / targetString.frequency);
            } else {
                // AUTO MODE: Use the closest string logic with hysteresis
                
                // Hysteresis: prevent rapid switching between strings if near the boundary
                if (lastStringIndexRef.current !== null && lastStringIndexRef.current !== closestIndex) {
                    const oldStringFreq = STANDARD_TUNING[lastStringIndexRef.current].frequency;
                    const diffToOld = 1200 * Math.log2(stableFrequency / oldStringFreq);
                    if (Math.abs(diffToOld) < 300) { // Keep old string if within range
                         activeIndex = lastStringIndexRef.current;
                         calculatedCents = diffToOld;
                    } else {
                        activeIndex = closestIndex;
                        calculatedCents = minDiffCents;
                    }
                } else {
                    activeIndex = closestIndex;
                    calculatedCents = minDiffCents;
                }
                setTargetStringIndex(activeIndex);
            }

            // Clamp visualization slightly but allow seeing "way off" values
            if (calculatedCents > 50) calculatedCents = 50;
            if (calculatedCents < -50) calculatedCents = -50;

            // -- EXTREME PRECISION SMOOTHING --
            const absCents = Math.abs(calculatedCents);
            let smoothingFactor = 0.1; 
            
            // Ultra-Fine Tuning Zone logic
            if (absCents < 1.0) {
                // If we are basically perfect, LOCK the needle visually (super slow drift)
                smoothingFactor = 0.02; 
            } else if (absCents < 5) {
                // Fine tuning zone
                smoothingFactor = 0.05;
            } else if (absCents > 20) {
                // Large adjustments
                smoothingFactor = 0.3;
            }

            currentCentsRef.current += (calculatedCents - currentCentsRef.current) * smoothingFactor;
            
            setGaugeCents(currentCentsRef.current);
            setCurrentNote(getNoteFromFrequency(stableFrequency)); 
        }
    } else {
        // Only clear history if silence persists for a while to prevent dropouts
        if (pitchHistoryRef.current.length > 0 && Math.random() > 0.9) {
            pitchHistoryRef.current.shift();
        }
    }
    
    requestRef.current = requestAnimationFrame(updatePitch);
  }, [isManualMode, targetStringIndex]);

  useEffect(() => {
    return () => {
      if (tunerState === TunerState.LISTENING) {
        stopListening();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTuner = () => {
    if (tunerState === TunerState.LISTENING) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSelectString = (index: number) => {
      // If inactive, start tuning immediately when a string is clicked
      if (tunerState === TunerState.INACTIVE) {
        startListening();
      }

      // Toggle Logic: 
      // If clicking the SAME string that is currently locked, turn OFF manual mode.
      if (isManualMode && targetStringIndex === index) {
        setIsManualMode(false);
        setTargetStringIndex(null); 
        setDetectedStringIndex(null);
        lastStringIndexRef.current = null;
      } 
      // Otherwise, turn ON manual mode and set target to this string.
      else {
        setIsManualMode(true);
        setTargetStringIndex(index);
        lastStringIndexRef.current = index;
        
        // Play the tone for the selected string
        playTone(STANDARD_TUNING[index].frequency);
        
        // Reset smoothing to avoid needle jumping from previous note
        currentCentsRef.current = 0; 
        pitchHistoryRef.current = [];
      }
  };
  
  const targetLabel = targetStringIndex !== null ? STANDARD_TUNING[targetStringIndex].label : "";

  return (
    <div className="h-[100dvh] bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white overflow-hidden touch-manipulation">
      <header className="relative px-4 py-6 flex justify-center items-center shrink-0 bg-slate-900 z-10">
        
        {/* Main Title Container with Glow */}
        <div className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 shadow-[0_0_25px_rgba(99,102,241,0.15)] backdrop-blur-sm">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Volume2 className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-md">
                필통튜너
            </h1>
        </div>

        {/* Settings Button - Positioned Absolutely */}
        <button className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-300 transition-colors">
          <Settings size={24} />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start py-2 px-3 relative w-full max-w-lg mx-auto overflow-y-auto no-scrollbar">
        <div className="w-full flex flex-col items-center gap-3 md:gap-6 py-2">
          
          <div className={`px-3 py-3 rounded-xl border text-center w-full transition-all duration-300 ${isManualMode ? 'bg-indigo-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-yellow-300 border-yellow-400 shadow-[0_0_15px_rgba(253,224,71,0.5)]'}`}>
                <p className={`${isManualMode ? 'text-indigo-200' : 'text-slate-900'} text-xs md:text-sm font-bold leading-relaxed`}>
                   {isManualMode 
                     ? "🔒 고정 모드: 선택한 줄만 튜닝합니다. 해제하려면 버튼을 다시 누르세요." 
                     : "🎵 자동 모드: 소리를 내면 자동으로 줄을 찾습니다. 특정 줄을 누르면 고정됩니다."}
                </p>
          </div>

          <div className="w-full">
            <StringSelector 
              selectedStringIndex={targetStringIndex}
              detectedStringIndex={detectedStringIndex}
              isManualMode={isManualMode}
              onSelectString={handleSelectString}
            />
          </div>

          <button 
            onClick={toggleTuner}
            className={`
              flex items-center justify-center gap-2 w-full max-w-xs py-3.5 rounded-full font-bold text-base shadow-lg transition-all duration-300 transform active:scale-95 shrink-0
              ${tunerState === TunerState.LISTENING 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30' 
                : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/30'}
            `}
          >
            {tunerState === TunerState.LISTENING ? (
              <>
                <MicOff size={20} />
                Stop Listening
              </>
            ) : (
              <>
                <Mic size={20} />
                Start Tuning
              </>
            )}
          </button>

          <div className="w-full flex flex-col items-center justify-center mt-6 pb-20 md:pb-0 relative">
             {/* Yellow Warning Text for Manual Mode Deviation */}
             {isManualMode && detectedStringIndex !== null && detectedStringIndex !== targetStringIndex && volume > 0.05 && (
                <div className="mb-2 px-4 py-2 bg-yellow-400/10 border border-yellow-400/50 rounded-lg animate-pulse">
                    <p className="text-yellow-400 font-bold text-sm md:text-base">
                        현재 기타의 음정이 노란색 박스까지 가 있습니다
                    </p>
                </div>
             )}

            <Gauge 
              cents={gaugeCents}
              isActive={tunerState === TunerState.LISTENING && volume > 0.05}
              targetLabel={targetLabel}
            />
          </div>

          {tunerState === TunerState.ERROR && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-center text-sm w-full">
              <p className="font-bold">마이크 권한 오류</p>
              <p className="text-xs mt-1">설정에서 마이크 사용을 허용해주세요.</p>
            </div>
          )}

        </div>
      </main>

      <GuitarTech />
      
      <footer className="p-2 text-center text-slate-600 text-[10px] shrink-0 bg-slate-900 border-t border-slate-800 hidden md:block">
        <p>&copy; {new Date().getFullYear()} Virtuoso Tuner.</p>
      </footer>
    </div>
  );
}

export default App;