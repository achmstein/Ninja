import ActivityKit
import AppIntents
import Foundation

/// "I'm coming down", tapped on the delivery card (iOS 17+): said to the
/// server from here with the token the app left, so the app need not open.
/// The card shows it as said only once the server took it; refused, the token
/// is dropped from the card, so the next tap opens the app, which says it.
@available(iOS 17, *)
struct DeliveryComingIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "I'm coming down"

    @Parameter(title: "Order")
    var orderId: Int

    @Parameter(title: "Access Token")
    var accessToken: String

    @Parameter(title: "API Base URL")
    var apiBaseUrl: String

    @Parameter(title: "Branch ID")
    var branchId: Int

    init() {}

    init(orderId: Int, accessToken: String, apiBaseUrl: String, branchId: Int) {
        self.orderId = orderId
        self.accessToken = accessToken
        self.apiBaseUrl = apiBaseUrl
        self.branchId = branchId
    }

    func perform() async throws -> some IntentResult {
        guard let url = URL(string: "\(apiBaseUrl)\(orderId)/delivery/coming?api-version=1.0") else {
            return .result()
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.timeoutInterval = 8
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        if branchId != 0 {
            request.setValue("\(branchId)", forHTTPHeaderField: "X-Branch-Id")
        }

        var said = false
        if let answer = try? await URLSession.shared.data(for: request) {
            let status = (answer.1 as? HTTPURLResponse)?.statusCode ?? 0
            said = status >= 200 && status < 300
        }

        for activity in Activity<DeliveryActivityAttributes>.activities where activity.attributes.orderId == orderId {
            var state = activity.content.state
            if said {
                state.toldLabel = state.toldLabel ?? "\u{2713}"
                state.comingLabel = nil
                if let body = state.toldBody { state.body = body }
            } else {
                state.accessToken = nil
            }
            await activity.update(ActivityContent(state: state, staleDate: activity.content.staleDate))
        }

        return .result()
    }
}
