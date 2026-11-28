import ActivityKit
import Flutter
import Foundation
import UIKit

/// The customer's live delivery card on iPhone: a Live Activity the app
/// starts and updates itself (no Apple push key), from what Flutter hands
/// over while it is open and from the server's `delivery_card` data push
/// while it is in the background. The delivery's state and what the card
/// needs to word itself (the customer's language, the business's name and
/// colour, the branch's number) are kept here between the two.
///
/// With the app force-quit the card stops moving, and says so once it has
/// heard nothing for ten minutes; the plain pushes still arrive.
class DeliveryCardHelper: NSObject {
    static let shared = DeliveryCardHelper()

    static let channelName = "com.chillax.client/delivery_card"

    private static let stateKey = "delivery_card_state"
    private static let configKey = "delivery_card_config"

    /// A card that reached its end (delivered, or not) leaves by itself after this long
    private static let linger: TimeInterval = 30 * 60

    /// Nothing heard for this long: the card says to open the app for the latest
    private static let staleAfter: TimeInterval = 10 * 60

    /// Where the second stop sits on the track: the order is with its rider
    private static let withRider = 0.3

    private static let fallback: [String: String] = [
        "preparing": "Preparing your order",
        "ready": "Ready, leaving soon",
        "onTheWay": "On the way to you",
        "near": "Almost there",
        "delivered": "Delivered",
        "notDelivered": "Not delivered",
        "order": "Order #{number}",
        "about": "about {minutes} min",
        "bringing": "{rider} is bringing it",
        "nearRider": "{rider} is about a minute away",
        "nearNoRider": "About a minute away",
        "knows": "{rider} knows you are coming down",
        "knowsNoRider": "The rider knows you are coming down",
        "enjoy": "Enjoy! How was it?",
        "failed": "The rider couldn't deliver it.",
        "call": "Call rider",
        "coming": "I'm coming down",
        "told": "\u{2713} Rider told",
        "rate": "Rate your order",
        "callCafe": "Call the caf\u{00E9}",
        "door": "Your door",
        "min": "min",
        "stale": "Open the app for the latest",
    ]

    private var channel: FlutterMethodChannel?

    /// A tap on the card that opened the app before Flutter was listening: handed over once it is
    private var pendingAction: [String: Any]?

    private override init() {
        super.init()
    }

    // MARK: - Flutter

    func setupChannel(with controller: FlutterViewController) {
        let channel = FlutterMethodChannel(name: DeliveryCardHelper.channelName, binaryMessenger: controller.binaryMessenger)
        self.channel = channel
        channel.setMethodCallHandler { [weak self] call, result in
            guard let self = self else {
                result(FlutterMethodNotImplemented)
                return
            }
            let args = call.arguments as? [String: Any] ?? [:]
            switch call.method {
            case "configure":
                self.configure(args)
                // A tap that opened the app before Flutter was listening
                if let action = self.pendingAction { self.send(action) }
                result(nil)
            case "show":
                self.apply(args)
                result(nil)
            case "dismiss":
                self.dismiss()
                result(nil)
            default:
                result(FlutterMethodNotImplemented)
            }
        }
    }

    private func send(_ action: [String: Any]) {
        pendingAction = action
        channel?.invokeMethod("onAction", arguments: action) { [weak self] answer in
            // Flutter took it (anything but "nobody is listening")
            if !(answer is FlutterError) && (answer as? NSObject) != FlutterMethodNotImplemented {
                self?.pendingAction = nil
            }
        }
    }

    // MARK: - What is kept

