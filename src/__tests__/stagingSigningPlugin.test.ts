/**
 * `plugins/withStagingSigning.js`.
 *
 * The plugin's fallback to Expo's debug key is deliberate — a contributor without the staging
 * keystore can still run a release build. What is NOT acceptable is doing it quietly: a
 * debug-signed `app-release.apk` has the same name and path as a real one, so the only place the
 * difference can surface is the build output. Play rejects the upload, but only after someone has
 * treated the artifact as a build of record.
 *
 * These assertions are on the generated Gradle text, like `androidNdkPlugin.test.ts` — `android/`
 * is gitignored and regenerated, so the transform is the only durable thing to test.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../../plugins/withStagingSigning') as {
  addSigningConfig: (contents: string) => string;
  useSigningConfigForRelease: (contents: string) => string;
  RELEASE_SIGNING_CHOICE: string;
};

/** `android/app/build.gradle` as Expo SDK 57 emits it, trimmed to the blocks under test. */
const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)
        }
    }
}
`;

function transform(contents: string): string {
  return plugin.useSigningConfigForRelease(plugin.addSigningConfig(contents));
}

describe('the staging signing plugin', () => {
  it('signs release with the staging key when one is configured', () => {
    const out = transform(TEMPLATE);

    expect(out).toContain('stagingRelease {');
    expect(out).toContain('signingConfig signingConfigs.stagingRelease');
  });

  it('says out loud when the release APK is debug-signed', () => {
    /*
     * The whole point. Without these lines `assembleRelease` prints nothing about which key it
     * used, and the artifact is indistinguishable from a properly signed one by inspection.
     */
    const out = transform(TEMPLATE);

    expect(out).toContain('ANDROID DEBUG KEY');
    expect(out).toContain('NOT uploadable to Play');
    // And it must name the way out, not just the problem.
    expect(out).toContain('SPOON_STAGING_STORE_FILE');
  });

  it('leaves the debug buildType alone', () => {
    // `assembleDebug` and the Metro workflow are the daily path; they keep Expo's debug signing
    // and must not acquire a warning about a key they are supposed to be using.
    const out = transform(TEMPLATE);
    const debugBlock = out.slice(out.indexOf('debug {', out.indexOf('buildTypes')));

    expect(debugBlock.slice(0, debugBlock.indexOf('release {'))).toContain(
      'signingConfig signingConfigs.debug',
    );
  });

  it('is idempotent, because prebuild runs on every build', () => {
    const once = transform(TEMPLATE);
    const twice = transform(once);

    expect(twice).toBe(once);
    expect(twice.match(/stagingRelease \{/g)).toHaveLength(1);
  });
});
