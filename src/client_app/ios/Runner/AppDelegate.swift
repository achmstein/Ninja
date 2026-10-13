import Flutter
import GoogleMaps
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // Set up notification delegate for interactive actions
    UNUserNotificationCenter.current().delegate = self

    // Register notification categories (action buttons for legacy fallback)
    SessionNotificationHelper.shared.registerCategories()

    // Set up method channels
    if let controller = window?.rootViewController as? FlutterViewController {
      SessionNotificationHelper.shared.setupChannel(with: controller)
      setupMapsChannel(with: controller)
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - Google Maps

  /// The Maps SDK key comes from the build's record, which only the Dart side
  /// reads (--dart-define-from-file): it is handed over here once, before the
  /// first Google map (lib/features/delivery/widgets/google_map_picker.dart).
  /// A build without a key never asks, and draws the free map.
  private func setupMapsChannel(with controller: FlutterViewController) {
    let channel = FlutterMethodChannel(name: "ninja/maps", binaryMessenger: controller.binaryMessenger)
    channel.setMethodCallHandler { call, result in
      guard call.method == "provideApiKey", let key = call.arguments as? String, !key.isEmpty else {
        result(FlutterMethodNotImplemented)
        return
      }
      GMSServices.provideAPIKey(key)
      result(nil)
    }
  }

  // MARK: - Deep Link Handling (Live Activity action buttons)

  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // Handle Live Activity action deep links: com.chillax.client://action/<actionId>
    if url.scheme == "com.chillax.client" && url.host == "action" {
      let actionId = url.lastPathComponent
      SessionNotificationHelper.shared.handleDeepLinkAction(actionId)
      return true
    }
    return super.application(app, open: url, options: options)
  }

  // MARK: - Remote notifications (FCM data messages)

  override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    let type = userInfo["type"] as? String

    if type == "session_ended" {
      SessionNotificationHelper.shared.dismiss()
    }

    // Let Flutter's firebase_messaging plugin handle everything else
    super.application(application, didReceiveRemoteNotification: userInfo,
                      fetchCompletionHandler: completionHandler)
  }

  // MARK: - UNUserNotificationCenterDelegate

  /// Show notifications even when app is in the foreground
  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge])
  }

  /// Handle notification action button taps (legacy notifications)
  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let actionIdentifier = response.actionIdentifier

    switch actionIdentifier {
    case UNNotificationDefaultActionIdentifier:
      // User tapped the notification itself — navigate to places
      SessionNotificationHelper.shared.navigateTo(route: "/places")

    case UNNotificationDismissActionIdentifier:
      // User dismissed the notification
      break

    default:
      // Custom action button tapped
      SessionNotificationHelper.shared.handleAction(identifier: actionIdentifier)
    }

    completionHandler()
  }
}
