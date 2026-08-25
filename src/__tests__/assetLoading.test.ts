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
