import { androidRasterisedFontPx, makeDesignScale, snapFontSize } from '@ui';

/**
 * The verified reference device: 1080px at 440dpi, so 392.727dp wide against the design's 370-unit
 * content column, rasterising at 2.75 device pixels per dp.
 */
const REF_WIDTH = 1080 / 2.75;
const REF_HEIGHT = 2392 / 2.75;
const PIXEL_RATIO = 2.75;
const FACTOR = REF_WIDTH / 370;

/** Every design-space font size the V13 type scale actually uses. */
const DESIGN_SIZES = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 30, 36, 50];

const androidDp = (designSize: number): number =>
  snapFontSize(designSize, FACTOR, PIXEL_RATIO, 'android');

describe('snapFontSize', () => {
  it.each(DESIGN_SIZES)(
    'rasterises design size %i on the nearest whole device pixel on Android',
    (designSize) => {
      const ideal = designSize * FACTOR * PIXEL_RATIO;
      expect(androidRasterisedFontPx(androidDp(designSize), PIXEL_RATIO)).toBe(Math.round(ideal));
    },
  );

  it('never rasterises more than half a device pixel from the design size', () => {
    for (let designSize = 8; designSize <= 60; designSize += 1) {
      const ideal = designSize * FACTOR * PIXEL_RATIO;
      const drawn = androidRasterisedFontPx(androidDp(designSize), PIXEL_RATIO);
      expect(Math.abs(drawn - ideal)).toBeLessThanOrEqual(0.5);
    }
  });

  /**
   * The defect this replaced. `s` snaps to 1/3 dp, which takes a 14-unit style's 14.86dp up to
   * 15.0dp = 41.25px, which Android then ceilings to **42** against the 41 the design asks for.
   * That is the 3.1% over-long SemiBold-14 runs measured on `592:488`, where the accumulated
   * advance walks every glyph past the first few onto the wrong pixel.
   */
  it('draws a 14-unit style one device pixel smaller than the 1/3-dp rounding did', () => {
    const scale = makeDesignScale(REF_WIDTH, REF_HEIGHT, PIXEL_RATIO);
    expect(androidRasterisedFontPx(scale.s(14), PIXEL_RATIO)).toBe(42);
    expect(androidRasterisedFontPx(androidDp(14), PIXEL_RATIO)).toBe(41);
  });

  /** Platforms that do not round state the size exactly, with no half-pixel bias applied. */
  it('states the exact pixel size on platforms that do not ceiling', () => {
    for (const designSize of DESIGN_SIZES) {
      const ios = snapFontSize(designSize, FACTOR, PIXEL_RATIO, 'ios');
      expect(ios * PIXEL_RATIO).toBeCloseTo(Math.round(designSize * FACTOR * PIXEL_RATIO), 6);
    }
  });

  it('never returns a size below one device pixel', () => {
    expect(androidRasterisedFontPx(androidDp(0.1), PIXEL_RATIO)).toBeGreaterThanOrEqual(1);
  });
});

describe('DesignScale', () => {
  const scale = makeDesignScale(REF_WIDTH, REF_HEIGHT, PIXEL_RATIO);

  it('maps the 370-unit content column onto the full screen width, to within 1/3 dp', () => {
    expect(Math.abs(scale.s(370) - REF_WIDTH)).toBeLessThanOrEqual(1 / 3);
  });

  it('keeps non-font lengths on the 1/3-dp grid', () => {
    expect(scale.s(0)).toBe(0);
    for (const design of [1, 7, 16, 42, 325]) {
      expect(scale.s(design) * 3).toBeCloseTo(Math.round(scale.s(design) * 3), 9);
    }
  });

  it('exposes font sizing separately from length scaling', () => {
    expect(scale.font(14)).not.toBe(scale.s(14));
  });
});
