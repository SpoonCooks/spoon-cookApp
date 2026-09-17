const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Sign release builds with a real key — the Play upload key where one exists, a staging key
 * otherwise, and never silently with neither.
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
 * ## Fail-soft, deliberately — but never quietly
 *
 * When the properties are absent the config is not emitted and `release` keeps Expo's debug
 * signing. A contributor who has never set up the staging key can still run a release build; they
 * get an artifact rather than a cryptic Gradle failure about a keystore they were never told
 * about. That part is on purpose and is unchanged.
 *
 * What was wrong was the SILENCE. `assembleRelease` printed nothing about which key it used, so a
 * debug-signed `app-release.apk` is indistinguishable from a real one by looking at it — same
 * name, same path, same build output. Play rejects it on upload, but only after someone has
 * treated it as the build of record and handed it around.
 *
 * So the fallback stays and announces itself: every release assembly now prints which key signed
 * it, and the debug case says plainly that the artifact cannot go to Play. Printing rather than
 * throwing keeps EAS working — it supplies its own credentials and defines none of these
 * properties, so a throw here would break exactly the builds that are signed correctly.
 */
const STAGING_SIGNING_CONFIG = `
    // Injected by plugins/withStagingSigning.js.
    // The PLAY UPLOAD identity. Google re-signs with the app signing key it holds; this is only
    // what proves the upload came from us, so it is the one that must never be the debug key.
    uploadRelease {
      if (project.hasProperty('SPOON_UPLOAD_STORE_FILE')) {
        storeFile file(SPOON_UPLOAD_STORE_FILE)
        storePassword SPOON_UPLOAD_STORE_PASSWORD
        keyAlias SPOON_UPLOAD_KEY_ALIAS
        keyPassword SPOON_UPLOAD_KEY_PASSWORD
      }
    }
    // A test-only staging identity, never production. Kept so internal builds stay consistent and
    // mutually upgradable on a machine that has no upload key.
    stagingRelease {
      if (project.hasProperty('SPOON_STAGING_STORE_FILE')) {
        storeFile file(SPOON_STAGING_STORE_FILE)
        storePassword SPOON_STAGING_STORE_PASSWORD
        keyAlias SPOON_STAGING_KEY_ALIAS
        keyPassword SPOON_STAGING_KEY_PASSWORD
      }
    }
`;

/** Present only in this plugin's output, so it doubles as the has-this-already-run marker. */
const SIGNING_MARKER = '[spoon-signing]';

/**
 * The `release` buildType's signing choice, which states itself out loud.
 *
 * `println` runs at Gradle CONFIGURATION time, so the line appears near the top of the build
 * output for every release assembly — including one that fails later for an unrelated reason.
 */
const RELEASE_SIGNING_CHOICE = `if (project.hasProperty('SPOON_UPLOAD_STORE_FILE')) {
        signingConfig signingConfigs.uploadRelease
        println '[spoon-signing] release signed with the PLAY UPLOAD key: ' + SPOON_UPLOAD_STORE_FILE
      } else if (project.hasProperty('SPOON_STAGING_STORE_FILE')) {
        signingConfig signingConfigs.stagingRelease
        println '[spoon-signing] release signed with the STAGING key: ' + SPOON_STAGING_STORE_FILE
        println '[spoon-signing] Internal builds only — Play will not accept this.'
      } else {
        signingConfig signingConfigs.debug
        println '[spoon-signing] WARNING: release signed with the shared ANDROID DEBUG KEY.'
        println '[spoon-signing] It is NOT uploadable to Play and is not a build of record.'
        println '[spoon-signing] Set SPOON_UPLOAD_STORE_FILE (and _PASSWORD/_KEY_ALIAS/_KEY_PASSWORD)'
        println '[spoon-signing] in ~/.gradle/gradle.properties to sign it properly.'
      }`;

function addSigningConfig(contents) {
  if (contents.includes('uploadRelease {')) return contents;
  const anchor = 'signingConfigs {';
  const at = contents.indexOf(anchor);
  if (at === -1) throw new Error('withStagingSigning: no signingConfigs block to extend');
  const insertAt = at + anchor.length;
  return contents.slice(0, insertAt) + STAGING_SIGNING_CONFIG + contents.slice(insertAt);
}

function useSigningConfigForRelease(contents) {
  /*
   * Idempotent, and it has to be stated rather than assumed: `prebuild` WITHOUT `--clean` applies
   * mods to the existing `build.gradle`, so this can see its own output. The replacement text
   * contains `signingConfig signingConfigs.debug` in its else branch, which a second pass would
   * happily rewrite into a nested copy of itself. (The ternary this replaced was accidentally
   * immune — it never contained that exact substring — so the hazard arrived with the warning.)
   */
  if (contents.includes(SIGNING_MARKER)) return contents;

  // Only the `release` buildType's assignment is rewritten. `debug` keeps Expo's debug signing so
  // `assembleDebug` and the Metro workflow are untouched.
  const releaseAt = contents.indexOf('release {');
  if (releaseAt === -1) throw new Error('withStagingSigning: no release buildType');
  const head = contents.slice(0, releaseAt);
  const tail = contents.slice(releaseAt);
  const replaced = tail.replace('signingConfig signingConfigs.debug', RELEASE_SIGNING_CHOICE);
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

// Exported for `src/__tests__/stagingSigningPlugin.test.ts`, which exercises the string transform
// directly: a regression here is otherwise only visible in a release build nobody runs by habit.
module.exports.addSigningConfig = addSigningConfig;
module.exports.useSigningConfigForRelease = useSigningConfigForRelease;
module.exports.RELEASE_SIGNING_CHOICE = RELEASE_SIGNING_CHOICE;
