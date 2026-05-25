/**
 * BGM Note Pattern Definitions for Abyss-Echo
 * Procedural 8-bit chip music using Web Audio API oscillators
 */

// Type definitions
export interface Note {
  midi: number;         // MIDI note number (e.g., C4 = 60)
  dur: number;          // Duration in 16th-note steps
}

export interface DrumPattern {
  kick?: number[];      // Step indices 0-15 for kick drum
  snare?: number[];     // Step indices 0-15 for snare
  hihat?: number[];     // Step indices 0-15 for hi-hat
}

export interface TrackDef {
  id: string;           // Track ID
  bpm: number;          // Beats per minute
  wave: OscillatorType; // Main oscillator waveform
  wave2?: OscillatorType; // Secondary oscillator for layering
  gain: number;         // Overall gain (volume)
  melody: Note[];       // Melody pattern
  bass: Note[];         // Bass pattern
  drums?: DrumPattern;  // Optional drum pattern (16 steps)
}

// Helper function to repeat a pattern of notes
export function rep(notes: Note[], times: number): Note[] {
  const result: Note[] = [];
  for (let i = 0; i < times; i++) {
    result.push(...notes);
  }
  return result;
}

// Note shortcuts
export const R = (dur: number): Note => ({ midi: 0, dur });
export const N = (midi: number, dur: number): Note => ({ midi, dur });

// MIDI to frequency conversion (A4 = 440Hz, A4 = MIDI 69)
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const MIDI_NOTES_TO_FREQ = midiToFreq;

// ============================================================================
// MUSIC TRACKS
// ============================================================================

// Track 1: Title (90 BPM, square, C minor, mysterious arpeggios)
const titleMelody: Note[] = rep([
  N(60, 2), N(63, 2), R(2), N(67, 2),  // C4, Eb4, G4
  N(68, 1), R(1), N(67, 2), N(63, 2),  // Ab4
  N(60, 2), N(58, 2), R(2), N(55, 2),  // C4, Bb3, G3
  N(56, 1), R(1), N(55, 2), R(2),     // G#3
], 2);

const titleBass: Note[] = rep([
  N(36, 4), R(4), N(43, 4), R(4),     // C2, G2
  N(36, 4), R(4), N(43, 2), N(46, 2), // C2, G2, Bb2
], 2);

// Track 2: Stone Dungeon (120 BPM, square, C minor, simple march) - with DRUMS
const stoneDungeonMelody: Note[] = rep([
  N(60, 2), N(58, 2), R(2), N(55, 4),  // C4, Bb3, G3
  N(53, 2), R(2), N(55, 2), R(2),     // F3, G3
  N(58, 2), N(55, 2), R(2), N(53, 4),  // Bb3, G3, F3
  N(51, 2), R(2), N(53, 2), R(2),     // Eb3, F3
], 2);

const stoneDungeonBass: Note[] = rep([
  N(36, 8), R(8),                      // C2
  N(41, 4), N(44, 4),                  // F2, G2
  N(36, 8), R(8),                      // C2
  N(39, 4), N(36, 4),                  // Eb2, C2
], 2);

const stoneDungeonDrums: DrumPattern = {
  kick: [0, 8],
  snare: [4, 12],
  hihat: [2, 6, 10, 14]
};

// Track 3: Crystal Cavern (110 BPM, triangle, E minor, ethereal flowing)
const crystalCavernMelody: Note[] = rep([
  N(64, 3), N(66, 2), N(69, 3), R(2),  // E4, F#4, A4
  N(71, 3), N(69, 2), N(66, 3), N(64, 3),// B4, A4, F#4, E4
  N(60, 4), R(4), N(64, 4), R(4),     // C4, E4
  N(67, 3), N(69, 2), N(71, 3), R(2), // G4, A4, B4
], 2);

const crystalCavernBass: Note[] = rep([
  N(40, 8), N(43, 8),                  // E2, G2
  N(45, 4), N(43, 4), N(40, 4), R(4), // A2, G2, E2
  N(45, 8), N(40, 8),                  // A2, E2
  N(43, 4), N(45, 4), N(43, 8),       // G2, A2, G2
], 2);

