/**
 * Cook App design tokens.
 *
 * Values are taken from the authoritative Cook App Figma
 * (`DfnWJV2wQxSWfFb1QcBZpG`, page `Cook App` = `434:2401`, V12) by walking every node's fills,
 * strokes, text styles and corner radii. Where the founder-provided brand list and Figma agree,
 * they are the same value; where Figma is more specific (neutrals, semantic reds, slate), Figma
 * wins per the Phase 1 source priority.
 *
 * Nothing here encodes business logic. Thresholds, durations and money are backend-owned.
 */

/** Founder-provided brand palette. All ten appear in the Figma. */
export const brand = {
  yellow600: '#ffd600',
  yellow500: '#ffde33',
  yellow400: '#ffe666',
  yellow300: '#ffef99',
  yellow200: '#fff7cc',
  lime600: '#cfff04',
  lime400: '#e2ff68',
  lime300: '#ecff9b',
  /** V12 `performance` tints, sampled from the section's own renders. */
  lime200: '#f0ffaf',
  lime100: '#f4ffc3',
  lime50: '#faffe8',
  yellow100: '#fffadf',
  black: '#000000',
  white: '#ffffff',
} as const;

/** Neutrals observed in the Figma, ordered light to dark. */
export const neutral = {
  cream: '#fffdf5',
  /**
   * Figma variable `color/black/ 70%` (`#000000b2`). The muted-copy colour on the Login flow —
   * over the flow's white background it resolves to `#4d4d4d`, which is what the V12 render
   * samples to. Kept as the translucent original so it composites correctly on any background.
   */
  black70: 'rgba(0, 0, 0, 0.7)',
  grey50: '#f9fafb',
  grey100: '#f3f4f6',
  grey300: '#cad5e2',
  grey400: '#a1a1a1',
  grey500: '#737373',
  grey900: '#171717',
  ink: '#0a0a0a',
} as const;

/** Semantic colours. `danger` is the countdown/late red used on both travel-risk states. */
export const semantic = {
  danger: '#ff0000',
  /**
   * `575:2138`'s absent disc (`#ff0909`). Very close to `danger` but not equal, and the two sit on
   * the same screen — the headline is `red` and the disc is `#ff0909` — so collapsing them would
   * paint one of the pair wrong.
   */
  dangerDisc: '#ff0909',
  /**
   * Figma variable `color/spring green/24`. The ONLY green in the V12 `performance` section: it
   * emphasises the backend-supplied bonus threshold inside `Bonus ke liye: N se zyada ghante
   * kaam`. Never used to signal success generally.
   */
  success: '#007a55',
  /**
   * Figma variable `color/spring green/30` (`#009966`). The `log in flow` check-in window row and
   * the present-verdict disc. Distinct from `success` (`#007a55`), which the `performance` section
   * uses for the bonus threshold; both greens appear in V13 and neither substitutes for the other.
   */
  springGreen30: '#009966',
  dangerDeep: '#e7000b',
  slate: '#0f172b',
  slate800: '#1e2939',
  slate900: '#101828',
} as const;

export const color = {
  ...brand,
  ...neutral,
  ...semantic,

  // Role aliases — prefer these in components so a palette change stays in one place.
  background: neutral.cream,
  surface: brand.white,
  surfaceMuted: neutral.grey50,
  textPrimary: neutral.ink,
  textSecondary: neutral.grey500,
  textMuted: neutral.grey400,
  accent: brand.yellow600,
  accentSoft: brand.yellow300,
  action: brand.lime600,
  actionSoft: brand.lime300,
  late: semantic.danger,
} as const;

/**
 * Livvic weight → bundled font family.
 *
 * The Figma uses exactly these five weights and no others (verified by walking every text style:
 * 400, 500, 600, 700, 900 — never 800). Each maps to a real bundled file, so no weight is
 * synthesised or substituted.
 */
export const fontFamily = {
  regular: 'Livvic-Regular',
  medium: 'Livvic-Medium',
  semibold: 'Livvic-SemiBold',
  bold: 'Livvic-Bold',
  black: 'Livvic-Black',
} as const;

export type FontWeightToken = keyof typeof fontFamily;

/** Font sizes present in the Figma. */
export const fontSize = {
  xxs: 9,
  xs: 10,
  s: 11,
  m: 12,
  /** `572:604` — the white note beside the check-in time. */
  md: 13,
  l: 14,
  xl: 16,
  xxl: 18,
  xxxl: 20,
  display: 24,
  displayLg: 30,
  displayXl: 36,
  hero: 50,
} as const;

/** Line heights, keyed to the size they pair with in the Figma. */
export const lineHeight = {
  xxs: 14,
  xs: 13,
  s: 16,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 28,
  xxxl: 28,
  display: 32,
  /** `505:1666` / `572:701` — the lime CTA sets 24px type on a 30px line, not the usual 32. */
  displayTight: 30,
  displayLg: 36,
  displayXl: 40,
  hero: 40,
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/**
 * Corner radii observed in the Figma. `full` stands in for Figma's fully-rounded sentinel
 * (which serialises as an absurd number), used for pills and circular avatars.
 */
export const radius = {
  xxs: 2,
  xs: 5,
  s: 7,
  sm: 8,
  m: 12,
  ml: 15,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 26,
  pill: 44,
  full: 999,
} as const;

export const iconSize = {
  xs: 10,
  s: 13,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 36,
  avatar: 42,
} as const;

/** Android elevation paired with an iOS-compatible shadow. */
export const shadow = {
  none: { elevation: 0 },
  card: {
    elevation: 2,
    shadowColor: color.black,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  raised: {
    elevation: 6,
    shadowColor: color.black,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
} as const;

/**
 * Figma frames are 390x830 with a 370-wide content column, i.e. a 10pt gutter each side.
 * `navHeight` is the fixed bottom nav (`nav.fixed`, 96 tall in Figma).
 */
export const layout = {
  designWidth: 390,
  designHeight: 830,
  contentWidth: 370,
  gutter: 10,
  navHeight: 96,
  bannerHeight: 74,
  minTouchTarget: 44,
} as const;

export const tokens = {
  color,
  brand,
  neutral,
  semantic,
  fontFamily,
  fontSize,
  lineHeight,
  spacing,
  radius,
  iconSize,
  shadow,
  layout,
} as const;

export type Tokens = typeof tokens;
