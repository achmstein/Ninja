import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../core/brand/brand_provider.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/network/network_status.dart';
import '../../core/offline/offline_queue.dart';
import '../../core/offline/offline_sale.dart';
import '../../core/sending/sending.dart';
import '../../core/network/api_errors.dart';
import '../../core/services/branch_names.dart';
import '../../core/widgets/pos_toast.dart';
import '../../l10n/app_localizations.dart';
import '../call_centre/call_centre_mode.dart';
import '../catalog/services/catalog_service.dart';
import '../customers/services/customer_search_service.dart';
import '../deliveries/delivery_errors.dart';
import '../deliveries/providers/deliveries_provider.dart';
import '../deliveries/widgets/delivery_form_dialog.dart';
import '../orders/services/order_service.dart';
import '../ticket/screens/settle_screen.dart';
import '../tickets/models/enums.dart';
import '../tickets/models/pricing.dart';
import '../tickets/models/ticket_detail.dart';
import '../tickets/providers/pricing_provider.dart';
import '../tickets/providers/tickets_provider.dart';
import 'bill_people.dart';
import 'bill_people_state.dart';
import 'models/pos_order_request.dart';
import 'models/sale_delivery.dart';
import 'services/price_check_service.dart';
import 'widgets/price_review_dialog.dart';
import 'models/sale_line.dart';
import 'providers/sale_provider.dart';

