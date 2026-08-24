import type { TextStyle } from 'react-native';

import { color, fontFamily, fontSize, lineHeight } from './tokens';

/**
 * Named text styles, derived from the size/weight/line-height combinations that actually occur in
 * the Cook App Figma. Components should use these rather than assembling font props ad hoc, so
 * the Hinglish copy renders consistently and long strings wrap predictably.
 */
export const textStyle = {
  /** Big countdown numerals — `26 mins`, `-2 mins`, `37 mins`. */
  hero: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.hero,
    lineHeight: lineHeight.hero,
    color: color.textPrimary,
  },
  displayXl: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.displayXl,
    lineHeight: lineHeight.displayXl,
    color: color.textPrimary,
  },
  /** Money totals — `₹35,739`. */
  displayLg: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.displayLg,
    lineHeight: lineHeight.displayLg,
    color: color.textPrimary,
  },
  display: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.display,
    lineHeight: lineHeight.display,
    color: color.textPrimary,
  },
  /**
   * `505:1666` / `572:701` — the lime call to action on the `log in flow` frames. Livvic Black
   * 24 on a 30 line with 1 unit of tracking; the design sets a tighter line than `display`.
   */
  actionLabel: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.display,
    lineHeight: lineHeight.displayTight,
    letterSpacing: 1,
    color: color.textPrimary,
  },
  /**
   * `523:14` / `526:299` / `525:223` — the red uppercase headline inside the attendance card.
   * Same metrics as `bodyStrong`, plus the 1-unit tracking the design sets on it.
   */
  overline: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.l,
    lineHeight: lineHeight.l,
    letterSpacing: 1,
    color: color.textPrimary,
  },
  /**
   * `571:601` — the shift pill. Livvic SemiBold 20 on a **16** line: the design deliberately sets
   * a line box shorter than the type so the pill stays 32 units tall.
   */
  pillLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.s,
    color: color.textPrimary,
  },
  /** `572:604` — the small white note beside the check-in time. Livvic SemiBold 13/16. */
  noteMuted: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    lineHeight: lineHeight.s,
    color: color.textPrimary,
  },
  /** Screen headings — `Namaste, Rekha`, `OTP verification`. */
  headingLg: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.xxxl,
    color: color.textPrimary,
  },
  headingLgBold: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.xxxl,
    color: color.textPrimary,
  },
  /** Prompt lines — `Chalna shuru kar dein`, `Customer se OTP mange`. */
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    color: color.textPrimary,
  },
  headingBlack: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    color: color.textPrimary,
  },
  titleBlack: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    color: color.textPrimary,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    color: color.textPrimary,
  },
  bodyStrong: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.l,
    lineHeight: lineHeight.l,
    color: color.textPrimary,
  },
  body: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.l,
    lineHeight: lineHeight.l,
    color: color.textPrimary,
  },
  bodyMuted: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.l,
    lineHeight: lineHeight.s,
    color: color.textSecondary,
  },
  /** Card meta — `1.5 hrs`, `Building/ Society`. */
  captionStrong: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.m,
    lineHeight: lineHeight.m,
    color: color.textPrimary,
  },
  caption: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.m,
    lineHeight: lineHeight.m,
    color: color.textPrimary,
  },
  captionMuted: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.m,
    lineHeight: lineHeight.m,
    color: color.textSecondary,
  },
  captionRegular: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.m,
    lineHeight: lineHeight.m,
    color: color.textSecondary,
  },
  /** Badges — `RUNNING LATE`, nav labels. */
  labelStrong: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.s,
    lineHeight: lineHeight.s,
    color: color.textPrimary,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.s,
    lineHeight: lineHeight.s,
    color: color.textSecondary,
  },
  micro: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: color.textPrimary,
  },
  microRegular: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    lineHeight: lineHeight.xxs,
    color: color.textSecondary,
  },
} as const satisfies Record<string, TextStyle>;

export type TextStyleToken = keyof typeof textStyle;
