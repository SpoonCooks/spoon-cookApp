import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader, Text, color, figmaStroke, useDesignScale } from '@ui';

/**
 * PROFILE — `707:1534`.
 *
 * One card, centred, carrying the three facts a cook needs to check that the app is signed in as
 * HER: her name, the number she signs in with, and the hub she is assigned to.
 *
 * ## Why there is nothing else on it
 *
 * The frame draws no edit control, no rating, no shift and no logout, so none is added here. A
 * cook cannot change her own name, number or hub — every one of those is an audited admin
 * operation (`/v1/admin/cooks/:id/profile`, `/phone`, `/hub`), and an input that could not
 * submit anywhere is the dead control the brief forbids.
 *
 * ## The hub line
 *
 * The frame's placeholder reads `Hub id`, which is a label, not a value a cook could act on. She
 * knows her hub by its NAME — the same string the admin surface and the dispatcher use — so the
 * card prints that. A cook with no hub assigned yet (the state a QA login is deliberately left
 * in) has no hub line at all rather than an empty row or a fabricated one.
 */

/** `707:1538` — the bordered card, 338 wide and 176 tall, at 16 from the gutter. */
const CARD = { width: 338, minHeight: 176, radius: 16, borderWidth: 1, padding: 17 } as const;

/** `707:1540` — the 50-unit avatar disc with its 40-unit glyph. */
const AVATAR = { size: 50, glyph: 40 } as const;

/** `707:1543` — the name/phone/hub block: 28 to the name, then 16-unit lines. */
const DETAILS = { gapAfterAvatar: 12, lineGap: 10 } as const;

const customerGlyph = require('@/assets/images/figma-v13/customer.png');

export interface ProfileViewProps {
  readonly name: string;
  /** The number this session signs in with, pre-formatted by the caller. */
  readonly phone: string;
  /** The assigned hub's name, or null when the cook has no hub. */
  readonly hubName: string | null;
  readonly onBack: () => void;
}

export function ProfileView({
  name,
  phone,
  hubName,
  onBack,
}: ProfileViewProps): React.ReactElement {
  const scale = useDesignScale();
  const { s } = scale;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen} testID="profile-screen">
      <View style={{ height: insets.top }} />
      <BackHeader title="Profile" onBack={onBack} testID="profile-back" />

      {/* The card is centred in the space between the header and the tab bar, which is what
          puts it mid-screen on the frame rather than under the header. */}
      <View style={styles.body}>
        <View
          style={[
            styles.card,
            figmaStroke(scale, { width: CARD.borderWidth, padding: CARD.padding }),
            {
              width: s(CARD.width),
              minHeight: s(CARD.minHeight),
              borderRadius: s(CARD.radius),
              gap: s(DETAILS.gapAfterAvatar),
            },
          ]}
          testID="profile-card"
        >
          <View
            style={[
              styles.avatar,
              { width: s(AVATAR.size), height: s(AVATAR.size), borderRadius: s(AVATAR.size) },
            ]}
          >
            <Image
              source={customerGlyph}
              style={{ width: s(AVATAR.glyph), height: s(AVATAR.glyph) }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>

          <View style={[styles.details, { gap: s(DETAILS.lineGap) }]}>
            <Text variant="headingLgBold" align="center" testID="profile-name">
              {name}
            </Text>
            <Text variant="title" align="center" color={color.black70} testID="profile-phone">
              {phone}
            </Text>
            {hubName !== null && (
              <Text variant="title" align="center" color={color.black70} testID="profile-hub">
                {hubName}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.white },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { alignItems: 'center', justifyContent: 'center', borderColor: color.yellow600 },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: color.yellow400,
  },
  details: { alignSelf: 'stretch', alignItems: 'center' },
});