    private var config: [String: Any] {
        get { UserDefaults.standard.dictionary(forKey: DeliveryCardHelper.configKey) ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: DeliveryCardHelper.configKey) }
    }

    private var state: [String: Any] {
        get { UserDefaults.standard.dictionary(forKey: DeliveryCardHelper.stateKey) ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: DeliveryCardHelper.stateKey) }
    }

    private func configure(_ args: [String: Any]) {
        var kept: [String: Any] = [:]
        for key in ["locale", "cafeName", "color", "branchPhone", "apiBaseUrl"] {
            if let text = args[key] as? String { kept[key] = text }
        }
        if let branch = args["branchId"] as? NSNumber { kept["branchId"] = branch.intValue }
        if let strings = args["strings"] as? [String: String] { kept["strings"] = strings }
        config = kept
    }

    private static func integer(_ value: Any?) -> Int? {
        if let number = value as? NSNumber { return number.intValue }
        if let text = value as? String, let number = Double(text) { return Int(number.rounded()) }
        return nil
    }

    private static func truthy(_ value: Any?) -> Bool {
        if let flag = value as? Bool { return flag }
        if let number = value as? NSNumber { return number.intValue != 0 }
        if let text = value as? String { return text == "1" || text.lowercased() == "true" }
        return false
    }

    private static func isOver(_ state: [String: Any]) -> Bool {
        ["Delivered", "Failed", "Returned"].contains(state["stage"] as? String ?? "Waiting")
    }

    // MARK: - The delivery moved

    /// From Flutter (everything, typed) or from a push (text, and for a progress update only what
    /// moved). Older news than what the card shows is dropped.
    func apply(_ data: [AnyHashable: Any]) {
        guard let orderId = DeliveryCardHelper.integer(data["orderId"]) else { return }
        let version = DeliveryCardHelper.integer(data["version"]) ?? 0
        var next = state

        if DeliveryCardHelper.integer(next["orderId"]) != orderId {
            next = ["orderId": orderId]
        } else if version < (DeliveryCardHelper.integer(next["version"]) ?? 0) {
            return
        }
        let sameStep = version == DeliveryCardHelper.integer(next["version"])
        let wasNear = DeliveryCardHelper.truthy(next["nearby"])

        next["version"] = version
        if let stage = data["stage"] as? String, !stage.isEmpty { next["stage"] = stage }
        for key in ["riderName", "riderPhone", "failureReason", "accessToken"] {
            guard let raw = data[key] else { continue }
            let text = (raw as? String ?? "").trimmingCharacters(in: .whitespaces)
            // Flutter passes a token only when it has one; a push never does
            if key == "accessToken" && text.isEmpty { continue }
            next[key] = text.isEmpty ? nil : text
        }
        for key in ["progress", "etaMinutes"] {
            guard let raw = data[key] else { continue }
            if let number = DeliveryCardHelper.integer(raw) {
                // Within one step the logo only goes forwards
                next[key] = key == "progress" && sameStep ? max(number, DeliveryCardHelper.integer(next[key]) ?? 0) : number
            } else {
                next[key] = nil
            }
        }
        for key in ["nearby", "coming"] {
            if let raw = data[key] { next[key] = DeliveryCardHelper.truthy(raw) }
        }
        if DeliveryCardHelper.isOver(next) {
            if next["endedAt"] == nil { next["endedAt"] = Date().timeIntervalSince1970 }
        } else {
            next["endedAt"] = nil
        }
        state = next

        // The plain pushes ring for leaving and for not delivered; near is the card's own to ring
        let ring = DeliveryCardHelper.truthy(data["alert"]) && DeliveryCardHelper.truthy(next["nearby"]) && !wasNear
        render(ring: ring)
    }

    func dismiss() {
        UserDefaults.standard.removeObject(forKey: DeliveryCardHelper.stateKey)
        if #available(iOS 16.2, *) {
            Task {
                for activity in Activity<DeliveryActivityAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }
    }

    // MARK: - The card's links (its buttons open the app with one)

    /// `…://delivery/<call|cafe|coming|rate>?order=<id>`; true when it was the card's
    func handleLink(_ url: URL) -> Bool {
        guard url.host == "delivery" else { return false }
        let orderId = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "order" })?.value.flatMap { Int($0) }
            ?? DeliveryCardHelper.integer(state["orderId"]) ?? 0

        switch url.lastPathComponent {
        case "call":
            dial(state["riderPhone"] as? String)
        case "cafe":
            dial(config["branchPhone"] as? String)
        case "coming":
            send(["action": "coming", "orderId": orderId])
        case "rate":
            send(["action": "rate", "orderId": orderId])
        default:
            send(["action": "open", "orderId": orderId])
        }
        return true
    }

    private func dial(_ phone: String?) {
        let digits = (phone ?? "").filter { $0.isNumber || $0 == "+" }
        guard !digits.isEmpty, let url = URL(string: "tel:\(digits)") else { return }
        DispatchQueue.main.async { UIApplication.shared.open(url) }
    }

    // MARK: - Words and drawing

    private func word(_ key: String) -> String {
        if let text = (config["strings"] as? [String: String])?[key], !text.isEmpty { return text }
        return DeliveryCardHelper.fallback[key] ?? ""
    }

    private func word(_ key: String, _ name: String, _ value: String) -> String {
        word(key).replacingOccurrences(of: "{\(name)}", with: value)
    }

    private func titleAndBody(_ state: [String: Any]) -> (String, String) {
        let rider = state["riderName"] as? String
        let minutes = DeliveryCardHelper.integer(state["etaMinutes"]).map { word("about", "minutes", String($0)) }
        let order = word("order", "number", String(DeliveryCardHelper.integer(state["orderId"]) ?? 0))
        let coming = DeliveryCardHelper.truthy(state["coming"])
        let join: ([String?]) -> String = { $0.compactMap { $0 }.joined(separator: " \u{00B7} ") }

        switch state["stage"] as? String ?? "Waiting" {
        case "Assigned":
            return (word("ready"), join([rider.map { word("bringing", "rider", $0) } ?? order, minutes]))
        case "OnTheWay":
            if DeliveryCardHelper.truthy(state["nearby"]) {
                if coming { return (word("near"), knows(rider)) }
                return (word("near"), rider.map { word("nearRider", "rider", $0) } ?? word("nearNoRider"))
            }
            if coming { return (word("onTheWay"), knows(rider)) }
            let line = join([rider, minutes])
            return (word("onTheWay"), line.isEmpty ? order : line)
        case "Delivered":
            return (word("delivered"), word("enjoy"))
        case "Failed", "Returned":
            return (word("notDelivered"), word("failed"))
        default:
            return (word("preparing"), join([order, minutes]))
        }
    }

    private func knows(_ rider: String?) -> String {
        rider.map { word("knows", "rider", $0) } ?? word("knowsNoRider")
    }

    /// How far along the track the logo sits, 0 to 1
    private func position(_ state: [String: Any]) -> Double {
        switch state["stage"] as? String ?? "Waiting" {
        case "Assigned":
            return DeliveryCardHelper.withRider
        case "OnTheWay", "Failed", "Returned":
            let progress = Double(DeliveryCardHelper.integer(state["progress"]) ?? 0) / 100
            let along = DeliveryCardHelper.withRider + (1 - DeliveryCardHelper.withRider) * min(1, max(0, progress))
            // Near the door reads as near the door, whatever the straight line said
            return DeliveryCardHelper.truthy(state["nearby"]) ? max(along, 0.92) : min(along, 0.92)
        case "Delivered":
            return 1
        default:
            return 0
        }
    }

    private func render(ring: Bool) {
        guard #available(iOS 16.2, *) else { return }
        let state = self.state
        let config = self.config
        guard let orderId = DeliveryCardHelper.integer(state["orderId"]) else { return }

        let stage = state["stage"] as? String ?? "Waiting"
        let over = DeliveryCardHelper.isOver(state)
        let endedAt = (state["endedAt"] as? Double).map { Date(timeIntervalSince1970: $0) }
        let (title, body) = titleAndBody(state)
        let coming = DeliveryCardHelper.truthy(state["coming"])
        let riderPhone = state["riderPhone"] as? String ?? ""
        let branchPhone = config["branchPhone"] as? String ?? ""
        let onTheWay = stage == "OnTheWay"

        let content = DeliveryActivityAttributes.ContentState(
            title: title,
            body: body,
            staleBody: word("stale"),
            position: position(state),
            tone: stage == "Delivered" ? "ok" : (over ? "bad" : "go"),
            minutes: over ? nil : DeliveryCardHelper.integer(state["etaMinutes"]),
            callLabel: onTheWay && !riderPhone.isEmpty ? word("call") : nil,
            comingLabel: onTheWay && !coming ? word("coming") : nil,
            toldLabel: onTheWay && coming ? word("told") : nil,
            toldBody: knows(state["riderName"] as? String),
            rateLabel: stage == "Delivered" ? word("rate") : nil,
            callCafeLabel: over && stage != "Delivered" && !branchPhone.isEmpty ? word("callCafe", "name", config["cafeName"] as? String ?? "") : nil,
            accessToken: state["accessToken"] as? String,
            apiBaseUrl: config["apiBaseUrl"] as? String,
            branchId: DeliveryCardHelper.integer(config["branchId"])
        )
        // Still going: stale when nothing more is heard. Over: nothing more is coming, and that is fine
        let stale = over ? nil : Date().addingTimeInterval(DeliveryCardHelper.staleAfter)
        let activityContent = ActivityContent(state: content, staleDate: stale)

        Task {
            // Another order's card, if one is still up, makes way
            for other in Activity<DeliveryActivityAttributes>.activities where other.attributes.orderId != orderId {
                await other.end(nil, dismissalPolicy: .immediate)
            }
            let current = Activity<DeliveryActivityAttributes>.activities.first { $0.attributes.orderId == orderId }

            if over {
                // Says how it ended, then leaves by itself
                guard let activity = current else { return }
                let leaveAt = (endedAt ?? Date()).addingTimeInterval(DeliveryCardHelper.linger)
                await activity.end(activityContent, dismissalPolicy: leaveAt > Date() ? .after(leaveAt) : .immediate)
                return
            }

            if let activity = current {
                let alert = ring
                    ? AlertConfiguration(title: LocalizedStringResource(stringLiteral: title), body: LocalizedStringResource(stringLiteral: body), sound: .default)
                    : nil
                await activity.update(activityContent, alertConfiguration: alert)
                return
            }

            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
            let attributes = DeliveryActivityAttributes(
                orderId: orderId,
                cafeName: (config["cafeName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
                    ?? (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? ""),
                colorHex: config["color"] as? String ?? "",
                rtl: (config["locale"] as? String) == "ar",
                doorLabel: self.word("door"),
                minLabel: self.word("min")
            )
            do {
                _ = try Activity.request(attributes: attributes, content: activityContent, pushType: nil)
            } catch {
                // Started from the background, which iOS allows only now and then: the next time the app is in front starts it
                print("Delivery card not started: \(error)")
            }
        }
    }
}
