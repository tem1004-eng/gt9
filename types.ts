export interface NoteData {
  note: string;
  octave: number;
  frequency: number;
  centsOff: number; // Deviation from perfect pitch
  perfectFrequency: number;
}

export interface GuitarString {
  note: string;
  octave: number;
  frequency: number;
  label: string; // e.g., "6E"
}

export enum TunerState {
  INACTIVE = 'INACTIVE',
  LISTENING = 'LISTENING',
  ERROR = 'ERROR'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}
