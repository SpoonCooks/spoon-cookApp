/**
 * Jest setup.
 *
 * @testing-library/react-native v13 registers its matchers automatically, so no extend-expect
 * import is needed. Reanimated v4 ships no `/mock` entry point either — the worklets runtime is
 * inert under the jest-expo preset, so no mock is required for these component tests.
 */

/**
 * Firebase Crashlytics. `core/crash` loads it lazily and never under Jest (`__DEV__` is true), so
 * this is a backstop: a test that deliberately enables reporting, or a future import of the module,
 * gets inert functions rather than a missing native module.
 */
jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: jest.fn(() => ({})),
  log: jest.fn(),
  recordError: jest.fn(),
  setUserId: jest.fn(async () => null),
  setAttributes: jest.fn(async () => null),
  setAttribute: jest.fn(async () => null),
}));

export {};
