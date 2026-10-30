import { crashReporter } from '@core/crash/crashReporter';
import { reportTaskError } from '@core/crash/reportTaskError';

jest.mock('@core/crash/crashReporter', () => ({
  crashReporter: { recordError: jest.fn() },
}));

const recordError = jest.mocked(crashReporter.recordError);

beforeEach(() => {
  recordError.mockClear();
});

describe('reportTaskError', () => {
  it('passes a real Error through untouched, tagged only with the task name', () => {
    const error = new Error('storage failed');

    reportTaskError('location', error);

    expect(recordError).toHaveBeenCalledWith(error, { task: 'location' });
  });

  it("wraps the task manager's { code, message } so its message and the task survive", () => {
    reportTaskError('presence', { code: 'E_TASK', message: 'service died' });

    const [sent] = recordError.mock.calls[0] ?? [];
    expect(sent).toBeInstanceOf(Error);
    expect((sent as Error).message).toBe('presence task failed: service died');
  });

  it.each([
    ['a bare string', 'boom', 'boom'],
    ['nothing useful', undefined, 'unknown error'],
  ])('describes %s', (_label, value, expected) => {
    reportTaskError('location', value);

    expect((recordError.mock.calls[0]?.[0] as Error).message).toBe(
      `location task failed: ${expected}`,
    );
  });
});
