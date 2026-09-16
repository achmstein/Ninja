import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/widgets/admin_scaffold.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../core/widgets/ui_components.dart';
import '../../../l10n/app_localizations.dart';
import '../models/place.dart';
import '../providers/places_provider.dart';
import '../status.dart';
import '../widgets/place_form_sheet.dart';

/// Rooms & Tables: every place of the branch, grouped by kind
class PlacesScreen extends ConsumerStatefulWidget {
  const PlacesScreen({super.key});

  @override
  ConsumerState<PlacesScreen> createState() => _PlacesScreenState();
}

class _PlacesScreenState extends ConsumerState<PlacesScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();

    // Auto-refresh for live timers
    _timer = Timer.periodic(AppConfig.placesRefreshInterval, (_) {
      ref.read(placesProvider.notifier).loadPlaces();
    });

    // Listen to route changes and refresh when navigating to this screen
    ref.listenManual(currentRouteProvider, (previous, next) {
      if (next == '/places' && previous != '/places' && previous != null) {
        ref.read(placesProvider.notifier).loadPlaces();
      }
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
    final l10n = AppLocalizations.of(context)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 2, bottom: 8),
          child: Row(
            children: [
              AppText(l10n.placesNav, style: theme.typography.lg.copyWith(fontSize: 18, fontWeight: FontWeight.w600)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.add, size: 22),
                onPressed: () => _showPlaceForm(context),
                tooltip: l10n.newPlace,
              ),
            ],
          ),
        ),

        // Content
        Expanded(
          child: DelayedShimmer(
            isLoading: state.isLoading && state.places.isEmpty,
            shimmer: const ShimmerLoadingList(),
            child: RefreshIndicator(
              color: theme.colors.primary,
              backgroundColor: theme.colors.background,
              onRefresh: () => ref.read(placesProvider.notifier).loadPlaces(),
              child: _PlaceList(
                places: state.places,
                openStays: state.openStays,
                onTapPlace: (place) => place.isTimed ? _showPlaceDetail(context, place) : _showPlaceForm(context, place: place),
                onSetActive: _setActive,
                onEdit: (place) => _showPlaceForm(context, place: place),
                onToggleService: _toggleService,
                onDelete: (place) => _deletePlace(context, place),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _showPlaceForm(BuildContext context, {Place? place}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (context) => PlaceFormSheet(place: place),
    );
  }

  void _showPlaceDetail(BuildContext context, Place place) {
    context.go('/places/${place.id}');
  }

  Future<void> _setActive(Place place, bool isActive) async {
    final l10n = AppLocalizations.of(context)!;
    final refusal = await ref.read(placesProvider.notifier).setActive(place.id, isActive);
    if (refusal != null && mounted) {
      showErrorToast(context, refusal.isEmpty ? l10n.failedToSavePlace : refusal);
    }
  }

  Future<void> _toggleService(Place place) async {
    final l10n = AppLocalizations.of(context)!;
    final next = place.status == PlaceStatus.outOfService ? PlaceStatus.available : PlaceStatus.outOfService;
    final refusal = await ref.read(placesProvider.notifier).setStatus(place.id, next);
    if (refusal != null && mounted) {
      showErrorToast(context, refusal.isEmpty ? l10n.failedToSavePlace : refusal);
    }
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
      showSuccessToast(context, l10n.placeDeleted);
    } else {
      showErrorToast(context, refusal.isEmpty ? l10n.failedToDeletePlace : refusal);
    }
  }
}

/// The places, grouped by kind: rooms, then tables, then stations
class _PlaceList extends StatelessWidget {
  final List<Place> places;
  final List<Stay> openStays;
  final void Function(Place) onTapPlace;
  final void Function(Place, bool) onSetActive;
  final void Function(Place) onEdit;
  final void Function(Place) onToggleService;
  final void Function(Place) onDelete;

  const _PlaceList({
    required this.places,
    required this.openStays,
    required this.onTapPlace,
    required this.onSetActive,
    required this.onEdit,
    required this.onToggleService,
    required this.onDelete,
  });

  String _groupTitle(AppLocalizations l10n, PlaceKind kind) => switch (kind) {
        PlaceKind.room => l10n.rooms,
        PlaceKind.table => l10n.tables,
        PlaceKind.station => l10n.stations,
      };

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    if (places.isEmpty) {
      return EmptyState(
        icon: FIcons.doorOpen,
        title: l10n.noPlacesYet,
      );
    }

    // One flat list: a header row before each kind that has places
    final rows = <Widget>[];
    for (final kind in PlaceKind.values) {
      final ofKind = places.where((p) => p.kind == kind).toList();
      if (ofKind.isEmpty) continue;
      rows.add(Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: AppText(
          _groupTitle(l10n, kind),
          style: theme.typography.sm.copyWith(
            fontWeight: FontWeight.w600,
            color: theme.colors.mutedForeground,
          ),
        ),
      ));
      for (var i = 0; i < ofKind.length; i++) {
        final place = ofKind[i];
        rows.add(_PlaceTile(
          place: place,
          stay: openStays.where((s) => s.placeId == place.id).firstOrNull,
          onTap: () => onTapPlace(place),
          onSetActive: (v) => onSetActive(place, v),
          onEdit: () => onEdit(place),
          onToggleService: () => onToggleService(place),
          onDelete: () => onDelete(place),
        ));
        if (i < ofKind.length - 1) {
          rows.add(Divider(height: 1, indent: 16, endIndent: 16, color: theme.colors.border));
        }
      }
    }

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: rows,
    );
  }
}

