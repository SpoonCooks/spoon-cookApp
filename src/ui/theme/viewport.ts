import { layout } from './tokens';

/**
 * The two frame conventions V13 authors screens in, and where the application viewport sits
 * inside each.
 *
 * ## Why this file exists
 *
 * V12 could assume "every frame is 390x830". V13 cannot: the five finalized sections use two
 * different authoring conventions, and applying one transform to both would displace every
 * element on eighteen of the thirty-five screens.
 *
 *   * **`bezel`** — `Login flow` and `Service flow`. The frame is 390x830 and draws a decorative
 *     phone mockup *inside itself*: a 9px black rounded border with the screen content laid out
 *     in the padding box. A child at `top: 1px` therefore sits at frame y = 10, and the home
 *     indicator strip at `top: 801.23px` sits at frame y = 810.23. The application viewport is
 *     the inner **370.44 x 810.45** area at offset (10, 9.78). The bezel is decoration; the app
 *     must never draw it.
 *   * **`direct`** — `leave`, `log in flow` and `performance`. The frame *is* the viewport. There
 *     is no bezel, the status bar is a real child at y = 0, and heights vary per screen because
 *     these screens scroll.
 *
 * In both conventions the content column measures **370dp**, which is what makes a single
 * `screenWidth / 370` factor (see `designScale.ts`) correct everywhere. That is the one thing
 * V13 did *not* change, and it is asserted by test rather than assumed.
 *
 * ## System chrome is not application content
 *
 * Both conventions draw a **status bar mock** at the top of the viewport and most draw a **home
 * indicator** strip at the bottom. Neither is application content — on a real device the OS owns
 * those bands. The app does not reproduce them; it starts its content immediately below the real
 * safe-area top inset. The bands are recorded here so the pixel-verification harness can exclude
 * the same regions from both sides of the comparison instead of scoring the app against chrome it
 * is not allowed to draw.
 */

/** How a section's frames relate to the application viewport. */
export type ViewportConvention = 'bezel' | 'direct';

export interface ViewportProfile {
  readonly convention: ViewportConvention;
  /** Frame-space origin of the application viewport. `(0, 0)` for `direct`. */
  readonly origin: { readonly x: number; readonly y: number };
  /** Viewport size in design units. `height` is per-frame for `direct` sections. */
  readonly width: number;
  readonly height: number | 'per-frame';
  /**
   * Height of the status-bar mock at the top of the viewport, in design units. The OS owns this
   * band; the app renders its content below it.
   */
  readonly statusBandHeight: number;
  /**
   * Height of the home-indicator strip at the bottom of the viewport, in design units, or 0 when
   * the convention does not draw one.
   */
  readonly homeIndicatorHeight: number;
}

/** Inner viewport of a 390x830 bezel frame, measured from the `434:3280` subtree. */
export const BEZEL_VIEWPORT = { x: 10, y: 9.78, width: 370.44, height: 810.45 } as const;

/**
 * The status-bar mock inside a **bezel** frame, in design units.
 *
 * Measured against the located bezel viewport on `434:3280`, `434:3224` and `434:3116`, and the
 * value the five verified `Login flow` comparisons were closed at. Do not tune it: those five
 * screens minimise their displacement probe at offset 0 against this number, so a change here
 * re-opens work that is already evidenced.
 */
export const STATUS_BAND_HEIGHT = 33;

/**
 * The status-bar mock inside a **direct** frame, in design units.
 *
 * Not the same as the bezel figure, and that is the point of typing the two separately. In the
 * direct sections the mock is `575:1743` — a 32-unit `Component 1` whose notch island is
 * `top-0 bottom-1/4`, i.e. exactly 24 units. Every uncapped direct reference render puts that
 * island on rows 0..23, which fixes the band at **32**. Applying the bezel's 33 here would drop a
 * real design row from the top of every `leave`, `log in flow` and `performance` comparison.
 */
export const DIRECT_STATUS_BAND_HEIGHT = 32;

/**
 * The status-bar mock inside a **leave** frame, in design units.
 *
 * A third value, and the reason this is a per-section table rather than a constant. `526:348` is
 * an explicit `h-[36.198px]` row that also draws a `#f3f4f6` hairline along its bottom edge; the
 * `log in flow` mock (`575:1743`) has neither the extra four units nor the rule.
 */
export const LEAVE_STATUS_BAND_HEIGHT = 36.198;

