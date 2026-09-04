const { withGradleProperties } = require('expo/config-plugins');

/**
 * Raises the Gradle JVM heap so D8 can dex a release build.
 *
 * ## Why this exists
 *
 * Expo templates `org.gradle.jvmargs=-Xmx2048m`. That is enough while Gradle is working
 * incrementally, and not enough for the build that follows `expo prebuild`: prebuild regenerates
 * `android/`, so the next release build dexes EVERYTHING in one pass instead of merging a handful
 * of changed archives. On 2026-09-04 that build died at `:app:mergeExtDexRelease` with
 *
 *     ERROR: D8: java.lang.OutOfMemoryError: Java heap space
 *
 * which names the symptom and not the cause -- the failure reads as a corrupt build directory,
 * and the usual reaction is to clean and rebuild, which spends another twelve minutes arriving
 * at the same place.
 *
 * ## Why a plugin rather than an edit to `android/gradle.properties`
 *
 * `android/` is generated and gitignored, and this is a value only the regeneration path needs.
 * Editing the file directly fixes today's build and is discarded by the very command that
 * creates the condition it fixes -- so the failure would return on exactly the occasion nobody
 * connects it to. A plugin is re-applied by every prebuild.
 *
 * ## Why 4g
 *
 * Twice the template, and it has to leave room for the rest of the machine: the daemon is not the
 * only thing running, and the build that failed had 3.9GB free of 23.7GB because a second app was
 * compiling native code beside it. 4g clears D8's peak for this project's dex graph with headroom,
 * without so much slack that a memory-pressured machine starts swapping to satisfy it.
 *
 * Metaspace goes up with it. It is a separate region from the heap, so a larger `-Xmx` does not
 * feed it, and the annotation processors in a release build are what exhaust it.
 */
const HEAP = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

module.exports = function withGradleHeap(config) {
  return withGradleProperties(config, (cfg) => {
    const properties = cfg.modResults;
    const existing = properties.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs',
    );
    if (existing) {
      existing.value = HEAP;
      return cfg;
    }
    properties.push({ type: 'property', key: 'org.gradle.jvmargs', value: HEAP });
    return cfg;
  });
};
