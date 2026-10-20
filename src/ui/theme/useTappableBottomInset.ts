import { useContext, useMemo } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { getTappableBottomInset } from '../../../modules/tappable-inset';

/**
 * Room the bottom of the screen must leave for the system's TAPPABLE navigation controls.
 *
 * `useSafeAreaInsets().bottom` is the wrong number for a bar that has to clear the buttons: under
 * gesture navigation it is still non-zero (the gesture-hint strip), so using it would move the bar
 * for gesture users. This is the 3-button panel's height and 0 under gestures.
 *
 * The safe-area bottom is read only to know WHEN to re-measure -- it changes when the user switches
 * navigation mode or rotates. The raw context is used rather than `useSafeAreaInsets` because that
 * hook throws outside a `SafeAreaProvider`, and this one has nothing to measure there anyway.
 */
export function useTappableBottomInset(): number {
  const safeAreaBottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `safeAreaBottom` is the re-measure trigger
  return useMemo(() => getTappableBottomInset(), [safeAreaBottom]);
}

/**
 * What is left of the bottom safe-area inset once `BottomNav` has cleared the tappable controls.
 *
 * A screen that pads itself by `insets.bottom` AND draws `BottomNav` clears the 3-button panel
 * twice: the bar adds the panel's height and the screen pads by it again, which floats the bar
 * about 135px (one panel) above where it belongs. Under gestures the tappable inset is 0, so this
 * is the whole safe-area bottom and nothing changes there.
 */
export function bottomInsetBelowNav(safeAreaBottom: number, tappableBottom: number): number {
  return Math.max(0, safeAreaBottom - tappableBottom);
}

/** `bottomInsetBelowNav` for the current window, for screens that draw `BottomNav` themselves. */
export function useBottomInsetBelowNav(): number {
  const safeAreaBottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return bottomInsetBelowNav(safeAreaBottom, useTappableBottomInset());
}
