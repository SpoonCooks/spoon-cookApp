import { readdirSync, readFileSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
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
 * The native splash placeholder must be FULLY TRANSPARENT.
 *
 * `app.config.ts` hands `splash-icon.png` to `expo-splash-screen` and documents it as
 * "a deliberately EMPTY (1x1 transparent) image", because the plugin always writes
 * `windowSplashScreenAnimatedIcon` into `styles.xml` and the Android build fails resource
 * linking without a drawable to point at. The Figma loading page (`434:3330`) is drawn in JS;
 * the native splash only has to hold the brand yellow until the bundle boots.
 *
 * The committed file was a single pixel of `[0, 0, 255, 127]` — semi-transparent BLUE. Scaled
 * into the splash icon box and composited over `#ffd600` it painted a dark purple square, about
 * 272px across, on every cold launch on both the emulator and a real device. Nothing caught it:
 * `expo export` never links Android resources, the gallery never renders the native splash, and
 * the JS loading page it precedes scores 0.18% against its reference.
 *
 * A one-pixel PNG is small enough to decode here rather than take on trust.
 */
describe('the native splash placeholder', () => {
  const png = readFileSync(join(SRC, '..', 'assets', 'images', 'splash-icon.png'));

  /** Minimal PNG reader: enough for a 1x1 image, and no dependency to add. */
  function decode(buffer: Buffer): {
    readonly width: number;
    readonly height: number;
    readonly colourType: number;
    readonly pixel: readonly number[];
  } {
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    let offset = 8;
    let header: { width: number; height: number; colourType: number } | undefined;
    const data: Buffer[] = [];
    while (offset < buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
      const body = buffer.subarray(offset + 8, offset + 8 + length);
      if (type === 'IHDR') {
        header = {
          width: body.readUInt32BE(0),
          height: body.readUInt32BE(4),
          colourType: body.readUInt8(9),
        };
      } else if (type === 'IDAT') {
        data.push(body);
      }
      offset += length + 12;
    }
    if (header === undefined) throw new Error('no IHDR');
    // Scanline layout for a 1x1 image: one filter byte, then the channels.
    const raw = inflateSync(Buffer.concat(data));
    return { ...header, pixel: Array.from(raw.subarray(1)) };
  }

  it('is a single pixel', () => {
    const { width, height } = decode(png);
    expect([width, height]).toEqual([1, 1]);
  });

  it('carries an alpha channel, and that alpha is zero', () => {
    const { colourType, pixel } = decode(png);
    // 6 = truecolour with alpha, 4 = greyscale with alpha. Anything else cannot be transparent.
    expect([4, 6]).toContain(colourType);
    const alpha = pixel[pixel.length - 1];
    expect(alpha).toBe(0);
  });

  it('paints nothing over the brand yellow it sits on', () => {
    // Compositing src-over with zero alpha must leave the background exactly as it was.
    const { pixel } = decode(png);
    const alpha = (pixel[pixel.length - 1] ?? 0) / 255;
    const background = [0xff, 0xd6, 0x00];
    const composited = background.map((channel, i) =>
      Math.round((pixel[i] ?? 0) * alpha + channel * (1 - alpha)),
    );
    expect(composited).toEqual(background);
  });
});