// Track 4: Ancient Crypt (100 BPM, sawtooth, D minor, dark reverent)
const ancientCryptMelody: Note[] = rep([
  R(4), N(62, 4), R(4), N(65, 4),     // D4, F4
  N(67, 2), N(65, 2), N(62, 4), N(58, 4), // A4, F4, D4, Bb3
  R(4), N(57, 4), R(4), N(60, 4),     // A3, C4
  N(62, 2), N(60, 2), N(57, 4), N(54, 4), // D4, C4, A3, F#3
], 2);

const ancientCryptBass: Note[] = rep([
  N(38, 8), R(4), N(38, 4),            // D2
  N(45, 8), R(4), N(43, 4),            // A2, G2
  N(38, 8), R(4), N(38, 4),            // D2
  N(41, 8), R(4), N(40, 4),            // F2, E2
], 2);

// Track 5: Lava Core (130 BPM, square, E phrygian, intense driving) - with DRUMS
const lavaCoreMelody: Note[] = rep([
  N(64, 1), N(65, 1), N(64, 1), N(62, 1), // E4, F4, E4, D4
  N(60, 1), N(62, 1), N(57, 1), N(57, 2), // C4, D4, A3, A3
  N(65, 1), N(67, 1), N(69, 1), N(67, 1), // F4, G4, A4, G4
  N(65, 1), R(1), N(64, 2), N(62, 2),    // F4, E4, D4
], 2);

const lavaCoreBass: Note[] = rep([
  N(40, 3), R(1), N(40, 3), R(1),     // E2
  N(41, 4), N(40, 4),                  // F2, E2
  N(38, 3), R(1), N(38, 3), R(1),     // D2
  N(40, 4), N(41, 4),                  // E2, F2
], 2);

const lavaCoreDrums: DrumPattern = {
  kick: [0, 3, 6, 10],
  snare: [4, 12],
  hihat: [2, 6, 10, 14]
};

// Track 6: Void Abyss (80 BPM, square+sawtooth, C diminished, eerie dissonant)
const voidAbyssMelody: Note[] = rep([
  N(60, 3), N(49, 3), R(2), N(54, 2),  // C4, Db4, F#4
  N(65, 3), N(49, 3), R(2), N(54, 2),  // F4, Db4, F#4
  N(67, 3), N(51, 3), R(2), N(55, 2),  // G4, D4, G4
  N(60, 3), N(49, 3), R(2), N(54, 2),  // C4, Db4, F#4
], 2);

const voidAbyssBass: Note[] = rep([
  N(36, 4), R(4), N(31, 4), R(4),     // C2, G#1
  N(36, 4), R(4), N(30, 4), R(4),     // C2, F#1
  N(31, 4), R(4), N(30, 4), R(4),     // G#1, F#1
  N(36, 6), R(6), N(31, 4),           // C2, G#1
], 2);

// Track 7: Boss (140 BPM, square, C minor, aggressive fast arpeggios) - with DRUMS
const bossMelody: Note[] = rep([
  N(60, 1), N(63, 1), N(67, 1), N(72, 1), // C4, Eb4, G4, C5
  N(71, 1), N(67, 1), N(63, 1), N(60, 1), // B4, G4, Eb4, C4
  N(58, 1), N(60, 1), N(63, 1), N(67, 1), // Bb3, C4, Eb4, G4
  N(70, 1), N(67, 1), N(63, 1), N(58, 1), // Bb4, G4, Eb4, Bb3
  N(60, 1), N(63, 1), N(67, 1), N(72, 1), // C4, Eb4, G4, C5
  N(71, 1), N(67, 1), N(63, 1), N(60, 1), // B4, G4, Eb4, C4
  N(58, 1), N(55, 1), N(58, 1), N(63, 1), // Bb3, G3, Bb3, Eb4
  N(67, 2), R(1), N(63, 1), R(2),       // G4, Eb4
], 2);

const bossBass: Note[] = rep([
  N(36, 3), R(1), N(36, 2), R(2),     // C2
  N(41, 3), R(1), N(41, 2), R(2),     // F2
  N(39, 3), R(1), N(39, 2), R(2),     // Eb2
  N(36, 3), R(1), N(36, 3), R(1),     // C2
], 2);

const bossDrums: DrumPattern = {
  kick: [0, 2, 4, 6, 8, 10, 12, 14],
  snare: [4, 12],
  hihat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
};

