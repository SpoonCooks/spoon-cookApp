import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, radius, spacing } from '../theme/tokens';
import { Text } from '../primitives/Text';
import { Button } from './Button';

/**
 * A two-choice confirmation, anchored to the bottom of the screen.
 *
 * The app's first `Modal`. It exists for the two account actions on Profile — leaving the session
 * and asking to be deleted — because both are things a cook cannot undo from inside the app: a
 * logout costs her an OTP to come back, and a deletion request goes to a queue she cannot see.
 *
 * ## Why the destructive choice is on the right, and never the default
 *
 * Both buttons are full-width rows rather than a side-by-side pair, because Hinglish labels do not
 * shorten to fit a half-width button the way "Yes"/"No" do, and a truncated confirmation is a
 * confirmation nobody can read. `Nahi` is drawn first and is the one a mis-tap reaches.
 *
 * ## Dismissal
 *
 * Backdrop and Android back both cancel — but only while nothing is in flight. A cook who taps
 * outside while the deletion request is on the wire would otherwise close the sheet without ever
 * learning whether it landed.
 */

export type ConfirmSheetTone = 'neutral' | 'danger';

export interface ConfirmSheetProps {
  readonly visible: boolean;
  readonly title: string;
  /** Hinglish, matching the app's UI language. */
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: ConfirmSheetTone;
  /** The confirmed action is on the wire: both choices are inert and the CTA spins. */
  readonly busy?: boolean;
  /** Shown in place of nothing when the action failed. The sheet stays open so it can be read. */
  readonly errorMessage?: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly testID?: string;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Nahi',
  tone = 'neutral',
  busy = false,
  errorMessage = null,
  onConfirm,
  onCancel,
  testID = 'confirm-sheet',
}: ConfirmSheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const dismiss = (): void => {
    if (!busy) onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop} testID={`${testID}-backdrop`}>
        {/* Absolute rather than wrapping the sheet: a parent Pressable would swallow the taps
            meant for the buttons inside it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={cancelLabel}
          onPress={dismiss}
        />

        <View
          style={[styles.sheet, { paddingBottom: spacing.xxl + insets.bottom }]}
          testID={testID}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Text variant="headingLgBold" testID={`${testID}-title`}>
            {title}
          </Text>
          <Text variant="body" color={color.black70} testID={`${testID}-message`}>
            {message}
          </Text>

          {errorMessage !== null && (
            <Text variant="body" color={color.danger} testID={`${testID}-error`}>
              {errorMessage}
            </Text>
          )}

          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              tone="ghost"
              disabled={busy}
              onPress={onCancel}
              testID={`${testID}-cancel`}
              style={styles.cancel}
            />
            <Button
              label={confirmLabel}
              tone={tone === 'danger' ? 'danger' : 'dark'}
              loading={busy}
              onPress={onConfirm}
              testID={`${testID}-confirm`}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    backgroundColor: color.white,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    gap: spacing.m,
  },
  actions: { gap: spacing.s, paddingTop: spacing.s },
  cancel: { borderWidth: 1, borderColor: color.grey300 },
});
