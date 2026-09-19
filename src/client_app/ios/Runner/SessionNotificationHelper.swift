import ActivityKit
import Foundation
import UserNotifications
import Flutter

class SessionNotificationHelper: NSObject {
    static let shared = SessionNotificationHelper()

    static let channelName = "com.chillax.client/session_notification"
    static let navigationChannelName = "com.chillax.client/navigation"
    static let notificationId = "session_notification"

    // Notification category & action identifiers (legacy fallback)
    static let categoryId = "SESSION_CONTROLS"
    static let actionCallWaiter = "ACTION_CALL_WAITER"
    static let actionController = "ACTION_CONTROLLER"
    static let actionOrderDrink1 = "ACTION_ORDER_DRINK_1"
    static let actionOrderDrink2 = "ACTION_ORDER_DRINK_2"

    static let cooldownSeconds: TimeInterval = 30

    private var sessionChannel: FlutterMethodChannel?
    private var navigationChannel: FlutterMethodChannel?

    private var lastPlaceName = ""
    private var lastDuration = ""
    private var lastStartTimeMs: Int64?
    private var lastLocale = "en"
    private var lastDrink1Name: String?
    private var lastDrink2Name: String?

    // Cooldowns: action identifier -> expiry Date
    private var cooldowns: [String: Date] = [:]
    private var cooldownTimer: Timer?

    // Live Activity storage (typed access via computed property)
    private var _liveActivityStorage: Any?

    @available(iOS 16.2, *)
    private var currentActivity: Activity<SessionActivityAttributes>? {
        get { _liveActivityStorage as? Activity<SessionActivityAttributes> }
        set { _liveActivityStorage = newValue }
    }

    private override init() {
        super.init()
    }

    /// Register notification categories with interactive actions (legacy fallback)
    func registerCategories() {
        updateCategoryActions(locale: "en", drink1Name: nil, drink2Name: nil)
    }

