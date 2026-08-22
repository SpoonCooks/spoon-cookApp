import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { color, spacing } from '../theme/tokens';
import { Text } from '../primitives/Text';
import { Button } from './Button';

/**
 * Loading / error / empty projections.
 *
 * These exist so no screen silently renders a blank body, and — critically — so a failed request
 * NEVER falls back to placeholder content. A cook seeing an invented job would act on it.
 * The error state offers a retry and says plainly that nothing could be loaded.
 */

export function LoadingState({
  testID = 'state-loading',
}: {
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.container} testID={testID} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={color.black} />
    </View>
  );
}

export interface ErrorStateProps {
  /** Hinglish, matching the app's UI language. */
  readonly message?: string;
  readonly onRetry?: () => void;
  readonly testID?: string;
}

export function ErrorState({
  message = 'Kuch gadbad ho gayi. Firse koshish kare.',
  onRetry,
  testID = 'state-error',
}: ErrorStateProps): React.ReactElement {
  return (
    <View style={styles.container} testID={testID} accessibilityRole="alert">
      <Text variant="body" align="center" color={color.textSecondary}>
        {message}
      </Text>
      {onRetry !== undefined && (
        <Button
          label="Firse koshish kare"
          tone="dark"
          fullWidth={false}
          onPress={onRetry}
          testID="state-error-retry"
        />
      )}
    </View>
  );
}

export function EmptyState({
  message,
  testID = 'state-empty',
}: {
  message: string;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.container} testID={testID}>
      <Text variant="body" align="center" color={color.textSecondary}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.l,
  },
});
