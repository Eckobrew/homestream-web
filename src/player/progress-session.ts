export interface Progress { itemId: string; positionTicks: number; isPaused: boolean; isStopped: boolean; }
/** Bind a progress sender to one item so episode switches cannot reuse its identity. */
export function progressSession(itemId: string, position: () => number, paused: () => boolean, send: (value: Progress) => void) {
  let stopped = false;
  return {
    report(isStopped = false, ticks?: number) {
      if (stopped) return;
      const value = ticks ?? Math.round(position() * 10000000);
      if (!Number.isSafeInteger(value) || value < 0) return;
      send({ itemId, positionTicks: value, isPaused: paused(), isStopped });
      if (isStopped) stopped = true;
    },
  };
}
