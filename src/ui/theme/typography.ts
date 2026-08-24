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
  /**
   * `528:663` / `528:608` — `Pakka`. Same metrics as `actionLabel` but with NO tracking: the
   * `log in flow` CTAs set 1 unit, the leave sheets set none, and sharing one variant would put a
   * unit of drift into every character of a centred button label.
   */
  actionLabelPlain: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.display,
    lineHeight: lineHeight.displayTight,
    color: color.textPrimary,
  },
  /** `526:338` / `528:656` — `CHUTTI LAGAYE`. Livvic Black 20 on a 20 line, 1 unit of tracking. */
  overlineXl: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.l,
    letterSpacing: 1,
    color: color.textPrimary,
  },
  /** `528:469` — `AAJ KA BREAK`. Livvic Black 18 on a 20 line, 1 unit of tracking. */
  overlineLg: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.l,
    letterSpacing: 1,
    color: color.textPrimary,
  },
  /** `528:475` — the break window times. Livvic Bold 18 on a 28 line, wider than `heading`. */
  timeStrong: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    color: color.textPrimary,
  },
  /** `528:391` / `528:458` — the `Chutti` chip and `Dates chunein`. Livvic Black 20 on a 25 line. */
  chipLabel: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.chip,
    color: color.textPrimary,
  },
  /**
   * `434:2934` / `502:198` — a `performance` period tab (`Aaj` / `Cycle` / `Mahina`). Livvic
   * Black 16 on a 24 line with **negative** tracking; the design tightens this one label rather
   * than the sub-line under it, so the two cannot share a variant.
   */
  tabLabel: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    letterSpacing: -0.4,
    color: color.textPrimary,
  },
  /** `491:5161` / `502:199` — the `1 din` / `7 din` / `28 din` line under a period tab. Bold 14/20. */
  tabSubLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.l,
    lineHeight: lineHeight.l,
    color: color.black80,
  },
  /**
   * `434:2892` / `537:732` — `Bonus ke liye: N se zyada …`. Livvic Black **11** on a 16.5 line,
   * the smallest Black run in the section. Shares its metrics with `calendarDay` and is kept
   * separate because the two carry different node provenance and would drift independently.
   */
  bonusHint: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.s,
    lineHeight: lineHeight.dayCell,
    color: color.textPrimary,
  },
  /**
   * `532:93` / `532:98` / `540:123` — the unit word beside a large numeral (`ghante`, `mins`,
   * `Kamai:`). Livvic SemiBold **16** on a 16 line: the design sets a line box equal to the type
   * so the word sits on the numeral's baseline rather than below it.
   */
  unitLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.s,
    color: color.textPrimary,
  },
  /** `502:631` — a past-cycle row title, `18 Jul - 21 Jul`. Black 18/28, tracking `-0.45`. */
  cycleRowTitle: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    letterSpacing: -0.45,
    color: color.textPrimary,
  },
  /** `505:1702` — a calendar day. Livvic Black 11 on a 16.5 line. */
  calendarDay: {
    fontFamily: fontFamily.black,
    fontSize: fontSize.s,
    lineHeight: lineHeight.dayCell,
    color: color.textPrimary,
  },
  /** `528:670` — the compact Help pill in a sheet header. Livvic Bold 12 on a 15.2 line. */
  helpPill: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.m,
    lineHeight: lineHeight.helpPill,
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
