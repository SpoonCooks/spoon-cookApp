import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * An SVG must never be loaded as an image source.
 *
 * ## What this catches
 *
 * `react-native` cannot decode an SVG. Handing one to `<Image source={require('…​.svg')} />`
 * throws nothing, logs nothing and renders nothing — the glyph is simply absent, and every test
 * that asserts the surrounding component still passes because the element is there.
 *
 * Three did exactly that. `info-back.svg` left all five Info rule sheets without their back
 * chevron, and `map-pin.svg` and `call-icon.svg` left `Map dekhe` and `Call kare` as bare labels
 * on every Service frame that draws them. Nothing surfaced it until the V14 pixel run put the
 * screens beside their reference renders.
 *
 * The project has no SVG Metro transformer — `scripts/visual/build_icons.py` says so, and it is
 * why `figmaV13Icons.ts` and `figmaV14Icons.ts` exist. Vector markup reaches the bundle as an
 * inlined string and is drawn by `SvgXml`.
 *
 * ## Why a source scan rather than a render assertion
 *
 * A render assertion can only cover the components someone remembered to write one for, and the
 * failure is invisible in a snapshot. This covers the whole of `src/` by construction, including
 * files that do not exist yet.
 */

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Strip comments before scanning.
 *
 * The fix for this bug is documented in a comment that quotes the very call it replaced, and this
 * file states the pattern it searches for. Both are prose. Scanning them would make the guard
 * report itself and the explanation of the bug as the bug.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('vector assets reach the bundle as markup, not as image sources', () => {
  it('never requires an .svg anywhere in src/', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const source = code(readFileSync(file, 'utf-8'));
      if (/require\(\s*['"][^'"]+\.svg['"]\s*\)/.test(source)) {
        offenders.push(file.slice(SRC.length + 1).replace(/\\/g, '/'));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the generated icon modules as inlined markup', () => {
    // If these ever stop being strings, the bug above has been reintroduced by another route.
    for (const module of ['figmaV13Icons.ts', 'figmaV14Icons.ts']) {
      const source = readFileSync(join(SRC, 'ui', 'icons', module), 'utf-8');
      expect(source).toContain('<svg');
      expect(code(source)).not.toMatch(/require\(/);
    }
  });
});

/**
 * The native splash background must be the BOOT GRADIENT'S TOP, not the brand yellow.
 *
 * `434:3330` fills the loading page with `#ffd600 -> #cfff04` at 70% over white. Measured on the
 * committed reference render that resolves to **#FAE44C** at the first row, and `BootView` draws
 * **#FBE54C** there — one level apart, which is why `login/boot` scores 0.18%.
 *
 * The native splash is what the OS paints BEFORE any of that, and `_layout.tsx` holds it up with
 * `preventAutoHideAsync()` until the fonts resolve. It used to be `#FFD600`, so the boot sequence
 * showed a saturated brand yellow and then jumped to a soft lemon — 76 levels apart on the blue
 * channel, which reads as a different screen rather than the same one still loading.
 *
 * Android 12+ accepts a single COLOUR for `windowSplashScreenBackground` and cannot render the
 * gradient, so matching its first row is the closest the native frame can get. These assertions
 * exist because nothing else can see this: the value only appears in a generated `styles.xml`,
 * and the JS page that follows it is pixel-verified independently.
 */
describe('the native splash background', () => {
  const config = readFileSync(join(SRC, '..', 'app.config.ts'), 'utf-8');

  it('is the measured top of the boot gradient', () => {
    expect(config).toContain("const SPLASH_BACKGROUND = '#FAE44C'");
  });

  it('is not the brand yellow, which is 76 levels away on blue', () => {
    expect(config).not.toContain("const SPLASH_BACKGROUND = '#FFD600'");
  });

  it('leaves the app icon on the brand yellow', () => {
    // The icon is brand furniture and does NOT follow the gradient.
    expect(config).toContain("const BRAND_YELLOW = '#FFD600'");
    expect(config).toContain('backgroundColor: BRAND_YELLOW');
  });

  /*
   * The app shipped with no icon at all: the adaptive icon named a background colour and gave
   * it nothing to hold, and no top-level icon existed either, so Android drew its own default
   * mark on the home screen and in the notification tray.
   */
  it('gives the launcher and the notification tray a Spoon mark to draw', () => {
    const logo = 'assets/images/figma-v13/spoon-brand-logo.png';

    expect(config).toMatch(new RegExp(`^  icon: '\./${logo}'`, 'm'));
    expect(config).toContain(`foregroundImage: './${logo}'`);

    // Android renders a notification icon as an alpha silhouette filled with this colour, so
    // a plain 'expo-notifications' with no config leaves it drawing the system default.
    const notifications = config.slice(config.indexOf("'expo-notifications'"));
    expect(notifications.slice(0, 200)).toContain(logo);
    expect(notifications.slice(0, 200)).toContain('color: BRAND_YELLOW');
  });

  it('hands that colour to expo-splash-screen', () => {
    expect(config).toContain('backgroundColor: SPLASH_BACKGROUND');
  });
});

/**
 * The native splash draws the design's own mark, at the size the design draws it.
 *
 * `434:3330` is the spoon wordmark on the boot gradient, and `BootView` reproduces it exactly —
 * 0.18% against the reference, the best of all 47 screens. On a release build nobody sees it:
 * `BootScreen` restores the session and redirects in milliseconds, so the gradient cross-fades
 * into Login and the mark never lands. The first second a cook actually looks at is the NATIVE
 * splash, and it drew nothing at all.
 *
 * Worse, before that it drew something wrong. `splash-icon.png` was documented as "1x1
 * transparent" and was actually one pixel of `[0, 0, 255, 127]` — semi-transparent blue — which
 * `expo-splash-screen` scaled to its default `imageWidth` of 100dp and composited over the
 * background as a dark purple square, about 275px across, on every cold launch.
 *
 * Nothing else can see any of this: the values live only in a generated `styles.xml` and
 * `colors.xml`, `expo export` never links Android resources, and the dev gallery renders the JS
 * page rather than the native frame that precedes it.
 */
describe('the native splash icon', () => {
  const config = readFileSync(join(SRC, '..', 'app.config.ts'), 'utf-8');

  it('is the same asset BootView renders, not a placeholder', () => {
    expect(config).toContain("image: './assets/images/figma-v13/spoon-brand-logo.png'");
    // The 1x1 blue pixel that painted the purple square must never come back.
    expect(config).not.toContain('splash-icon.png');
  });

  it('is drawn at 288dp, the largest the drawable canvas holds uncropped', () => {
    // A wider box is CROPPED, not scaled: at 393dp the fork handle and the wordmark's right edge
    expect(config).toContain('imageWidth: 288');
  });

  it('keeps an image configured at all', () => {
    // `expo-splash-screen` always writes `windowSplashScreenAnimatedIcon` into styles.xml.
    // Without a drawable to point at, the Android build fails resource linking — and `expo
    // export` cannot surface that, because export never links Android resources.
    expect(config).toMatch(/image:\s*'\.\/assets\/images\/[^']+'/);
  });
});
