# 8-Bit Music & SFX System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add procedural 8-bit chip music BGM and enhanced SFX to abyss-echo using Web Audio API oscillators — no external audio files.

**Architecture:** A new `AudioManager` singleton class owns the Web Audio context, manages BGM playback (step sequencer with note patterns per scene), SFX playback (enhanced existing system), and music/SFX state (mute toggles). It auto-detects game context (biome, boss, phase) from the store and crossfades between BGM tracks. The existing `playSound()` in gameStore is replaced by calls to `AudioManager`.

**Tech Stack:** Web Audio API (OscillatorNode, GainNode, BiquadFilterNode), TypeScript, Zustand store integration

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/audio/AudioManager.ts` | Singleton: AudioContext, BGM sequencer, SFX playback, mute state, crossfade logic |
| `src/audio/musicData.ts` | All note sequences (MIDI note numbers + durations), tempo, wave type per BGM track |
| `src/audio/sfxData.ts` | Enhanced SFX definitions: multi-oscillator, envelopes, pitch sweeps |
| `src/types/index.ts` | Add `musicEnabled`, `sfxEnabled` to `GameState` |
| `src/store/gameStore.ts` | Replace inline `playSound`/`getAudioCtx` with `AudioManager` calls; add context-aware BGM triggers |
| `src/components/CharacterCreation.tsx` | Add music/SFX toggle buttons |
| `src/components/App.tsx` | Add global volume overlay controls |
| `src/components/GameOverScreen.tsx` | Trigger game-over BGM |

---

## Musical Design

### Note representation
All notes use MIDI numbers (60 = C4). Duration in steps (1 step = 1/16 note at given tempo).

### BGM Tracks (7 tracks)

| Track ID | Scene | Tempo (BPM) | Wave | Key | Mood |
|----------|-------|-------------|------|-----|------|
| `title` | Title/CharCreation | 90 | square | C minor | Mysterious, slow arpeggios |
| `stoneDungeon` | Floors 1-5 | 120 | square | C minor | Simple march rhythm |
| `crystalCavern` | Floors 6-10 | 110 | triangle | E minor | Ethereal, flowing |
| `ancientCrypt` | Floors 11-15 | 100 | sawtooth(25%) | D minor | Dark, reverent |
| `lavaCore` | Floors 16-20 | 130 | square | E phrygian | Intense, driving |
| `voidAbyss` | Floors 21+ | 80 | square+sawtooth | C diminished | Eerie, dissonant |
| `boss` | Boss floor overlay | 140 | square | C minor | Aggressive, fast arpeggios |
| `shop` | Shop modal | 100 | triangle | F major | Light, cheerful |
| `gameOver` | Death screen | 60 | triangle | C minor | Slow, somber |

### SFX Enhancement
Replace single-oscillator bleeps with multi-stage envelopes:
- **Attack**: Quick pitch-down sweep + noise burst
- **Hit**: Low thud with resonance
- **Critical**: Rising arpeggio burst
- **LevelUp**: Ascending major arpeggio
- **Pickup**: Bright two-note chime
- **Door**: Wooden knock (filtered noise)
- **Death**: Long descending tone
- **Skill**: Whoosh (filtered sweep)
- **Coin**: High double-tap chime
- **Trap**: Dissonant stab
- **Heal**: Ascending shimmer
- **BossAppear**: Dramatic low rumble + rising tone

---

## Task 1: Create musicData.ts — All BGM Note Patterns

**Files:**
- Create: `src/audio/musicData.ts`

- [ ] **Step 1: Create the musicData.ts file with all BGM track definitions**

```typescript
// src/audio/musicData.ts
// 8-bit chip music note data for abyss-echo
// Notes: MIDI numbers (60=C4, 69=A4=440Hz)
// Durations: in 16th-note steps at track tempo

export interface Note {
  midi: number;   // MIDI note number (0 = rest)
  dur: number;    // Duration in 16th-note steps
}

export interface TrackDef {
  id: string;
  bpm: number;
  wave: OscillatorType;
  wave2?: OscillatorType;   // Optional second oscillator layer
  gain: number;             // Master volume 0-1
  melody: Note[];
  bass: Note[];
  drums?: DrumPattern;      // Optional percussion channel
}

export interface DrumPattern {
  kick: number[];    // Step indices where kick hits
  snare: number[];   // Step indices where snare hits
  hihat: number[];   // Step indices where hihat hits
}

