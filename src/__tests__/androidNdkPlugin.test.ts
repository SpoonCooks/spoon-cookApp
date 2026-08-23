/**
 * `plugins/withAndroidNdkVersion.js`.
 *
 * The plugin exists because `android/` is generated and gitignored: a hand-edited Gradle file
 * survives until the next `expo prebuild --clean` and then silently reverts to a default that
 * cannot compile. These tests cover the string transform directly, so a regression is caught in
 * ~20 ms rather than eight minutes into a C++ build.
 *
 * The behaviour that actually matters is ORDERING — the pin must land before
 * `apply plugin: "expo-root-project"`, because that plugin's `setIfNotExist("ndkVersion")` only
 * preserves a value that already exists when it runs.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../../plugins/withAndroidNdkVersion') as {
  (config: unknown, props: { ndkVersion: string }): unknown;
  MARKER: string;
  stripExistingBlock: (contents: string) => string;
  buildBlock: (ndkVersion: string) => string;
};

const NDK = '27.2.12479018';

/** The generated root `build.gradle` as Expo SDK 57 emits it. */
const TEMPLATE = `// Top-level build file where you can add configuration options common to all sub-projects/modules.

buildscript {
  repositories {
    google()
    mavenCentral()
  }
  dependencies {
    classpath('com.android.tools.build:gradle')
  }
}

allprojects {
  repositories {
    google()
    mavenCentral()
  }
}

apply plugin: "expo-root-project"
apply plugin: "com.facebook.react.rootproject"
`;

/**
 * `withProjectBuildGradle` is mocked so the transform runs without a real Expo project on disk.
 * The mock simply hands the plugin a fake mod and records what it wrote back.
 */
jest.mock('@expo/config-plugins', () => ({
  withProjectBuildGradle: (
    config: unknown,
    action: (mod: { modResults: { language: string; contents: string } }) => {
      modResults: { language: string; contents: string };
    },
  ) => {
    const holder = globalThis as { __gradle__?: { language: string; contents: string } };
    const mod = { modResults: holder.__gradle__ ?? { language: 'groovy', contents: '' } };
    holder.__gradle__ = action(mod).modResults;
    return config;
  },
}));

/** Run the plugin over `contents` and return the resulting Gradle file. */
function applyPlugin(contents: string, ndkVersion: string = NDK, language = 'groovy'): string {
  const holder = globalThis as { __gradle__?: { language: string; contents: string } };
  holder.__gradle__ = { language, contents };
  plugin({}, { ndkVersion });
  return holder.__gradle__.contents;
}

describe('withAndroidNdkVersion', () => {
  it('writes the pinned version into the root build.gradle', () => {
    const out = applyPlugin(TEMPLATE);
    expect(out).toContain(`ndkVersion = "${NDK}"`);
  });

  it('places the pin BEFORE the Expo root plugin is applied', () => {
    // The whole fix depends on this ordering: `setIfNotExist` keeps an existing value, so a pin
    // written after the apply would be ignored and the broken 27.1 default would win.
    const out = applyPlugin(TEMPLATE);
    expect(out.indexOf('ndkVersion =')).toBeLessThan(
      out.indexOf('apply plugin: "expo-root-project"'),
    );
  });

  it('sets the property the native modules actually read', () => {
    // reanimated, worklets, expo-modules-core, screens, gesture-handler and svg all guard on
    // `rootProject.hasProperty("ndkVersion")`, so it must land in an `ext` block on the root.
    const out = applyPlugin(TEMPLATE);
    expect(out).toMatch(/ext\s*\{[^}]*ndkVersion\s*=/);
  });

  it('is idempotent — a second prebuild does not duplicate the block', () => {
    const once = applyPlugin(TEMPLATE);
    const twice = applyPlugin(once);
    expect(twice).toBe(once);
    expect(twice.split(plugin.MARKER)).toHaveLength(2); // marker appears exactly once
  });

  it('stays idempotent over three runs', () => {
    const thrice = applyPlugin(applyPlugin(applyPlugin(TEMPLATE)));
    expect(thrice.split(`ndkVersion = "`)).toHaveLength(2);
  });

  it('replaces an older pinned version rather than appending a second one', () => {
    const old = applyPlugin(TEMPLATE, '27.1.12297006');
    const updated = applyPlugin(old, NDK);
    expect(updated).toContain(`ndkVersion = "${NDK}"`);
    // Assert on the PIN, not the bare string: the injected comment legitimately names the broken
    // version when explaining why the pin exists.
    expect(updated).not.toContain('ndkVersion = "27.1.12297006"');
    expect(updated.split(plugin.MARKER)).toHaveLength(2);
  });

  it('leaves the rest of the template untouched', () => {
    const out = applyPlugin(TEMPLATE);
    expect(out).toContain('apply plugin: "com.facebook.react.rootproject"');
    expect(out).toContain("classpath('com.android.tools.build:gradle')");
    // No blanket subprojects rewrite — the earlier approach reached into every Android
    // subproject's extension, which is broader than needed and overrides deliberate settings.
    expect(out).not.toContain('subprojects');
  });

  it('rejects a malformed version instead of silently skipping the pin', () => {
    // A skipped pin surfaces as an inscrutable C++ error minutes into the build.
    for (const bad of ['27.2', 'latest', '27', 'v27.2.12479018', '']) {
      expect(() => applyPlugin(TEMPLATE, bad)).toThrow(/full NDK version/);
    }
    // An omitted prop must fail too. Checked directly against the plugin so the helper's default
    // parameter cannot quietly substitute a valid version and hide the gap.
    expect(() => plugin({}, {} as { ndkVersion: string })).toThrow(/full NDK version/);
  });

  it('fails loudly if the generated template stops containing the anchor', () => {
    expect(() => applyPlugin('// nothing to anchor to\n')).toThrow(/expo-root-project/);
  });

  it('exposes the exact version the app config pins', () => {
    // Guards against app.config.ts and this suite drifting apart.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'app.config.ts'), 'utf8');
    expect(source).toContain(`const ANDROID_NDK_VERSION = '${NDK}'`);
    expect(source).toContain(
      "['./plugins/withAndroidNdkVersion', { ndkVersion: ANDROID_NDK_VERSION }]",
    );
  });
});

describe('stripExistingBlock', () => {
  it('is a no-op on a file that was never processed', () => {
    expect(plugin.stripExistingBlock(TEMPLATE)).toBe(TEMPLATE);
  });

  it('removes a block it previously wrote', () => {
    const withBlock = TEMPLATE.replace(
      'apply plugin: "expo-root-project"',
      `${plugin.buildBlock(NDK)}\napply plugin: "expo-root-project"`,
    );
    expect(plugin.stripExistingBlock(withBlock)).not.toContain(plugin.MARKER);
  });
});