    /// Update category actions based on current locale and drink names
    private func updateCategoryActions(locale: String, drink1Name: String?, drink2Name: String?) {
        let isArabic = locale == "ar"

        var actions: [UNNotificationAction] = []

        actions.append(UNNotificationAction(
            identifier: SessionNotificationHelper.actionCallWaiter,
            title: getActionTitle(
                action: SessionNotificationHelper.actionCallWaiter,
                defaultLabel: isArabic ? "الويتر" : "Waiter"
            ),
            options: []
        ))

        actions.append(UNNotificationAction(
            identifier: SessionNotificationHelper.actionController,
            title: getActionTitle(
                action: SessionNotificationHelper.actionController,
                defaultLabel: isArabic ? "دراع" : "Controller"
            ),
            options: []
        ))

        if let name = drink1Name {
            actions.append(UNNotificationAction(
                identifier: SessionNotificationHelper.actionOrderDrink1,
                title: getActionTitle(
                    action: SessionNotificationHelper.actionOrderDrink1,
                    defaultLabel: name
                ),
                options: []
            ))
        }

        if let name = drink2Name {
            actions.append(UNNotificationAction(
                identifier: SessionNotificationHelper.actionOrderDrink2,
                title: getActionTitle(
                    action: SessionNotificationHelper.actionOrderDrink2,
                    defaultLabel: name
                ),
                options: []
            ))
        }

        let category = UNNotificationCategory(
            identifier: SessionNotificationHelper.categoryId,
            actions: actions,
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    /// Set up the method channel for Flutter communication
    func setupChannel(with controller: FlutterViewController) {
        sessionChannel = FlutterMethodChannel(
            name: SessionNotificationHelper.channelName,
            binaryMessenger: controller.binaryMessenger
        )

        navigationChannel = FlutterMethodChannel(
            name: SessionNotificationHelper.navigationChannelName,
            binaryMessenger: controller.binaryMessenger
        )

        sessionChannel?.setMethodCallHandler { [weak self] call, result in
            guard let self = self else {
                result(FlutterMethodNotImplemented)
                return
            }

            switch call.method {
            case "show":
                guard let args = call.arguments as? [String: Any] else {
                    result(FlutterError(code: "INVALID_ARGS", message: "Invalid arguments", details: nil))
                    return
                }
                let placeName = args["placeName"] as? String ?? ""
                let duration = args["duration"] as? String ?? ""
                let startTimeMs = args["startTimeMs"] as? Int64
                let locale = args["locale"] as? String ?? "en"
                let drink1Name = args["drink1Name"] as? String
                let drink2Name = args["drink2Name"] as? String
                let accessToken = args["accessToken"] as? String
                let apiBaseUrl = args["apiBaseUrl"] as? String
                let sessionId = args["sessionId"] as? Int
                let placeId = args["placeId"] as? Int
                let placeKind = args["placeKind"] as? String
                let branchId = args["branchId"] as? Int
                let placeNameEn = args["placeNameEn"] as? String
                let placeNameAr = args["placeNameAr"] as? String
                self.show(placeName: placeName, duration: duration, startTimeMs: startTimeMs, locale: locale,
                          drink1Name: drink1Name, drink2Name: drink2Name,
                          accessToken: accessToken, apiBaseUrl: apiBaseUrl,
                          sessionId: sessionId, placeId: placeId, placeKind: placeKind, branchId: branchId,
                          placeNameEn: placeNameEn, placeNameAr: placeNameAr)
                result(nil)

            case "dismiss":
                self.dismiss()
                result(nil)

            default:
                result(FlutterMethodNotImplemented)
            }
        }
    }

    // MARK: - Show / Update

    /// Show or update the session notification.
    /// Uses Live Activities on iOS 16.2+, falls back to regular notification on older versions.
    func show(placeName: String, duration: String, startTimeMs: Int64?, locale: String,
              drink1Name: String? = nil, drink2Name: String? = nil,
              accessToken: String? = nil, apiBaseUrl: String? = nil,
              sessionId: Int? = nil, placeId: Int? = nil, placeKind: String? = nil, branchId: Int? = nil,
              placeNameEn: String? = nil, placeNameAr: String? = nil) {
        lastPlaceName = placeName
        lastDuration = duration
        lastStartTimeMs = startTimeMs
        lastLocale = locale
        lastDrink1Name = drink1Name
        lastDrink2Name = drink2Name

        if #available(iOS 16.2, *) {
            showLiveActivity(placeName: placeName, startTimeMs: startTimeMs, locale: locale,
                             drink1Name: drink1Name, drink2Name: drink2Name,
                             accessToken: accessToken, apiBaseUrl: apiBaseUrl,
                             sessionId: sessionId, placeId: placeId, placeKind: placeKind, branchId: branchId,
                             placeNameEn: placeNameEn, placeNameAr: placeNameAr)
        } else {
            showLegacyNotification(placeName: placeName, locale: locale)
        }
    }

    /// Dismiss the session notification
    func dismiss() {
        cooldowns.removeAll()
        cooldownTimer?.invalidate()
        cooldownTimer = nil

        if #available(iOS 16.2, *) {
            dismissLiveActivity()
        }

        lastPlaceName = ""
        lastDrink1Name = nil
        lastDrink2Name = nil

        // Also dismiss any legacy notification
        UNUserNotificationCenter.current().removeDeliveredNotifications(
            withIdentifiers: [SessionNotificationHelper.notificationId]
        )
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [SessionNotificationHelper.notificationId]
        )
    }

    // MARK: - Live Activity (iOS 16.2+)

    @available(iOS 16.2, *)
    private func showLiveActivity(placeName: String, startTimeMs: Int64?, locale: String,
                                  drink1Name: String?, drink2Name: String?,
                                  accessToken: String? = nil, apiBaseUrl: String? = nil,
                                  sessionId: Int? = nil, placeId: Int? = nil, placeKind: String? = nil, branchId: Int? = nil,
                                  placeNameEn: String? = nil, placeNameAr: String? = nil) {
        let startDate: Date
        if let ms = startTimeMs {
            startDate = Date(timeIntervalSince1970: Double(ms) / 1000.0)
        } else {
            startDate = Date()
        }

        var state = SessionActivityAttributes.ContentState(
            startTime: startDate,
            drink1Name: drink1Name,
            drink2Name: drink2Name,
            accessToken: accessToken,
            apiBaseUrl: apiBaseUrl,
            sessionId: sessionId,
            placeId: placeId,
            placeKind: placeKind,
            branchId: branchId,
            placeNameEn: placeNameEn,
            placeNameAr: placeNameAr
        )

        if let activity = currentActivity,
           activity.activityState == .active {
            // Preserve active cooldowns from the existing state
            let existing = activity.content.state
            let now = Date()
            if let cd = existing.waiterCooldownEnd, cd > now { state.waiterCooldownEnd = cd }
            if let cd = existing.controllerCooldownEnd, cd > now { state.controllerCooldownEnd = cd }

            // Update existing activity
            Task {
                await activity.update(ActivityContent(state: state, staleDate: nil))
            }
        } else {
            // End any stale activities before starting a new one
            endAllActivities()

            // Start new activity
            let attributes = SessionActivityAttributes(placeName: placeName, locale: locale)
            let content = ActivityContent(state: state, staleDate: nil)

            do {
                currentActivity = try Activity.request(
                    attributes: attributes,
                    content: content,
                    pushType: nil
                )
            } catch {
                print("Failed to start Live Activity: \(error)")
                // Fall back to legacy notification
                showLegacyNotification(placeName: placeName, locale: locale)
            }
        }
    }

    /// End all live activities for this app (cleans up stale/orphaned activities)
    @available(iOS 16.2, *)
    private func endAllActivities() {
        for activity in Activity<SessionActivityAttributes>.activities {
            let state = activity.content.state
            Task {
                await activity.end(ActivityContent(state: state, staleDate: nil),
                                   dismissalPolicy: .immediate)
            }
        }
    }

    @available(iOS 16.2, *)
    private func dismissLiveActivity() {
        // End all activities, not just currentActivity, to clean up any orphaned ones
        for activity in Activity<SessionActivityAttributes>.activities {
            let state = activity.content.state
            Task {
                await activity.end(ActivityContent(state: state, staleDate: nil),
                                   dismissalPolicy: .immediate)
            }
        }
        currentActivity = nil
    }

    // MARK: - Legacy Notification (iOS < 16.2)

    private func showLegacyNotification(placeName: String, locale: String) {
        updateCategoryActions(locale: locale, drink1Name: lastDrink1Name, drink2Name: lastDrink2Name)

        let content = UNMutableNotificationContent()
        content.title = "Chillax"
        content.categoryIdentifier = SessionNotificationHelper.categoryId
        content.sound = nil

        let isArabic = locale == "ar"
        let sessionLabel = isArabic ? "الاوضه شغالة" : "Session active"
        content.body = "\(placeName) · \(sessionLabel)"

        let request = UNNotificationRequest(
            identifier: SessionNotificationHelper.notificationId,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to show session notification: \(error)")
            }
        }
    }

    // MARK: - Action Handling

    /// Handle a notification action response (legacy notifications)
    func handleAction(identifier: String) {
        let dartActionId = mapToDartAction(identifier)
        guard let actionId = dartActionId else { return }
        performAction(internalId: identifier, dartActionId: actionId)
    }

    /// Handle a deep link action from Live Activity buttons
    func handleDeepLinkAction(_ dartActionId: String) {
        let internalId: String
        switch dartActionId {
        case "call_waiter": internalId = SessionNotificationHelper.actionCallWaiter
        case "controller": internalId = SessionNotificationHelper.actionController
        case "order_drink_1": internalId = SessionNotificationHelper.actionOrderDrink1
        case "order_drink_2": internalId = SessionNotificationHelper.actionOrderDrink2
        default: return
        }
        performAction(internalId: internalId, dartActionId: dartActionId)
    }

    private func performAction(internalId: String, dartActionId: String) {
        let now = Date()

        // Check cooldown
        if let expiry = cooldowns[internalId], now < expiry { return }
        cooldowns[internalId] = now.addingTimeInterval(SessionNotificationHelper.cooldownSeconds)

        // Forward to Flutter
        if sessionChannel != nil {
            DispatchQueue.main.async { [weak self] in
                self?.sessionChannel?.invokeMethod("onAction", arguments: dartActionId)
            }
        } else if dartActionId == "call_waiter" || dartActionId == "controller" {
            sendDirectRequest(actionId: dartActionId)
        }
    }

    private func mapToDartAction(_ identifier: String) -> String? {
        switch identifier {
        case SessionNotificationHelper.actionCallWaiter: return "call_waiter"
        case SessionNotificationHelper.actionController: return "controller"
        case SessionNotificationHelper.actionOrderDrink1: return "order_drink_1"
        case SessionNotificationHelper.actionOrderDrink2: return "order_drink_2"
        default: return nil
        }
    }

    /// Send a service request directly via HTTP when Flutter engine isn't available
    private func sendDirectRequest(actionId: String) {
        let defaults = UserDefaults.standard
        guard let accessToken = defaults.string(forKey: "flutter.active_session_access_token"),
              defaults.object(forKey: "flutter.active_session_id") != nil else {
            return
        }

        let sessionId = defaults.integer(forKey: "flutter.active_session_id")
        let placeId = defaults.integer(forKey: "flutter.active_session_place_id")
        let placeKind = defaults.string(forKey: "flutter.active_session_place_kind")
        let branchId = defaults.integer(forKey: "flutter.active_session_branch_id")
        let placeNameEn = defaults.string(forKey: "flutter.active_session_place_name_en") ?? ""
        let placeNameAr = defaults.string(forKey: "flutter.active_session_place_name_ar")

        let requestType: Int
        switch actionId {
        case "call_waiter": requestType = 1
        case "controller": requestType = 2
        default: return
        }

        var placeNameJson: [String: Any] = ["en": placeNameEn]
        if let ar = placeNameAr { placeNameJson["ar"] = ar }

        var body: [String: Any] = [
            "sessionId": sessionId,
            "placeId": placeId,
            "placeName": placeNameJson,
            "requestType": requestType
        ]
        if let kind = placeKind { body["placeKind"] = kind }

        let baseUrl = defaults.string(forKey: "flutter.notifications_api_url")
            ?? "https://chillax.site/notifications-api/"
        guard let url = URL(string: "\(baseUrl)service-requests?api-version=1.0"),
              let jsonData = try? JSONSerialization.data(withJSONObject: body) else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        if branchId != 0 {
            request.setValue("\(branchId)", forHTTPHeaderField: "X-Branch-Id")
        }
        request.httpBody = jsonData

        URLSession.shared.dataTask(with: request) { _, _, _ in }.resume()
    }

    /// Navigate to a route via Flutter
    func navigateTo(route: String) {
        DispatchQueue.main.async { [weak self] in
            self?.navigationChannel?.invokeMethod("navigateTo", arguments: route)
        }
    }

    // MARK: - Private Helpers

    private func getActionTitle(action: String, defaultLabel: String) -> String {
        let now = Date()
        guard let expiry = cooldowns[action], now < expiry else {
            return defaultLabel
        }
        let remaining = Int(expiry.timeIntervalSince(now))
        return "✓ \(remaining)s"
    }
}
