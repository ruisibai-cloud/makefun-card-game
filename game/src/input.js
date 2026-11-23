// Keyboard and pointer input. One-shot presses are queued and taken once by the loop, so a
// press between two frames is never lost and never counted twice. Clicks arrive as client
// points; the caller converts them to table coordinates with the renderer's toTable().
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_END = 4;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const END = new Set(['KeyE']);
const PLAY_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 };

export function createInput(target) {
  let flags = 0;
  const plays = [];
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) flags |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) flags |= ACTION_PAUSE;
    else if (END.has(event.code)) flags |= ACTION_END;
    else if (event.code in PLAY_KEYS) plays.push(PLAY_KEYS[event.code]);
    else return;
    event.preventDefault();
  });
  target.addEventListener('pointerdown', (event) => {
    clicks.push({ x: event.clientX, y: event.clientY });
  });

  return {
    /** Everything queued since the last call: flags, card indexes to play, click points. */
    takeActions() {
      const taken = { flags, plays: plays.splice(0), clicks: clicks.splice(0) };
      flags = 0;
      return taken;
    },
  };
}
