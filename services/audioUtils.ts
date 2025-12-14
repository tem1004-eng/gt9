import { NoteData } from '../types';
import { NOTE_STRINGS, A4_FREQ } from '../constants';

/**
 * Optimized Autocorrelation algorithm for large buffers (8192).
 * Instead of O(N^2), we restrict the lag search range to relevant guitar frequencies.
 */
export const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
  let size = buffer.length;
  let rms = 0;

  // 1. RMS Calculation (Noise Gate)
  for (let i = 0; i < size; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / size);

  if (rms < 0.03) {
    return -1; 
  }

  // 2. Bounded Autocorrelation
  // We don't need to correlate the entire 8192 buffer against itself.
  // Guitar Frequencies: 
  // Lowest (Drop A approx) ~55Hz -> Max Period ~872 samples (at 48k)
  // Highest (24th fret High E) ~1300Hz -> Min Period ~36 samples
  // So we only need to check lags from 0 to ~1000.
  
  const MAX_LAG = Math.floor(sampleRate / 50); // Search down to 50Hz
  const correlations = new Float32Array(MAX_LAG);

  // Perform correlation only for the relevant lag range
  // We use the full buffer size for averaging to get stability
  for (let lag = 0; lag < MAX_LAG; lag++) {
    let sum = 0;
    // Iterate over the buffer, but stop so we don't go out of bounds
    for (let i = 0; i < size - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = sum;
  }

  // 3. Find the first dip (Standard procedure)
  let d = 0;
  while (correlations[d] > correlations[d + 1]) { d++; }
  
  // 4. Find the global max peak after the first dip
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < MAX_LAG; i++) {
    if (correlations[i] > maxval) {
      maxval = correlations[i];
      maxpos = i;
    }
  }
  
  let T0 = maxpos;

  // 5. Harmonic Check
  // Ensure the correlation is strong enough.
  if (maxval / correlations[0] < 0.85) { // Stricter threshold for "Extreme" precision
      return -1; 
  }

  // 6. Parabolic Interpolation for Sub-Sample Accuracy
  // This is critical for getting cents precision with discrete samples.
  const x1 = correlations[T0 - 1];
  const x2 = correlations[T0];
  const x3 = correlations[T0 + 1];
  
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  
  if (a) {
      T0 = T0 - b / (2 * a);
  }

  return sampleRate / T0;
};

export const getNoteFromFrequency = (frequency: number): NoteData => {
  const noteNum = 12 * (Math.log(frequency / A4_FREQ) / Math.log(2)) + 69;
  const roundedNote = Math.round(noteNum);
  const perfectFrequency = A4_FREQ * Math.pow(2, (roundedNote - 69) / 12);
  const cents = Math.floor(1200 * Math.log2(frequency / perfectFrequency));
  
  const noteIndex = roundedNote % 12;
  const noteName = NOTE_STRINGS[noteIndex];
  const octave = Math.floor(roundedNote / 12) - 1;

  return {
    note: noteName,
    octave: octave,
    frequency: frequency,
    centsOff: cents,
    perfectFrequency: perfectFrequency
  };
};

export const playTone = (frequency: number, type: OscillatorType = 'sine', duration: number = 2.0) => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  
  osc.stop(ctx.currentTime + duration);
  
  setTimeout(() => {
      if (ctx.state !== 'closed') ctx.close();
  }, duration * 1000 + 100);
};