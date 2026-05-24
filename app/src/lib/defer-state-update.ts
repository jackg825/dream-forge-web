export function deferStateUpdate(update: () => void): () => void {
  let cancelled = false;

  queueMicrotask(() => {
    if (!cancelled) {
      update();
    }
  });

  return () => {
    cancelled = true;
  };
}
