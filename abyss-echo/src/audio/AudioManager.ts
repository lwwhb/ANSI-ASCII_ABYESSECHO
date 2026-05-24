/**
 * AudioManager - Core Audio Engine for Abyss-Echo
 * Procedural 8-bit music and SFX using Web Audio API
 */

import { MUSIC_TRACKS, midiToFreq, type TrackDef } from './musicData';
import { SFX_DEFS, type SfxId, type SfxStage } from './sfxData';

// ============================================================================
// TYPES
// ============================================================================

interface ActiveOscillator {
  oscillator: OscillatorNode;
  gainNode: GainNode;
  stopTime: number;
}

interface BgmState {
  track: TrackDef;
  nextMelodyTime: number;
  nextBassTime: number;
  nextDrumTime: number;
  melodyIndex: number;
  bassIndex: number;
  drumStep: number;
  activeOscillators: ActiveOscillator[];
  schedulerInterval: number | null;
}

// ============================================================================
// AUDIO MANAGER CLASS
// ============================================================================

class AudioManagerClass {
  // Audio Context and Nodes
  private _ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // BGM State
  private _currentBgmState: BgmState | null = null;
  private _previousTrackId: string | null = null;
  private _inBossFight: boolean = false;
  private _generation: number = 0; // 用于取消过时的 setTimeout 回调

  // SFX ducking timeout tracking (C10 fix)
  private _sfxDuckingTimeout: number | null = null;

  // Mute state
  private _musicEnabled: boolean = true;
  private _sfxEnabled: boolean = true;

  // Scheduling constants
  private readonly SCHEDULE_AHEAD = 0.2; // Schedule 200ms ahead
  private readonly SCHEDULE_INTERVAL = 50; // Schedule every 50ms

  // ============================================================================
  // AUDIO CONTEXT LIFECYCLE
  // ============================================================================

