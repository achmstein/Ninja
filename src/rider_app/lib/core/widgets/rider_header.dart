import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'branch_switcher.dart';

/// The top bar: the business and the branch, and nothing else, so the
/// branch has the phone's whole width in either language. The rider's duty
/// switch is the first thing on the deliveries screen, and settings are a
/// tab of the bar at the foot.
class RiderHeader extends StatelessWidget {
  const RiderHeader({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border(bottom: BorderSide(color: theme.colors.border)),
      ),
      alignment: AlignmentDirectional.centerStart,
      child: const BranchSwitcher(),
    );
  }
}
