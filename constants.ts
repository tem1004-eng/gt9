import { GuitarString } from './types';

export const STANDARD_TUNING: GuitarString[] = [
  { note: 'E', octave: 2, frequency: 82.41, label: 'E2' }, // 6th String
  { note: 'A', octave: 2, frequency: 110.00, label: 'A2' },
  { note: 'D', octave: 3, frequency: 146.83, label: 'D3' },
  { note: 'G', octave: 3, frequency: 196.00, label: 'G3' },
  { note: 'B', octave: 3, frequency: 246.94, label: 'B3' },
  { note: 'E', octave: 4, frequency: 329.63, label: 'E4' }, // 1st String
];

export const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const A4_FREQ = 440;
