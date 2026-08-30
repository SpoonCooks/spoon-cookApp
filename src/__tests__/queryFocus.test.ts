import { AppState } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/**
 * `refetchOnWindowFocus` on a phone.
 *
 * ## Why this file exists
 *
 * `createQueryClient` sets `refetchOnWindowFocus: true`, and on React Native that setting was
 * doing nothing at all. TanStack Query's built-in focus detection listens for the DOM's
 * `visibilitychange` and `focus` events; neither exists here, so nothing ever told the library
 * the app had come back to the foreground.
 *
 * The Kaam list is the screen that paid for it. `useJobs` sets no `refetchInterval` — and should
 * not, since a day's roster is not a live service — so a refetch on focus was its only route to
 * fresh data. A cook opened Kaam, backgrounded the app, came back an hour later and read an
 * hour-old list. The same was true of her profile, earnings, attendance and leaves.
 *
 * A regression here is invisible: the flag stays `true`, every screen still renders, and the data
 * is merely old. So the real registration is driven directly, through a captured AppState.
 */

/** Callbacks the module under test hands to `AppState.addEventListener`. */
const handlers: ((status: string) => void)[] = [];
let removeCount = 0;

/*
 * A spy rather than `jest.mock('react-native', ...)`.
 *
 * Spreading `requireActual('react-native')` to keep the rest of the module intact forces every
 * one of its lazy getters — `FlatList`, `VirtualizedList`, the whole surface — and the preset
 * throws part-way through. Only `AppState` matters here, so only `AppState` is replaced.
 */
jest.spyOn(AppState, 'addEventListener').mockImplementation(((
  _event: string,
  handler: (status: string) => void,
) => {
  handlers.push(handler);
  return {
    remove: () => {
      removeCount += 1;
    },
  };
}) as never);

/*
 * Loading the module registers the listener as a side effect, and that side effect IS the fix —
 * so the load is the thing under test. `require` rather than `import` because ES imports are
 * hoisted above the spy above, which would let the real `addEventListener` run instead.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('@core/api/queries');

/** Drives the app through a foreground transition the way the OS would. */
function appStateChangesTo(status: string): void {
  for (const handler of handlers) handler(status);
}

describe('focus wiring', () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it('registers exactly one AppState listener', () => {
    // `focusManager` is a library-wide singleton. Registering twice would double every refetch
    // on focus, which is why the call sits at module scope rather than inside a component.
    expect(handlers).toHaveLength(1);
  });

  it('reports focused when the app becomes active', () => {
    appStateChangesTo('background');
    expect(focusManager.isFocused()).toBe(false);

    appStateChangesTo('active');
    expect(focusManager.isFocused()).toBe(true);
  });

  it('does NOT treat the app-switcher as focus', () => {
    /*
     * `inactive` is iOS's app-switcher and the moment a system dialog covers the app. Counting it
     * as focus would refetch every active query each time a cook glanced at another app and came
     * straight back — on the mobile data these phones run on.
     */
    appStateChangesTo('active');
    appStateChangesTo('inactive');
    expect(focusManager.isFocused()).toBe(false);
  });

  it('detaches the subscription when the manager unsubscribes', () => {
    // The setup function returns an unsubscribe. Without it the AppState subscription outlives
    // the manager and leaks a listener per registration.
    const before = removeCount;
    focusManager.setEventListener(() => () => undefined);
    expect(removeCount).toBe(before + 1);
  });
});
