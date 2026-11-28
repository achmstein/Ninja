import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

/// The customer's live delivery card: what the delivery is doing, a line
/// under it, about how many minutes are left, a straight track from the
/// business to the door with its logo riding it, and the buttons that apply.
/// The logo is the extension's own picture (Assets.xcassets/DeliveryLogo),
/// which a business's build replaces with its icon.
@available(iOS 16.2, *)
struct DeliveryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeliveryActivityAttributes.self) { context in
            DeliveryLockScreenView(context: context)
                .activityBackgroundTint(.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let tint = DeliveryPalette.tint(context)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    DeliveryLogo(size: 30, corner: 8)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let minutes = context.state.minutes {
                        DeliveryMinutes(minutes: minutes, label: context.attributes.minLabel, tint: tint, size: 24)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        DeliveryTrack(context: context)
                        DeliveryActions(context: context)
                    }
                    .environment(\.layoutDirection, context.attributes.rtl ? .rightToLeft : .leftToRight)
                }
            } compactLeading: {
                DeliveryLogo(size: 22, corner: 11)
            } compactTrailing: {
                if let minutes = context.state.minutes {
                    Text("\(minutes) \(context.attributes.minLabel)")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .monospacedDigit()
                        .foregroundColor(tint)
                } else {
                    Image(systemName: context.state.tone == "bad" ? "exclamationmark" : "checkmark")
                        .font(.caption)
                        .foregroundColor(tint)
                }
            } minimal: {
                DeliveryLogo(size: 22, corner: 11)
            }
        }
    }
}

// MARK: - Colours

@available(iOS 16.2, *)
enum DeliveryPalette {
    /// The track's colour on the card's dark ground: the business's own, lifted when it would vanish
    static func tint(_ context: ActivityViewContext<DeliveryActivityAttributes>) -> Color {
        switch context.state.tone {
        case "ok": return Color(red: 0.37, green: 0.83, blue: 0.60)
        case "bad": return Color(red: 1.0, green: 0.54, blue: 0.50)
        default: return brand(context.attributes.colorHex)
        }
    }

    static func brand(_ hex: String) -> Color {
        var text = hex.trimmingCharacters(in: .whitespaces)
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.count == 6, let value = UInt32(text, radix: 16) else {
            return Color(red: 0.38, green: 0.65, blue: 0.98)
        }
        var r = Double((value >> 16) & 0xFF) / 255
        var g = Double((value >> 8) & 0xFF) / 255
        var b = Double(value & 0xFF) / 255
        let luminance = 0.299 * r + 0.587 * g + 0.114 * b
        if luminance < 0.45 {
            // Towards white, enough to read on black
            r += (1 - r) * 0.55
            g += (1 - g) * 0.55
            b += (1 - b) * 0.55
        }
        return Color(red: r, green: g, blue: b)
    }
}

// MARK: - Pieces

@available(iOS 16.2, *)
private struct DeliveryLogo: View {
    let size: CGFloat
    let corner: CGFloat

    var body: some View {
        Image("DeliveryLogo")
            .resizable()
            .scaledToFill()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }
}

@available(iOS 16.2, *)
private struct DeliveryMinutes: View {
    let minutes: Int
    let label: String
    let tint: Color
    let size: CGFloat

    var body: some View {
        VStack(spacing: 0) {
            Text("\(minutes)")
                .font(.system(size: size, weight: .bold))
                .monospacedDigit()
                .foregroundColor(tint)
            Text(label)
                .font(.caption2)
                .foregroundColor(.white.opacity(0.7))
        }
    }
}

/// The straight track: the rail, what is covered, three stops (the business, with the rider, the
/// door) and the logo where the delivery is. Mirrored for Arabic, the logo kept the right way round.
@available(iOS 16.2, *)
private struct DeliveryTrack: View {
    let context: ActivityViewContext<DeliveryActivityAttributes>

    private static let marker: CGFloat = 32
    private static let stops: [Double] = [0, 0.3, 1]

    var body: some View {
        let tint = DeliveryPalette.tint(context)
        let rtl = context.attributes.rtl
        let at = min(1, max(0, context.state.position))

        VStack(spacing: 2) {
            GeometryReader { geometry in
                let inset = DeliveryTrack.marker / 2
                let span = max(1, geometry.size.width - inset * 2)
                let y = geometry.size.height / 2

                ZStack(alignment: .topLeading) {
                    Capsule()
                        .fill(Color.white.opacity(0.25))
                        .frame(width: span, height: 4)
                        .offset(x: inset, y: y - 2)
                    Capsule()
                        .fill(tint)
                        .frame(width: span * at, height: 4)
                        .offset(x: inset, y: y - 2)
                    ForEach(DeliveryTrack.stops, id: \.self) { stop in
                        Circle()
                            .fill(at >= stop ? tint : Color(white: 0.45))
                            .frame(width: 10, height: 10)
                            .offset(x: inset + span * stop - 5, y: y - 5)
                    }
                    Image("DeliveryLogo")
                        .resizable()
                        .scaledToFill()
                        .frame(width: DeliveryTrack.marker - 5, height: DeliveryTrack.marker - 5)
                        .clipShape(Circle())
                        .scaleEffect(x: rtl ? -1 : 1, y: 1)
                        .padding(2.5)
                        .background(Circle().fill(tint))
                        .offset(x: inset + span * at - DeliveryTrack.marker / 2, y: y - DeliveryTrack.marker / 2)
                }
                .scaleEffect(x: rtl ? -1 : 1, y: 1)
            }
            .frame(height: DeliveryTrack.marker + 2)

            HStack {
                Text(context.attributes.cafeName)
                Spacer()
                Text(context.attributes.doorLabel)
            }
            .font(.caption2)
            .foregroundColor(.white.opacity(0.65))
            .lineLimit(1)
        }
    }
}

