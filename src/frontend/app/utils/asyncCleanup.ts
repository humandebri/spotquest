/**
 * Utility for safe async operation cleanup
 */

export class CancellablePromise<T> {
  private promise: Promise<T>;
  private _cancelled = false;
  private abortController?: AbortController;

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (reason?: any) => void,
      signal?: AbortSignal
    ) => void
  ) {
    this.abortController = new AbortController();
    
    this.promise = new Promise<T>((resolve, reject) => {
      executor(
        (value) => {
          if (!this._cancelled) {
            resolve(value);
          }
        },
        (reason) => {
          if (!this._cancelled) {
            reject(reason);
          }
        },
        this.abortController?.signal
      );
    });
  }

  get cancelled(): boolean {
    return this._cancelled;
  }

  cancel(): void {
    this._cancelled = true;
    this.abortController?.abort();
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(
      (value) => {
        if (this._cancelled) {
          return Promise.reject(new Error('Operation cancelled'));
        }
        return onfulfilled ? onfulfilled(value) : value as any;
      },
      onrejected
    );
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<T | TResult> {
    return this.promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this.promise.finally(onfinally);
  }
}

export function makeCancellable<T>(
  promise: Promise<T>
): { promise: Promise<T>; cancel: () => void } {
  let cancelled = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then((value) => {
        if (!cancelled) {
          resolve(value);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          reject(error);
        }
      });
  });

  return {
    promise: wrappedPromise,
    cancel: () => {
      cancelled = true;
    },
  };
}

export class AsyncCleanupManager {
  private cleanupTasks: Array<() => void | Promise<void>> = [];
  private cancelled = false;

  add(cleanup: () => void | Promise<void>): void {
    if (!this.cancelled) {
      this.cleanupTasks.push(cleanup);
    }
  }

  async cleanup(): Promise<void> {
    this.cancelled = true;
    
    // Run all cleanup tasks in parallel
    const results = await Promise.allSettled(
      this.cleanupTasks.map(async (task) => {
        try {
          await task();
        } catch (error) {
          console.error('Cleanup task failed:', error);
        }
      })
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Cleanup task ${index} failed:`, result.reason);
      }
    });

    this.cleanupTasks = [];
  }
}