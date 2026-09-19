import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 16.2, *)
struct SessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SessionActivityAttributes.self) { context in
            // Lock screen / banner view
            SessionLockScreenView(context: context)
                .activityBackgroundTint(.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Dynamic Island
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "play.fill")
                            .font(.caption2)
                            .foregroundColor(.green)
                        Text(context.attributes.placeName)
                            .font(.headline)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.startTime, style: .timer)
                        .font(.system(.title3, design: .monospaced))
                        .monospacedDigit()
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    SessionActionsView(context: context)
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: "play.fill")
                        .font(.caption2)
                        .foregroundColor(.green)
                    Text(context.state.startTime, style: .timer)
                        .monospacedDigit()
                        .font(.caption)
                }
            } compactTrailing: {
                Text(context.attributes.placeName)
                    .lineLimit(1)
                    .font(.caption)
            } minimal: {
                Image(systemName: "play.fill")
                    .foregroundColor(.green)
            }
        }
    }
}

// MARK: - Lock Screen View

@available(iOS 16.2, *)
private struct SessionLockScreenView: View {
    let context: ActivityViewContext<SessionActivityAttributes>

    var body: some View {
        VStack(spacing: 12) {
            // Place name + timer
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill")
                        .font(.caption)
                        .foregroundColor(.green)
                    Text(context.attributes.placeName)
                        .font(.headline)
                        .foregroundColor(.white)
                }

                Spacer()

                Text(context.state.startTime, style: .timer)
                    .font(.system(.title2, design: .monospaced))
                    .monospacedDigit()
                    .foregroundColor(.white)
            }

            // Action buttons
            SessionActionsView(context: context)
        }
        .padding(16)
    }
}

// MARK: - Action Buttons

@available(iOS 16.2, *)
private struct SessionActionsView: View {
    let context: ActivityViewContext<SessionActivityAttributes>

    private var locale: String { context.attributes.locale }
    private var isArabic: Bool { locale == "ar" }
    private var state: SessionActivityAttributes.ContentState { context.state }

    var body: some View {
        HStack(spacing: 8) {
            actionButton(
                actionId: "call_waiter",
                label: isArabic ? "الويتر" : "Waiter",
                icon: "bell.fill",
                cooldownEnd: state.waiterCooldownEnd
            )

            actionButton(
                actionId: "controller",
                label: isArabic ? "دراع" : "Controller",
                icon: "gamecontroller.fill",
                cooldownEnd: state.controllerCooldownEnd
            )

            if let drink1 = state.drink1Name {
                deepLinkButton(
                    actionId: "order_drink_1",
                    label: drink1,
                    icon: "cup.and.saucer.fill"
                )
            }

            if let drink2 = state.drink2Name {
                deepLinkButton(
                    actionId: "order_drink_2",
                    label: drink2,
                    icon: "mug.fill"
                )
            }
        }
        .environment(\.layoutDirection, isArabic ? .rightToLeft : .leftToRight)
    }

    @ViewBuilder
    private func actionButton(actionId: String, label: String, icon: String, cooldownEnd: Date?) -> some View {
        let inCooldown = cooldownEnd != nil && cooldownEnd! > Date()

        if inCooldown {
            cooldownLabel(icon: icon, cooldownEnd: cooldownEnd!)
        } else if #available(iOS 17, *),
           let accessToken = state.accessToken,
           let apiBaseUrl = state.apiBaseUrl,
           let sessionId = state.sessionId,
           let placeId = state.placeId {
            // iOS 17+: background intent — no app launch
            Button(intent: SessionActionIntent(
                actionId: actionId,
                accessToken: accessToken,
                apiBaseUrl: apiBaseUrl,
                sessionId: sessionId,
                placeId: placeId,
                placeKind: state.placeKind,
                branchId: state.branchId ?? 0,
                placeNameEn: state.placeNameEn ?? "",
                placeNameAr: state.placeNameAr
            )) {
                actionLabel(label: label, icon: icon)
            }
            .buttonStyle(.plain)
        } else {
            // iOS 16.x: deep link — opens app
            Link(destination: URL(string: "com.chillax.client://action/\(actionId)")!) {
                actionLabel(label: label, icon: icon)
            }
        }
    }

    private func deepLinkButton(actionId: String, label: String, icon: String) -> some View {
        Link(destination: URL(string: "com.chillax.client://action/\(actionId)")!) {
            actionLabel(label: label, icon: icon)
        }
    }

    private func actionLabel(label: String, icon: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(label)
                .font(.caption)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.15))
        .cornerRadius(8)
        .foregroundColor(.white)
    }

    private func cooldownLabel(icon: String, cooldownEnd: Date) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "checkmark")
                .font(.caption2)
            Text(cooldownEnd, style: .relative)
                .font(.caption)
                .monospacedDigit()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.green.opacity(0.3))
        .cornerRadius(8)
        .foregroundColor(.green)
    }
}
