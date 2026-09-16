import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../../core/models/localized_text.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../../customers/models/customer.dart';
import '../models/place.dart';
import '../providers/places_provider.dart';
import '../status.dart';
import '../widgets/place_form_sheet.dart';

/// One timed place - Split view: what is going on now (top) + history (bottom)
class PlaceDetailScreen extends ConsumerStatefulWidget {
  final int placeId;

  const PlaceDetailScreen({super.key, required this.placeId});

  @override
  ConsumerState<PlaceDetailScreen> createState() => _PlaceDetailScreenState();
}

class _PlaceDetailScreenState extends ConsumerState<PlaceDetailScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(placesProvider.notifier).loadPlaces();
      ref.read(placesProvider.notifier).loadStayHistory(widget.placeId);
    });

    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(placesProvider);
    final theme = context.theme;

    final place = state.places.where((p) => p.id == widget.placeId).firstOrNull;
    final stay = state.openStayOn(widget.placeId);

    if (place == null) {
      return Scaffold(
        backgroundColor: theme.colors.background,
        body: SafeArea(
          child: Column(
            children: [
              _buildHeader(context, theme, null, null),
              Expanded(child: Center(child: CircularProgressIndicator(color: theme.colors.primary))),
            ],
          ),
        ),
      );
    }

    final isRunning = stay?.status == StayStatus.running;
    final isHeld = stay?.status == StayStatus.held;
    final isAvailable = place.status == PlaceStatus.available && !isRunning && !isHeld;

    return Scaffold(
      backgroundColor: theme.colors.background,
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            _buildHeader(context, theme, place, stay),

            // TOP HALF: what is going on now
            _CurrentStateSection(
              place: place,
              stay: stay,
              isRunning: isRunning,
              isHeld: isHeld,
              isAvailable: isAvailable,
              onHold: () => _holdPlace(context, place),
              onWalkIn: () => _startWalkIn(place),
              onStartStay: stay != null ? () => _startStay(stay) : null,
              onConfirmStay: stay != null ? () => _confirmStay(stay) : null,
              onEndStay: stay != null ? () => _endStay(context, stay) : null,
              onCancelStay: stay != null ? () => _cancelStay(context, stay) : null,
              onAssignCustomer: stay != null && isHeld && stay.customerId == null
                  ? () => _showAddCustomerSheet(context, stay)
                  : null,
              onAddCustomer: stay != null && isRunning ? () => _showAddCustomerSheet(context, stay) : null,
              onRemoveMember: stay != null && isRunning
                  ? (customerId) => _removeMember(context, stay.id, customerId)
                  : null,
              onChangeOption: stay != null && isRunning && stay.hasOptions
                  ? (code) => _changeOption(stay, code)
                  : null,
            ),

            // BOTTOM HALF: history
            Expanded(
              child: _HistorySection(
                stays: state.stayHistory ?? [],
                isLoading: state.isLoadingHistory,
                hasMore: state.hasMoreHistory,
                onLoadMore: () => ref.read(placesProvider.notifier).loadStayHistory(widget.placeId, loadMore: true),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, FThemeData theme, Place? place, Stay? stay) {
    final l10n = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              ref.read(placesProvider.notifier).clearStayHistory();
              context.go('/places');
            },
          ),
          const Spacer(),
          if (place != null) ...[
            IconButton(
              icon: const Icon(Icons.qr_code, size: 20),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: 'https://chillax.site/p/${place.id}'));
                showSuccessToast(context, l10n.placeLinkCopied);
              },
              tooltip: l10n.copyPlaceLink,
            ),
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 20),
              onPressed: () => _showEditSheet(context, place),
              tooltip: l10n.edit,
            ),
            if (stay == null)
              IconButton(
                icon: Icon(Icons.delete_outline, size: 20, color: theme.colors.destructive),
                onPressed: () => _deletePlace(context, place),
                tooltip: l10n.delete,
              ),
          ],
        ],
      ),
    );
  }

  void _showEditSheet(BuildContext context, Place place) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (context) => PlaceFormSheet(place: place),
    );
  }

  /// Hold the place for someone on their way: their name, and whether
  /// the clock should start the moment they are confirmed
  Future<void> _holdPlace(BuildContext context, Place place) async {
    final l10n = AppLocalizations.of(context)!;
    final result = await showModalBottomSheet<({String? customerName, bool startOnConfirm})>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (context) => _HoldSheet(place: place),
    );
    if (result == null) return;
    final ok = await ref.read(placesProvider.notifier).holdPlace(
          place.id,
          customerName: result.customerName,
          startOnConfirm: result.startOnConfirm,
        );
    if (!context.mounted) return;
    if (ok) {
      showSuccessToast(context, l10n.placeHeld(place.name.localized(context)));
    } else {
      showErrorToast(context, l10n.failedToHold);
    }
  }

  /// Which rate to run at; null when the user backed out. A place with a
  /// single rate never asks.
  Future<String?> _pickOption(List<RateOption> options) async {
    if (options.length < 2) return options.firstOrNull?.code ?? '';
    final l10n = AppLocalizations.of(context)!;
    return showAdaptiveDialog<String>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.vertical,
        title: AppText(l10n.rate),
        body: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            for (final option in options) ...[
              FButton(
                variant: option == options.first ? null : FButtonVariant.outline,
                onPress: () => Navigator.of(context).pop(option.code),
                child: AppText('${option.name.localized(context)} · ${rateText(option.hourlyRate)} ${l10n.perHour}'),
              ),
              const SizedBox(height: 8),
            ],
          ],
        ),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(null),
          ),
        ],
      ),
    );
  }

  Future<void> _startWalkIn(Place place) async {
    final l10n = AppLocalizations.of(context)!;
    final code = await _pickOption(place.options);
    if (code == null) return;
    final ok = await ref.read(placesProvider.notifier).startWalkIn(place.id, optionCode: code.isEmpty ? null : code);
    if (mounted && !ok) showErrorToast(context, l10n.failedToStartClock);
  }

  Future<void> _startStay(Stay stay) async {
    final l10n = AppLocalizations.of(context)!;
    final code = await _pickOption(stay.options);
    if (code == null) return;
    final ok = await ref.read(placesProvider.notifier).startStay(stay.id, optionCode: code.isEmpty ? null : code);
    if (mounted && !ok) showErrorToast(context, l10n.failedToStartClock);
  }

  /// The customer arrived. When the hold asked for it, this starts the
  /// clock too, so the rate is asked first.
  Future<void> _confirmStay(Stay stay) async {
    final l10n = AppLocalizations.of(context)!;
    String? code;
    if (stay.startOnConfirm) {
      code = await _pickOption(stay.options);
      if (code == null) return;
    }
    final ok = await ref.read(placesProvider.notifier).confirmStay(stay.id, optionCode: code == null || code.isEmpty ? null : code);
    if (mounted && !ok) showErrorToast(context, l10n.failedToConfirm);
  }

  Future<void> _endStay(BuildContext context, Stay stay) async {
    final l10n = AppLocalizations.of(context)!;
    final estimate = stay.estimate(DateTime.now());
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.endTimeQuestion),
        body: AppText(l10n.endTimeEstimate(rateText(estimate.amount))),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.keepGoing),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            child: AppText(l10n.end),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final ok = await ref.read(placesProvider.notifier).endStay(stay.id);
    if (!context.mounted) return;
    if (ok) {
      showSuccessToast(context, l10n.timeEnded);
      // Reload history to show the ended stay
      ref.read(placesProvider.notifier).loadStayHistory(widget.placeId);
    } else {
      showErrorToast(context, l10n.failedToEndTime);
    }
  }

  /// Give up a hold, or cut a running clock short with nothing on the bill
  Future<void> _cancelStay(BuildContext context, Stay stay) async {
    final l10n = AppLocalizations.of(context)!;
    final held = stay.status == StayStatus.held;
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(held ? l10n.cancelHoldQuestion : l10n.cancelTimeQuestion),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.no),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            variant: FButtonVariant.destructive,
            child: AppText(held ? l10n.cancelHold : l10n.cancelTime),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final ok = await ref.read(placesProvider.notifier).cancelStay(stay.id);
    if (!context.mounted) return;
    if (ok) {
      showSuccessToast(context, held ? l10n.holdCancelled : l10n.timeCancelled);
      // Reload history to show the cancelled stay
      ref.read(placesProvider.notifier).loadStayHistory(widget.placeId);
    } else {
      showErrorToast(context, l10n.failedToCancelHold);
    }
  }

  void _showAddCustomerSheet(BuildContext context, Stay stay) {
    // Collect already-assigned customer IDs to filter them out
    final existingCustomerIds = <String>{};
    if (stay.customerId != null) existingCustomerIds.add(stay.customerId!);
    for (final member in stay.members) {
      existingCustomerIds.add(member.customerId);
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (sheetContext) => _AssignCustomerSheet(
        excludeCustomerIds: existingCustomerIds,
        onCustomerSelected: (customer) async {
          Navigator.pop(sheetContext);
          final l10n = AppLocalizations.of(context)!;
          bool success;
          if (stay.customerId == null) {
            // Nobody owns the stay yet - this customer does
            success = await ref.read(placesProvider.notifier).assignStayCustomer(
                  stay.id,
                  customer.id,
                  customer.displayName,
                );
          } else {
            // Already owned - add as member
            success = await ref.read(placesProvider.notifier).addStayMember(
                  stay.id,
                  customer.id,
                  customer.displayName,
                );
          }
          if (context.mounted) {
            if (success) {
              showSuccessToast(context, l10n.customerAssigned);
            } else {
              showErrorToast(context, l10n.failedToAssignCustomer);
            }
          }
        },
      ),
    );
  }

  Future<void> _removeMember(BuildContext context, int stayId, String customerId) async {
    final l10n = AppLocalizations.of(context)!;
    final success = await ref.read(placesProvider.notifier).removeStayMember(stayId, customerId);
    if (context.mounted) {
      if (success) {
        showSuccessToast(context, l10n.memberRemoved);
      } else {
        showErrorToast(context, l10n.failedToRemoveMember);
      }
    }
  }

  Future<void> _changeOption(Stay stay, String code) async {
    final l10n = AppLocalizations.of(context)!;
    final next = optionLabel(context, stay.options, code);
    final current = optionLabel(context, stay.options, stay.currentOptionCode);
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.switchToRateQuestion(next)),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.keepRate(current)),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            child: AppText(l10n.switchRate),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final ok = await ref.read(placesProvider.notifier).changeOption(stay.id, code);
    if (mounted && !ok) showErrorToast(context, l10n.failedToChangeRate);
  }

  Future<void> _deletePlace(BuildContext context, Place place) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.deletePlaceQuestion),
        body: AppText(place.name.localized(context)),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            variant: FButtonVariant.destructive,
            child: AppText(l10n.delete),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final refusal = await ref.read(placesProvider.notifier).deletePlace(place.id);
    if (!context.mounted) return;
    if (refusal == null) {
      ref.read(placesProvider.notifier).clearStayHistory();
      context.go('/places');
    } else {
      showErrorToast(context, refusal.isEmpty ? l10n.failedToDeletePlace : refusal);
    }
  }
}

