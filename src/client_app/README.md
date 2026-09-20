# ninja_client

A new Flutter project.

## Getting Started

Against the local AppHost, forward the BFF and sign in against the AppHost's
tenant one; the code has no realm of its own:

```
adb reverse tcp:8080 tcp:5000
flutter run --dart-define=REALM=chillax
```

A release build is told everything by a record instead
(`--dart-define-from-file=../../tenants/chillax.json`, see `tenants/README.md`).

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