// --- Helper: generate repeated pattern ---
function rep(notes: Note[], times: number): Note[] {
  const result: Note[] = [];
  for (let i = 0; i < times; i++) result.push(...notes);
  return result;
}

// --- Note shortcuts ---
const R = (d = 1): Note => ({ midi: 0, dur: d });
const N = (midi: number, dur = 1): Note => ({ midi, dur });

// ============================================================
// Title Screen — Mysterious C minor arpeggios, slow
// ============================================================
const titleMelody: Note[] = [
  N(48,4), N(51,4), N(55,4), N(60,4),
  N(58,4), N(55,4), N(51,4), N(48,4),
  N(46,4), N(51,4), N(55,4), N(58,4),
  N(55,4), N(51,4), N(46,4), N(43,4),
];
const titleBass: Note[] = [
  N(36,8), N(36,4), N(39,4),
  N(34,8), N(34,4), N(43,4),
];

// ============================================================
// Stone Dungeon — Simple march, C minor
// ============================================================
const stoneMelody: Note[] = [
  N(60,2), N(60,2), N(63,2), N(60,2),
  N(58,2), N(58,2), N(60,2), R(2),
  N(55,2), N(55,2), N(58,2), N(55,2),
  N(51,2), N(51,2), N(55,2), R(2),
];
const stoneBass: Note[] = [
  N(36,4), N(36,2), N(36,2), N(39,4), N(39,4),
  N(34,4), N(34,2), N(34,2), N(43,4), N(43,4),
];

// ============================================================
// Crystal Cavern — Ethereal E minor, flowing arpeggios
// ============================================================
const crystalMelody: Note[] = [
  N(64,3), N(67,3), N(71,3), N(72,3),
  N(71,3), N(67,3), N(64,3), N(62,3),
  N(60,3), N(64,3), N(67,3), N(71,3),
  N(67,3), N(64,3), N(60,3), N(59,3),
];
const crystalBass: Note[] = [
  N(40,8), N(43,4), N(47,4),
  N(40,8), N(43,4), N(47,4),
];

// ============================================================
// Ancient Crypt — Dark D minor, slow and reverent
// ============================================================
const cryptMelody: Note[] = [
  N(62,4), N(65,4), N(69,4), R(4),
  N(67,4), N(65,4), N(62,4), R(4),
  N(60,4), N(62,4), N(65,4), R(4),
  N(62,4), N(60,4), N(57,4), R(4),
];
const cryptBass: Note[] = [
  N(38,8), N(38,4), N(41,4),
  N(36,8), N(36,4), N(45,4),
];

// ============================================================
// Lava Core — Intense E phrygian, driving rhythm
// ============================================================
const lavaMelody: Note[] = [
  N(64,2), N(64,1), N(63,1), N(64,2), N(67,2),
  N(64,2), N(63,2), N(60,2), R(2),
  N(60,2), N(60,1), N(59,1), N(60,2), N(64,2),
  N(60,2), N(59,2), N(56,2), R(2),
];
const lavaBass: Note[] = [
  N(40,4), N(40,2), N(40,2), N(43,4), N(43,4),
  N(36,4), N(36,2), N(36,2), N(40,4), N(40,4),
];

// ============================================================
// Void Abyss — Eerie, dissonant, slow
// ============================================================
const voidMelody: Note[] = [
  N(60,4), N(56,4), N(63,4), N(53,4),
  N(60,4), N(58,4), N(55,4), N(51,4),
];
const voidBass: Note[] = [
  N(36,6), N(34,6), N(37,6), N(32,6),
  N(36,6), N(35,6), N(33,6), N(31,6),
];

// ============================================================
// Boss Battle — Aggressive C minor, fast arpeggios
// ============================================================
const bossMelody: Note[] = [
  N(48,1), N(51,1), N(55,1), N(60,1),
  N(55,1), N(51,1), N(48,1), N(51,1),
  N(55,1), N(60,1), N(63,1), N(60,1),
  N(55,1), N(51,1), N(48,1), N(46,1),
];
const bossBass: Note[] = [
  N(36,2), N(36,2), N(39,2), N(39,2),
  N(34,2), N(34,2), N(36,2), N(36,2),
];

