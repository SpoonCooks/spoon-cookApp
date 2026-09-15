import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackHeader, Button, ConfirmSheet, Text, color, figmaStroke, useDesignScale } from '@ui';

import { formatRequestedOn } from './profileModel';

/**
 * PROFILE — `707:1534`, plus the account actions the frame does not draw.
 *
 * One card, centred, carrying the three facts a cook needs to check that the app is signed in as
 * HER: her name, the number she signs in with, and the hub she is assigned to. Below it, the two
 * things she is allowed to do to the account itself.
 *
 * ## Why there is still no edit control
 *
 * A cook cannot change her own name, number or hub — every one of those is an audited admin
 * operation (`/v1/admin/cooks/:id/profile`, `/phone`, `/hub`), and an input that could not submit
 * anywhere is the dead control the brief forbids. That rule is unchanged.
 *
 * ## Why Logout and Delete are here anyway, with no frame behind them
 *
 * Both are store requirements rather than design requests: Play will not list an app that signs a
 * person in and offers no way out, and it requires an in-app route to account deletion. There is
 * no V13/V15 frame for either, so the geometry follows the card's own gutter and the palette uses
 * tints already observed elsewhere in the Figma rather than inventing a colour.
 *
 * ## Delete does not delete
 *
 * `POST /cook/account/deletion-request` only records a request for Ops (see `requestAccountDeletion`).
 * The copy on both the row and the sheet says exactly that, because a cook who reads "deleted" and
 * then finds herself still assigned to tomorrow's booking has been lied to by her own app.
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

/**
 * The account block, which has no frame: the rows take the CARD's width and gutter so the column
 * reads as one, and sit 24 above the home indicator.
 */
const ACCOUNT = { rowGap: 10, gutterBottom: 24, rowPadding: 14, radius: 16 } as const;

const customerGlyph = require('@/assets/images/figma-v13/customer.png');

/** Which confirmation is open. Only one can be, so one value carries it. */
export type ProfileSheet = 'none' | 'logout' | 'delete';

/**
 * The account block's whole contract.
 *
 * Visibility, busy and error live with the ROUTE rather than in this view, because all three are
 * owned by the mutation that is running: only the route knows whether a confirmed action
 * succeeded, and therefore whether the sheet should close or stay open holding a reason.
 *
 * One `busy` and one `errorMessage` for both actions, not two of each — a cook can only have one
 * of these in flight at a time, and a second pair would be state that can never differ.
 */
export interface ProfileAccountProps {
  /** `deletionRequest.requestedAt` from `GET /cook/me`, or null when no request is open. */
  readonly deletionRequestedAt: string | null;
  readonly sheet: ProfileSheet;
  readonly busy: boolean;
  readonly errorMessage: string | null;
  readonly onOpenSheet: (sheet: Exclude<ProfileSheet, 'none'>) => void;
  readonly onCloseSheet: () => void;
  /** Runs whichever action the open sheet confirms. */
  readonly onConfirm: () => void;
}

export interface ProfileViewProps {
  readonly name: string;
  /** The number this session signs in with, pre-formatted by the caller. */
  readonly phone: string;
  /** The assigned hub's name, or null when the cook has no hub. */
  readonly hubName: string | null;
  readonly onBack: () => void;
  /**
   * Omitted entirely by a caller that only wants the identity card — the dev gallery, and the
   * tests that assert what the card states. A screen with no account block draws no rows rather
   * than drawing inert ones.
   */
  readonly account?: ProfileAccountProps;
}

export function ProfileView({
  name,
  phone,
  hubName,
  onBack,
  account,
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

      {account !== undefined && (
        <View
          style={[
            styles.account,
            {
              width: s(CARD.width),
              gap: s(ACCOUNT.rowGap),
              paddingBottom: s(ACCOUNT.gutterBottom) + insets.bottom,
            },
          ]}
          testID="profile-account"
        >
          <Button
            label="Logout"
            tone="ghost"
            style={styles.logoutRow}
            onPress={() => {
              account.onOpenSheet('logout');
            }}
            testID="profile-logout"
          />

          {account.deletionRequestedAt === null ? (
            <Button
              /*
               * The full instruction, restored.
               *
               * This read `Account delete` for a while: at the row's width the longer string
               * overflowed the Button's content box, and Fabric resolved that by dropping the
               * trailing word — no wrap, no ellipsis, no warning, and the label visibly off-centre
               * because the box had been measured for the whole string. Shortening the copy was
               * the workaround; `Button` now shrinks a label that does not fit instead of losing
               * a word of it, so the workaround can go and the row can say what it means.
               */
              label="Account delete kare"
              tone="ghost"
              style={styles.deleteRow}
              onPress={() => {
                account.onOpenSheet('delete');
              }}
              testID="profile-delete"
            />
          ) : (
            /* Not a disabled Button: a greyed-out control invites a cook to keep pressing it, and
               the server would accept every press as the same no-op. The row states the fact
               instead, which is the only thing left to say until Ops acts. */
            <View
              style={[styles.pendingRow, { borderRadius: s(ACCOUNT.radius) }]}
              testID="profile-delete-pending"
            >
              <Text variant="bodyStrong" align="center" testID="profile-delete-pending-title">
                Delete request bheji gayi
              </Text>
              <Text
                variant="caption"
                align="center"
                color={color.black70}
                testID="profile-delete-pending-note"
              >
                {pendingNote(account.deletionRequestedAt)}
              </Text>
            </View>
          )}
        </View>
      )}

      {account !== undefined && (
        <>
          <ConfirmSheet
            visible={account.sheet === 'logout'}
            title="Logout kare?"
            message="Aap is phone se nikal jayenge. Wapas aane ke liye OTP se login karna hoga."
            confirmLabel="Haan, logout kare"
            busy={account.busy}
            errorMessage={account.errorMessage}
            onConfirm={account.onConfirm}
            onCancel={account.onCloseSheet}
            testID="profile-logout-sheet"
          />
          <ConfirmSheet
            visible={account.sheet === 'delete'}
            tone="danger"
            title="Account delete kare?"
            message={
              'Aapka request Spoon team ko jayega. Team review karegi — tab tak aapka kaam, hazri ' +
              'aur kamai waise hi chalte rahenge. Approve hone ke baad account wapas nahi milega.'
            }
            confirmLabel="Haan, request bheje"
            busy={account.busy}
            errorMessage={account.errorMessage}
            onConfirm={account.onConfirm}
            onCancel={account.onCloseSheet}
            testID="profile-delete-sheet"
          />
        </>
      )}
    </View>
  );
}

/** The pending line's second row. Without a parsable date it still states that a request is open. */
function pendingNote(requestedAt: string): string {
  const on = formatRequestedOn(requestedAt);
  const review = 'Spoon team review kar rahi hai.';
  return on === null ? review : `${on} · ${review}`;
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
  account: { alignSelf: 'center' },
  /**
   * `yellow300` and `dangerSoft` are both tints the Figma already uses elsewhere in this app.
   * Nothing here is copied from the Customer App's own Account screen: that screen's inspector
   * values belong to a different design system, and a colour with no frame behind it is better
   * borrowed from this app's palette than imported from another's.
   */
  logoutRow: { backgroundColor: color.yellow300, borderRadius: 16, minHeight: 46 },
  deleteRow: { backgroundColor: color.dangerSoft, borderRadius: 16, minHeight: 46 },
  pendingRow: {
    backgroundColor: color.dangerTint,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
