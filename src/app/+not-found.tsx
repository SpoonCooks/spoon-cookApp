import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, spacing, Text } from '@ui';

export default function NotFoundScreen(): React.ReactElement {
  return (
    <View style={styles.container} testID="not-found">
      <Text variant="headingLg" align="center">
        Yeh page nahi mila
      </Text>
      <Button label="Jobs pe wapas jaye" tone="dark" onPress={() => router.replace('/jobs')} />
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
