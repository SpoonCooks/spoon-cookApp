package expo.modules.smsuserconsent

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Google's SMS User Consent API: the one-tap "Allow Spoon to read this message?" sheet other apps
 * show for an OTP.
 *
 * Chosen over the SMS Retriever API because Retriever needs the sender to append an 11-character
 * app hash to every message; User Consent works with the SMS the backend already sends. It only
 * ever sees the ONE message that arrives while listening, and only after the cook taps Allow, so
 * the app needs no READ_SMS / RECEIVE_SMS permission.
 *
 * `start` begins a five-minute listen; the message body arrives as the `onSms` event. `stop` ends it.
 */
class SmsUserConsentModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("SmsUserConsent")
    Events("onSms")

    Function("start") {
      val context = appContext.reactContext ?: return@Function false
      stopListening(context)
      SmsRetriever.getClient(context).startSmsUserConsent(null)

      val next = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
          if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
          val status = intent.extras?.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return
          if (status.statusCode != CommonStatusCodes.SUCCESS) return
          @Suppress("DEPRECATION")
          val consent: Intent? =
            intent.extras?.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT)
          val activity = appContext.currentActivity
          if (consent != null && activity != null) {
            activity.startActivityForResult(consent, REQUEST_CODE)
          }
          stopListening(ctx)
        }
      }
      val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(next, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
      } else {
        context.registerReceiver(next, filter, SmsRetriever.SEND_PERMISSION, null)
      }
      receiver = next
      true
    }

    Function("stop") {
      appContext.reactContext?.let { stopListening(it) }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      if (payload.resultCode == Activity.RESULT_OK) {
        val message = payload.data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
        if (message != null) sendEvent("onSms", mapOf("message" to message))
      }
    }

    OnDestroy {
      appContext.reactContext?.let { stopListening(it) }
    }
  }

  private fun stopListening(context: Context) {
    val current = receiver ?: return
    receiver = null
    try {
      context.unregisterReceiver(current)
    } catch (_: IllegalArgumentException) {
      // Already unregistered.
    }
  }

  private companion object {
    const val REQUEST_CODE = 7731
  }
}
