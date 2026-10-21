const fs = require('fs');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

/**
 * Turns on R8 for release builds.
 *
 * ## Why this exists
 *
 * Play Console flagged release 202609180 with "DEX code optimisation is below our threshold":
 * obfuscation at 1%, against a 25% floor, with a fix-by of February 2027. Expo's template reads
 * `android.enableMinifyInReleaseBuilds` from `gradle.properties` and defaults it to false, so
 * every release so far has shipped its DEX exactly as D8 produced it -- unshrunk, unoptimised,
 * unobfuscated.
 *
 * ## Why a plugin rather than an edit to `android/gradle.properties`
 *
 * Same reason as `withGradleHeap`: `android/` is generated and gitignored, and
 * `expo prebuild --clean` -- which every release build runs -- would discard a hand edit and
 * ship the next build unminified without anyone noticing.
 *
 * ## Why code only, not resources
 *
 * `android.enableShrinkResourcesInReleaseBuilds` is left off. Play's check is about DEX, and
 * resource shrinking removes anything it cannot prove is referenced, which in a React Native app
 * includes drawables the JS side resolves by name at runtime. That is a separate change with its
 * own on-device check, not something to bundle with this one.
 *
 * ## Keep rules
 *
 * No keep rules are needed today. The code R8 cannot see being used -- Expo modules and their
 * records, React Native's TurboModules, Reanimated and Worklets, SVG, notifications, location
 * and task-manager -- arrives with its own consumer rules, and `TappableInsetModule` is an Expo
 * module, covered by expo-modules-core's `-keep ... extends Module`. A new native dependency
 * without consumer rules is where a release-only crash would come from, which is why a minified
 * build has to be exercised on a handset, not just compiled.
 *
 * ## The one `-dontwarn`
 *
 * `barcodeScannerEnabled: false` (app.config.ts) makes ML Kit `compileOnly`, so expo-camera's
 * `BarcodeAnalyzer` and `BarCodeScannerResultSerializer` still reference ML Kit classes that are
 * no longer in the app. D8 does not care; R8 does, and the first minified build failed at
 * `:app:minifyReleaseWithR8` on 23 `Missing class com.google.mlkit.vision.*`. Those references
 * are dead by design: expo-camera reaches them only after `CameraUtils.isMLKitBarcodeScannerAvailable`
 * finds `BarcodeScanning` by reflection, which it never will. So the warning is silenced for
 * exactly those ML Kit vision packages and nothing wider -- a missing class anywhere else should
 * still fail the build.
 */
const KEY = 'android.enableMinifyInReleaseBuilds';

const RULES_MARKER = '# [spoon-release-minify]';
const RULES = `${RULES_MARKER} Added by plugins/withReleaseMinify.js -- see the note there.
# ML Kit is compileOnly (barcodeScannerEnabled: false); expo-camera checks for it at runtime.
-dontwarn com.google.mlkit.vision.barcode.**
-dontwarn com.google.mlkit.vision.codescanner.**
-dontwarn com.google.mlkit.vision.common.**
${RULES_MARKER} end`;

/** Appends the rules once; a re-run (or a prebuild without --clean) does not duplicate them. */
function applyRules(contents) {
  const start = contents.indexOf(RULES_MARKER);
  const base = start === -1 ? contents : contents.slice(0, start);
  return `${base.trimEnd()}\n\n${RULES}\n`;
}

function applyMinify(properties) {
  const existing = properties.find((item) => item.type === 'property' && item.key === KEY);
  if (existing) {
    existing.value = 'true';
    return properties;
  }
  properties.push({ type: 'property', key: KEY, value: 'true' });
  return properties;
}

module.exports = function withReleaseMinify(config) {
  const withProperty = withGradleProperties(config, (cfg) => {
    cfg.modResults = applyMinify(cfg.modResults);
    return cfg;
  });
  return withDangerousMod(withProperty, [
    'android',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const contents = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
      fs.writeFileSync(file, applyRules(contents));
      return cfg;
    },
  ]);
};

module.exports.KEY = KEY;
module.exports.RULES_MARKER = RULES_MARKER;
module.exports.applyMinify = applyMinify;
module.exports.applyRules = applyRules;
