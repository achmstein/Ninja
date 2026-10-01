import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The menu's deck is past its first card (client_web's menu-screen.tsx
/// `compact`): the chrome makes room for the cards. The top bar goes up as
/// far as it is tall, the dock's tabs fold (the menu tucks them itself), and
/// the first card brings it all back. Set by the menu while its cards are on
/// screen; null with no deck there (a list, the whole menu, another tab),
/// where the page's own scroll moves the top bar.
class DeckCompact extends Notifier<bool?> {
  @override
  bool? build() => null;

  void set(bool? compact) {
    if (state != compact) state = compact;
  }
}

final deckCompactProvider = NotifierProvider<DeckCompact, bool?>(DeckCompact.new);
