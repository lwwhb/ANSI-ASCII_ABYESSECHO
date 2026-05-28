// ============================================================
// Browser API mocks for running the game store in Node.js
// ============================================================

// __DEV__ global — defined by Vite in browser, must be set for Node.js
(globalThis as any).__DEV__ = false;

// localStorage mock
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  get length() { return storage.size; },
  key: (_index: number) => null,
};

// AudioContext mock - no-op all Web Audio API
class MockAudioNode {
  connect() { return this; }
  disconnect() {}
  addEventListener() {}
  removeEventListener() {}
}

class MockOscillator extends MockAudioNode {
  type: OscillatorType = 'sine';
  frequency = { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, value: 440 };
  start() {}
  stop() {}
  onended: (() => void) | null = null;
}

class MockGain extends MockAudioNode {
  gain = {
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    cancelScheduledValues: () => {},
    value: 1,
  };
}

class MockAudioContext {
  createOscillator() { return new MockOscillator(); }
  createGain() { return new MockGain(); }
  get destination() { return new MockAudioNode(); }
  get currentTime() { return 0; }
  get state() { return 'running' as AudioContextState; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  createBuffer(_numChannels: number, _length: number, _sampleRate: number) {
    return { getChannelData: () => new Float32Array(0), duration: 0, sampleRate: 44100, numberOfChannels: 1, length: 0 };
  }
  createBufferSource() {
    return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, onended: null, loop: false };
  }
}

// requestAnimationFrame mock
const requestAnimationFrameMock = (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number;
const cancelAnimationFrameMock = (id: number) => clearTimeout(id);

// Apply mocks to globalThis
export function setupBrowserMocks() {
  // @ts-expect-error Node.js environment
  globalThis.localStorage = localStorageMock;

  // @ts-expect-error Node.js environment
  globalThis.AudioContext = MockAudioContext;

  // @ts-expect-error Node.js environment
  globalThis.webkitAudioContext = MockAudioContext;

  // @ts-expect-error Node.js environment
  globalThis.requestAnimationFrame = requestAnimationFrameMock;

  // @ts-expect-error Node.js environment
  globalThis.cancelAnimationFrame = cancelAnimationFrameMock;

  // @ts-expect-error Node.js environment
  globalThis.window = globalThis;

  // @ts-expect-error Node.js environment
  globalThis.document = {
    createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {}, contains: () => false }, addEventListener: () => {}, removeEventListener: () => {}, appendChild: () => {}, removeChild: () => {}, setAttribute: () => {}, getContext: () => null }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {}, removeChild: () => {} },
    documentElement: { style: {} },
  };

  // navigator is read-only in Node.js v24+, skip if can't set
  try {
    // @ts-expect-error Node.js environment
    globalThis.navigator = {
      userAgent: 'Node.js',
      mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [] }) },
    };
  } catch { /* navigator is read-only in some Node.js versions */ }

  // @ts-expect-error Node.js environment
  globalThis.HTMLCanvasElement = class {
    width = 0;
    height = 0;
    getContext() { return null; }
    toDataURL() { return ''; }
  };

  // @ts-expect-error Node.js environment
  globalThis.HTMLAudioElement = class {
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
  };
}
