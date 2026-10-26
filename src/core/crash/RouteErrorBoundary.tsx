import { ErrorBoundary } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';

import { crashReporter } from './crashReporter';

/**
 * The root route's error boundary: reports a render failure, then shows exactly what expo-router
 * showed before.
 *
 * The app had no boundary of its own, so a screen that threw while rendering fell to the router's
 * default error screen and was never reported. Exported from `_layout.tsx` under the name
 * `ErrorBoundary`, which is the convention expo-router looks for. It wraps the router's own
 * component rather than drawing anything new: the screen a cook sees is unchanged, and any new
 * wording for it is a copy decision, not a reporting one.
 *
 * Render errors only. An error in an event handler or a promise never reaches a boundary; fatal
 * ones are caught by the SDK's global handler, and the rest are reported where they are handled.
 */
export function RouteErrorBoundary(props: ErrorBoundaryProps): React.ReactElement {
  const { error } = props;

  useEffect(() => {
    crashReporter.recordError(error, { source: 'route-error-boundary' });
  }, [error]);

  return <ErrorBoundary {...props} />;
}
