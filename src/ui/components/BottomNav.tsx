import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { useDesignScale } from '../theme/designScale';
import { Text } from '../primitives/Text';
import { color, dropShadow } from '../theme/tokens';

/**
 * The V14 five-tab bottom navigation (`634:2478` and its 32 siblings).
 *
 * ## Why this replaces the V13 tab bar wholesale
 *
 * V13 had no designed bottom nav: `(tabs)/_layout.tsx` drew React Navigation's default bar with
 * four `Ionicons` glyphs, because no V13 frame contained one. V14 adds a real one to **33 of the
 * 47 frames** and it is the single largest change in the revision — fourteen carried-over screens
 * are exactly 68 units taller than their V13 selves and otherwise identical.
 *
 * It is a fifth destination as well as a redraw: `Niyam` is new, and it is what makes the `Info`
 * section (`611:398`) reachable at all.
 *
 * ## Geometry
 *
 * The bar is **68 units** tall: a 52-unit row inside 8 units of vertical padding. On a 370-unit
 * column the arithmetic closes exactly, which is why the tab width is derived rather than stated:
 *
 *     370 - 2*16 (outer) - 2*4 (inner) = 330      (330 - 4*10 gaps) / 5 = 58 per tab
 *
 * and Figma reports each tab frame as exactly `58 x 52`.
 *
 * ## The icons are the exported Figma bitmaps
 *
 * All five are raster PNGs in the design, not vectors — `download_assets` returns no SVG for any
 * nav node. `@expo/vector-icons` has near-equivalents for several of them (a check, a chef's hat,
 * a calendar), but substituting one would put artwork on screen that the design does not contain,
 * so the exported bytes are used and committed.
 *
 * Each glyph is drawn `contain` into the full 50x26 icon box: the five bitmaps do not share an
 * aspect ratio, so `contain` is what keeps every one of them whole. The box is `50` because the
 * tab is `58` wide with `4` of padding either side.
 *
 * Both the box and the image state that size in NUMBERS, and they have to — see `iconBox` below.
 */

/** The five destinations, in the order V14 draws them left to right. */
export type BottomNavTab = 'hazri' | 'kaam' | 'chutti' | 'kamai' | 'niyam';

interface TabSpec {
  readonly id: BottomNavTab;
  readonly label: string;
  readonly icon: ImageSourcePropType;
}

const TABS: readonly TabSpec[] = [
  {
    id: 'hazri',
    label: 'Hazri',
    icon: require('@/assets/images/figma-v14/nav-hazri.png') as ImageSourcePropType,
  },
  {
    id: 'kaam',
    label: 'Kaam',
    icon: require('@/assets/images/figma-v14/nav-kaam.png') as ImageSourcePropType,
  },
  {
    id: 'chutti',
    label: 'Chutti',
    icon: require('@/assets/images/figma-v14/nav-chutti.png') as ImageSourcePropType,
  },
  {
    id: 'kamai',
    label: 'Kamai',
    icon: require('@/assets/images/figma-v14/nav-kamai.png') as ImageSourcePropType,
  },
  {
    id: 'niyam',
    label: 'Niyam',
    icon: require('@/assets/images/figma-v14/nav-niyam.png') as ImageSourcePropType,
  },
];

/** Design-space geometry, transcribed from `634:2478`. */
const NAV = {
  /** Total bar height: `52` row + `8` padding top and bottom. */
  height: 68,
  rowHeight: 52,
  paddingH: 16,
  paddingV: 8,
  innerPaddingH: 4,
  gap: 10,
  tabPadding: 4,
  tabRadius: 5,
  /** The glyph box: the tab's `58` less `4` of padding either side. */
  iconWidth: 50,
  iconHeight: 26,
  labelGap: 2,
} as const;

export interface BottomNavProps {
  /** Which destination is highlighted. `null` renders the bar with no active tab. */
  readonly active: BottomNavTab | null;
  readonly onSelect?: ((tab: BottomNavTab) => void) | undefined;
  readonly testID?: string | undefined;
}

export function BottomNav({ active, onSelect, testID }: BottomNavProps): React.ReactElement {
  const { s } = useDesignScale();

  return (
    <View
      style={[styles.bar, { paddingHorizontal: s(NAV.paddingH), paddingVertical: s(NAV.paddingV) }]}
      testID={testID}
    >
      <View
        style={[
          styles.row,
          { height: s(NAV.rowHeight), paddingHorizontal: s(NAV.innerPaddingH), gap: s(NAV.gap) },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              onPress={onSelect ? () => onSelect(tab.id) : undefined}
              style={[
                styles.tab,
                {
                  padding: s(NAV.tabPadding),
                  borderRadius: s(NAV.tabRadius),
                  gap: s(NAV.labelGap),
                },
                isActive && styles.tabActive,
              ]}
              testID={`bottom-nav-${tab.id}`}
            >
              <View
                style={[styles.iconBox, { width: s(NAV.iconWidth), height: s(NAV.iconHeight) }]}
              >
                <Image
                  source={tab.icon}
                  style={{ width: s(NAV.iconWidth), height: s(NAV.iconHeight) }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>
              <View style={styles.labelBox}>
                <Text variant="navLabel" align="center" numberOfLines={1}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Design-space height of the bar, for screens that must reserve room for it. */
export const BOTTOM_NAV_HEIGHT = NAV.height;

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
    /**
     * The design's `0 0 1px rgba(0,0,0,0.15)` ambient edge, drawn upward.
     *
     * V14 is not consistent about the offset — `Service flow` and `job flow` author it as
     * `0px 0px 1px` and `performance` and `leave` as `0px -1px 1px` — so the upward form is used
     * for all of them, which is the one that reads as a bar edge. Android draws nothing either
     * way: `dropShadow` returns `{}` there because `boxShadow` composites over the fill and tints
     * it, which costs far more than the missing one-pixel edge.
     */
    ...dropShadow(1, 0.15, -1),
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: color.white,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** `634:2484` — the active destination's `#ffef99` pill. */
  tabActive: { backgroundColor: color.yellow300 },
  /**
   * The glyph box carries an explicit size, and that is not a stylistic preference.
   *
   * The design writes this `<img>` as `absolute inset-0 object-contain size-full` inside a
   * `w-full` box, and the first port took it literally: `alignSelf: 'stretch'` for the box and
   * `StyleSheet.absoluteFill` for the image. On device all five glyphs rendered BLANK while the
   * labels and the `#ffef99` pill drew perfectly — so the bar looked finished in review, and only
   * a diff against the reference showed the icons were missing.
   *
   * The box collapses. Nothing is left in its flow once the image is positioned absolutely, so it
   * measures to zero width and an absolutely-inset child of a zero-width box paints nothing. The
   * label box survives the same `alignSelf` only because a `Text` gives it something to measure.
   *
   * `50 x 26` is the box the design draws, said in numbers that cannot collapse to nothing.
   */
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
