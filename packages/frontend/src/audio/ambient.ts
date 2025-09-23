const handles = new Map<
  string,
  {
    oscillators: OscillatorNode[];
    gain: GainNode;
    context: AudioContext;
    cleanup: () => void;
  }
>();

let sharedContext: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedContext) return sharedContext;
  try {
    sharedContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch (error) {
    console.warn('[ambient] failed to create AudioContext', error);
    sharedContext = null;
  }
  return sharedContext;
}

export type AmbientConfig = {
  frequencies: number[];
  type?: OscillatorType;
  volume?: number;
  filterFrequency?: number;
  vibratoFrequency?: number;
  vibratoDepth?: number;
};

export async function playAmbient(id: string, config: AmbientConfig) {
  const ctx = ensureContext();
  if (!ctx) return;

  try {
    await ctx.resume?.();
  } catch (error) {
    console.warn('[ambient] resume rejected', error);
  }

  stopAmbient(id);

  const gain = ctx.createGain();
  gain.gain.value = config.volume ?? 0.05;
  gain.connect(ctx.destination);

  let filter: BiquadFilterNode | undefined;
  if (config.filterFrequency) {
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = config.filterFrequency;
    filter.connect(gain);
  }

  const vibratoDepth = config.vibratoDepth ?? 4;
  const vibratoFreq = config.vibratoFrequency ?? 0.5;
  let vibrato: OscillatorNode | null = null;
  let vibratoGain: GainNode | null = null;
  if (vibratoDepth > 0) {
    vibrato = ctx.createOscillator();
    vibrato.frequency.value = vibratoFreq;
    vibratoGain = ctx.createGain();
    vibratoGain.gain.value = vibratoDepth;
    vibrato.start();
  }

  const oscillators: OscillatorNode[] = [];
  for (const freq of config.frequencies) {
    const osc = ctx.createOscillator();
    osc.type = config.type ?? 'triangle';
    osc.frequency.value = freq;
    const destination = filter ?? gain;
    if (vibrato && vibratoGain) {
      const modulation = ctx.createGain();
      modulation.gain.value = vibratoDepth;
      vibratoGain.connect(modulation);
      modulation.connect(osc.frequency);
    }
    if (vibrato && vibratoGain) {
      vibrato.connect(vibratoGain);
    }
    osc.connect(destination);
    osc.start();
    oscillators.push(osc);
  }

  handles.set(id, {
    oscillators,
    gain,
    context: ctx,
    cleanup: () => {
      if (vibrato) {
        try {
          vibrato.stop();
        } catch (error) {
          void error;
        }
        vibrato.disconnect();
      }
      vibratoGain?.disconnect();
    },
  });
}

export function stopAmbient(id: string) {
  const handle = handles.get(id);
  if (!handle) return;
  handle.oscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch (error) {
      void error;
    }
    osc.disconnect();
  });
  try {
    handle.gain.disconnect();
  } catch (error) {
    void error;
  }
  handle.cleanup();
  handles.delete(id);
}

export function stopAllAmbient() {
  Array.from(handles.keys()).forEach((id) => stopAmbient(id));
}
