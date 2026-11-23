// Tiny synthesized sound: no audio files, everything is an oscillator through a gain envelope,
// so the game stays offline and self-contained. The context starts on the first user gesture;
// every call is guarded, so a browser without audio just plays silently.
export function createAudio() {
  let context = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(frequency, seconds, type, volume, when = 0) {
    const audio = ensure();
    if (!audio) return;
    try {
      if (audio.state === 'suspended') void audio.resume();
      const start = audio.currentTime + when;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + seconds + 0.02);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    /** Call on the first pointer or key gesture so later sounds are allowed. */
    unlock() {
      ensure();
    },
    playCard() {
      tone(520, 0.09, 'triangle', 0.12);
      tone(780, 0.12, 'triangle', 0.08, 0.05);
    },
    hit() {
      tone(160, 0.16, 'sawtooth', 0.14);
      tone(90, 0.2, 'sine', 0.16, 0.02);
    },
    block() {
      tone(320, 0.1, 'square', 0.06);
    },
    heal() {
      tone(440, 0.12, 'sine', 0.1);
      tone(660, 0.16, 'sine', 0.1, 0.08);
    },
    draw() {
      tone(880, 0.06, 'triangle', 0.06);
    },
    win() {
      [523, 659, 784, 1047].forEach((note, i) => tone(note, 0.22, 'triangle', 0.12, i * 0.12));
    },
    lose() {
      [392, 330, 262, 196].forEach((note, i) => tone(note, 0.24, 'triangle', 0.1, i * 0.14));
    },
  };
}
