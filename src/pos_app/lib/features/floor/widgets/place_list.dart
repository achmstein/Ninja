import 'dart:async';
import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/heading.dart';
import '../../../l10n/app_localizations.dart';
import '../../places/models/place.dart';
import '../../tickets/models/ticket_summary.dart';

/// Every place that has no bill yet, as a narrow column beside the bills so
/// opening one is a single tap. It stays a list, searchable, so forty tables
/// and twelve rooms cost a scroll or a couple of letters, never the screen.
/// A room opens its controls (start a walk-in, start the reservation that
/// just arrived); a table opens a bill.
class PlaceList extends StatefulWidget {
  final List<Place> places;
  final List<Stay> sessions;
  final List<TicketSummary> tickets;
  final List<Reservation> reservations;
  final bool busy;
  final VoidCallback onNewTab;
  final ValueChanged<Place> onPick;

  const PlaceList({
    super.key,
    required this.places,
    required this.sessions,
    this.reservations = const [],
    required this.tickets,
    required this.busy,
    required this.onNewTab,
    required this.onPick,
  });

  @override
  State<PlaceList> createState() => _PlaceListState();
}

class _PlaceListState extends State<PlaceList> {
  final _term = TextEditingController();
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _term.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _clock?.cancel();
    _term.dispose();
    super.dispose();
  }

  // A running session shows its clock; a second-hand only while one runs
  void _syncClock(bool running) {
    if (running && _clock == null) {
      _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
    } else if (!running && _clock != null) {
      _clock!.cancel();
      _clock = null;
    }
  }

  Stay? _stayForPlace(int placeId) {
    for (final session in widget.sessions) {
      if (session.placeId == placeId) return session;
    }
    return null;
  }

  /// The reservation keeping a place right now, if any
  Reservation? _reservationHolding(int placeId) {
    for (final r in widget.reservations) {
      if (r.placeId == placeId && r.isOpen && r.isHolding) return r;
    }
    return null;
  }

  static String _formatClock(Duration elapsed) {
    final h = elapsed.inHours;
    final m = elapsed.inMinutes % 60;
    final s = elapsed.inSeconds % 60;
    String two(int v) => v.toString().padLeft(2, '0');
    return h > 0 ? '$h:${two(m)}:${two(s)}' : '${two(m)}:${two(s)}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final needle = _term.text.trim().toLowerCase();
    bool matches(LocalizedText name) =>
        needle.isEmpty ||
        name.en.toLowerCase().contains(needle) ||
        (name.ar ?? '').toLowerCase().contains(needle);

    // A place with a bill is among the bills already; one without is here,
    // in whatever state it is in. Bills opened before the remodel name a
    // room by its id.
    bool hasBill(Place place) => widget.tickets.any(
        (t) => t.placeId == place.id || (place.kind == PlaceKind.room && t.placeId == place.id));
    final free = [
      for (final place in widget.places)
        if (place.isActive && matches(place.name) && !hasBill(place)) place,
    ];
    final groups = [
      (PlaceKind.room, l10n.rooms),
      (PlaceKind.table, l10n.tables),
      (PlaceKind.station, l10n.stations),
    ];
    final now = DateTime.now();
    _syncClock(free.any((place) => _stayForPlace(place.id)?.status == StayStatus.running));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FTextField(
          control: FTextFieldControl.managed(controller: _term),
          hint: l10n.searchPlaces,
          prefixBuilder: (context, style, _) => Padding(
            padding: const EdgeInsetsDirectional.only(start: 12),
            child: Icon(FIcons.search, size: 16, color: theme.colors.mutedForeground),
          ),
          maxLines: 1,
        ),
        const SizedBox(height: 4),
        if (needle.isEmpty)
          _PlaceRow(
            leading: Icon(FIcons.plus, size: 20, color: theme.colors.mutedForeground),
            name: l10n.newTab,
            icon: FIcons.shoppingBag,
            onTap: widget.onNewTab,
          ),
        for (final (kind, label) in groups)
          if (free.any((p) => p.kind == kind)) ...[
            Padding(padding: const EdgeInsets.fromLTRB(0, 8, 0, 4), child: Heading(label)),
            for (final place in free.where((p) => p.kind == kind))
              Builder(builder: (context) {
                // A place with a clock has a state; one without is only
                // ever free, unless somebody reserved it and is on their way
                final session = place.isTimed ? _stayForPlace(place.id) : null;
                final reservation = _reservationHolding(place.id);
                final maintenance = place.isTimed && place.status == PlaceStatus.outOfService;
                // The dot already says free; text only when there is
                // something to add
                final detail = session?.status == StayStatus.running && session?.startedAt != null
                    ? _formatClock(now.difference(session!.startedAt!))
                    : reservation != null
                        ? (reservation.customerName ?? l10n.statusReserved)
                        : maintenance
                            ? l10n.underMaintenance
                            : null;
                return _PlaceRow(
                  leading: _StatusDot(
                      color: place.isTimed || place.status == PlaceStatus.held ? _placeDot(place.status) : AppColors.successColor),
                  name: place.name.localized(context),
                  detail: detail,
                  icon: place.kind.icon,
                  onTap: maintenance || widget.busy ? null : () => widget.onPick(place),
                );
              }),
          ],
        if (free.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(
              needle.isNotEmpty ? l10n.noPlaceMatches : l10n.everyPlaceHasABill,
              textAlign: TextAlign.center,
              style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
            ),
          ),
      ],
    );
  }

  static Color _placeDot(PlaceStatus status) => switch (status) {
        PlaceStatus.available => AppColors.successColor,
        PlaceStatus.occupied => AppColors.red500,
        PlaceStatus.held => AppColors.amber500,
        PlaceStatus.outOfService => AppColors.gray400,
      };
}

class _StatusDot extends StatelessWidget {
  final Color color;
  const _StatusDot({required this.color});

  @override
  Widget build(BuildContext context) =>
      Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}

/// One 48 dp row: a dot or icon, the name, an optional detail and the
/// kind of place at the end. Dimmed, not hidden, when it cannot be tapped.
class _PlaceRow extends StatelessWidget {
  final Widget leading;
  final String name;
  final String? detail;
  final IconData icon;
  final VoidCallback? onTap;

  const _PlaceRow({required this.leading, required this.name, this.detail, required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final row = Row(
      children: [
        SizedBox(width: 20, child: Center(child: leading)),
        const SizedBox(width: 12),
        Expanded(
          child: Text(name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
        ),
        if (detail != null) ...[
          const SizedBox(width: 8),
          Flexible(
            child: Text(detail!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.typography.sm.copyWith(
                  color: theme.colors.mutedForeground,
                  fontFeatures: const [FontFeature.tabularFigures()],
                )),
          ),
        ],
        const SizedBox(width: 12),
        Icon(icon, size: 16, color: theme.colors.mutedForeground),
      ],
    );
    return Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: FTappable(
        onPress: onTap,
        builder: (context, states, child) => Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary.withValues(alpha: 0.5) : null,
            borderRadius: BorderRadius.circular(10),
          ),
          child: child,
        ),
        child: row,
      ),
    );
  }
}