// ============================================================
// Shop — Light F major, cheerful
// ============================================================
const shopMelody: Note[] = [
  N(65,2), N(69,2), N(72,2), N(77,2),
  N(72,2), N(69,2), N(65,2), R(2),
  N(67,2), N(70,2), N(74,2), N(77,2),
  N(74,2), N(70,2), N(67,2), R(2),
];
const shopBass: Note[] = [
  N(41,4), N(41,4), N(45,4), N(45,4),
  N(43,4), N(43,4), N(41,4), N(41,4),
];

// ============================================================
// Game Over — Slow, somber C minor
// ============================================================
const gameOverMelody: Note[] = [
  N(60,8), N(58,8), N(55,8), N(51,8),
  N(48,16), R(16),
];
const gameOverBass: Note[] = [
  N(36,16), N(34,16), N(31,16),
];

// ============================================================
// All tracks
// ============================================================
export const MUSIC_TRACKS: TrackDef[] = [
  {
    id: 'title', bpm: 90, wave: 'square', gain: 0.12,
    melody: rep(titleMelody, 2),
    bass: rep(titleBass, 4),
  },
  {
    id: 'stoneDungeon', bpm: 120, wave: 'square', gain: 0.10,
    melody: rep(stoneMelody, 2),
    bass: rep(stoneBass, 4),
    drums: { kick: [0,4,8,12], snare: [4,12], hihat: [0,2,4,6,8,10,12,14] },
  },
  {
    id: 'crystalCavern', bpm: 110, wave: 'triangle', gain: 0.10,
    melody: rep(crystalMelody, 2),
    bass: rep(crystalBass, 4),
  },
  {
    id: 'ancientCrypt', bpm: 100, wave: 'sawtooth', gain: 0.08,
    melody: rep(cryptMelody, 2),
    bass: rep(cryptBass, 4),
  },
  {
    id: 'lavaCore', bpm: 130, wave: 'square', gain: 0.10,
    melody: rep(lavaMelody, 2),
    bass: rep(lavaBass, 4),
    drums: { kick: [0,3,6,8,11,14], snare: [4,12], hihat: [0,2,4,6,8,10,12,14] },
  },
  {
    id: 'voidAbyss', bpm: 80, wave: 'square', wave2: 'sawtooth', gain: 0.08,
    melody: rep(voidMelody, 4),
    bass: rep(voidBass, 4),
  },
  {
    id: 'boss', bpm: 140, wave: 'square', gain: 0.12,
    melody: rep(bossMelody, 4),
    bass: rep(bossBass, 8),
    drums: { kick: [0,2,4,6,8,10,12,14], snare: [4,12], hihat: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] },
  },
  {
    id: 'shop', bpm: 100, wave: 'triangle', gain: 0.10,
    melody: rep(shopMelody, 2),
    bass: rep(shopBass, 4),
  },
  {
    id: 'gameOver', bpm: 60, wave: 'triangle', gain: 0.10,
    melody: gameOverMelody,
    bass: gameOverBass,
  },
];

// MIDI note to frequency conversion
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
```

---

## Task 2: Create sfxData.ts — Enhanced Sound Effect Definitions

**Files:**
- Create: `src/audio/sfxData.ts`

- [ ] **Step 1: Create sfxData.ts with multi-stage SFX definitions**

```typescript
// src/audio/sfxData.ts
// Enhanced 8-bit sound effect definitions using Web Audio API

export type SfxId = 'attack' | 'hit' | 'critical' | 'levelup' | 'pickup' | 'door' | 'death' | 'skill' | 'coin' | 'trap' | 'heal' | 'bossAppear';

export interface SfxStage {
  freq: number;        // Frequency in Hz
  freqEnd?: number;    // End frequency for sweep (optional)
  wave: OscillatorType;
  duration: number;    // Seconds
  gain: number;        // Volume 0-1
  gainEnd?: number;    // End volume for envelope (optional, defaults to 0)
}

export interface SfxDef {
  id: SfxId;
  stages: SfxStage[];  // Stages play sequentially
}

