// Shared with main app target — must be identical to Runner/SessionActivityAttributes.swift
import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct SessionActivityAttributes: ActivityAttributes {
    let placeName: String
    let locale: String

    public struct ContentState: Codable, Hashable {
        var startTime: Date
        var drink1Name: String?
        var drink2Name: String?

        // Session context for background action intents (iOS 17+)
        var accessToken: String?
        var apiBaseUrl: String?
        var sessionId: Int?
        var placeId: Int?
        var placeKind: String?
        var branchId: Int?
        var placeNameEn: String?
        var placeNameAr: String?

        // Cooldown timestamps — set after a button is tapped
        var waiterCooldownEnd: Date?
        var controllerCooldownEnd: Date?
    }
}
