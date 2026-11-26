import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/layout/breakpoints.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/money.dart';
import '../../../l10n/app_localizations.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';
import '../widgets/shift_report.dart';
import '../../../core/theme/type_roles.dart';

/// The Z-report history: closed shifts newest first, paged. A page shorter
/// than the page size is the last one (the endpoint returns a bare array —
/// no total count to hang page numbers on).
class ShiftHistoryScreen extends ConsumerStatefulWidget {
  const ShiftHistoryScreen({super.key});

  @override
  ConsumerState<ShiftHistoryScreen> createState() => _ShiftHistoryScreenState();
}

class _ShiftHistoryScreenState extends ConsumerState<ShiftHistoryScreen> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(closedShiftsProvider(_page));
    final shifts = async.value;
    final lastPage = (shifts?.length ?? 0) < closedShiftsPageSize;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 768),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  SizedBox.square(
                    dimension: Sizes.control,
                    child: FButton.icon(
                      variant: FButtonVariant.ghost,
                      onPress: () => context.go('/shift'),
                      child: Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(l10n.shiftHistory, style: theme.type.title),
                ],
              ),
              const SizedBox(height: 12),
              if (shifts == null)
                Shimmer.fromColors(
                  baseColor: theme.colors.muted,
                  highlightColor: theme.colors.background,
                  child: Column(
                    children: [
                      for (var i = 0; i < 6; i++)
                        Container(
                          height: 64,
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radiusCard)),
                        ),
                    ],
                  ),
                )
              else if (shifts.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 96),
                  child: Text(l10n.noClosedShifts,
                      textAlign: TextAlign.center,
                      style: theme.type.body.copyWith(color: theme.colors.mutedForeground)),
                )
              else
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: theme.colors.border),
                    borderRadius: BorderRadius.circular(Sizes.radiusCard),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      for (final (index, shift) in shifts.indexed) ...[
                        if (index > 0) Container(height: 1, color: theme.colors.border),
                        _ShiftRow(shift: shift, onTap: () => context.go('/shifts/${shift.id}')),
                      ],
                    ],
                  ),
                ),
              if (_page > 0 || !lastPage) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    SizedBox(
                      height: Sizes.control,
                      child: FButton(
                        variant: FButtonVariant.outline,
                        mainAxisSize: MainAxisSize.min,
                        onPress: _page == 0 ? null : () => setState(() => _page--),
                        child: Text(l10n.previousPage, style: theme.type.button),
                      ),
                    ),
                    const Spacer(),
                    SizedBox(
                      height: Sizes.control,
                      child: FButton(
                        variant: FButtonVariant.outline,
                        mainAxisSize: MainAxisSize.min,
                        onPress: lastPage ? null : () => setState(() => _page++),
                        child: Text(l10n.nextPage, style: theme.type.button),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ShiftRow extends StatelessWidget {
  final ShiftView shift;
  final VoidCallback onTap;

  const _ShiftRow({required this.shift, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    const tabular = [FontFeature.tabularFigures()];
    String at(DateTime? value) => value == null ? '' : formatDateTimeShort(context, value);
    final sales = Text(money(context, shift.salesTotal),
        style: theme.type.heading.copyWith(fontFeatures: tabular));
    final verdict = OverShortPill(value: shift.overShort ?? 0);
    return FTappable(
      onPress: onTap,
      builder: (context, states, child) => Container(
        constraints: const BoxConstraints(minHeight: Sizes.control),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary.withValues(alpha: 0.5) : null,
        child: child,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${at(shift.openedAt)} → ${at(shift.closedAt)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.type.body.copyWith(fontWeight: FontWeight.w500, fontFeatures: tabular)),
                if (shift.openedBy != null && shift.openedBy!.isNotEmpty)
                  Row(
                    children: [
                      Icon(FIcons.user, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(shift.openedBy!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Side by side they leave a phone's row nothing for the dates: there
          // the verdict goes under the sales
          if (context.isCompact)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [sales, const SizedBox(height: 4), verdict],
            )
          else ...[
            sales,
            const SizedBox(width: 12),
            verdict,
          ],
        ],
      ),
    );
  }
}
