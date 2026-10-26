import { render, screen } from '@testing-library/react-native';

import { crashReporter } from '@core/crash/crashReporter';
import { RouteErrorBoundary } from '@core/crash/RouteErrorBoundary';

jest.mock('@core/crash/crashReporter', () => ({
  crashReporter: { recordError: jest.fn() },
}));

// expo-router's own screen, stood in for by a marker that echoes what it was given. What matters is
// that the boundary renders it with the SAME props: the screen a cook sees must not change.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement } = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    ErrorBoundary: ({ error }: { error: Error }) =>
      createElement(Text, { testID: 'router-error-screen' }, error.message),
  };
});

const recordError = jest.mocked(crashReporter.recordError);

beforeEach(() => {
  recordError.mockClear();
});

describe('RouteErrorBoundary', () => {
  it("reports the render failure, then shows the router's own error screen unchanged", () => {
    const error = new Error('Cannot read properties of undefined');
    const retry = jest.fn(async () => undefined);

    render(<RouteErrorBoundary error={error} retry={retry} />);

    expect(recordError).toHaveBeenCalledTimes(1);
    expect(recordError).toHaveBeenCalledWith(error, { source: 'route-error-boundary' });
    expect(screen.getByTestId('router-error-screen').props.children).toBe(
      'Cannot read properties of undefined',
    );
  });

  it('reports a given error once, not on every re-render', () => {
    const error = new Error('boom');
    const retry = jest.fn(async () => undefined);
    const view = render(<RouteErrorBoundary error={error} retry={retry} />);

    view.rerender(<RouteErrorBoundary error={error} retry={retry} />);

    expect(recordError).toHaveBeenCalledTimes(1);
  });
});