/// Sheet: hold the place for someone
class _HoldSheet extends StatefulWidget {
  final Place place;

  const _HoldSheet({required this.place});

  @override
  State<_HoldSheet> createState() => _HoldSheetState();
}

class _HoldSheetState extends State<_HoldSheet> {
  final _nameController = TextEditingController();
  bool _startOnConfirm = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: theme.colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: theme.colors.mutedForeground,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                AppText(
                  l10n.holdPlaceTitle(widget.place.name.localized(context)),
                  style: theme.typography.lg.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                AppText(l10n.customer, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                FTextField(
                  control: FTextFieldControl.managed(controller: _nameController),
                  hint: l10n.name,
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: AppText(l10n.startOnConfirm, style: theme.typography.sm)),
                    FSwitch(
                      value: _startOnConfirm,
                      onChange: (v) => setState(() => _startOnConfirm = v),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: () => Navigator.of(context).pop(),
                        child: AppText(l10n.cancel),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FButton(
                        onPress: () {
                          final name = _nameController.text.trim();
                          Navigator.of(context).pop((
                            customerName: name.isEmpty ? null : name,
                            startOnConfirm: _startOnConfirm,
                          ));
                        },
                        child: AppText(l10n.hold),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Top section: what is going on now
class _CurrentStateSection extends StatelessWidget {
  final Place place;
  final Stay? stay;
  final bool isRunning;
  final bool isHeld;
  final bool isAvailable;
  final VoidCallback onHold;
  final VoidCallback onWalkIn;
  final VoidCallback? onStartStay;
  final VoidCallback? onConfirmStay;
  final VoidCallback? onEndStay;
  final VoidCallback? onCancelStay;
  final VoidCallback? onAssignCustomer;
  final VoidCallback? onAddCustomer;
  final ValueChanged<String>? onRemoveMember;
  final ValueChanged<String>? onChangeOption;

  const _CurrentStateSection({
    required this.place,
    required this.stay,
    required this.isRunning,
    required this.isHeld,
    required this.isAvailable,
    required this.onHold,
    required this.onWalkIn,
    this.onStartStay,
    this.onConfirmStay,
    this.onEndStay,
    this.onCancelStay,
    this.onAssignCustomer,
    this.onAddCustomer,
    this.onRemoveMember,
    this.onChangeOption,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final now = DateTime.now();

    // Get status color
    Color statusColor;
    if (isRunning) {
      statusColor = theme.colors.destructive;
    } else if (isHeld) {
      statusColor = Colors.orange;
    } else if (isAvailable) {
      statusColor = Colors.green;
    } else {
      statusColor = theme.colors.mutedForeground;
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Place name + status indicator + rates
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: statusColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppText(
                  place.name.localized(context),
                  style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              AppText(
                '${tariffLine(context, place.options, rateText)} ${l10n.perHour}',
                style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Running: the clock, big
          if (isRunning && stay != null) ...[
            Center(
              child: AppText(
                stay!.formattedDuration,
                style: TextStyle(
                  fontSize: 56,
                  fontWeight: FontWeight.w300,
                  fontFamily: 'monospace',
                  letterSpacing: 4,
                  height: 1,
                  color: theme.colors.foreground,
                ),
              ),
            ),

            const SizedBox(height: 8),

            // Time on each rate, and what it comes to so far
            if (stay!.hasOptions && stay!.usedOptions(now).isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (final option in stay!.usedOptions(now)) ...[
                    if (option != stay!.usedOptions(now).first) const SizedBox(width: 16),
                    AppText(
                      '${option.name.localized(context)} ${formatClock(stay!.optionSeconds(option.code, now))}',
                      style: theme.typography.xs.copyWith(
                        color: theme.colors.mutedForeground,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 6),
            ],
            Center(
              child: AppText(
                '${l10n.estimate}: ${rateText(stay!.estimate(now).amount)}',
                style: theme.typography.sm.copyWith(
                  color: theme.colors.mutedForeground,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Rate toggle, when there is a choice
            if (onChangeOption != null) ...[
              _RateOptionToggle(
                options: stay!.options,
                currentCode: stay!.currentOptionCode,
                onChanged: onChangeOption!,
              ),
              const SizedBox(height: 16),
            ],

            const SizedBox(height: 16),

            // Members list
            if (stay!.members.isNotEmpty) ...[
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: stay!.members.map((member) {
                    return Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: GestureDetector(
                        onTap: () => context.push('/customers/${member.customerId}'),
                        child: Chip(
                          avatar: Icon(
                            member.isOwner ? Icons.star : Icons.person,
                            size: 16,
                            color: member.isOwner ? Colors.amber : theme.colors.mutedForeground,
                          ),
                          label: AppText(
                            member.customerName ?? member.customerId,
                            style: theme.typography.sm,
                          ),
                          deleteIcon: member.isOwner ? null : const Icon(Icons.close, size: 16),
                          onDeleted: member.isOwner || onRemoveMember == null
                              ? null
                              : () => onRemoveMember!(member.customerId),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 12),
            ] else if (stay!.userName != null) ...[
              // Fallback: show the one name if no members loaded
              GestureDetector(
                onTap: stay!.customerId != null ? () => context.push('/customers/${stay!.customerId}') : null,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.person_outline, size: 16, color: theme.colors.mutedForeground),
                    const SizedBox(width: 4),
                    AppText(
                      stay!.userName!,
                      style: theme.typography.sm.copyWith(
                        color: theme.colors.mutedForeground,
                        decoration: stay!.customerId != null ? TextDecoration.underline : null,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Add Customer button (always available while the clock runs)
            if (onAddCustomer != null) ...[
              Center(
                child: FButton(
                  variant: FButtonVariant.outline,
                  onPress: onAddCustomer,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.person_add_outlined, size: 18),
                      const SizedBox(width: 8),
                      AppText(l10n.addCustomer),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // End / cancel
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FButton(
                  variant: FButtonVariant.outline,
                  onPress: onCancelStay,
                  child: AppText(l10n.cancelTime),
                ),
                const SizedBox(width: 12),
                FButton(
                  variant: FButtonVariant.destructive,
                  onPress: onEndStay,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.stop, size: 18),
                      const SizedBox(width: 8),
                      AppText(l10n.end),
                    ],
                  ),
                ),
              ],
            ),
          ],

          // Held: someone is on their way
          if (isHeld && stay != null) ...[
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.schedule, size: 32, color: Colors.orange),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    stay!.userName != null ? l10n.heldFor(stay!.userName!) : l10n.held,
                    style: theme.typography.lg.copyWith(fontWeight: FontWeight.w500),
                  ),
                  if (stay!.startOnConfirm) ...[
                    const SizedBox(height: 4),
                    AppText(
                      l10n.startsOnConfirm,
                      style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground),
                    ),
                  ],
                  const SizedBox(height: 12),
                  if (stay!.userName != null && stay!.customerId != null)
                    GestureDetector(
                      onTap: () => context.push('/customers/${stay!.customerId}'),
                      child: Chip(
                        avatar: const Icon(Icons.star, size: 16, color: Colors.amber),
                        label: AppText(stay!.userName!, style: theme.typography.sm),
                        visualDensity: VisualDensity.compact,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    )
                  else if (onAssignCustomer != null)
                    GestureDetector(
                      onTap: onAssignCustomer,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          border: Border.all(color: theme.colors.border, style: BorderStyle.solid),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.person_add_outlined, size: 18, color: theme.colors.mutedForeground),
                            const SizedBox(width: 8),
                            AppText(
                              l10n.addCustomer,
                              style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                            ),
                          ],
                        ),
                      ),
                    ),
                  // Countdown to when the hold lapses
                  if (stay!.expiresAt != null) ...[
                    const SizedBox(height: 16),
                    _ExpirationCountdown(stay: stay!),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FButton(
                  variant: FButtonVariant.outline,
                  onPress: onCancelStay,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.close, size: 18),
                      const SizedBox(width: 8),
                      AppText(l10n.cancelHold),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // Confirm starts the clock when the hold asked for it;
                // otherwise Start does
                FButton(
                  onPress: stay!.startOnConfirm ? onConfirmStay : onStartStay,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Transform.scale(
                        scaleX: Directionality.of(context) == TextDirection.rtl ? -1 : 1,
                        child: Icon(stay!.startOnConfirm ? Icons.check : Icons.play_arrow, size: 18),
                      ),
                      const SizedBox(width: 8),
                      AppText(stay!.startOnConfirm ? l10n.confirm : l10n.startClockAt(place.name.localized(context))),
                    ],
                  ),
                ),
              ],
            ),
          ],

          // Available: hold or walk in
          if (isAvailable) ...[
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check_circle_outline, size: 32, color: Colors.green),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    l10n.available,
                    style: theme.typography.lg.copyWith(fontWeight: FontWeight.w500),
                  ),
                  if (place.description != null && place.description!.en.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    AppText(
                      place.description!.localized(context),
                      style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FButton(
                  variant: FButtonVariant.outline,
                  onPress: onHold,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.bookmark_add_outlined, size: 18),
                      const SizedBox(width: 8),
                      AppText(l10n.hold),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                FButton(
                  onPress: onWalkIn,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Transform.scale(
                        scaleX: Directionality.of(context) == TextDirection.rtl ? -1 : 1,
                        child: const Icon(Icons.play_arrow, size: 18),
                      ),
                      const SizedBox(width: 8),
                      AppText(l10n.walkIn),
                    ],
                  ),
                ),
              ],
            ),
          ],

          // Out of service, or occupied without a stay
          if (!isRunning && !isHeld && !isAvailable) ...[
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: theme.colors.muted,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.build_outlined, size: 32, color: theme.colors.mutedForeground),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    place.status == PlaceStatus.outOfService ? l10n.outOfService : l10n.statusOccupied,
                    style: theme.typography.lg.copyWith(
                      fontWeight: FontWeight.w500,
                      color: theme.colors.mutedForeground,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Toggle between the rate options of a running stay
class _RateOptionToggle extends StatelessWidget {
  final List<RateOption> options;
  final String? currentCode;
  final ValueChanged<String> onChanged;

  const _RateOptionToggle({
    required this.options,
    required this.currentCode,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;

    return Center(
      child: Container(
        decoration: BoxDecoration(
          color: theme.colors.muted,
          borderRadius: BorderRadius.circular(10),
        ),
        padding: const EdgeInsets.all(3),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final option in options)
              _optionButton(
                context,
                label: option.name.localized(context),
                rate: option.hourlyRate,
                isSelected: option.code == currentCode,
                onTap: () {
                  if (option.code != currentCode) onChanged(option.code);
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _optionButton(
    BuildContext context, {
    required String label,
    required double rate,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? theme.colors.background : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: isSelected
              ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4, offset: const Offset(0, 1))]
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppText(
              label,
              style: theme.typography.sm.copyWith(
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                color: isSelected ? theme.colors.foreground : theme.colors.mutedForeground,
              ),
            ),
            const SizedBox(height: 2),
            AppText(
              '${rateText(rate)} ${l10n.perHour}',
              style: theme.typography.xs.copyWith(
                color: isSelected ? theme.colors.primary : theme.colors.mutedForeground,
                fontWeight: isSelected ? FontWeight.w500 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom section: history with load more
class _HistorySection extends StatelessWidget {
  final List<Stay> stays;
  final bool isLoading;
  final bool hasMore;
  final VoidCallback? onLoadMore;

  const _HistorySection({
    required this.stays,
    required this.isLoading,
    this.hasMore = false,
    this.onLoadMore,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final locale = Localizations.localeOf(context);
    final l10n = AppLocalizations.of(context)!;
    final dateFormat = DateFormat('MMM d', locale.languageCode);
    final timeFormat = DateFormat('h:mm a', locale.languageCode);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
          child: AppText(
            l10n.timeHistory,
            style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600),
          ),
        ),

        // List
        Expanded(
          child: isLoading && stays.isEmpty
              ? Center(child: CircularProgressIndicator(color: theme.colors.primary))
              : stays.isEmpty
                  ? Center(
                      child: AppText(
                        l10n.noTimeHistory,
                        style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: stays.length + (hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        // Load more button
                        if (index == stays.length) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Center(
                              child: isLoading
                                  ? SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.primary),
                                    )
                                  : GestureDetector(
                                      onTap: onLoadMore,
                                      child: AppText(
                                        l10n.loadMore,
                                        style: theme.typography.sm.copyWith(color: theme.colors.primary),
                                      ),
                                    ),
                            ),
                          );
                        }

                        final stay = stays[index];
                        final when = stay.startedAt ?? stay.createdAt;
                        final cancelled = stay.status == StayStatus.cancelled;
                        return GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _showStayDetailSheet(context, stay),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                // Date & time
                                SizedBox(
                                  width: 70,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      AppText(
                                        dateFormat.format(when.toLocal()),
                                        style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                                      ),
                                      AppText(
                                        timeFormat.format(when.toLocal()),
                                        style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground),
                                      ),
                                    ],
                                  ),
                                ),

                                // Who
                                Expanded(
                                  child: stay.userName != null
                                      ? AppText(
                                          stay.userName!,
                                          style: theme.typography.sm,
                                          overflow: TextOverflow.ellipsis,
                                        )
                                      : AppText(
                                          l10n.walkIn,
                                          style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                                        ),
                                ),

                                // How long, or that it was cancelled
                                AppText(
                                  cancelled ? l10n.cancelled : stay.formattedDuration,
                                  style: theme.typography.sm.copyWith(
                                    fontFamily: cancelled ? null : 'monospace',
                                    fontWeight: FontWeight.w500,
                                    color: cancelled ? theme.colors.mutedForeground : null,
                                  ),
                                ),

                                const SizedBox(width: 4),
                                Icon(Icons.chevron_right, size: 16, color: theme.colors.mutedForeground),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }

  void _showStayDetailSheet(BuildContext context, Stay stay) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final hSuffix = l10n.hoursShort;
    final locale = Localizations.localeOf(context).languageCode;
    final now = DateTime.now();
    final cancelled = stay.status == StayStatus.cancelled;

    // What the server settled per rate; only the rates that were used
    final lines = stay.costs.where((c) => c.hours > 0).toList();
    final colors = [theme.colors.primary, Colors.orange, Colors.teal, Colors.purple];

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: theme.colors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),

              // Header: icon + who/when + how long
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: theme.colors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(stay.placeKind.icon, size: 22, color: theme.colors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppText(
                          stay.userName ?? l10n.walkIn,
                          style: theme.typography.base.copyWith(fontWeight: FontWeight.w600),
                        ),
                        AppText(
                          DateFormat('MMM d, y – h:mm a', locale).format((stay.startedAt ?? stay.createdAt).toLocal()),
                          style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      AppText(
                        cancelled ? l10n.cancelled : stay.formattedDuration,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          fontFamily: cancelled ? null : 'monospace',
                          letterSpacing: 1,
                          color: theme.colors.foreground,
                        ),
                      ),
                      if (!cancelled)
                        AppText(
                          stay.totalCost != null ? rateText(stay.totalCost!) : l10n.totalDuration,
                          style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground, fontSize: 10),
                        ),
                    ],
                  ),
                ],
              ),

              // Per-rate breakdown
              if (lines.isNotEmpty) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    for (var i = 0; i < lines.length; i++) ...[
                      if (i > 0) const SizedBox(width: 12),
                      Expanded(
                        child: _rateCard(
                          theme,
                          lines[i].optionName.localized(context),
                          formatClock(stay.optionSeconds(lines[i].optionCode, now)),
                          '${hoursText(lines[i].hours)} $hSuffix · ${rateText(lines[i].cost)}',
                          colors[i % colors.length],
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _rateCard(FThemeData theme, String label, String duration, String billed, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          AppText(
            duration,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: color,
              fontFamily: 'monospace',
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 2),
          AppText(
            billed,
            style: theme.typography.xs.copyWith(color: color.withValues(alpha: 0.6)),
          ),
          const SizedBox(height: 4),
          AppText(
            label,
            style: theme.typography.xs.copyWith(
              color: color.withValues(alpha: 0.8),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

/// Countdown to when a hold lapses
class _ExpirationCountdown extends StatelessWidget {
  final Stay stay;

  const _ExpirationCountdown({required this.stay});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final remaining = stay.timeUntilExpiration;

    if (remaining == null) return const SizedBox.shrink();

    // Determine urgency level
    final isExpired = remaining.inSeconds <= 0;
    final isUrgent = remaining.inMinutes < 5;

    Color bgColor;
    Color textColor;
    String message;

    if (isExpired) {
      bgColor = theme.colors.destructive.withValues(alpha: 0.15);
      textColor = theme.colors.destructive;
      message = l10n.expiredAutoCancelling;
    } else if (isUrgent) {
      bgColor = theme.colors.destructive.withValues(alpha: 0.1);
      textColor = theme.colors.destructive;
      message = l10n.autoCancelIn(stay.formattedCountdown);
    } else {
      bgColor = Colors.orange.withValues(alpha: 0.1);
      textColor = Colors.orange.shade700;
      message = l10n.expiresIn(stay.formattedCountdown);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isUrgent || isExpired ? Icons.warning_amber_rounded : Icons.timer_outlined,
            size: 16,
            color: textColor,
          ),
          const SizedBox(width: 6),
          AppText(
            message,
            style: theme.typography.sm.copyWith(color: textColor, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet for searching and putting a customer on a stay
class _AssignCustomerSheet extends ConsumerStatefulWidget {
  final ValueChanged<Customer> onCustomerSelected;
  final Set<String> excludeCustomerIds;

  const _AssignCustomerSheet({
    required this.onCustomerSelected,
    this.excludeCustomerIds = const {},
  });

  @override
  ConsumerState<_AssignCustomerSheet> createState() => _AssignCustomerSheetState();
}

class _AssignCustomerSheetState extends ConsumerState<_AssignCustomerSheet> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<Customer> _results = [];
  bool _isSearching = false;
  late final ApiClient _identityApi;

  @override
  void initState() {
    super.initState();
    _identityApi = ref.read(identityApiProvider);
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    _debounce?.cancel();
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      setState(() {
        _results = [];
        _isSearching = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(query));
  }

  Future<void> _search(String query) async {
    setState(() => _isSearching = true);
    try {
      final response = await _identityApi.get('/users', queryParameters: {
        'search': query,
        'max': 20,
      });
      final data = response.data as List<dynamic>;
      final users = data
          .map((e) => Customer.fromJson(e as Map<String, dynamic>))
          .where((c) => !widget.excludeCustomerIds.contains(c.id))
          .toList();
      if (mounted) {
        setState(() {
          _results = users;
          _isSearching = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _results = [];
          _isSearching = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final bottomPadding = MediaQuery.of(context).viewPadding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        bottom: false,
        child: Padding(
          padding: EdgeInsets.only(bottom: bottomInset + bottomPadding),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colors.mutedForeground,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.only(left: 16, right: 16, top: 2, bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: AppText(
                        l10n.addCustomer,
                        style: theme.typography.lg.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Icon(Icons.close, color: theme.colors.mutedForeground),
                    ),
                  ],
                ),
              ),

              // Search field
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FTextField(
                  control: FTextFieldControl.managed(controller: _searchController),
                  hint: l10n.searchCustomerByName,
                ),
              ),
              const SizedBox(height: 8),

              // Results
              if (_isSearching)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator(color: theme.colors.primary)),
                )
              else if (_results.isNotEmpty)
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 300),
                  child: ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      final customer = _results[index];
                      return ListTile(
                        dense: true,
                        visualDensity: VisualDensity.compact,
                        leading: CircleAvatar(
                          radius: 16,
                          backgroundColor: theme.colors.secondary,
                          child: AppText(
                            customer.initials,
                            style: theme.typography.xs.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                        title: AppText(customer.displayName, style: theme.typography.sm),
                        subtitle: customer.email != null
                            ? AppText(customer.email!,
                                style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground))
                            : null,
                        onTap: () => widget.onCustomerSelected(customer),
                      );
                    },
                  ),
                )
              else if (_searchController.text.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: AppText(
                    l10n.noCustomersFound,
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                  ),
                ),

              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
