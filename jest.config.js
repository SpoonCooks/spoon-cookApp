// Pin the timezone so any test that turns a server instant into a local clock time is
// deterministic. The Cook App's shifts are stated in India local time, so that is the timezone
// the screens are authored against; without this the result depends on the runner's machine.
process.env.TZ = 'Asia/Kolkata';

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@ui$': '<rootDir>/src/ui/index.ts',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
