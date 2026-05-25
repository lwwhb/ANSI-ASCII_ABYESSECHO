export type SfxId = 'attack' | 'hit' | 'critical' | 'levelup' | 'pickup' | 'door' | 'death' | 'skill' | 'coin' | 'trap' | 'heal' | 'bossAppear' | 'heartbeat' | 'stomachGrowl' | 'chainReaction' | 'relicAcquire' | 'enhanceSuccess' | 'enhanceFail' | 'bossPhase' | 'portalWarp' | 'bump' | 'ironDoor' | 'magicSpring' | 'voidRift';

export interface SfxStage {
  freq: number;        // Start frequency in Hz
  freqEnd?: number;    // End frequency for pitch sweep (optional)
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
  // 1. attack: Quick downward sweep (300→150Hz square) + low thump (100Hz square)
  {
    id: 'attack',
    stages: [
      { freq: 300, freqEnd: 150, wave: 'square', duration: 0.08, gain: 0.3 },
      { freq: 100, wave: 'square', duration: 0.05, gain: 0.15 },
    ],
  },

  // 2. hit: Low sawtooth thud (120→60Hz, short)
  {
    id: 'hit',
    stages: [
      { freq: 120, freqEnd: 60, wave: 'sawtooth', duration: 0.1, gain: 0.25 },
    ],
  },

  // 3. critical: Rising arpeggio burst (400→800Hz, then 800→400Hz, then 600Hz settle) - 3 stages
  {
    id: 'critical',
    stages: [
      { freq: 400, freqEnd: 800, wave: 'square', duration: 0.05, gain: 0.35 },
      { freq: 800, freqEnd: 400, wave: 'square', duration: 0.05, gain: 0.3 },
      { freq: 600, wave: 'square', duration: 0.08, gain: 0.2, gainEnd: 0 },
    ],
  },

  // 4. levelup: Ascending major chord arpeggio (C5-E5-G5) square wave - 3 stages
  {
    id: 'levelup',
    stages: [
      { freq: 523.25, wave: 'square', duration: 0.1, gain: 0.25 },  // C5
      { freq: 659.25, wave: 'square', duration: 0.1, gain: 0.25 },  // E5
      { freq: 784.00, wave: 'square', duration: 0.15, gain: 0.25, gainEnd: 0 },  // G5
    ],
  },

  // 5. pickup: Bright two-note chime (660Hz then 880Hz sine)
  {
    id: 'pickup',
    stages: [
      { freq: 660, wave: 'sine', duration: 0.08, gain: 0.3 },
      { freq: 880, wave: 'sine', duration: 0.1, gain: 0.3, gainEnd: 0 },
    ],
  },

  // 6. door: Wooden knock - filtered (200→80Hz triangle, then 80→60Hz triangle)
  {
    id: 'door',
    stages: [
      { freq: 200, freqEnd: 80, wave: 'triangle', duration: 0.06, gain: 0.2 },
      { freq: 80, freqEnd: 60, wave: 'triangle', duration: 0.08, gain: 0.15, gainEnd: 0 },
    ],
  },

  // 7. death: Long descending tone (300→80Hz sawtooth, then 80→40Hz)
  {
    id: 'death',
    stages: [
      { freq: 300, freqEnd: 80, wave: 'sawtooth', duration: 0.3, gain: 0.3 },
      { freq: 80, freqEnd: 40, wave: 'sawtooth', duration: 0.4, gain: 0.2, gainEnd: 0 },
    ],
  },

  // 8. skill: Whoosh (200→600Hz square, then 600→400Hz)
  {
    id: 'skill',
    stages: [
      { freq: 200, freqEnd: 600, wave: 'square', duration: 0.1, gain: 0.25 },
      { freq: 600, freqEnd: 400, wave: 'square', duration: 0.08, gain: 0.2, gainEnd: 0 },
    ],
  },

  // 9. coin: High double-tap (880Hz then 1100Hz sine)
  {
    id: 'coin',
    stages: [
      { freq: 880, wave: 'sine', duration: 0.04, gain: 0.25 },
      { freq: 1100, wave: 'sine', duration: 0.06, gain: 0.25, gainEnd: 0 },
    ],
  },

  // 10. trap: Dissonant stab (200→600Hz sawtooth, then 600→100Hz)
  {
    id: 'trap',
    stages: [
      { freq: 200, freqEnd: 600, wave: 'sawtooth', duration: 0.07, gain: 0.3 },
      { freq: 600, freqEnd: 100, wave: 'sawtooth', duration: 0.1, gain: 0.25, gainEnd: 0 },
    ],
  },

  // 11. heal: Ascending shimmer (440→554→659Hz sine) - 3 stages
  {
    id: 'heal',
    stages: [
      { freq: 440, freqEnd: 554, wave: 'sine', duration: 0.08, gain: 0.25 },
      { freq: 554, freqEnd: 659, wave: 'sine', duration: 0.08, gain: 0.25 },
      { freq: 659, wave: 'sine', duration: 0.12, gain: 0.2, gainEnd: 0 },
    ],
  },

  // 12. bossAppear: Dramatic low rumble + rising tone (80→40Hz sawtooth, then 200→600Hz square)
  {
    id: 'bossAppear',
    stages: [
      { freq: 80, freqEnd: 40, wave: 'sawtooth', duration: 0.4, gain: 0.35 },
      { freq: 200, freqEnd: 600, wave: 'square', duration: 0.3, gain: 0.3, gainEnd: 0 },
    ],
  },

