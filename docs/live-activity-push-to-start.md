# Live Activity / ongoing notification while the app is closed

Goal: when a cashier assigns a customer to a room, the customer's phone shows the
running-session live widget (iOS Live Activity) or ongoing notification (Android)
even if they have not opened the app — reusing the existing SessionLiveActivity
(room name + running timer + quick actions).

## What already exists
- iOS Live Activity extension `ios/ChillaxLiveActivity` (SessionLiveActivity, attributes,
  SessionActionIntent) + `Runner/SessionNotificationHelper` with `show(...)` / `dismiss()`.
- Android ongoing notification via the same MethodChannel `com.chillax.client/session_notification`.
- Silent data FCM `type=session_started` (roomName, sessionId, roomId, startTimeMs, locale)
  sent by Notification.API `SessionMemberJoinedIntegrationEventHandler`.
- `AssignCustomer` on an active session adds the customer as an Owner member and raises
  `SessionMemberJoinedDomainEvent` → the FCM is already sent on assignment.
- Flutter `firebaseMessagingBackgroundHandler` starts the widget from the background isolate.

## Coverage today
- App in background (not force-quit): works on both platforms via the data FCM.
- App force-quit on iOS: NOT delivered (Apple blocks silent pushes to a force-quit app).
- App force-stopped on Android: nothing until reopened (platform limit; swiped-away is fine).

## The gap: iOS force-quit → ActivityKit push-to-start (iOS 17.2+)
Live Activity pushes cannot go through Firebase; they need a direct APNs connection.

### Owner action items (blocking — only you can do these)
1. Apple Developer → Keys → create an **APNs Auth Key (.p8)**. Note the **Key ID**.
2. Note your **Team ID** (Apple Developer membership) and the widget bundle id
   (`com.chillax.client` + the ChillaxLiveActivity extension).
3. Add GitHub secrets: `APNS_AUTH_KEY_P8` (the file contents), `APNS_KEY_ID`,
   `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, and set the APNs environment (production).

### App changes (I build)
- On iOS 17.2+, observe `Activity<SessionActivityAttributes>.pushToStartTokenUpdates`,
  send the hex token to the backend as a new subscription type `LiveActivityPushToStart`.
- Re-register the token on launch and when it rotates.
- Keep the existing app-driven `show`/`dismiss` for the foreground/background path.

### Backend changes (I build)
- Store the push-to-start token (new `SubscriptionType.LiveActivityPushToStart`, per user).
- New `ApnsLiveActivityService`: JWT auth with the .p8 key; POST to
  `https://api.push.apple.com/3/device/<token>` with headers
  `apns-push-type: liveactivity`, `apns-topic: <bundleId>.push-type.liveactivity`,
  and a payload `{ "aps": { "event": "start", "timestamp": ..., "content-state": {...},
  "attributes-type": "SessionActivityAttributes", "attributes": {...} } }`.
- On `SessionMemberJoined` (assignment/join), also send the start push to any stored
  push-to-start tokens for that user, alongside the existing FCM.
- Optional later: send `update`/`end` liveactivity pushes so a force-quit phone keeps
  the timer fresh; otherwise the app takes over updates when next opened.

### Testing
- Requires a physical iOS 17.2+ device; the Simulator cannot receive APNs.
- Verify: force-quit the app, assign the customer on the till, confirm the Live Activity
  starts on the lock screen / Dynamic Island.

## Order of work
1. (Unblocked) App: capture + register the push-to-start token; backend: store it.
2. (Blocked on the .p8 key) Backend: APNs sender + wire to assignment; end-to-end test.
