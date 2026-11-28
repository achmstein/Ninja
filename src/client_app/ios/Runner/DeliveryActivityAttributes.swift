// Shared with the Live Activity extension — must be identical to ChillaxLiveActivity/DeliveryActivityAttributes.swift
import ActivityKit
import Foundation

/// The customer's live delivery card. The app writes the words (in the
/// customer's language) and where the logo sits on the track; the card only
/// draws them. Nothing here says where the rider is.
@available(iOS 16.2, *)
struct DeliveryActivityAttributes: ActivityAttributes {
    let orderId: Int
    let cafeName: String
    /// The business's colour, "#rrggbb"; empty for none
    let colorHex: String
    let rtl: Bool
    let doorLabel: String
    let minLabel: String

    public struct ContentState: Codable, Hashable {
        var title: String
        var body: String
        /// Shown in place of the body when nothing has been heard for a while
        var staleBody: String
        /// Where the logo sits on the track, 0 to 1
        var position: Double
        /// "go" on the way there, "ok" delivered, "bad" not delivered
        var tone: String
        var minutes: Int?

        // The buttons, each present only while it applies
        var callLabel: String?
        var comingLabel: String?
        var toldLabel: String?
        /// The body once "I'm coming down" was said from the card itself
        var toldBody: String?
        var rateLabel: String?
        var callCafeLabel: String?

        // For "I'm coming down" said from the card without opening the app (iOS 17+)
        var accessToken: String?
        var apiBaseUrl: String?
        var branchId: Int?
    }
}
