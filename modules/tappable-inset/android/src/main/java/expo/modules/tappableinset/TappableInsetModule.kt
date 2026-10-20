package expo.modules.tappableinset

import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The bottom inset the system's TAPPABLE navigation controls occupy, in dp.
 *
 * Not the same as the `navigationBars` inset that react-native-safe-area-context reports. With
 * 3-button navigation both are the button panel's height. With gesture navigation `navigationBars`
 * still reports the gesture-hint strip, but nothing there is tappable, so this is 0 -- which is
 * what lets the tab bar clear the buttons without moving at all under gestures.
 */
class TappableInsetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TappableInset")

    Function("getBottom") {
      val activity = appContext.currentActivity ?: return@Function 0.0
      val insets = ViewCompat.getRootWindowInsets(activity.window.decorView)
        ?: return@Function 0.0
      val px = insets.getInsets(WindowInsetsCompat.Type.tappableElement()).bottom
      (px / activity.resources.displayMetrics.density).toDouble()
    }
  }
}
