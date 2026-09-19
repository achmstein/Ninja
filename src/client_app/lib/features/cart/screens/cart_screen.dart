import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/providers/current_place_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/profile_gate.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/money.dart';
import '../models/cart_item.dart';
import '../services/cart_service.dart';
import '../services/promo_service.dart';
import '../../orders/services/order_service.dart';
import '../../profile/providers/loyalty_provider.dart';
import '../../../core/models/localized_text.dart';
import '../../places/services/place_service.dart';
import '../../../core/services/sound_service.dart';

/// Shopping cart screen - minimalistic
class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  final TextEditingController _noteController = TextEditingController();
  final TextEditingController _promoController = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      // Reset checkout state to clear stale loading/error from previous checkout
      ref.read(checkoutProvider.notifier).reset();
      ref.read(loyaltyRedemptionProvider.notifier).reset();
      // Refresh loyalty balance so points earned from confirmed orders are up to date
      ref.read(loyaltyProvider.notifier).loadLoyaltyInfo();
    });
  }

  @override
  void dispose() {
    _noteController.dispose();
    _promoController.dispose();
    super.dispose();
  }

  void _showNoteSheet(BuildContext context, AppLocalizations l10n) {
    final colors = context.theme.colors;
    final tempController = TextEditingController(text: _noteController.text);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: colors.background,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: colors.mutedForeground,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                AppText(
                  l10n.orderNoteOptional,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: colors.foreground,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: colors.border),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: TextField(
                    controller: tempController,
                    autofocus: true,
                    minLines: 4,
                    maxLines: 6,
                    decoration: InputDecoration(
                      hintText: l10n.anySpecialRequests,
                      hintStyle: TextStyle(
                        color: colors.mutedForeground,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.all(12),
                    ),
                    style: TextStyle(
                      color: colors.foreground,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FButton(
                    onPress: () {
                      setState(() {
                        _noteController.text = tempController.text;
                      });
                      Navigator.pop(context);
                    },
                    child: AppText(l10n.done),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<double>(cartTotalProvider, (_, total) => ref.read(promoProvider.notifier).requote(total));
    final cart = ref.watch(cartProvider);
    final checkoutState = ref.watch(checkoutProvider);
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final isOrderingEnabled = ref.watch(branchProvider).selectedBranch?.isOrderingEnabled ?? true;

    return FScaffold(
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Custom header with back button
            Container(
              padding: const EdgeInsets.only(left: 8, right: 16, top: 8, bottom: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => context.pop(),
                    child: const Icon(FIcons.arrowLeft, size: 22),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: AppText(
                      l10n.cart,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                  if (!cart.isEmpty)
                    GestureDetector(
                      onTap: () => _showClearCartDialog(context),
                      child: const Icon(FIcons.trash2, size: 22),
                    ),
                ],
              ),
            ),
            Expanded(
              child: cart.isEmpty
                  ? _buildEmptyCart()
                  : LayoutBuilder(
                      builder: (context, constraints) {
                        return SingleChildScrollView(
                          padding: const EdgeInsets.all(16),
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minHeight: constraints.maxHeight - 32, // Account for padding
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                // Cart items section (top)
                                Column(
                                  children: cart.items.asMap().entries.map((entry) {
                                    final index = entry.key;
                                    final item = entry.value;
                                    return Column(
                                      children: [
                                        CartItemTile(item: item, index: index),
                                        if (index < cart.items.length - 1)
                                          Divider(height: 1, color: colors.border),
                                      ],
                                    );
                                  }).toList(),
                                ),

                                // Checkout section (bottom)
                                Column(
                                  children: [
                                    const SizedBox(height: 24),

                                    // Where this order is going
                                    _buildDestinationRow(colors),

                                    // Note
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        AppText(
                                          l10n.orderNoteOptional,
                                          style: TextStyle(
                                            fontWeight: FontWeight.w500,
                                            fontSize: 14,
                                            color: colors.foreground,
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        GestureDetector(
                                          onTap: () => _showNoteSheet(context, l10n),
                                          child: Container(
                                            width: double.infinity,
                                            constraints: const BoxConstraints(minHeight: 80),
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              border: Border.all(color: colors.border),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            alignment: AlignmentDirectional.topStart,
                                            child: AppText(
                                              _noteController.text.isNotEmpty
                                                  ? _noteController.text
                                                  : l10n.anySpecialRequests,
                                              style: TextStyle(
                                                color: _noteController.text.isNotEmpty
                                                    ? colors.foreground
                                                    : colors.mutedForeground,
                                              ),
                                              maxLines: 3,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 16),

                                    // Promo code
                                    _buildPromoSection(cart.totalPrice, colors),
                                    const SizedBox(height: 16),

                                    // Points redemption
                                    _buildPointsRedemption(cart.totalPrice, colors),
                                    const SizedBox(height: 16),

                                    // Total
                                    _buildTotalSection(cart.totalPrice, colors),
                                    const SizedBox(height: 16),

                                    // Ordering disabled message
                                    if (!isOrderingEnabled)
                                      Padding(
                                        padding: const EdgeInsets.only(bottom: 8),
                                        child: Row(
                                          children: [
                                            Icon(FIcons.circleAlert, size: 16, color: colors.destructive),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: AppText(
                                                l10n.orderingUnavailable,
                                                style: TextStyle(fontSize: 13, color: colors.destructive),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),

                                    // Checkout button
                                    SafeArea(
                                      child: SizedBox(
                                        width: double.infinity,
                                        child: ElevatedButton(
                                          onPressed: checkoutState.isLoading || !isOrderingEnabled
                                              ? null
                                              : () => _handleCheckout(cart),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: colors.primary,
                                            foregroundColor: colors.primaryForeground,
                                            disabledBackgroundColor: Colors.grey,
                                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                                            shape: const StadiumBorder(),
                                          ),
                                          child: checkoutState.isLoading
                                              ? SizedBox(
                                                  height: 20,
                                                  width: 20,
                                                  child: CircularProgressIndicator(
                                                    color: colors.primaryForeground,
                                                    strokeWidth: 2,
                                                  ),
                                                )
                                              : AppText(
                                                  l10n.placeOrder,
                                                  style: TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 15,
                                                  ),
                                                ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _applyPromo(double subtotal) {
    FocusScope.of(context).unfocus();
    ref.read(promoProvider.notifier).apply(_promoController.text, subtotal);
  }

  String _promoReason(AppLocalizations l10n, String reason) => switch (reason) {
        'NotFound' => l10n.promoNotFound,
        'UsedUp' => l10n.promoUsedUp,
        'AlreadyUsed' => l10n.promoAlreadyUsed,
        'BelowMinimum' => l10n.promoBelowMinimum,
        _ => l10n.promoNotValidNow,
      };

  /// One row: the code field with Apply, or the applied code with its
  /// verdict and a way to drop it. The discount itself shows in the totals.
  Widget _buildPromoSection(double orderTotal, dynamic colors) {
    final l10n = AppLocalizations.of(context)!;
    final promo = ref.watch(promoProvider);
    final code = promo.code;

    if (code != null) {
      final reason = promo.reason;
      return Row(
        children: [
          Icon(FIcons.tag, size: 18, color: reason == null ? colors.primary : colors.destructive),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(code, style: TextStyle(fontWeight: FontWeight.w600, color: colors.foreground)),
                if (reason != null)
                  AppText(_promoReason(l10n, reason), style: TextStyle(fontSize: 12, color: colors.destructive)),
              ],
            ),
          ),
          if (promo.checking)
            SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: colors.primary))
          else
            IconButton(
              icon: Icon(FIcons.x, size: 18, color: colors.mutedForeground),
              tooltip: l10n.removePromo,
              onPressed: () {
                ref.read(promoProvider.notifier).clear();
                _promoController.clear();
              },
            ),
        ],
      );
    }

    return Row(
      children: [
        Expanded(
          child: FTextField(
            control: FTextFieldControl.managed(controller: _promoController),
            hint: l10n.promoCode,
            textCapitalization: TextCapitalization.characters,
          ),
        ),
        const SizedBox(width: 8),
        FButton(
          variant: FButtonVariant.outline,
          onPress: () => _applyPromo(orderTotal),
          child: Text(l10n.apply),
        ),
      ],
    );
  }

  Widget _buildPointsRedemption(double orderTotal, dynamic colors) {
    final l10n = AppLocalizations.of(context)!;
    final money = ref.watch(moneyProvider);
    final loyaltyState = ref.watch(loyaltyProvider);
    final redemption = ref.watch(loyaltyRedemptionProvider);
    final loyaltyInfo = loyaltyState.loyaltyInfo;

    // Don't show if no loyalty account, no points, or loyalty service unavailable
    if (loyaltyInfo == null || loyaltyInfo.pointsBalance <= 0 || redemption.loyaltyError) {
      return const SizedBox.shrink();
    }

    final numberFormat = NumberFormat('#,###');
    final maxRedeemable = ref.read(loyaltyProvider.notifier).getMaxRedeemablePoints(orderTotal);
    final discount = redemption.serverDiscount ?? 0.0;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with toggle
          Row(
            children: [
              Icon(FIcons.gift, size: 18, color: colors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: AppText(
                  l10n.useLoyaltyPoints,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: colors.foreground,
                  ),
                ),
              ),
              AppText(
                '${numberFormat.format(loyaltyInfo.pointsBalance)} ${l10n.pts}',
                style: TextStyle(
                  fontSize: 13,
                  color: colors.mutedForeground,
                ),
              ),
              const SizedBox(width: 8),
              FSwitch(
                value: redemption.usePoints,
                onChange: maxRedeemable > 0
                    ? (value) {
                        ref.read(loyaltyRedemptionProvider.notifier)
                            .toggleUsePoints(value, maxRedeemable);
                      }
                    : null,
              ),
            ],
          ),

          // Points slider when enabled
          if (redemption.usePoints && maxRedeemable > 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Material(
                    color: Colors.transparent,
                    child: SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        activeTrackColor: colors.primary,
                        inactiveTrackColor: colors.border,
                        thumbColor: colors.primary,
                      ),
                      child: Slider(
                        value: redemption.pointsToRedeem.toDouble(),
                        min: 0,
                        max: maxRedeemable.toDouble(),
                        divisions: maxRedeemable > 0 ? (maxRedeemable / 10).ceil() : 1,
                        onChanged: (value) {
                          ref.read(loyaltyRedemptionProvider.notifier)
                              .setPointsToRedeem(value.round());
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                AppText(
                  '${numberFormat.format(redemption.pointsToRedeem)} ${l10n.pts}',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: colors.foreground,
                  ),
                ),
                AppText(
                  money.discount(discount),
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppTheme.successColor,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// Where this order will be delivered, so the customer can see it before
  /// committing. Reads orderDestinationProvider, the same source checkout uses.
  Widget _buildDestinationRow(dynamic colors) {
    final destination = ref.watch(orderDestinationProvider);
    if (destination == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Icon(
            destination.placeKind.icon,
            size: 16,
            color: colors.mutedForeground as Color,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: AppText(
              destination.name.localized(context),
              style: TextStyle(
                fontSize: 13,
                color: colors.mutedForeground as Color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalSection(double orderTotal, dynamic colors) {
    final l10n = AppLocalizations.of(context)!;
    final money = ref.watch(moneyProvider);
    final redemption = ref.watch(loyaltyRedemptionProvider);
    final promo = ref.watch(promoProvider);
    final discount = redemption.serverDiscount ?? 0.0;
    final promoDiscount = promo.applied ? promo.discount : 0.0;
    final afterDiscounts = orderTotal - promoDiscount - discount;
    final finalTotal = afterDiscounts < 0 ? 0.0 : afterDiscounts;

    return Column(
      children: [
        // Subtotal if a discount applies
        if (redemption.pointsToRedeem > 0 || promoDiscount > 0) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              AppText(
                l10n.subtotal,
                style: TextStyle(
                  fontSize: 14,
                  color: colors.mutedForeground,
                ),
              ),
              AppText(
                money(orderTotal),
                style: TextStyle(
                  fontSize: 14,
                  color: colors.mutedForeground,
                ),
              ),
            ],
          ),
          if (promoDiscount > 0) ...[
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                AppText(
                  l10n.promoDiscount,
                  style: TextStyle(fontSize: 14, color: AppTheme.successColor),
                ),
                AppText(
                  money.discount(promoDiscount),
                  style: TextStyle(fontSize: 14, color: AppTheme.successColor),
                ),
              ],
            ),
          ],
          if (discount > 0) ...[
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              AppText(
                l10n.pointsDiscount,
                style: TextStyle(
                  fontSize: 14,
                  color: AppTheme.successColor,
                ),
              ),
              AppText(
                money.discount(discount),
                style: TextStyle(
                  fontSize: 14,
                  color: AppTheme.successColor,
                ),
              ),
            ],
          ),
          ],
          const SizedBox(height: 8),
        ],
        // Total
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            AppText(
              l10n.total,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            AppText(
              money(finalTotal),
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildEmptyCart() {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            FIcons.shoppingCart,
            size: 80,
            color: colors.mutedForeground,
          ),
          const SizedBox(height: 16),
          AppText(
            l10n.yourCartIsEmpty,
            style: TextStyle(
              fontSize: 18,
              color: colors.foreground,
            ),
          ),
        ],
      ),
    );
  }

  void _showClearCartDialog(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    showFDialog(
      context: context,
      builder: (context, style, animation) => FDialog(
        style: style,
        animation: animation,
        title: Text(l10n.clearCartQuestion),
        direction: Axis.horizontal,
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            onPress: () => Navigator.pop(context),
            child: Text(l10n.cancel),
          ),
          FButton(
            variant: FButtonVariant.destructive,
            onPress: () {
              ref.read(cartProvider.notifier).clear();
              Navigator.pop(context);
            },
            child: Text(l10n.clear),
          ),
        ],
      ),
    );
  }

  void _handleCheckout(Cart cart) async {
    // Ensure user has name + phone before placing order
    if (!await ensureProfileComplete(context, ref)) return;
    if (!mounted) return;

    final l10n = AppLocalizations.of(context)!;
    final note = _noteController.text.isNotEmpty ? _noteController.text : null;
    final redemption = ref.read(loyaltyRedemptionProvider);
    final promo = ref.read(promoProvider);

    // Make sure the destination reflects a stay that may have started while
    // the cart was open; stay-beats-table lives in orderDestinationProvider.
    await ref.read(myStaysProvider.notifier).refresh();
    final destination = ref.read(orderDestinationProvider);

    final success = await ref.read(checkoutProvider.notifier).submitOrder(
          items: cart.items,
          placeId: destination?.placeId,
          placeKind: destination?.placeKind.wireName,
          placeName: destination?.name.toJson(),
          sessionId: destination?.sessionId,
          customerNote: note,
          pointsToRedeem: redemption.pointsToRedeem,
          loyaltyDiscount: redemption.serverDiscount ?? 0,
          promoCode: promo.applied ? promo.code : null,
        );

    if (success && mounted) {
      _noteController.clear();
      ref.read(loyaltyRedemptionProvider.notifier).reset();
      ref.read(promoProvider.notifier).clear();
      _promoController.clear();
      // Keep the table alive through a long sitting with several rounds
      ref.read(currentPlaceProvider.notifier).stampOrdered();

      // Refresh loyalty info to show updated balance after order is confirmed
      ref.read(loyaltyProvider.notifier).refresh();

      // Navigate to orders page and show success toast
      SoundService.instance.playSuccess();
      context.go('/bills');
      showFToast(
        context: context,
        title: Text(l10n.orderPlacedSuccessfully),
        icon: Icon(FIcons.check, color: AppTheme.successColor),
      );
    } else if (mounted) {
      final error = ref.read(checkoutProvider).error;
      showFToast(
        context: context,
        title: Text(error ?? l10n.failedToPlaceOrder),
        icon: Icon(FIcons.circleX, color: context.theme.colors.destructive),
      );
    }
  }
}

/// Cart item tile with image
class CartItemTile extends ConsumerWidget {
  final CartItem item;
  final int index;

  const CartItemTile({
    super.key,
    required this.item,
    required this.index,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final locale = ref.watch(localeProvider);
    final money = ref.watch(moneyProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product image
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: item.pictureUri != null
                ? CachedNetworkImage(
                    imageUrl: item.pictureUri!,
                    width: 64,
                    height: 64,
                    fit: BoxFit.cover,
                    errorWidget: (context, url, error) => Container(
                      width: 64,
                      height: 64,
                      color: colors.muted,
                      child: Icon(
                        FIcons.image,
                        color: colors.mutedForeground,
                        size: 24,
                      ),
                    ),
                  )
                : Container(
                    width: 64,
                    height: 64,
                    color: colors.muted,
                    child: Icon(
                      FIcons.coffee,
                      color: colors.mutedForeground,
                      size: 24,
                    ),
                  ),
          ),
          const SizedBox(width: 12),

          // Item info and controls
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name and remove button
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: AppText(
                        item.productName.getText(locale),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: colors.foreground,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => ref.read(cartProvider.notifier).removeItem(index),
                      child: Icon(FIcons.x, size: 18, color: colors.mutedForeground),
                    ),
                  ],
                ),
                if (item.selectedCustomizations.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  AppText(
                    item.selectedCustomizations
                        .map((c) => c.optionName.getText(locale))
                        .join(', '),
                    style: TextStyle(
                      color: colors.mutedForeground,
                      fontSize: 13,
                    ),
                  ),
                ],
                if (item.specialInstructions != null) ...[
                  const SizedBox(height: 4),
                  AppText(
                    AppLocalizations.of(context)!.noteWithText(item.specialInstructions!),
                    style: TextStyle(
                      color: colors.mutedForeground,
                      fontSize: 13,
                    ),
                  ),
                ],
                const SizedBox(height: 12),

                // Quantity controls and price on same row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Quantity controls
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        GestureDetector(
                          onTap: item.quantity > 1
                              ? () => ref.read(cartProvider.notifier).updateQuantity(index, item.quantity - 1)
                              : null,
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              border: Border.all(color: colors.border),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              FIcons.minus,
                              size: 14,
                              color: item.quantity > 1 ? colors.foreground : colors.mutedForeground,
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: AppText(
                            '${item.quantity}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => ref.read(cartProvider.notifier).updateQuantity(index, item.quantity + 1),
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              border: Border.all(color: colors.border),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(FIcons.plus, size: 14, color: colors.foreground),
                          ),
                        ),
                      ],
                    ),

                    // Price
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        AppText(
                          money(item.totalPrice),
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (item.isOnOffer)
                          AppText(
                            money(item.originalTotalPrice),
                            style: TextStyle(
                              fontSize: 12,
                              decoration: TextDecoration.lineThrough,
                              color: colors.mutedForeground,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
