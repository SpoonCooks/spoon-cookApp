import { Image, Pressable, StyleSheet, View } from 'react-native';

import { color, dropShadow } from '../theme/tokens';
import { useDesignScale } from '../theme/designScale';
import { Text } from '../primitives/Text';

/**
 * The yellow WhatsApp help button, in the two sizes V13 ships it in.
 *
 * `full` (`571:584`, `592:484`) is the 98x35 pill on a screen's top nav. `compact` (`528:669`) is
 * the 73x25.3 version inside a bottom-sheet header, which is not a scaled-down `full`: it sets
 * 12px type on a 15.2 line and positions both children absolutely, so it is transcribed rather
 * than derived.
 *
 * The glyph is the exported Figma bitmap. `@expo/vector-icons` ships a WhatsApp mark but it is a
 * different drawing, and substituting it would put artwork on screen that the design does not
 * contain.
 */
export interface HelpPillProps {
  readonly size?: 'full' | 'compact' | undefined;
  readonly onPress?: (() => void) | undefined;
  readonly testID?: string | undefined;
}

const FULL = {
  width: 98,
  height: 35,
  radius: 16,
  paddingH: 8,
  labelWidth: 48,
  glyph: 28,
} as const;

const COMPACT = {
  width: 73,
  height: 25.335,
  radius: 16,
  labelLeft: 0,
  labelTop: 3,
  labelBottom: 2.33,
  labelWidth: 48,
  glyphLeft: 45,
  glyphWidth: 22,
  glyphHeight: 25,
} as const;

const whatsAppGlyph = require('@/assets/images/figma-v13/whats-app.png');

export function HelpPill({ size = 'full', onPress, testID }: HelpPillProps): React.ReactElement {
  const { s } = useDesignScale();

  if (size === 'compact') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Help"
        onPress={onPress}
        style={[
          styles.pill,
          {
            width: s(COMPACT.width),
            height: s(COMPACT.height),
            borderRadius: s(COMPACT.radius),
          },
        ]}
        testID={testID}
      >
        <Text
          variant="helpPill"
          align="center"
          style={{
            position: 'absolute',
            left: s(COMPACT.labelLeft),
            top: s(COMPACT.labelTop),
            width: s(COMPACT.labelWidth),
          }}
        >
          Help
        </Text>
        <Image
          source={whatsAppGlyph}
          style={{
            position: 'absolute',
            left: s(COMPACT.glyphLeft),
            top: 0,
            width: s(COMPACT.glyphWidth),
            height: s(COMPACT.glyphHeight),
          }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Help"
      onPress={onPress}
      style={[
        styles.pill,
        styles.fullRow,
        {
          width: s(FULL.width),
          height: s(FULL.height),
          borderRadius: s(FULL.radius),
          paddingHorizontal: s(FULL.paddingH),
        },
      ]}
      testID={testID}
    >
      <Text variant="title" align="center" style={{ width: s(FULL.labelWidth) }}>
        Help
      </Text>
      <Image
        source={whatsAppGlyph}
        style={{ width: s(FULL.glyph), height: s(FULL.glyph) }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}

/**
 * `592:480` / `597:1145` — the full-width top nav: a Livvic Black title left, the help pill right.
 *
 * `titleVariant` exists because V14 splits the title size by section: `leave` keeps 20/28
 * (`headingLg`) while `Service flow`, `job flow` and `Info` set 24/30 (`screenTitle`). The bar
 * itself is identical in both, so the size is a prop rather than a second component.
 */
export function TopNavBar({
  title,
  titleVariant = 'headingLg',
  onHelp,
  testID,
}: {
  title: string;
  titleVariant?: 'headingLg' | 'screenTitle' | undefined;
  onHelp?: (() => void) | undefined;
  testID?: string | undefined;
}): React.ReactElement {
  const { s } = useDesignScale();
  return (
    <View
      style={[styles.nav, { paddingHorizontal: s(20), paddingVertical: s(6), height: s(47) }]}
      testID={testID}
    >
      <View style={{ width: s(179) }}>
        <Text variant={titleVariant} testID="leave-nav-title">
          {title}
        </Text>
      </View>
      <HelpPill onPress={onHelp} testID="leave-nav-help" />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: color.yellow600,
    /**
     * The design's `0 0 2px rgba(0,0,0,0.15)` drawn as a real platform shadow, NOT as `boxShadow`.
     *
     * React Native's `boxShadow` composites over the view on Android instead of behind it: it
     * darkened the whole pill from the design's `#ffd600` to `#ecc600` — a uniform x0.925 on both
     * channels, measured across the entire fill — while leaving almost no shadow outside, where
     * the reference render actually has one. Elevation puts the shadow where it belongs and leaves
     * the fill alone; `shadowColor`/`shadowOpacity` carry the same intent on iOS.
     */
    ...dropShadow(2, 0.15),
  },
  fullRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: color.white,
  },
});
