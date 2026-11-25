import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../brand/brand_mark.dart';

/// The top bar: the business's mark and name, and nothing to switch. A rider
/// works for the business, not a branch: on duty is on duty at every branch
/// they were given, their list holds what each of them gave them, and a
/// delivery card names the branch to collect it from when there is more than
/// one. The duty switch is the first thing on the deliveries screen, and
/// settings are a tab of the bar at the foot.
class RiderHeader extends ConsumerWidget {
  const RiderHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final business = ref.watch(brandProvider).displayName(Localizations.localeOf(context));
    // Before the brand has loaded, the branch stands in for the name
    final branch = ref.watch(branchProvider.select((s) => s.selectedBranch))?.name.localized(context) ?? '';
    final title = business.isEmpty ? branch : business;

    return Container(
      height: Sizes.header,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border(bottom: BorderSide(color: theme.colors.border)),
      ),
      child: Row(
        children: [
          const BrandMark(size: 36),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.ellipsis,
              style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, color: theme.colors.foreground),
            ),
          ),
        ],
      ),
    );
  }
}
