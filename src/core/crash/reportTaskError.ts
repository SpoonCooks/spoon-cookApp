import { crashReporter } from './crashReporter';

/** Which background task failed; the only context attached, so nothing personal can ride along. */
export type TaskName = 'location' | 'presence';

function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') return message;
  }
  return typeof error === 'string' ? error : 'unknown error';
}

/**
 * Reports a failure in one of the headless location tasks.
 *
 * These run with no screen and no cook watching: Android starts them in a headless JS runtime while
 * the app is closed, so a failure here is otherwise invisible and shows up only as a cook who
 * "stopped being tracked". Callers must NOT pass expected failures -- offline, 5xx, 401, 429 are
 * tolerated by design (the next fix retries) and would only be noise.
 *
 * `expo-task-manager` hands its own `error` as `{ code, message }`, not an `Error`, so a non-Error
 * is wrapped with its message and the task's name.
 */
export function reportTaskError(task: TaskName, error: unknown): void {
  const reported =
    error instanceof Error ? error : new Error(`${task} task failed: ${describe(error)}`);
  crashReporter.recordError(reported, { task });
}
