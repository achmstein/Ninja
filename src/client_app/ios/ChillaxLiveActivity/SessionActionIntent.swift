import ActivityKit
import AppIntents
import Foundation

private let cooldownSeconds: TimeInterval = 30

/// Update the Live Activity's content state with a cooldown timestamp for the given action.
@available(iOS 17, *)
private func setCooldown(for actionId: String) async {
    guard let activity = Activity<SessionActivityAttributes>.activities.first else { return }
    var state = activity.content.state
    let expiry = Date().addingTimeInterval(cooldownSeconds)

    switch actionId {
    case "call_waiter": state.waiterCooldownEnd = expiry
    case "controller": state.controllerCooldownEnd = expiry
    default: break
    }

    await activity.update(ActivityContent(state: state, staleDate: nil))
}

/// Background action intent for Live Activity buttons (iOS 17+).
/// Sends service requests directly via HTTP without opening the app.
@available(iOS 17, *)
struct SessionActionIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Session Action"

    @Parameter(title: "Action")
    var actionId: String

    @Parameter(title: "Access Token")
    var accessToken: String

    @Parameter(title: "API Base URL")
    var apiBaseUrl: String

    @Parameter(title: "Session ID")
    var sessionId: Int

    @Parameter(title: "Place ID")
    var placeId: Int

    @Parameter(title: "Place Kind")
    var placeKind: String?

    @Parameter(title: "Branch ID")
    var branchId: Int

    @Parameter(title: "Place Name EN")
    var placeNameEn: String

    @Parameter(title: "Place Name AR")
    var placeNameAr: String?

    init() {}

    init(actionId: String, accessToken: String, apiBaseUrl: String,
         sessionId: Int, placeId: Int, placeKind: String?, branchId: Int,
         placeNameEn: String, placeNameAr: String?) {
        self.actionId = actionId
        self.accessToken = accessToken
        self.apiBaseUrl = apiBaseUrl
        self.sessionId = sessionId
        self.placeId = placeId
        self.placeKind = placeKind
        self.branchId = branchId
        self.placeNameEn = placeNameEn
        self.placeNameAr = placeNameAr
    }

    func perform() async throws -> some IntentResult {
        let requestType: Int
        switch actionId {
        case "call_waiter": requestType = 1
        case "controller": requestType = 2
        default: return .result()
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

        guard let url = URL(string: "\(apiBaseUrl)service-requests?api-version=1.0"),
              let jsonData = try? JSONSerialization.data(withJSONObject: body) else {
            return .result()
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        if branchId != 0 {
            request.setValue("\(branchId)", forHTTPHeaderField: "X-Branch-Id")
        }
        request.httpBody = jsonData

        let (_, response) = try await URLSession.shared.data(for: request)
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0

        // Show cooldown on success or if already in cooldown (400)
        if (statusCode >= 200 && statusCode < 300) || statusCode == 400 {
            await setCooldown(for: actionId)
        }

        return .result()
    }
}