  private get ctx(): AudioContext {
    if (!this._ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) {
          this._ctx = new AC();
          this.setupGainNodes();
        }
      } catch { /* no audio available */ }
    }
    return this._ctx!;
  }

  /**
   * 在用户交互时调用，确保 AudioContext 从 suspended 状态恢复。
   * 浏览器要求在用户手势（click/keydown 等）之后才允许播放音频。
   * 恢复后会检查并启动调度器，确保音乐正常播放。
   */
  public ensureResumed(): void {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().then(() => {
        // 恢复后启动调度器（playTrack 的 resume 回调可能在某些浏览器未触发）
        if (this._currentBgmState && this._musicEnabled && !this._currentBgmState.schedulerInterval) {
          this.startScheduler();
        }
      });
    }
  }

  private setupGainNodes(): void {
    if (!this._ctx) return;

    this.masterGain = this._ctx.createGain();
    this.bgmGain = this._ctx.createGain();
    this.sfxGain = this._ctx.createGain();

    // Set initial volumes
    this.masterGain.gain.value = 0.6;
    this.bgmGain.gain.value = 0.5;
    this.sfxGain.gain.value = 1.0;

    // Connect: sfxGain -> masterGain -> destination
    //              bgmGain -> masterGain -> destination
    this.sfxGain.connect(this.masterGain);
    this.bgmGain.connect(this.masterGain);
    this.masterGain.connect(this._ctx.destination);
  }

  // ============================================================================
  // BGM STEP SEQUENCER
  // ============================================================================

  private createNoteSequence(
    track: TrackDef,
    currentTime: number
  ): BgmState {
    return {
      track,
      nextMelodyTime: currentTime,
      nextBassTime: currentTime,
      nextDrumTime: currentTime,
      melodyIndex: 0,
      bassIndex: 0,
      drumStep: 0,
      activeOscillators: [],
      schedulerInterval: null
    };
  }

  private scheduleNotes(state: BgmState, scheduleUntil: number): void {
    if (!this.bgmGain) return;

    // Schedule all melody notes within the lookahead window
    while (state.nextMelodyTime < scheduleUntil) {
      const idx = state.melodyIndex;
      if (idx >= state.track.melody.length) break;
      this.scheduleMelodyNote(state, state.nextMelodyTime, idx);
    }

    // Schedule all bass notes within the lookahead window
    while (state.nextBassTime < scheduleUntil) {
      const idx = state.bassIndex;
      if (idx >= state.track.bass.length) break;
      this.scheduleBassNote(state, state.nextBassTime, idx);
    }

    // Schedule all drum steps within the lookahead window
    // 仅当曲目有鼓声模式时才调度，否则跳过（无鼓声时 nextDrumTime 不推进会导致无限循环）
    if (state.track.drums) {
      // H17 fix: Add safety counter to prevent infinite loop
      let drumIterations = 0;
      const maxDrumIterations = 64;
      while (state.nextDrumTime < scheduleUntil && drumIterations < maxDrumIterations) {
        this.scheduleDrumHits(state, state.nextDrumTime, state.drumStep);
        drumIterations++;
      }
    }
  }

  private getStepDuration(bpm: number, durSteps: number): number {
    // Duration = (60 seconds / BPM) / 4 sixteenth notes * dur steps
    return (60 / bpm / 4) * durSteps;
  }

  private scheduleMelodyNote(state: BgmState, startTime: number, noteIndex: number): void {
    if (!this.bgmGain || noteIndex >= state.track.melody.length) return;

    const note = state.track.melody[noteIndex];
    const duration = this.getStepDuration(state.track.bpm, note.dur);
    const isRest = note.midi === 0;

    // Create oscillator
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = state.track.wave;

    if (isRest) {
      // Rest: set gain to near zero
      gainNode.gain.setValueAtTime(0.001, startTime);
    } else {
      // Note: set frequency and envelope
      const freq = midiToFreq(note.midi);
      osc.frequency.setValueAtTime(freq, startTime);

      // Envelope: attack at start, hold until 80% of duration, fade out to 95%
      const holdTime = startTime + duration * 0.8;
      const releaseTime = startTime + duration * 0.95;

      gainNode.gain.setValueAtTime(state.track.gain, startTime);
      gainNode.gain.setValueAtTime(state.track.gain, holdTime);
      gainNode.gain.linearRampToValueAtTime(0.001, releaseTime);
    }

    // Connect and start/stop
    osc.connect(gainNode);
    gainNode.connect(this.bgmGain);
    osc.start(startTime);
    osc.stop(startTime + duration);

    // A3 fix: Add secondary oscillator (wave2) for layered timbre
    if (state.track.wave2 && !isRest) {
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = state.track.wave2;
      osc2.frequency.setValueAtTime(midiToFreq(note.midi), startTime);
      const layerGain = state.track.gain * 0.3; // Secondary layer at 30% volume
      gain2.gain.setValueAtTime(layerGain, startTime);
      gain2.gain.setValueAtTime(layerGain, startTime + duration * 0.8);
      gain2.gain.linearRampToValueAtTime(0.001, startTime + duration * 0.95);
      osc2.connect(gain2);
      gain2.connect(this.bgmGain);
      osc2.start(startTime);
      osc2.stop(startTime + duration);
      state.activeOscillators.push({
        oscillator: osc2,
        gainNode: gain2,
        stopTime: startTime + duration
      });
    }

    // Track the oscillator for cleanup
    state.activeOscillators.push({
      oscillator: osc,
      gainNode,
      stopTime: startTime + duration
    });

    // Update state
    state.nextMelodyTime = startTime + duration;
    state.melodyIndex = (noteIndex + 1) % state.track.melody.length;
  }

  private scheduleBassNote(state: BgmState, startTime: number, noteIndex: number): void {
    if (!this.bgmGain || noteIndex >= state.track.bass.length) return;

    const note = state.track.bass[noteIndex];
    const duration = this.getStepDuration(state.track.bpm, note.dur);
    const isRest = note.midi === 0;

    // Create oscillator (always triangle for warmth)
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';

    if (isRest) {
      gainNode.gain.setValueAtTime(0.001, startTime);
    } else {
      const freq = midiToFreq(note.midi);
      osc.frequency.setValueAtTime(freq, startTime);

      // Envelope: attack at start, hold until 80% of duration, fade out to 95%
      const holdTime = startTime + duration * 0.8;
      const releaseTime = startTime + duration * 0.95;

      gainNode.gain.setValueAtTime(state.track.gain, startTime);
      gainNode.gain.setValueAtTime(state.track.gain, holdTime);
      gainNode.gain.linearRampToValueAtTime(0.001, releaseTime);
    }

    osc.connect(gainNode);
    gainNode.connect(this.bgmGain);
    osc.start(startTime);
    osc.stop(startTime + duration);

    state.activeOscillators.push({
      oscillator: osc,
      gainNode,
      stopTime: startTime + duration
    });

    state.nextBassTime = startTime + duration;
    state.bassIndex = (noteIndex + 1) % state.track.bass.length;
  }

  private scheduleDrumHits(state: BgmState, startTime: number, step: number): void {
    if (!this.bgmGain || !state.track.drums) return;

    const drums = state.track.drums;
    const kickPattern = drums.kick || [];
    const snarePattern = drums.snare || [];
    const hihatPattern = drums.hihat || [];

    // Determine which drums hit on this step
    const hasKick = kickPattern.includes(step);
    const hasSnare = snarePattern.includes(step);
    const hasHihat = hihatPattern.includes(step);

    if (!hasKick && !hasSnare && !hasHihat) {
      // No drums on this step, move to next
      const stepDuration = this.getStepDuration(state.track.bpm, 1); // 1 sixteenth note
      state.nextDrumTime = startTime + stepDuration;
      state.drumStep = (step + 1) % 16;
      return;
    }

    // Schedule each drum that hits on this step
    if (hasKick) {
      this.scheduleOneShot('sine', 80, 0.08, 0.2, startTime, this.bgmGain);
    }

    if (hasSnare) {
      this.scheduleOneShot('sawtooth', 200, 0.08, 0.15, startTime, this.bgmGain);
    }

    if (hasHihat) {
      this.scheduleOneShot('square', 800, 0.04, 0.08, startTime, this.bgmGain);
    }

    // Advance to next step
    const stepDuration = this.getStepDuration(state.track.bpm, 1);
    state.nextDrumTime = startTime + stepDuration;
    state.drumStep = (step + 1) % 16;
  }

  private scheduleOneShot(
    wave: OscillatorType,
    freq: number,
    duration: number,
    gain: number,
    startTime: number,
    outputNode: GainNode | null
  ): void {
    if (!outputNode) return;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startTime);

    // Quick envelope
    noteGain.gain.setValueAtTime(gain, startTime);
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(noteGain);
    noteGain.connect(outputNode);
    osc.start(startTime);
    osc.stop(startTime + duration);

    // Note: Don't track one-shot drums for cleanup, they're short-lived
  }

  private schedulerLoop = (): void => {
    if (!this._currentBgmState) return;

    const currentTime = this.ctx.currentTime;
    const scheduleUntil = currentTime + this.SCHEDULE_AHEAD;

    this.scheduleNotes(this._currentBgmState, scheduleUntil);
    this.cleanupFinishedOscillators(this._currentBgmState);
  };

  private startScheduler(): void {
    if (this._currentBgmState?.schedulerInterval) return;

    // 如果 nextMelodyTime 等时间点远早于当前时间（如 context 从 suspended 恢复），
    // 重新对齐到 currentTime，避免一次性调度大量音符
    const state = this._currentBgmState!;
    const currentTime = this.ctx.currentTime;
    if (state.nextMelodyTime < currentTime) state.nextMelodyTime = currentTime;
    if (state.nextBassTime < currentTime) state.nextBassTime = currentTime;
    if (state.nextDrumTime < currentTime) state.nextDrumTime = currentTime;

    state.schedulerInterval = window.setInterval(
      () => this.schedulerLoop(),
      this.SCHEDULE_INTERVAL
    );

    // Initial scheduling
    this.schedulerLoop();
  }

  private stopScheduler(): void {
    if (this._currentBgmState?.schedulerInterval) {
      clearInterval(this._currentBgmState.schedulerInterval);
      this._currentBgmState.schedulerInterval = null;
    }
  }

  private cleanupFinishedOscillators(state: BgmState): void {
    const currentTime = this.ctx.currentTime;

    // Remove oscillators that have already stopped
    state.activeOscillators = state.activeOscillators.filter(osc => {
      if (osc.stopTime <= currentTime + 0.1) {
        // This oscillator is finished, clean it up
        try {
          osc.oscillator.stop();
        } catch {
          // Already stopped, ignore
        }
        osc.gainNode.disconnect();
        osc.oscillator.disconnect();
        return false;
      }
      return true;
    });
  }

  // ============================================================================
  // BGM PLAYBACK CONTROL
  // ============================================================================

  private playTrack(track: TrackDef): void {
    // Stop any existing scheduler + oscillators to prevent duplicates
    this.stopScheduler();
    if (this._currentBgmState) {
      this.stopOscillators(true);
    }

    // 递增 generation，使过时的 setTimeout 回调失效
    this._generation++;

    // 如果 AudioContext 处于 suspended 状态，先尝试恢复
    // 恢复是异步的，若未成功则只创建状态不启动调度器，等 ensureResumed() 后再启动
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().then(() => {
        // 恢复成功后，如果当前还是期望的音轨，启动调度器
        if (this._currentBgmState && this._musicEnabled && !this._currentBgmState.schedulerInterval) {
          this.startScheduler();
        }
      });
    }

    const currentTime = this.ctx.currentTime;
    this._currentBgmState = this.createNoteSequence(track, currentTime);

    // 只有 AudioContext 处于 running 状态时才启动调度器
    if (!this._ctx || this._ctx.state === 'running') {
      this.startScheduler();
    }

    // Reset BGM volume — cancel any lingering scheduled ramps first
    if (this.bgmGain && this._musicEnabled) {
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.value = 0.5;
    }
  }

  public playBGM(trackId: string): void {
    if (!this._musicEnabled) return;

    const track = MUSIC_TRACKS.find(t => t.id === trackId);
    if (!track) {
      console.warn(`Unknown track ID: ${trackId}`);
      return;
    }

    // If we're already playing this track, do nothing
    if (this._currentBgmState?.track.id === trackId) return;

    // 递增 generation，使过时的 setTimeout 回调失效
    this._generation++;

    if (this._currentBgmState) {
      // Crossfade: 先淡出旧音轨，300ms 后启动新音轨
      this.stopBGM(false);

      const crossfadeGen = this._generation;
      setTimeout(() => {
        if (this._generation === crossfadeGen && this._musicEnabled) {
          this.playTrack(track);
        }
      }, 350); // H18 fix: 350ms to ensure stopBGM 0.3s ramp completes
    } else {
      // 没有正在播放的音轨，立即开始，无需等待
      this.playTrack(track);
    }
  }

  private stopOscillators(_immediate: boolean): void {
    if (!this._currentBgmState) return;

    this._currentBgmState.activeOscillators.forEach(osc => {
      try {
        osc.oscillator.stop();
        osc.gainNode.disconnect();
        osc.oscillator.disconnect();
      } catch {
        // Already stopped
      }
    });

    this._currentBgmState.activeOscillators = [];
  }

  public stopBGM(immediate: boolean = false): void {
    const state = this._currentBgmState;
    if (!state) return;

    this.stopScheduler();

    if (immediate || !this.bgmGain) {
      this.stopOscillators(true);
    } else {
      // Fade out over 0.3 seconds
      const currentTime = this.ctx.currentTime;
      this.bgmGain.gain.linearRampToValueAtTime(0.001, currentTime + 0.3);

      // 递增 generation，使过时的 crossfade setTimeout 不会启动新调度器
      this._generation++;
      const stopGen = this._generation;

      // Stop oscillators after fade-out
      // H18 fix: Increase setTimeout to 350ms to ensure ramp completes
      setTimeout(() => {
        // 只有 generation 未变时才清理（说明期间没有新的 playBGM/playTrack 调用）
        if (this._generation === stopGen) {
          this.stopOscillators(false);
        }
        // Reset gain for next time
        if (this.bgmGain) {
          this.bgmGain.gain.value = 0.5;
        }
      }, 350);
    }

    this._currentBgmState = null;
  }

  // ============================================================================
  // CROSSFADE
  // ============================================================================

  public crossfade(trackId: string): void {
    this.playBGM(trackId);
  }

  // ============================================================================
  // BOSS FIGHT OVERLAY
  // ============================================================================

  public enterBossFight(): void {
    if (this._inBossFight) return;

    // Save current track if playing
    if (this._currentBgmState) {
      this._previousTrackId = this._currentBgmState.track.id;
    }

    this._inBossFight = true;
    this.playSFX('bossAppear');
    this.playBGM('boss');
  }

  public exitBossFight(): void {
    if (!this._inBossFight) return;

    this._inBossFight = false;

    if (this._previousTrackId) {
      this.playBGM(this._previousTrackId);
    } else {
      this.stopBGM(true);
    }

    this._previousTrackId = null;
  }

  // ============================================================================
  // SFX PLAYBACK
  // ============================================================================

  public playSFX(id: SfxId): void {
    if (!this._sfxEnabled) return;

    const sfx = SFX_DEFS.find(s => s.id === id);
    if (!sfx) return;

    // Duck BGM (C10 fix: cancel previous restore before scheduling new one)
    if (this.bgmGain) {
      const currentTime = this.ctx.currentTime;

      // Clear any pending restore timeout
      if (this._sfxDuckingTimeout !== null) {
        clearTimeout(this._sfxDuckingTimeout);
        this._sfxDuckingTimeout = null;
      }

      // Lower BGM to 0.15 over 50ms
      this.bgmGain.gain.linearRampToValueAtTime(0.15, currentTime + 0.05);

      // Restore to 0.5 after 200ms delay, over 300ms
      const sfxGen = this._generation;
      this._sfxDuckingTimeout = window.setTimeout(() => {
        if (this.bgmGain && this._generation === sfxGen) {
          const restoreTime = this.ctx.currentTime;
          this.bgmGain.gain.linearRampToValueAtTime(0.5, restoreTime + 0.3);
        }
        this._sfxDuckingTimeout = null;
      }, 200);
    }

    // Play SFX stages sequentially
    let time = this.ctx.currentTime;

    for (const stage of sfx.stages) {
      this.playSfxStage(stage, time);
      time += stage.duration;
    }
  }

  private playSfxStage(stage: SfxStage, startTime: number): void {
    if (!this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = stage.wave;
    osc.frequency.setValueAtTime(stage.freq, startTime);

    // Frequency sweep if specified
    if (stage.freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(stage.freqEnd, startTime + stage.duration);
    }

    // Gain envelope
    gainNode.gain.setValueAtTime(stage.gain, startTime);

    const finalGain = stage.gainEnd !== undefined ? stage.gainEnd : 0;
    if (finalGain !== stage.gain) {
      gainNode.gain.linearRampToValueAtTime(finalGain, startTime + stage.duration);
    }

    osc.connect(gainNode);
    gainNode.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + stage.duration);

    // Disconnect nodes after sound finishes to prevent audio graph memory leak
    osc.onended = () => {
      try { gainNode.disconnect(); } catch { /* already disconnected */ }
      try { osc.disconnect(); } catch { /* already disconnected */ }
    };
  }

  // ============================================================================
  // MUTE TOGGLES
  // ============================================================================

  public toggleMusic(): void {
    this._musicEnabled = !this._musicEnabled;

    if (this._musicEnabled) {
      // Resume if we have a track state
      if (this._currentBgmState) {
        this.playTrack(this._currentBgmState.track);
      }
    } else {
      this.stopBGM(true);
    }
  }

  public toggleSfx(): void {
    this._sfxEnabled = !this._sfxEnabled;
  }

  public setMusicEnabled(enabled: boolean): void {
    if (enabled !== this._musicEnabled) {
      this.toggleMusic();
    }
  }

  public setSfxEnabled(enabled: boolean): void {
    this._sfxEnabled = enabled;
  }

  public get musicEnabled(): boolean {
    return this._musicEnabled;
  }

  public get sfxEnabled(): boolean {
    return this._sfxEnabled;
  }

  // ============================================================================
  // CONTEXT-AWARE BGM
  // ============================================================================

  public updateContext(
    phase: string,
    floor: number,
    hasBoss: boolean,
    biome: string
  ): void {
    // Phase-based tracks take priority
    if (phase === 'gameOver') {
      if (this._currentBgmState?.track.id !== 'gameOver') {
        this.playBGM('gameOver');
      }
      return;
    }

    if (phase === 'shop') {
      if (this._currentBgmState?.track.id !== 'shop') {
        this.playBGM('shop');
      }
      return;
    }

    if (phase === 'title' || phase === 'characterCreation') {
      if (this._currentBgmState?.track.id !== 'title') {
        this.playBGM('title');
      }
      return;
    }

    // Boss fight handling
    if (hasBoss) {
      if (!this._inBossFight) {
        this.enterBossFight();
      } else if (this._currentBgmState?.track.id !== 'boss') {
        // A2 fix: Re-enter boss music if we returned from shop during boss fight
        this.playBGM('boss');
      }
      return;
    }

    // If we were in a boss fight and now we're not, exit
    if (this._inBossFight && !hasBoss) {
      this.exitBossFight();
    }

    // Biome-based tracks
    const biomeToTrack: Record<string, string> = {
      stoneDungeon: 'stoneDungeon',
      crystalCavern: 'crystalCavern',
      ancientCrypt: 'ancientCrypt',
      lavaCore: 'lavaCore',
      voidAbyss: 'voidAbyss'
    };

    const trackId = biomeToTrack[biome];
    if (trackId && this._currentBgmState?.track.id !== trackId) {
      try {
        this.playBGM(trackId);
      } catch (e) {
        console.warn('AudioManager: Failed to play BGM track', trackId, e);
      }
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  public shutdown(): void {
    this.stopBGM(true);
    this._inBossFight = false;
    this._previousTrackId = null;
    this._currentBgmState = null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const AudioManager = new AudioManagerClass();
