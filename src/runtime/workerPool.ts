/**
 * @module runtime/workerPool
 *
 * A small, dependency-free task orchestrator that bounds the number of
 * concurrently in-flight tasks. It is the scheduling core that would sit
 * in front of a real `Worker` (or any other async executor) without being
 * coupled to one: the unit of work is supplied as an injectable
 * {@link TaskRunner}, so the pool can be exercised in tests with plain
 * promises and no actual threads.
 *
 * Behaviour:
 *
 * - At most `concurrency` tasks run at any instant; the remainder wait in
 *   a FIFO queue and start as running slots free up.
 * - {@link WorkerPool.runAll} preserves input order in its output array
 *   regardless of the order in which individual tasks settle.
 * - A task that rejects rejects only its own promise. The pool keeps
 *   draining its queue, and sibling tasks continue to resolve normally.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The unit of work executed by a {@link WorkerPool}. Maps a single input
 * to a promise of its output.
 */
export type TaskRunner<I, O> = (input: I) => Promise<O>;

/**
 * Options for {@link createWorkerPool}.
 */
export interface WorkerPoolOptions {
  /**
   * Maximum number of tasks allowed to run simultaneously. Defaults to
   * `globalThis.navigator?.hardwareConcurrency ?? 4`. Must be a positive
   * integer.
   */
  readonly concurrency?: number | undefined;
}

/**
 * A bounded-concurrency task pool.
 */
export interface WorkerPool<I, O> {
  /**
   * Schedule a single input. Resolves with the runner's output, or
   * rejects with the runner's error. Honours the pool's concurrency
   * limit, queueing if all slots are busy.
   */
  run(input: I): Promise<O>;
  /**
   * Schedule every input, returning the outputs in the **same order** as
   * the inputs. Rejects if any task rejects, but every task is still
   * scheduled and the pool stays usable afterwards.
   */
  runAll(inputs: readonly I[]): Promise<O[]>;
  /** Number of tasks currently executing (excludes queued tasks). */
  readonly activeCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the default concurrency from the host's reported hardware
 * parallelism, falling back to `4` when unavailable.
 */
function resolveDefaultConcurrency(): number {
  const reported = (
    globalThis as { navigator?: { hardwareConcurrency?: number } }
  ).navigator?.hardwareConcurrency;
  if (typeof reported === 'number' && Number.isInteger(reported) && reported > 0) {
    return reported;
  }
  return 4;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a {@link WorkerPool} backed by the given {@link TaskRunner}.
 *
 * @param runner  - The async function invoked once per scheduled input.
 * @param options - Optional {@link WorkerPoolOptions}.
 * @returns A {@link WorkerPool}.
 * @throws If `options.concurrency` is provided but is not a positive
 *         integer.
 */
export function createWorkerPool<I, O>(
  runner: TaskRunner<I, O>,
  options?: WorkerPoolOptions,
): WorkerPool<I, O> {
  const concurrency = options?.concurrency ?? resolveDefaultConcurrency();
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error(
      `workerPool: concurrency must be a positive integer, received ${concurrency}`,
    );
  }

  /** A queued task awaiting a free execution slot. */
  interface QueuedTask {
    readonly input: I;
    readonly resolve: (value: O) => void;
    readonly reject: (reason: unknown) => void;
  }

  const queue: QueuedTask[] = [];
  let active = 0;

  /**
   * Promote queued tasks into running slots while capacity remains.
   * Each completed task frees its slot and re-pumps the queue.
   */
  function pump(): void {
    while (active < concurrency) {
      const task = queue.shift();
      if (task === undefined) return;

      active += 1;
      void Promise.resolve()
        .then(() => runner(task.input))
        .then(
          (value) => {
            task.resolve(value);
          },
          (reason: unknown) => {
            task.reject(reason);
          },
        )
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  }

  function run(input: I): Promise<O> {
    return new Promise<O>((resolve, reject) => {
      queue.push({ input, resolve, reject });
      pump();
    });
  }

  function runAll(inputs: readonly I[]): Promise<O[]> {
    return Promise.all(inputs.map((input) => run(input)));
  }

  return {
    run,
    runAll,
    get activeCount(): number {
      return active;
    },
  };
}
