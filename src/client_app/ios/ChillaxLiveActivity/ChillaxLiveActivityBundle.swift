import SwiftUI
import WidgetKit

@main
struct ChillaxLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        SessionLiveActivity()
        DeliveryLiveActivity()
    }
}
