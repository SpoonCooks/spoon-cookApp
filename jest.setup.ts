/**
 * Jest setup.
 *
 * @testing-library/react-native v13 registers its matchers automatically, so no extend-expect
 * import is needed. Reanimated v4 ships no `/mock` entry point either — the worklets runtime is
 * inert under the jest-expo preset, so no mock is required for these component tests.
 */
export {};
