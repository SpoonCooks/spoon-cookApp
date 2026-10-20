import { requireOptionalNativeModule } from 'expo';

interface TappableInsetNative {
  getBottom(): number;
}

/** `null` on iOS, in jest, and in any binary built before this module existed. */
const native = requireOptionalNativeModule<TappableInsetNative>('TappableInset');

/** Bottom inset (dp) of the system's tappable controls: the 3-button panel, never the gesture strip. */
export function getTappableBottomInset(): number {
  return native?.getBottom() ?? 0;
}
