export type BoundedBatchResult<T> =
  | { index: number; status: "fulfilled"; value: T }
  | { index: number; status: "rejected"; reason: unknown };

export async function runBoundedBatch<Input, Output>(
  items: readonly Input[],
  worker: (item: Input, index: number) => Promise<Output>,
  concurrency: number,
  onSettled?: (result: BoundedBatchResult<Output>) => void
): Promise<BoundedBatchResult<Output>[]> {
  if (items.length === 0) return [];

  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(concurrency) || 1)
  );
  const results = new Array<BoundedBatchResult<Output>>(items.length);
  let nextIndex = 0;

  async function consume(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;

      try {
        const value = await worker(items[index], index);
        const result: BoundedBatchResult<Output> = {
          index,
          status: "fulfilled",
          value,
        };
        results[index] = result;
        notifySettled(result);
      } catch (reason) {
        const result: BoundedBatchResult<Output> = {
          index,
          status: "rejected",
          reason,
        };
        results[index] = result;
        notifySettled(result);
      }
    }
  }

  function notifySettled(result: BoundedBatchResult<Output>): void {
    try {
      onSettled?.(result);
    } catch {
      // Observers must not turn a completed item into a duplicate retry.
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => consume()));
  return results;
}