/**
 * Height of the status-bar mock in a **Service flow** frame, in design units.
 *
 * A fourth value, and not the bezel's 33. `462:3660` is an explicit `h-[36.198px]` row carrying a
 * `#f3f4f6` hairline along its bottom edge — the same component the `leave` frames use, and not
 * the one `Login flow` uses. Comparing Service against 33 drops three design rows fewer than it
 * should from the top of the reference, which displaces every Service screen by three rows before
 * a single element is examined.
 */
export const SERVICE_STATUS_BAND_HEIGHT = 36.198;

/** `434:3325` and its siblings: a 4dp pill in a strip that ends at the viewport's bottom edge. */
export const HOME_INDICATOR_HEIGHT = 10;

const BEZEL_PROFILE: ViewportProfile = {
  convention: 'bezel',
  origin: { x: BEZEL_VIEWPORT.x, y: BEZEL_VIEWPORT.y },
  width: BEZEL_VIEWPORT.width,
  height: BEZEL_VIEWPORT.height,
  statusBandHeight: STATUS_BAND_HEIGHT,
  homeIndicatorHeight: HOME_INDICATOR_HEIGHT,
};

const DIRECT_PROFILE: ViewportProfile = {
  convention: 'direct',
  origin: { x: 0, y: 0 },
  width: layout.contentWidth,
  height: 'per-frame',
  statusBandHeight: DIRECT_STATUS_BAND_HEIGHT,
  // A direct frame ends at its own last content row; only the phone mockups draw an indicator.
  homeIndicatorHeight: 0,
};

/**
 * `Service flow` was a bezel section in V13 and is NOT one in V14.
 *
 * V14 deleted all twelve V13 service frames and re-authored the section as 371-wide `direct`
 * frames carrying the 32-unit `phone bar` — the same mock `log in flow` and `performance` use.
 * Keeping the old profile would apply a 10-unit bezel origin and a 36.198-unit band to frames that
 * have neither, displacing every Service comparison before a single element was examined.
 *
 * {@link SERVICE_STATUS_BAND_HEIGHT} is retained only so the V13 evidence stays readable.
 */
const SERVICE_PROFILE: ViewportProfile = DIRECT_PROFILE;

const LEAVE_PROFILE: ViewportProfile = {
  convention: 'direct',
  origin: { x: 0, y: 0 },
  width: layout.contentWidth,
  height: 'per-frame',
  statusBandHeight: LEAVE_STATUS_BAND_HEIGHT,
  homeIndicatorHeight: 0,
};

/** Section node id -> viewport profile. Keyed by node id because two sections share a name stem. */
export const viewportProfileBySection: Readonly<Record<string, ViewportProfile>> = {
  '434:3115': BEZEL_PROFILE, // Login flow — the only bezel section left in V14
  '485:4971': SERVICE_PROFILE, // Service flow — direct in V14, bezel in V13
  '540:416': LEAVE_PROFILE, // leave
  '592:1068': DIRECT_PROFILE, // log in flow
  '575:1741': DIRECT_PROFILE, // performance
  '592:1070': DIRECT_PROFILE, // job flow — new in V14
  /*
   * `Info` is listed for completeness, but it is the one section whose band is NOT uniform:
   * `597:1131` draws the 32-unit `phone bar` and the five rule sheets draw the 36.198 hairline
   * row. The harness reads the band per frame from `inventory.json`; this entry is the section
   * default only.
   */
  '611:398': DIRECT_PROFILE, // Info — new in V14, mixed band (see above)
};

export function viewportProfile(sectionNodeId: string): ViewportProfile {
  const profile = viewportProfileBySection[sectionNodeId];
  if (profile === undefined) {
    throw new Error(`No viewport profile for section ${sectionNodeId}`);
  }
  return profile;
}

/**
 * Content height available below the status band, in design units.
 *
 * A `bezel` screen's design content area is 767.45 units tall (810.45 viewport, less the 33-unit
 * status band and the 10-unit home indicator). The verified emulator supplies 796.36dp between
 * its own system bars, which is 750.3 design units — **17 units short**. Screens whose design
 * height fills the frame are therefore laid out to *fill the available space* rather than to a
 * fixed 764/800 height, and the harness records how many reference rows went uncompared.
 */
export function designContentHeight(profile: ViewportProfile, frameHeight?: number): number {
  const total = profile.height === 'per-frame' ? (frameHeight ?? 0) : profile.height;
  return total - profile.statusBandHeight - profile.homeIndicatorHeight;
}
