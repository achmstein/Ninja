import 'package:flutter/material.dart';
import 'package:ninja_app_core/motion/motion.dart';
import '../../customers/screens/customer_search_screen.dart';
import '../models/sale_line.dart';

/// The one customer picker behind "Choose customer" on the sale pad, in the
/// new-bill dialog, on a room's people and on the floor's lookup: a search by
/// name on the whole screen (see [CustomerSearchScreen]).
/// With [accountsOnly] there is no name shortcut: for the room roster, a
/// member is a tab the bill can go on, and a bare name is nobody.
/// [quickPicks] are offered before anyone else: the room's roster when the
/// sale is for a room; most of the time the person is already there, so
/// this is one tap instead of a search.
/// [title] says what a plain lookup is for, in place of "Choose customer".
/// [busy] are accounts that cannot be picked, each with where their bill
/// is: opening a new bill, whoever already has one running shows greyed
/// out with it — one person, one bill.
Future<SaleCustomer?> showCustomerDialog(
  BuildContext context, {
  bool accountsOnly = false,
  List<({String id, String name})> quickPicks = const [],
  String? title,
  Map<String, String> busy = const {},
}) {
  // Over whatever asked, dialogs included: the whole screen, on the root navigator
  return Navigator.of(context, rootNavigator: true).push<SaleCustomer>(
    PageRouteBuilder(
      fullscreenDialog: true,
      transitionDuration: Motion.base,
      reverseTransitionDuration: Motion.base,
      pageBuilder: (context, _, _) =>
          CustomerSearchScreen(accountsOnly: accountsOnly, quickPicks: quickPicks, title: title, busy: busy),
      transitionsBuilder: (context, animation, _, child) => FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Motion.enter, reverseCurve: Motion.exit),
        child: child,
      ),
    ),
  );
}