  // 13. heartbeat: Low double-thump mimicking heartbeat (55Hz sine + 45Hz sine, soft)
  {
    id: 'heartbeat',
    stages: [
      { freq: 55, wave: 'sine', duration: 0.12, gain: 0.35, gainEnd: 0 },
      { freq: 45, wave: 'sine', duration: 0.18, gain: 0.25, gainEnd: 0 },
    ],
  },

  // 14. stomachGrowl: Low descending gurgle (120→40Hz triangle, then 80→30Hz triangle)
  {
    id: 'stomachGrowl',
    stages: [
      { freq: 120, freqEnd: 40, wave: 'triangle', duration: 0.15, gain: 0.2, gainEnd: 0 },
      { freq: 80, freqEnd: 30, wave: 'triangle', duration: 0.2, gain: 0.15, gainEnd: 0 },
    ],
  },

  // 15. chainReaction: Explosive burst — rising crackle (200→800Hz sawtooth) + deep boom (100→40Hz)
  {
    id: 'chainReaction',
    stages: [
      { freq: 200, freqEnd: 800, wave: 'sawtooth', duration: 0.06, gain: 0.35 },
      { freq: 800, freqEnd: 400, wave: 'square', duration: 0.05, gain: 0.3 },
      { freq: 100, freqEnd: 40, wave: 'sawtooth', duration: 0.15, gain: 0.2, gainEnd: 0 },
    ],
  },

  // 16. relicAcquire: Mystical shimmer — ascending sparkle (C5→E5→G5→C6 sine arpeggio)
  {
    id: 'relicAcquire',
    stages: [
      { freq: 523.25, wave: 'sine', duration: 0.08, gain: 0.3 },
      { freq: 659.25, wave: 'sine', duration: 0.08, gain: 0.3 },
      { freq: 784.00, wave: 'sine', duration: 0.08, gain: 0.3 },
      { freq: 1046.50, wave: 'sine', duration: 0.15, gain: 0.25, gainEnd: 0 },
    ],
  },

  // 17. enhanceSuccess: Metallic ping — high ring (1200→800Hz square, short)
  {
    id: 'enhanceSuccess',
    stages: [
      { freq: 1200, freqEnd: 800, wave: 'square', duration: 0.08, gain: 0.25 },
      { freq: 800, wave: 'triangle', duration: 0.12, gain: 0.2, gainEnd: 0 },
    ],
  },

  // 18. enhanceFail: Dull crunch — descending break (400→80Hz sawtooth + short noise)
  {
    id: 'enhanceFail',
    stages: [
      { freq: 400, freqEnd: 80, wave: 'sawtooth', duration: 0.1, gain: 0.3 },
      { freq: 60, wave: 'square', duration: 0.08, gain: 0.15, gainEnd: 0 },
    ],
  },

  // 19. bossPhase: Menacing shift — low rumble + staccato hit (60→30Hz sawtooth, then 400Hz square)
  {
    id: 'bossPhase',
    stages: [
      { freq: 60, freqEnd: 30, wave: 'sawtooth', duration: 0.2, gain: 0.35 },
      { freq: 400, wave: 'square', duration: 0.08, gain: 0.3, gainEnd: 0 },
    ],
  },

  // 20. portalWarp: Electronic warble — rapid up-down sweep (300→600→300Hz triangle)
  {
    id: 'portalWarp',
    stages: [
      { freq: 300, freqEnd: 600, wave: 'triangle', duration: 0.08, gain: 0.25 },
      { freq: 600, freqEnd: 300, wave: 'triangle', duration: 0.08, gain: 0.25 },
      { freq: 400, freqEnd: 200, wave: 'sine', duration: 0.1, gain: 0.2, gainEnd: 0 },
    ],
  },

  // 21. bump: Dull thud — short low knock (100→60Hz triangle)
  {
    id: 'bump',
    stages: [
      { freq: 100, freqEnd: 60, wave: 'triangle', duration: 0.06, gain: 0.15, gainEnd: 0 },
    ],
  },

  // 22. ironDoor: Heavy metallic scrape — low grind (150→80Hz sawtooth + 60Hz square thud)
  {
    id: 'ironDoor',
    stages: [
      { freq: 150, freqEnd: 80, wave: 'sawtooth', duration: 0.12, gain: 0.25 },
      { freq: 60, wave: 'square', duration: 0.08, gain: 0.2, gainEnd: 0 },
    ],
  },

  // magicSpring: Ethereal ascending chime (sine 400→600→800Hz, soft)
  {
    id: 'magicSpring',
    stages: [
      { freq: 400, freqEnd: 600, wave: 'sine', duration: 0.15, gain: 0.25 },
      { freq: 600, freqEnd: 800, wave: 'sine', duration: 0.15, gain: 0.2 },
      { freq: 800, wave: 'sine', duration: 0.3, gain: 0.1, gainEnd: 0 },
    ],
  },

  // voidRift: Ominous low hum with dissonant overtone (sawtooth 60Hz + sine 90Hz)
  {
    id: 'voidRift',
    stages: [
      { freq: 60, wave: 'sawtooth', duration: 0.3, gain: 0.2 },
      { freq: 90, wave: 'sine', duration: 0.5, gain: 0.15, gainEnd: 0 },
    ],
  },
];