export const SFX_DEFS: SfxDef[] = [
  {
    id: 'attack',
    stages: [
      { freq: 300, freqEnd: 150, wave: 'square', duration: 0.04, gain: 0.10, gainEnd: 0 },
      { freq: 100, wave: 'square', duration: 0.03, gain: 0.05, gainEnd: 0 },
    ],
  },
  {
    id: 'hit',
    stages: [
      { freq: 120, freqEnd: 60, wave: 'sawtooth', duration: 0.08, gain: 0.12, gainEnd: 0 },
    ],
  },
  {
    id: 'critical',
    stages: [
      { freq: 400, freqEnd: 800, wave: 'square', duration: 0.06, gain: 0.12 },
      { freq: 800, freqEnd: 400, wave: 'square', duration: 0.06, gain: 0.10 },
      { freq: 600, wave: 'square', duration: 0.04, gain: 0.08, gainEnd: 0 },
    ],
  },
  {
    id: 'levelup',
    stages: [
      { freq: 523, wave: 'square', duration: 0.1, gain: 0.12 },
      { freq: 659, wave: 'square', duration: 0.1, gain: 0.12 },
      { freq: 784, wave: 'square', duration: 0.15, gain: 0.12, gainEnd: 0 },
    ],
  },
  {
    id: 'pickup',
    stages: [
      { freq: 660, wave: 'sine', duration: 0.05, gain: 0.10 },
      { freq: 880, wave: 'sine', duration: 0.06, gain: 0.08, gainEnd: 0 },
    ],
  },
  {
    id: 'door',
    stages: [
      { freq: 200, freqEnd: 80, wave: 'triangle', duration: 0.06, gain: 0.10, gainEnd: 0 },
      { freq: 80, freqEnd: 60, wave: 'triangle', duration: 0.06, gain: 0.06, gainEnd: 0 },
    ],
  },
  {
    id: 'death',
    stages: [
      { freq: 300, freqEnd: 80, wave: 'sawtooth', duration: 0.3, gain: 0.15, gainEnd: 0 },
      { freq: 80, freqEnd: 40, wave: 'sawtooth', duration: 0.4, gain: 0.08, gainEnd: 0 },
    ],
  },
  {
    id: 'skill',
    stages: [
      { freq: 200, freqEnd: 600, wave: 'square', duration: 0.08, gain: 0.10 },
      { freq: 600, freqEnd: 400, wave: 'square', duration: 0.06, gain: 0.08, gainEnd: 0 },
    ],
  },
  {
    id: 'coin',
    stages: [
      { freq: 880, wave: 'sine', duration: 0.04, gain: 0.08 },
      { freq: 1100, wave: 'sine', duration: 0.06, gain: 0.06, gainEnd: 0 },
    ],
  },
  {
    id: 'trap',
    stages: [
      { freq: 200, freqEnd: 600, wave: 'sawtooth', duration: 0.05, gain: 0.12 },
      { freq: 600, freqEnd: 100, wave: 'sawtooth', duration: 0.1, gain: 0.10, gainEnd: 0 },
    ],
  },
  {
    id: 'heal',
    stages: [
      { freq: 440, wave: 'sine', duration: 0.08, gain: 0.08 },
      { freq: 554, wave: 'sine', duration: 0.08, gain: 0.08 },
      { freq: 659, wave: 'sine', duration: 0.12, gain: 0.06, gainEnd: 0 },
    ],
  },
  {
    id: 'bossAppear',
    stages: [
      { freq: 80, freqEnd: 40, wave: 'sawtooth', duration: 0.5, gain: 0.15 },
      { freq: 200, freqEnd: 600, wave: 'square', duration: 0.3, gain: 0.12, gainEnd: 0 },
    ],
  },
];
```

---

## Task 3: Create AudioManager.ts — Core Audio Engine

**Files:**
- Create: `src/audio/AudioManager.ts`

This is the central piece. It handles:
- AudioContext lifecycle
- BGM step sequencer (plays notes from TrackDef patterns in a loop)
- SFX playback (multi-stage from SfxDef)
- Crossfade between BGM tracks
- Music/SFX mute toggles
- Boss overlay (plays boss BGM on top of biome BGM or replaces it)
- Ducking (lower BGM volume when SFX plays)

- [ ] **Step 1: Create AudioManager.ts**

```typescript
// src/audio/AudioManager.ts
import { MUSIC_TRACKS, TrackDef, Note, midiToFreq, DrumPattern } from './musicData';
import { SFX_DEFS, SfxId, SfxDef } from './sfxData';

