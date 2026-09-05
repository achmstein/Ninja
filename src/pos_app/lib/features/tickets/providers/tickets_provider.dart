import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/ticket_detail.dart';
import '../models/ticket_summary.dart';
import '../services/tickets_service.dart';

/// The open bills of the active branch. SignalR nudges a refresh; the poll
/// is the fallback for a silently dead socket, like pos_web's
/// refetchInterval on the same query.
class OpenTicketsNotifier extends AsyncNotifier<List<TicketSummary>> {
  Timer? _poll;

  @override
  Future<List<TicketSummary>> build() async {
    // Rebuild when the branch changes: every call carries X-Branch-Id
    ref.watch(selectedBranchIdProvider);
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.ticketsPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return ref.read(ticketsRepositoryProvider).getOpenTickets();
  }

  /// Refetch without dropping what is on screen
  Future<void> refresh() async {
    final result = await AsyncValue.guard(
      () => ref.read(ticketsRepositoryProvider).getOpenTickets(),
    );
    if (!ref.mounted) return;
    // A transient failure keeps the last good list; a success replaces it
    if (result.hasValue) state = result;
  }
}

final openTicketsProvider =
    AsyncNotifierProvider<OpenTicketsNotifier, List<TicketSummary>>(OpenTicketsNotifier.new);

/// One bill, refetched on the same nudges. A 404 means the bill is gone
/// (discarded elsewhere) — the screen showing it goes back to the floor.
final ticketProvider = FutureProvider.autoDispose.family<TicketDetail, int>((ref, id) async {
  ref.watch(selectedBranchIdProvider);
  final timer = Timer(AppConfig.ticketsPoll, () => ref.invalidateSelf());
  ref.onDispose(timer.cancel);
  return ref.read(ticketsRepositoryProvider).getTicket(id);
});
