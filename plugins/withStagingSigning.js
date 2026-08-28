const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Sign staging release builds with a dedicated test-only key.
 *
 * ## Why this plugin has to exist
 *
 * `expo prebuild` generates `android/app/build.gradle` with `release` pointing at
 * `signingConfigs.debug` — the shared Android debug key, which every machine has and which is not
 * an identity. That is fine for `assembleDebug` and wrong for an artifact anyone installs and
 * treats as a build of record: two different machines produce APKs that are indistinguishable and
 * mutually upgradable.
 *
 * It must be a plugin rather than a hand edit because `prebuild --clean` deletes `android/`
 * wholesale. A `build.gradle` edited by hand survives exactly until the next regeneration, which
 * is precisely when somebody is least likely to notice it has gone.
 *
 * ## Where the credentials live, and where they must not
 *
 * The keystore path and passwords are read from Gradle properties, which are supplied from the
 * USER-level `~/.gradle/gradle.properties`. Nothing secret is written into either repository, and
 * `android/` is gitignored anyway. The credential is a test-only staging identity: it signs
 * internal builds so they are consistent and upgradable, and it is not, and must never become, a
 * production release key.
 *
 * ## Fail-soft, deliberately
 *
 * When the properties are absent the config is not emitted at all and `release` keeps Expo's debug
 * signing. A contributor who has never set up the staging key can still run a release build; they
 * simply get an unsigned-for-staging artifact rather than a cryptic Gradle failure about a
 * keystore they were never told about.
 */
const STAGING_SIGNING_CONFIG = `
    // Injected by plugins/withStagingSigning.js — test-only staging identity, never production.
    stagingRelease {
      if (project.hasProperty('SPOON_STAGING_STORE_FILE')) {
        storeFile file(SPOON_STAGING_STORE_FILE)
        storePassword SPOON_STAGING_STORE_PASSWORD
        keyAlias SPOON_STAGING_KEY_ALIAS
        keyPassword SPOON_STAGING_KEY_PASSWORD
      }
    }
`;

function addSigningConfig(contents) {
  if (contents.includes('stagingRelease {')) return contents;
  const anchor = 'signingConfigs {';
  const at = contents.indexOf(anchor);
  if (at === -1) throw new Error('withStagingSigning: no signingConfigs block to extend');
  const insertAt = at + anchor.length;
  return contents.slice(0, insertAt) + STAGING_SIGNING_CONFIG + contents.slice(insertAt);
}

function useSigningConfigForRelease(contents) {
  // Only the `release` buildType's assignment is rewritten. `debug` keeps Expo's debug signing so
  // `assembleDebug` and the Metro workflow are untouched.
  const releaseAt = contents.indexOf('release {');
  if (releaseAt === -1) throw new Error('withStagingSigning: no release buildType');
  const head = contents.slice(0, releaseAt);
  const tail = contents.slice(releaseAt);
  const replaced = tail.replace(
    'signingConfig signingConfigs.debug',
    "signingConfig project.hasProperty('SPOON_STAGING_STORE_FILE') ? signingConfigs.stagingRelease : signingConfigs.debug",
  );
  return head + replaced;
}

module.exports = function withStagingSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withStagingSigning: expected a groovy build.gradle');
    }
    mod.modResults.contents = useSigningConfigForRelease(addSigningConfig(mod.modResults.contents));
    return mod;
  });
};