/// Sending what was rung up, every way the till does it. The web till's
/// `usePlaceOrder` is the same.
///
/// - a **round** onto an open bill ([sendNew]), each person's lines as their
///   own: the bill shows it at once, faded until the server has it
///   (core/sending);
/// - a **counter sale** ([charge]): the same way onto a bill of its own, then
///   straight to its payment; offline, it is taken here and sent once the
///   server is back;
/// - a **delivery** or a **call-centre order**: placed and waited for
///   ([placing]), since they have no bill on this till to show themselves
///   on. A caller with no account becomes a customer as their order goes.
mixin SaleCharge<W extends ConsumerStatefulWidget> on ConsumerState<W>, BillPeopleState<W> {
  /// The order's note as it is typed: cleared with the sale it was for
  TextEditingController get noteField;
  void closeOrderSheet();

  /// A delivery or a call-centre order is being placed: nothing else may be touched
  bool placing = false;

  // Idempotency mirror of pos_web's charge: the request id must survive
  // retries of the SAME sale, so a resubmit after a timeout (where the
  // server actually processed the first attempt) is deduplicated instead of
  // ringing the customer up twice. A new id is only issued when the sale
  // content changes.
  String? _requestSignature;
  String? _requestId;

  /// After a POS order, save the attached customer's customization choices so
  /// they prefill next time. Last line per product wins (matches the app).
  void _saveCustomerPreferences(String? customerId, List<SaleLine> lines) {
    if (customerId == null || customerId.isEmpty) return;
    final byProduct = <int, List<Map<String, int>>>{};
    for (final line in lines) {
      if (line.customizations.isEmpty) continue;
      byProduct[line.productId] = [
        for (final c in line.customizations) {'customizationId': c.customizationId, 'optionId': c.optionId},
      ];
    }
    if (byProduct.isEmpty) return;
    final items = [
      for (final entry in byProduct.entries) {'catalogItemId': entry.key, 'selectedOptions': entry.value},
    ];
    unawaited(ref.read(catalogRepositoryProvider).saveCustomerPreferences(customerId, items));
  }

  /// Where a delivery on this sale stands: none, ready to go out with a
  /// rider, or waiting on the branch's terms (never quietly a counter sale)
  DeliveryCharge deliveryChargeOf(SaleState sale, {bool watch = false, WidgetRef? via}) {
    final ref = via ?? this.ref;
    final features = watch ? ref.watch(featuresProvider) : ref.read(featuresProvider);
    final asked = !onBill && features.delivery;
    final terms = asked ? (watch ? ref.watch(tillDeliveryTermsProvider) : ref.read(tillDeliveryTermsProvider)) : null;
    return deliveryCharge(
      hasDelivery: sale.delivery != null,
      addingToTicket: onBill,
      featureOn: features.delivery,
      termsKnown: terms?.hasValue ?? false,
      termsFailed: terms?.hasError ?? false,
      delivers: terms?.value?.delivers ?? false,
    );
  }

  /// Whether this sale goes out with a rider
  bool _delivering(SaleState sale) => deliveryChargeOf(sale) == DeliveryCharge.ready;

  /// The delivery form: the caller's number, name and address. Who it is for
  /// is said once, there: the account the number belongs to (or the one on
  /// the sale already), else a caller off the street by the name they gave.
  Future<void> openDeliveryForm() async {
    final sale = ref.read(saleProvider);
    final result = await showDeliveryFormDialog(
      context,
      initial: sale.delivery,
      customer: sale.customer,
      itemsTotal: saleTotal(sale.lines),
    );
    if (result == null || !mounted) return;
    final notifier = ref.read(saleProvider.notifier);
    notifier.setDelivery(result.delivery);
    if ((result.customer.id ?? '').isNotEmpty || (sale.customer?.id ?? '').isEmpty) notifier.setCustomer(result.customer);
  }

  /// What makes a sale the same sale when it is sent again
  String _signatureOf(SaleState sale) => json.encode({
        'lines': [
          for (final line in sale.lines)
            [line.productId, line.quantity, line.specialInstructions, [for (final c in line.customizations) [c.customizationId, c.optionId]]],
        ],
        'note': sale.note.trim(),
        // Attaching (or removing) a customer makes it a different sale, not a
        // retry of the previous one — a bare name counts too
        'customer': sale.customer?.id ?? sale.customer?.name,
        // And sent somewhere else, another sale again
        'delivery': _delivering(sale) ? sale.delivery?.toJson() : null,
      });

  /// A caller with no account yet becomes a customer as their order goes:
  /// the number is the customer, so the next call finds them, with their
  /// points and what they ordered. A number that already has an account
  /// answers with it. Null when it could not be done (a number that is not
  /// one here, no answer): the order then goes as a guest's, never held up
  /// for this.
  Future<SaleCustomer?> _ensureCaller(String name, String phone) async {
    try {
      final result = await ref
          .read(counterCustomerServiceProvider)
          .add(name: name, phone: phone)
          .timeout(const Duration(seconds: 8));
      final user = switch (result) {
        CustomerAdded(:final user) => user,
        CustomerExists(:final existing) => existing,
        CustomerRefused() => null,
      };
      if (user == null) return null;
      return SaleCustomer(
        id: user.id,
        name: user.displayName.isNotEmpty ? user.displayName : name,
        phone: user.phoneNumber ?? phone,
        addedAtCounter: user.addedAtCounter,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> charge() async {
    // A bill's rounds are sent for whoever Send is told (_sendRound), never charged
    if (onBill) return;
    final sale = ref.read(saleProvider);
    final l10n = AppLocalizations.of(context)!;
    final signature = _signatureOf(sale);
    if (_requestId == null || _requestSignature != signature) {
      _requestSignature = signature;
      _requestId = const Uuid().v4();
    }

    // A delivery on the sale the branch's terms do not confirm yet is not
    // charged at all (never as a counter sale in its place)
    if (deliveryBlocksCharge(deliveryChargeOf(sale))) {
      showPosToast(context, PosToastType.warning, l10n.deliveryTermsUnknown);
      return;
    }

    // A delivery taken over the phone: a rider needs a name at the door
    // (taken off the sale, it is asked again), and it needs the server
    final delivery = _delivering(sale) ? sale.delivery : null;
    if (delivery != null && (sale.customer?.name.trim() ?? '').isEmpty) {
      await openDeliveryForm();
      return;
    }
    if (delivery != null && !ref.read(onlineProvider)) {
      showPosToast(context, PosToastType.warning, l10n.offlineNotAvailable);
      return;
    }

    // The call centre takes nothing offline: the order is for a branch elsewhere
    final callCentre = ref.read(callCentreModeProvider);
    if (callCentre && !ref.read(onlineProvider)) {
      showPosToast(context, PosToastType.warning, l10n.offlineNotAvailable);
      return;
    }

    // No network: a counter sale is kept on the till and paid right here
    if (!ref.read(onlineProvider)) return _chargeOffline(sale, l10n);

    // From here it is on its way: the bill or the floor comes next, and the
    // blocking "sending" wait would paint under an open sheet
    closeOrderSheet();

    // Sent to the branch nearer the caller: its menu first, its prices and
    // what it ran out of, so the order is not turned down when it arrives
    var lines = sale.lines;
    final sendTo = delivery?.sendTo;
    final sendToName = sendTo == null ? '' : branchNameOf(ref.read(allBranchesProvider).value, sendTo.branchId, context);
    if (sendTo != null) {
      setState(() => placing = true);
      PriceReview review;
      try {
        review = await ref.read(priceCheckServiceProvider).check(sendTo.branchId, lines);
      } catch (_) {
        if (mounted) {
          setState(() => placing = false);
          showPosToast(context, PosToastType.error, l10n.priceCheckFailed(sendToName));
        }
        return;
      }
      if (!mounted) return;
      setState(() => placing = false);
      if (!review.agrees) {
        final choice = await showPriceReviewDialog(context, review, sendToName);
        if (!mounted || choice == null) return;
        if (choice == PriceReviewChoice.keepHere) {
          // Made here after all: the cashier charges again, at this branch's fee
          ref.read(saleProvider.notifier).setDelivery(delivery!.keptHere());
          return;
        }
        lines = review.lines;
      }
    }

    // A walk-in's new bill shows the lines at once, faded until the server
    // has them, on the way to its payment (core/sending)
    if (delivery == null && !callCentre) {
      final requestId = _requestId!;
      unawaited(ref.read(sendingProvider.notifier).start(Sending(
            requestId: requestId,
            ticketId: null,
            branchId: ref.read(selectedBranchIdProvider),
            lines: lines,
            note: sale.note,
            customer: sale.customer,
            startedAt: DateTime.now(),
          )));
      _requestSignature = null;
      _requestId = null;
      ref.read(saleProvider.notifier).clear();
      context.go('/ticket/sending/$requestId');
      return;
    }

    var goOffline = false;
    setState(() => placing = true);
    try {
      // A caller with no account yet becomes a customer as their order
      // goes; when that cannot be done it goes as a guest's
      var customer = sale.customer;
      final callerName = customer?.name.trim() ?? '';
      final deliveryPhone = delivery?.phone.trim() ?? '';
      final callerPhone = deliveryPhone.isNotEmpty ? deliveryPhone : (customer?.phone?.trim() ?? '');
      if ((customer?.id ?? '').isEmpty && callerName.isNotEmpty && callerPhone.isNotEmpty) {
        final added = await _ensureCaller(callerName, callerPhone);
        if (!mounted) return;
        if (added != null) {
          customer = added;
          ref.read(saleProvider.notifier).setCustomer(added);
          // Still the same sale: sent again after a failure, it keeps its request id
          _requestSignature = _signatureOf(ref.read(saleProvider));
        }
      }
      final orderId = await ref.read(orderRepositoryProvider).createPosOrder(
            PosOrderRequest(
              lines: lines,
              note: sale.note,
              customer: customer,
              delivery: delivery,
            ),
            requestId: _requestId!,
          );
      // The order landed — the next charge is a new logical request
      _requestSignature = null;
      _requestId = null;
      // Remember how this customer's items were customized, so they prefill
      // next time — fire-and-forget, the same as the customer app does.
      _saveCustomerPreferences(customer?.id, sale.lines);
      if (!mounted) return;

      // A delivery is a bill of its own, settled when the rider's cash comes
      // in: nothing to pay now, and the rider is picked on the floor. So is
      // the call centre's pickup: the branch's counter takes the money when
      // the caller collects, and the call centre goes on to the next caller
      ref.read(saleProvider.notifier).clear();
      noteField.clear();
      // The rider picked in the form is given it at once; without one it is given from Deliveries
      final rider = !callCentre && sendTo == null && orderId != 0 ? delivery?.rider : null;
      if (rider != null) {
        final words = l10n;
        unawaited(ref.read(deliveryActionsProvider).assign(orderId, rider.asTillRider).catchError((Object e) {
          if (mounted) showPosToast(context, PosToastType.error, describeDeliveryError(e, words));
        }));
      } else {
        unawaited(ref.read(deliveriesProvider.notifier).refresh());
      }
      ref.read(openTicketsProvider.notifier).refresh();
      showPosToast(
        context,
        PosToastType.success,
        orderId == 0
            ? l10n.orderAlreadyPlaced
            : callCentre
                ? l10n.callCentrePlaced(orderId, ref.read(branchProvider).selectedBranch?.name.localized(context) ?? '')
                : sendTo != null
                ? l10n.deliverySentTo(sendToName, orderId)
                : rider != null
                ? l10n.deliveryPlacedRider(rider.name)
                : l10n.deliveryPlaced,
      );
      context.go('/');
    } catch (e) {
      if (!mounted) return;
      // The first sign the network is gone is usually this very call
      if (NetworkStatus.isConnectionError(e)) {
        networkStatus.reportFailure();
        goOffline = true;
      } else {
        // A delivery's refusals carry a code the till says in its own words
        final words = delivery != null && deliveryErrorCode(e) != null ? describeDeliveryError(e, l10n) : describeError(e, l10n);
        showPosToast(context, PosToastType.error, words);
      }
    } finally {
      if (mounted) setState(() => placing = false);
    }
    if (goOffline && mounted) await _chargeOffline(sale, l10n);
  }

  // The pad prices the sale the way Sales will when it is replayed (a
  // counter sale carries no service charge; VAT follows the branch's cached
  // rules), then takes the money through the same settle dialog. Adding to
  // a bill on the floor needs the server, so that waits.
  Future<void> _chargeOffline(SaleState sale, AppLocalizations l10n) async {
    if (onBill) {
      showPosToast(context, PosToastType.warning, l10n.offlineNotAvailable);
      return;
    }
    // The branch's rules were fetched (or read from the cache) when the pad
    // opened; a still-loading first read gets a moment, then no rules
    final pricing = await ref
        .read(pricingProvider.future)
        .timeout(const Duration(seconds: 2), onTimeout: () => const PricingView())
        .catchError((_) => const PricingView());
    if (!mounted) return;
    final bill = counterBill(saleTotal(sale.lines), pricing);
    final ticket = TicketDetail(
      id: 0,
      type: TicketType.counter,
      label: sale.customer?.name,
      openedAt: DateTime.now(),
      subtotal: bill.subtotal,
      vat: bill.vat,
      vatRate: pricing.vatRate,
      vatIncluded: pricing.pricesIncludeVat,
      total: bill.total,
      lines: [
        for (final (index, line) in sale.lines.indexed)
          TicketLineView(
            id: index + 1,
            description: line.name,
            details: line.details,
            qty: line.quantity.toDouble(),
            unitPrice: line.price,
            total: line.total,
            customerId: sale.customer?.id,
            customerName: sale.customer?.name,
          ),
      ],
    );
    final requestId = _requestId!;
    await showSettle(
      context,
      ticket,
      offline: OfflineSaleDraft(
        requestId: requestId,
        placedAt: DateTime.now(),
        lines: sale.lines,
        note: sale.note,
        customer: sale.customer,
      ),
    );
    if (!mounted) return;
    // Whatever closed the dialog, a sale that reached the queue is paid: the
    // cart must not offer it for a second charge
    if (ref.read(offlineQueueProvider).any((s) => s.id == requestId)) {
      _requestSignature = null;
      _requestId = null;
      ref.read(saleProvider.notifier).clear();
      closeOrderSheet();
      context.go('/');
    }
  }

  /// One person's part of a round onto the open bill, or nobody's. The bill shows it at once, faded until the server has it
  /// (core/sending); what was not sent stays on the sale, and the till stays
  /// on this screen. False when it could not go, so nothing is taken off the
  /// sale.
  bool _sendRound(List<SaleLine> part, SaleCustomer? who) {
    final ticketId = billId;
    if (!mounted || ticketId == null || part.isEmpty) return false;
    final l10n = AppLocalizations.of(context)!;
    if (!ref.read(onlineProvider)) {
      showPosToast(context, PosToastType.warning, l10n.offlineNotAvailable);
      return false;
    }
    final sale = ref.read(saleProvider);
    unawaited(ref
        .read(sendingProvider.notifier)
        .start(Sending(
          requestId: const Uuid().v4(),
          ticketId: ticketId,
          branchId: ref.read(selectedBranchIdProvider),
          lines: part,
          note: sale.note,
          customer: who,
          startedAt: DateTime.now(),
        ))
        .then((outcome) {
      if (outcome == SendOutcome.alreadyPlaced && mounted) showPosToast(context, PosToastType.info, l10n.orderAlreadyPlaced);
    }));
    ref.read(saleProvider.notifier).removeLines(part.map((line) => line.key));
    // The note was the round's: gone with its last line
    final note = ref.read(saleProvider).note;
    if (noteField.text != note) noteField.text = note;

    if (who != null) joinRoom(who);
    return true;
  }

  /// Send on a bill: what is new goes out, each person's lines as their own
  /// round. Nothing is asked: every line says whose it is
  void sendNew() {
    for (final round in roundsByPerson(ref.read(saleProvider).lines)) {
      if (!_sendRound(round.lines, round.who)) return;
    }
  }
}