class AudioManagerClass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // BGM sequencer state
  private currentTrackId: string | null = null;
  private melodyOsc: OscillatorNode | null = null;
  private melodyGain: GainNode | null = null;
  private bassOsc: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;
  private drumInterval: number | null = null;
  private sequencerTimer: number | null = null;
  private melodyIndex = 0;
  private bassIndex = 0;
  private drumStep = 0;
  private isPlaying = false;

  // Boss overlay
  private bossTrackActive = false;
  private preBossTrackId: string | null = null;

  // Mute state
  private _musicEnabled = true;
  private _sfxEnabled = true;

  // Crossfade
  private crossfadeGain: GainNode | null = null;
  private fadeTimer: number | null = null;

  // Ducking
  private ducking = false;
  private duckTimer: number | null = null;

  get musicEnabled() { return this._musicEnabled; }
  get sfxEnabled() { return this._sfxEnabled; }

  private getCtx(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          this.ctx = new AC();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 0.6;
          this.masterGain.connect(this.ctx.destination);

          this.bgmGain = this.ctx.createGain();
          this.bgmGain.gain.value = 0.5;
          this.bgmGain.connect(this.masterGain);

          this.sfxGain = this.ctx.createGain();
          this.sfxGain.gain.value = 1.0;
          this.sfxGain.connect(this.masterGain);
        }
      }
      if (this.ctx?.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch { return null; }
  }

  // ============================================================
  // BGM Playback
  // ============================================================

  playBGM(trackId: string) {
    if (this.currentTrackId === trackId && this.isPlaying) return;
    if (!this._musicEnabled) { this.currentTrackId = trackId; return; }

    const ctx = this.getCtx();
    if (!ctx) return;

    // Crossfade: fade out old, start new
    this.stopBGM(false);
    this.startTrack(trackId);
  }

  private startTrack(trackId: string) {
    const ctx = this.getCtx();
    if (!ctx || !this.bgmGain) return;

    const track = MUSIC_TRACKS.find(t => t.id === trackId);
    if (!track) return;

    this.currentTrackId = trackId;
    this.isPlaying = true;
    this.melodyIndex = 0;
    this.bassIndex = 0;
    this.drumStep = 0;

    // Create melody oscillator
    this.melodyGain = ctx.createGain();
    this.melodyGain.gain.value = 0;
    this.melodyGain.connect(this.bgmGain);

    this.melodyOsc = ctx.createOscillator();
    this.melodyOsc.type = track.wave;
    this.melodyOsc.connect(this.melodyGain);
    this.melodyOsc.start();

    // Create bass oscillator
    this.bassGain = ctx.createGain();
    this.bassGain.gain.value = 0;
    this.bassGain.connect(this.bgmGain);

    this.bassOsc = ctx.createOscillator();
    this.bassOsc.type = 'triangle'; // Bass always triangle for warmth
    this.bassOsc.connect(this.bassGain);
    this.bassOsc.start();

    // Schedule notes
    this.scheduleNotes(track);
  }

  private scheduleNotes(track: TrackDef) {
    if (!this.isPlaying || !this.ctx) return;

    const stepDuration = 60 / track.bpm / 4; // 16th note duration in seconds
    const lookAhead = 0.2; // Schedule 200ms ahead
    const scheduleInterval = 50; // Check every 50ms

    const schedule = () => {
      if (!this.isPlaying || !this.ctx) return;

      const currentTime = this.ctx.currentTime;

      // Schedule melody notes
      this.scheduleMelodyNote(track, currentTime, stepDuration);
      // Schedule bass notes
      this.scheduleBassNote(track, currentTime, stepDuration);
      // Schedule drums
      this.scheduleDrums(track, currentTime, stepDuration);

      this.sequencerTimer = window.setTimeout(schedule, scheduleInterval);
    };

    schedule();
  }

  private nextMelodyTime = 0;
  private nextBassTime = 0;
  private nextDrumTime = 0;

  private scheduleMelodyNote(track: TrackDef, currentTime: number, stepDuration: number) {
    if (!this.melodyOsc || !this.melodyGain || !this.ctx) return;

    while (this.nextMelodyTime < currentTime + 0.2) {
      if (this.nextMelodyTime < currentTime) {
        this.nextMelodyTime = currentTime;
      }

      const note = track.melody[this.melodyIndex % track.melody.length];
      const duration = note.dur * stepDuration;

      if (note.midi > 0) {
        const freq = midiToFreq(note.midi);
        this.melodyOsc.frequency.setValueAtTime(freq, this.nextMelodyTime);
        this.melodyGain.gain.setValueAtTime(track.gain, this.nextMelodyTime);
        this.melodyGain.gain.setValueAtTime(track.gain, this.nextMelodyTime + duration * 0.8);
        this.melodyGain.gain.linearRampToValueAtTime(0.001, this.nextMelodyTime + duration * 0.95);
      } else {
        this.melodyGain.gain.setValueAtTime(0.001, this.nextMelodyTime);
      }

      this.nextMelodyTime += duration;
      this.melodyIndex++;
    }
  }

  private scheduleBassNote(track: TrackDef, currentTime: number, stepDuration: number) {
    if (!this.bassOsc || !this.bassGain || !this.ctx) return;

    while (this.nextBassTime < currentTime + 0.2) {
      if (this.nextBassTime < currentTime) {
        this.nextBassTime = currentTime;
      }

      const note = track.bass[this.bassIndex % track.bass.length];
      const duration = note.dur * stepDuration;

      if (note.midi > 0) {
        const freq = midiToFreq(note.midi);
        this.bassOsc.frequency.setValueAtTime(freq, this.nextBassTime);
        this.bassGain.gain.setValueAtTime(track.gain * 0.7, this.nextBassTime);
        this.bassGain.gain.setValueAtTime(track.gain * 0.7, this.nextBassTime + duration * 0.8);
        this.bassGain.gain.linearRampToValueAtTime(0.001, this.nextBassTime + duration * 0.95);
      } else {
        this.bassGain.gain.setValueAtTime(0.001, this.nextBassTime);
      }

      this.nextBassTime += duration;
      this.bassIndex++;
    }
  }

  private scheduleDrums(track: TrackDef, currentTime: number, stepDuration: number) {
    if (!track.drums || !this.ctx || !this.bgmGain) return;

    while (this.nextDrumTime < currentTime + 0.2) {
      if (this.nextDrumTime < currentTime) {
        this.nextDrumTime = currentTime;
      }

      const stepInPattern = this.drumStep % 16;

      // Kick
      if (track.drums.kick.includes(stepInPattern)) {
        this.playDrumHit(80, 'sine', 0.15, 0.06, this.nextDrumTime);
      }
      // Snare (noise-like using sawtooth)
      if (track.drums.snare.includes(stepInPattern)) {
        this.playDrumHit(200, 'sawtooth', 0.08, 0.04, this.nextDrumTime);
      }
      // Hi-hat
      if (track.drums.hihat.includes(stepInPattern)) {
        this.playDrumHit(800, 'square', 0.04, 0.02, this.nextDrumTime);
      }

      this.nextDrumTime += stepDuration;
      this.drumStep++;
    }
  }

  private playDrumHit(freq: number, wave: OscillatorType, gain: number, duration: number, time: number) {
    const ctx = this.getCtx();
    if (!ctx || !this.bgmGain) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(gain, time);
    g.gain.linearRampToValueAtTime(0.001, time + duration);
    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  stopBGM(immediate: boolean = true) {
    if (immediate) {
      this.stopAllOscillators();
    } else {
      // Quick fade out
      const ctx = this.getCtx();
      if (ctx && this.bgmGain) {
        this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, ctx.currentTime);
        this.bgmGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        setTimeout(() => this.stopAllOscillators(), 350);
      } else {
        this.stopAllOscillators();
      }
    }
  }

  private stopAllOscillators() {
    if (this.sequencerTimer) {
      clearTimeout(this.sequencerTimer);
      this.sequencerTimer = null;
    }

    try { this.melodyOsc?.stop(); } catch { /* ignore */ }
    try { this.bassOsc?.stop(); } catch { /* ignore */ }
    this.melodyOsc = null;
    this.bassOsc = null;
    this.melodyGain = null;
    this.bassGain = null;

    this.isPlaying = false;
    this.nextMelodyTime = 0;
    this.nextBassTime = 0;
    this.nextDrumTime = 0;

    // Reset bgm gain
    const ctx = this.getCtx();
    if (ctx && this.bgmGain) {
      this.bgmGain.gain.setValueAtTime(0.5, ctx.currentTime);
    }
  }

  // ============================================================
  // Boss Overlay
  // ============================================================

  enterBossFight() {
    if (this.bossTrackActive) return;
    this.preBossTrackId = this.currentTrackId;
    this.bossTrackActive = true;
    this.playBGM('boss');
  }

  exitBossFight() {
    if (!this.bossTrackActive) return;
    this.bossTrackActive = false;
    const returnTo = this.preBossTrackId || 'stoneDungeon';
    this.preBossTrackId = null;
    this.playBGM(returnTo);
  }

  // ============================================================
  // SFX Playback
  // ============================================================

  playSFX(id: SfxId) {
    if (!this._sfxEnabled) return;
    const ctx = this.getCtx();
    if (!ctx || !this.sfxGain) return;

    const def = SFX_DEFS.find(d => d.id === id);
    if (!def) return;

    // Duck BGM
    this.duck();

    let offset = 0;
    for (const stage of def.stages) {
      this.playSfxStage(stage, ctx.currentTime + offset);
      offset += stage.duration;
    }
  }

  private playSfxStage(stage: SfxDef['stages'][0], startTime: number) {
    const ctx = this.getCtx();
    if (!ctx || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = stage.wave;

    // Frequency
    osc.frequency.setValueAtTime(stage.freq, startTime);
    if (stage.freqEnd) {
      osc.frequency.linearRampToValueAtTime(stage.freqEnd, startTime + stage.duration);
    }

    // Envelope
    const endGain = stage.gainEnd ?? 0;
    gain.gain.setValueAtTime(stage.gain, startTime);
    gain.gain.setValueAtTime(stage.gain, startTime + stage.duration * 0.7);
    gain.gain.linearRampToValueAtTime(Math.max(0.001, endGain), startTime + stage.duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + stage.duration + 0.02);
  }

  private duck() {
    const ctx = this.getCtx();
    if (!ctx || !this.bgmGain || !this._musicEnabled) return;

    if (this.duckTimer) clearTimeout(this.duckTimer);

    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);

    this.duckTimer = window.setTimeout(() => {
      if (this.bgmGain && this.ctx) {
        this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, this.ctx.currentTime);
        this.bgmGain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.3);
      }
    }, 200);
  }

  // ============================================================
  // Toggle Controls
  // ============================================================

  toggleMusic(): boolean {
    this._musicEnabled = !this._musicEnabled;
    if (this._musicEnabled) {
      // Resume current track
      if (this.currentTrackId) {
        this.startTrack(this.currentTrackId);
      }
    } else {
      this.stopBGM(true);
    }
    return this._musicEnabled;
  }

  toggleSfx(): boolean {
    this._sfxEnabled = !this._sfxEnabled;
    return this._sfxEnabled;
  }

  setMusicEnabled(enabled: boolean) {
    if (enabled && !this._musicEnabled) {
      this._musicEnabled = true;
      if (this.currentTrackId) this.startTrack(this.currentTrackId);
    } else if (!enabled && this._musicEnabled) {
      this._musicEnabled = false;
      this.stopBGM(true);
    }
  }

  setSfxEnabled(enabled: boolean) {
    this._sfxEnabled = enabled;
  }

  // ============================================================
  // Context-Aware BGM Selection
  // ============================================================

  updateContext(phase: string, floor: number, hasBoss: boolean, biome: string) {
    let targetTrack: string;

    if (phase === 'gameOver') {
      targetTrack = 'gameOver';
    } else if (phase === 'shop') {
      targetTrack = 'shop';
    } else if (phase === 'title' || phase === 'characterCreation') {
      targetTrack = 'title';
    } else if (hasBoss) {
      if (!this.bossTrackActive) this.enterBossFight();
      return;
    } else {
      // Select by biome
      const biomeTracks: Record<string, string> = {
        stoneDungeon: 'stoneDungeon',
        crystalCavern: 'crystalCavern',
        ancientCrypt: 'ancientCrypt',
        lavaCore: 'lavaCore',
        voidAbyss: 'voidAbyss',
      };
      targetTrack = biomeTracks[biome] || 'stoneDungeon';

      if (this.bossTrackActive) {
        this.exitBossFight();
        return;
      }
    }

    this.playBGM(targetTrack);
  }
}