/// One place: kind icon, name, rates or status, the active switch, a menu
class _PlaceTile extends StatefulWidget {
  final Place place;
  final Stay? stay;
  final VoidCallback onTap;
  final ValueChanged<bool> onSetActive;
  final VoidCallback onEdit;
  final VoidCallback onToggleService;
  final VoidCallback onDelete;

  const _PlaceTile({
    required this.place,
    this.stay,
    required this.onTap,
    required this.onSetActive,
    required this.onEdit,
    required this.onToggleService,
    required this.onDelete,
  });

  @override
  State<_PlaceTile> createState() => _PlaceTileState();
}

class _PlaceTileState extends State<_PlaceTile> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _setupTimer();
  }

  @override
  void didUpdateWidget(_PlaceTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    _timer?.cancel();
    _setupTimer();
  }

  void _setupTimer() {
    // A running clock and a hold countdown both tick
    if (widget.stay != null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final place = widget.place;
    final stay = widget.stay;
    final statusColor = _statusColor(theme);
    final isOutOfService = place.status == PlaceStatus.outOfService;

    final rates = place.isTimed
        ? '${tariffLine(context, place.options, rateText)} ${l10n.perHour}'
        : l10n.ordersOnly;

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: Opacity(
        opacity: place.isActive ? 1 : 0.55,
        child: Padding(
          padding: const EdgeInsetsDirectional.only(start: 16, end: 4, top: 12, bottom: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Kind icon, tinted by status
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(place.kind.icon, size: 24, color: statusColor),
              ),
              const SizedBox(width: 12),

              // Name, rates, what is going on
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppText(
                      place.name.localized(context),
                      style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, fontSize: 15),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: AppText(
                            _statusLabel(l10n) ?? rates,
                            style: theme.typography.sm.copyWith(
                              color: _statusLabel(l10n) != null ? statusColor : theme.colors.mutedForeground,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    if (stay?.userName != null) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(Icons.person, size: 14, color: theme.colors.mutedForeground),
                          const SizedBox(width: 4),
                          Expanded(
                            child: AppText(
                              stay!.userName!,
                              style: theme.typography.sm.copyWith(color: theme.colors.foreground, fontSize: 13),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

              // Active switch: off keeps the place but customers cannot use it
              FSwitch(
                value: place.isActive,
                onChange: widget.onSetActive,
              ),

              PopupMenuButton<String>(
                icon: Icon(Icons.more_vert, size: 20, color: theme.colors.mutedForeground),
                onSelected: (value) {
                  switch (value) {
                    case 'edit':
                      widget.onEdit();
                    case 'service':
                      widget.onToggleService();
                    case 'delete':
                      widget.onDelete();
                  }
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'edit',
                    child: Row(
                      children: [
                        const Icon(Icons.edit_outlined, size: 20),
                        const SizedBox(width: 8),
                        Text(l10n.edit),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'service',
                    child: Row(
                      children: [
                        Icon(isOutOfService ? Icons.check_circle_outline : Icons.build_outlined, size: 20),
                        const SizedBox(width: 8),
                        Text(isOutOfService ? l10n.backInService : l10n.outOfService),
                      ],
                    ),
                  ),
                  if (stay == null)
                    PopupMenuItem(
                      value: 'delete',
                      child: Row(
                        children: [
                          Icon(Icons.delete_outline, size: 20, color: theme.colors.destructive),
                          const SizedBox(width: 8),
                          Text(l10n.delete, style: TextStyle(color: theme.colors.destructive)),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// What the clock or the hold says; null when the rates line should show
  String? _statusLabel(AppLocalizations l10n) {
    final stay = widget.stay;
    if (stay?.status == StayStatus.running) {
      return stay!.formattedDuration;
    }
    if (stay?.status == StayStatus.held) {
      if (stay!.expiresAt != null) {
        final remaining = stay.timeUntilExpiration;
        if (remaining != null && remaining.inSeconds > 0) {
          return l10n.expiresIn(stay.formattedCountdown);
        }
        return l10n.expiredAutoCancelling;
      }
      return l10n.held;
    }
    switch (widget.place.status) {
      case PlaceStatus.occupied:
        return l10n.statusOccupied;
      case PlaceStatus.outOfService:
        return l10n.outOfService;
      case PlaceStatus.available:
      case PlaceStatus.held:
        return null;
    }
  }

  Color _statusColor(FThemeData theme) {
    final stay = widget.stay;
    if (stay?.status == StayStatus.running) {
      return theme.colors.destructive;
    }
    if (stay?.status == StayStatus.held) {
      // Red when the hold is about to lapse
      final remaining = stay!.timeUntilExpiration;
      if (remaining != null && remaining.inMinutes < 5) {
        return theme.colors.destructive;
      }
      return Colors.orange;
    }

    switch (widget.place.status) {
      case PlaceStatus.available:
        return Colors.green;
      case PlaceStatus.occupied:
        return theme.colors.destructive;
      case PlaceStatus.held:
        return Colors.orange;
      case PlaceStatus.outOfService:
        return theme.colors.mutedForeground;
    }
  }
}
