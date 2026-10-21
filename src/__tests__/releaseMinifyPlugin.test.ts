import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `plugins/withReleaseMinify.js`.
 *
 * The flag only ever lives in a generated, gitignored `gradle.properties`, so the one way it can
 * regress silently is the plugin dropping out of `app.config.ts` or writing the wrong value: the
 * next release would build, upload and pass review unminified, and the only sign would be Play's
 * DEX warning coming back.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../../plugins/withReleaseMinify') as {
  KEY: string;
  RULES_MARKER: string;
  applyRules: (contents: string) => string;
  applyMinify: (
    properties: { type: string; key?: string; value?: string }[],
  ) => { type: string; key?: string; value?: string }[];
};

describe('withReleaseMinify', () => {
  it('sets the property Expo reads for release minification', () => {
    expect(plugin.KEY).toBe('android.enableMinifyInReleaseBuilds');
    expect(plugin.applyMinify([])).toEqual([
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
    ]);
  });

  it('overrides a template default of false instead of adding a second entry', () => {
    const result = plugin.applyMinify([
      { type: 'comment', value: 'Enable R8' },
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
    ]);
    const entries = result.filter((p) => p.key === 'android.enableMinifyInReleaseBuilds');
    expect(entries).toEqual([
      { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
    ]);
  });

  it('leaves resource shrinking alone', () => {
    const result = plugin.applyMinify([]);
    expect(result.some((p) => p.key === 'android.enableShrinkResourcesInReleaseBuilds')).toBe(
      false,
    );
  });

  describe('proguard rules', () => {
    const TEMPLATE = '# react-native-reanimated\n-keep class com.swmansion.reanimated.** { *; }\n';

    it('silences exactly the ML Kit vision packages expo-camera references', () => {
      const out = plugin.applyRules(TEMPLATE);
      expect(out.startsWith(TEMPLATE.trimEnd())).toBe(true);
      const rules = out.split('\n').filter((line) => line.startsWith('-'));
      expect(rules).toEqual([
        '-keep class com.swmansion.reanimated.** { *; }',
        '-dontwarn com.google.mlkit.vision.barcode.**',
        '-dontwarn com.google.mlkit.vision.codescanner.**',
        '-dontwarn com.google.mlkit.vision.common.**',
        '-keep class expo.modules.adapters.react.apploader.RNHeadlessAppLoader { *; }',
      ]);
    });

    it('keeps the headless app loader that expo-modules-core names only in its manifest', () => {
      // Without it R8 deletes the class and background tasks cannot start the JS runtime.
      expect(plugin.applyRules('')).toContain(
        '-keep class expo.modules.adapters.react.apploader.RNHeadlessAppLoader { *; }',
      );
    });

    it('never silences more than ML Kit', () => {
      // A blanket -dontwarn would turn a genuinely missing class into a runtime crash.
      const added = plugin.applyRules('').split('\n').filter((l) => l.startsWith('-dontwarn'));
      for (const rule of added) expect(rule).toMatch(/^-dontwarn com\.google\.mlkit\.vision\./);
    });

    it('does not duplicate the block when prebuild runs twice', () => {
      const twice = plugin.applyRules(plugin.applyRules(TEMPLATE));
      expect(twice).toBe(plugin.applyRules(TEMPLATE));
      expect(twice.split(plugin.RULES_MARKER).length - 1).toBe(2);
    });
  });

  it('is applied by app.config.ts', () => {
    const config = readFileSync(join(__dirname, '..', '..', 'app.config.ts'), 'utf-8');
    expect(config).toContain("'./plugins/withReleaseMinify'");
  });
});