// Singleton export
export const AudioManager = new AudioManagerClass();
```

---

## Task 4: Integrate AudioManager into GameState & Store

**Files:**
- Modify: `src/types/index.ts` — Add `musicEnabled`/`sfxEnabled` to GameState
- Modify: `src/store/gameStore.ts` — Replace inline audio with AudioManager, add context-aware BGM triggers

- [ ] **Step 1: Add musicEnabled/sfxEnabled to GameState in types/index.ts**

Add to the `GameState` interface:
```typescript
  musicEnabled: boolean;
  sfxEnabled: boolean;
```

Add to the `GameStore` interface action methods:
```typescript
  toggleMusic: () => void;
  toggleSfx: () => void;
```

- [ ] **Step 2: Update gameStore.ts — Replace playSound/getAudioCtx with AudioManager**

Remove the existing `getAudioCtx()` and `playSound()` functions from gameStore.ts.

Add import:
```typescript
import { AudioManager } from '../audio/AudioManager';
```

Replace ALL `playSound('xxx')` calls with `AudioManager.playSFX('xxx')`.

Also add `musicEnabled: true, sfxEnabled: true` to `initialState`.

Add `toggleMusic` and `toggleSfx` actions to the store:
```typescript
toggleMusic: () => {
  const enabled = AudioManager.toggleMusic();
  set({ musicEnabled: enabled });
},
toggleSfx: () => {
  const enabled = AudioManager.toggleSfx();
  set({ sfxEnabled: enabled });
},
```

- [ ] **Step 3: Add context-aware BGM triggers in gameStore.ts**

In `newGame()`, after `enterFloor(1)`, add:
```typescript
AudioManager.updateContext('playing', 1, false, 'stoneDungeon');
```

In `enterFloor()`, after setting state, add:
```typescript
const biome = getBiomeForFloor(floor);
const hasBoss = enemies.some(e => e.isBoss);
AudioManager.updateContext('playing', floor, hasBoss, biome);
```

In `movePlayer()`, when boss is first encountered (enemy with `isBoss: true` in visible range):
```typescript
// Check if boss is now visible
const bossVisible = enemies.some(e => e.isBoss && e.hp > 0 && visibleTiles.has(`${e.pos.x},${e.pos.y}`));
if (bossVisible) {
  AudioManager.playSFX('bossAppear');
  AudioManager.enterBossFight();
}
```

In `descendStairs()`:
```typescript
// BGM will update via enterFloor
```

In `setPhase()`:
```typescript
if (phase === GamePhase.Shop) AudioManager.updateContext('shop', 0, false, '');
if (phase === GamePhase.GameOver) AudioManager.updateContext('gameOver', 0, false, '');
if (phase === GamePhase.Playing) {
  const state = get();
  const biome = getBiomeForFloor(state.currentFloor);
  AudioManager.updateContext('playing', state.currentFloor, false, biome);
}
```

Also add `AudioManager.playSFX('trap')` in the trap damage section and `AudioManager.playSFX('heal')` in potion healing.

---

## Task 5: Add Music/SFX Toggle UI to CharacterCreation & Game HUD

**Files:**
- Modify: `src/components/CharacterCreation.tsx` — Add toggle buttons
- Modify: `src/components/App.tsx` — Add HUD audio controls

- [ ] **Step 1: Add music/SFX toggles to CharacterCreation.tsx**

Add a row of toggle buttons below the daily challenge toggle:
```tsx
<div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px' }}>
  <label style={{ color: musicEnabled ? '#44cc44' : '#444455', cursor: 'pointer', fontSize: '12px' }}>
    🎵 音乐 {musicEnabled ? 'ON' : 'OFF'}
  </label>
  <label style={{ color: sfxEnabled ? '#44cc44' : '#444455', cursor: 'pointer', fontSize: '12px' }}>
    🔊 音效 {sfxEnabled ? 'ON' : 'OFF'}
  </label>
</div>
```

- [ ] **Step 2: Add HUD audio controls to App.tsx GameScreen**

Add a small fixed-position control in the top-right corner:
```tsx
<div style={{
  position: 'absolute',
  top: '4px',
  right: '4px',
  display: 'flex',
  gap: '4px',
  zIndex: 50,
}}>
  <button onClick={...} style={...}>🎵</button>
  <button onClick={...} style={...}>🔊</button>
</div>
```

---

## Task 6: Build Verification & Integration Testing

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript type check**

Run: `cd /Users/haibowang/Desktop/ASCI\&ASCII/abyss-echo && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run production build**

Run: `cd /Users/haibowang/Desktop/ASCI\&ASCII/abyss-echo && npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Manual testing checklist**

- Title screen plays title BGM
- Entering floor 1 plays stoneDungeon BGM
- Descending to floor 6 crossfades to crystalCavern BGM
- Boss floor plays boss BGM (overlay)
- Shop opens shop BGM, returns on close
- Game Over plays gameOver BGM
- SFX play correctly for all actions (attack, hit, critical, etc.)
- Music toggle works (M key)
- SFX toggle works
- BGM ducks when SFX plays