// Track 8: Shop (100 BPM, triangle, F major, light cheerful)
const shopMelody: Note[] = rep([
  N(65, 2), N(69, 2), N(72, 2), R(2),  // F4, A4, C5
  N(74, 2), N(72, 2), N(69, 2), N(65, 2), // D5, C5, A4, F4
  N(64, 2), N(69, 2), N(74, 2), R(2),  // E4, A4, D5
  N(72, 2), N(69, 2), N(65, 2), N(64, 2), // C5, A4, F4, E4
], 2);

const shopBass: Note[] = rep([
  N(41, 4), N(45, 4), N(48, 4), R(4), // F2, A2, C3
  N(45, 4), N(41, 4), N(45, 4), R(4), // A2, F2, A2
  N(43, 4), N(46, 4), N(50, 4), R(4), // G2, Bb2, D3
  N(46, 4), N(43, 4), N(41, 4), N(40, 4), // Bb2, G2, F2, E2
], 2);

// Track 9: Game Over (60 BPM, triangle, C minor, slow somber)
const gameOverMelody: Note[] = rep([
  N(60, 4), R(4), N(58, 6), R(2),    // C4, Bb3
  N(55, 4), R(4), N(53, 6), R(2),    // G3, F3
  N(51, 4), R(4), N(50, 6), R(2),    // Eb3, D3
  N(48, 4), R(4), N(47, 6), R(2),    // C3, B2
], 2);

const gameOverBass: Note[] = rep([
  N(36, 8), R(8),                      // C2
  N(36, 8), R(8),                      // C2
  N(39, 8), R(8),                      // Eb2
  N(36, 8), R(8),                      // C2
], 2);

// Export all music tracks
export const MUSIC_TRACKS: TrackDef[] = [
  {
    id: 'title',
    bpm: 90,
    wave: 'square',
    gain: 0.15,
    melody: titleMelody,
    bass: titleBass
  },
  {
    id: 'stoneDungeon',
    bpm: 120,
    wave: 'square',
    gain: 0.15,
    melody: stoneDungeonMelody,
    bass: stoneDungeonBass,
    drums: stoneDungeonDrums
  },
  {
    id: 'crystalCavern',
    bpm: 110,
    wave: 'triangle',
    gain: 0.18,
    melody: crystalCavernMelody,
    bass: crystalCavernBass
  },
  {
    id: 'ancientCrypt',
    bpm: 100,
    wave: 'sawtooth',
    gain: 0.12,
    melody: ancientCryptMelody,
    bass: ancientCryptBass
  },
  {
    id: 'lavaCore',
    bpm: 130,
    wave: 'square',
    gain: 0.15,
    melody: lavaCoreMelody,
    bass: lavaCoreBass,
    drums: lavaCoreDrums
  },
  {
    id: 'voidAbyss',
    bpm: 80,
    wave: 'square',
    wave2: 'sawtooth',
    gain: 0.12,
    melody: voidAbyssMelody,
    bass: voidAbyssBass
  },
  {
    id: 'boss',
    bpm: 140,
    wave: 'square',
    gain: 0.18,
    melody: bossMelody,
    bass: bossBass,
    drums: bossDrums
  },
  {
    id: 'shop',
    bpm: 100,
    wave: 'triangle',
    gain: 0.15,
    melody: shopMelody,
    bass: shopBass
  },
  {
    id: 'gameOver',
    bpm: 60,
    wave: 'triangle',
    gain: 0.15,
    melody: gameOverMelody,
    bass: gameOverBass
  },
  // Track 10: Secret Room (70 BPM, sine, Eb minor, mysterious shimmer)
  {
    id: 'secretRoom',
    bpm: 70,
    wave: 'sine',
    gain: 0.14,
    melody: rep([
      N(63, 4), R(4), N(66, 4), R(4),     // Eb4, F#4
      N(70, 6), R(2), N(68, 4), R(4),     // Bb4, Ab4
      N(63, 4), R(4), N(58, 4), R(4),     // Eb4, Bb3
      N(61, 6), R(2), N(63, 4), R(4),     // Db4, Eb4
    ], 2),
    bass: rep([
      N(39, 8), R(8), N(46, 8), R(8),     // Eb2, Bb2
      N(42, 8), R(8), N(39, 8), R(8),     // F#2, Eb2
    ], 2)
  }
];
