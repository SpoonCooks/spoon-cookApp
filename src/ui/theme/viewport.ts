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
 * The status-bar mock is 33 design units tall in every V13 frame that draws one — a 12px clock on
 * a `pt-12 pb-4` row. Verified identical on `434:3280`, `434:3224`, `434:3116` and the Service
 * frames.
 */
export const STATUS_BAND_HEIGHT = 33;

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
  statusBandHeight: STATUS_BAND_HEIGHT,
  homeIndicatorHeight: 0,
};

/** Section node id -> viewport profile. Keyed by node id because two sections share a name stem. */
export const viewportProfileBySection: Readonly<Record<string, ViewportProfile>> = {
  '434:3115': BEZEL_PROFILE, // Login flow
  '485:4971': BEZEL_PROFILE, // Service flow
  '540:416': DIRECT_PROFILE, // leave
  '592:1068': DIRECT_PROFILE, // log in flow
  '575:1741': DIRECT_PROFILE, // performance
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
