/**
 * Monotonic generation counter. Every speak captures the current generation;
 * a newer speak or a cancel calls next(), so stale in-flight TTS never plays
 * (voice-foundation design §5). Pure and framework-free.
 */
export function createGenerationGuard() {
  let gen = 0;
  return {
    current: () => gen,
    next: () => ++gen,
    isCurrent: (g: number) => g === gen,
  };
}