// MARK: - Lock screen

@available(iOS 16.2, *)
private struct DeliveryLockScreenView: View {
    let context: ActivityViewContext<DeliveryActivityAttributes>

    var body: some View {
        let tint = DeliveryPalette.tint(context)

        VStack(spacing: 10) {
            HStack(spacing: 11) {
                DeliveryLogo(size: 40, corner: 11)
                VStack(alignment: .leading, spacing: 1) {
                    Text(context.state.title)
                        .font(.headline)
                        .foregroundColor(.white)
                        .lineLimit(1)
                    // Nothing heard for a while (the app was closed): say so, not a stale promise
                    Text(context.isStale ? context.state.staleBody : context.state.body)
                        .font(.footnote)
                        .foregroundColor(.white.opacity(0.7))
                        .lineLimit(2)
                }
                Spacer(minLength: 4)
                if let minutes = context.state.minutes, !context.isStale {
                    DeliveryMinutes(minutes: minutes, label: context.attributes.minLabel, tint: tint, size: 30)
                }
            }

            DeliveryTrack(context: context)
            DeliveryActions(context: context)
        }
        .padding(16)
        .environment(\.layoutDirection, context.attributes.rtl ? .rightToLeft : .leftToRight)
    }
}

// MARK: - Buttons

@available(iOS 16.2, *)
private struct DeliveryActions: View {
    let context: ActivityViewContext<DeliveryActivityAttributes>

    private var state: DeliveryActivityAttributes.ContentState { context.state }

    /// Each button's link opens the app, which rings the number or says the word (AppDelegate)
    private func link(_ action: String) -> URL {
        URL(string: "com.chillax.client://delivery/\(action)?order=\(context.attributes.orderId)")!
    }

    var body: some View {
        let buttons = hasButtons
        if buttons {
            HStack(spacing: 8) {
                if let call = state.callLabel {
                    Link(destination: link("call")) { label(call, icon: "phone.fill", filled: false) }
                }
                if let told = state.toldLabel {
                    Text(told)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(Color.green.opacity(0.28))
                        .foregroundColor(Color(red: 0.37, green: 0.83, blue: 0.60))
                        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                } else if let coming = state.comingLabel {
                    comingButton(coming)
                }
                if let rate = state.rateLabel {
                    Link(destination: link("rate")) { label(rate, icon: "star.fill", filled: true) }
                }
                if let cafe = state.callCafeLabel {
                    Link(destination: link("cafe")) { label(cafe, icon: "phone.fill", filled: true) }
                }
            }
        }
    }

    private var hasButtons: Bool {
        state.callLabel != nil || state.comingLabel != nil || state.toldLabel != nil
            || state.rateLabel != nil || state.callCafeLabel != nil
    }

    @ViewBuilder
    private func comingButton(_ title: String) -> some View {
        if #available(iOS 17, *),
           let token = state.accessToken, DeliveryToken.isFresh(token),
           let api = state.apiBaseUrl {
            // Said from the card itself, the app staying closed
            Button(intent: DeliveryComingIntent(
                orderId: context.attributes.orderId,
                accessToken: token,
                apiBaseUrl: api,
                branchId: state.branchId ?? 0
            )) {
                label(title, icon: "figure.walk", filled: true)
            }
            .buttonStyle(.plain)
        } else {
            // An older iPhone, or the app's sign-in has to be renewed first: the app opens and says it
            Link(destination: link("coming")) { label(title, icon: "figure.walk", filled: true) }
        }
    }

    private func label(_ text: String, icon: String, filled: Bool) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.caption)
            Text(text)
                .font(.subheadline)
                .fontWeight(.semibold)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 9)
        .background(filled ? Color.white : Color.white.opacity(0.15))
        .foregroundColor(filled ? .black : .white)
        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
}

/// Whether the token the app left is still good, by its own expiry: the card says "I'm coming
/// down" by itself only with a token the server will take.
enum DeliveryToken {
    static func isFresh(_ token: String) -> Bool {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { return false }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while payload.count % 4 != 0 { payload.append("=") }
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? Double else { return false }
        return exp - Date().timeIntervalSince1970 > 20
    }
}
