import { bottomInsetBelowNav } from '../ui/theme/useTappableBottomInset';

/**
 * A screen that draws `BottomNav` pads only by what the bar has not already cleared, so the 3-button
 * panel is not cleared twice. Numbers are the SM-G991B's: 135px panel in 3-button mode, 42px
 * gesture-hint strip (and 0 tappable) in gesture mode.
 */
describe('bottomInsetBelowNav', () => {
  it('pads nothing in 3-button mode, where the bar already clears the whole panel', () => {
    expect(bottomInsetBelowNav(135, 135)).toBe(0);
  });

  it('keeps the whole safe-area bottom in gesture mode, where nothing is tappable', () => {
    expect(bottomInsetBelowNav(42, 0)).toBe(42);
  });

  it('is unchanged when the native module is absent (tappable inset 0)', () => {
    expect(bottomInsetBelowNav(135, 0)).toBe(135);
  });

  it('never goes negative when the tappable inset exceeds the safe-area bottom', () => {
    expect(bottomInsetBelowNav(100, 135)).toBe(0);
    expect(bottomInsetBelowNav(0, 40)).toBe(0);
  });
});
