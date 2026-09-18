import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../services/order_service.dart';
import 'rating_widget.dart';

/// The rating sheet: every order in [orderIds] gets the same stars and
/// word, starting from [initialRating] — the star tapped on the bill.
/// Resolves to true once submitted.
Future<bool> showRatingDialog({
  required BuildContext context,
  required WidgetRef ref,
  required List<int> orderIds,
  int initialRating = 5,
}) async {
  final rated = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    builder: (context) => RatingDialog(
      orderIds: orderIds,
      initialRating: initialRating,
      ref: ref,
    ),
  );
  return rated ?? false;
}

/// Rating dialog widget
class RatingDialog extends StatefulWidget {
  final List<int> orderIds;
  final int initialRating;
  final WidgetRef ref;

  const RatingDialog({
    super.key,
    required this.orderIds,
    this.initialRating = 5,
    required this.ref,
  });

  @override
  State<RatingDialog> createState() => _RatingDialogState();
}

class _RatingDialogState extends State<RatingDialog> {
  late int _rating = widget.initialRating;
  final _commentController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submitRating() async {
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final orderService = widget.ref.read(orderRepositoryProvider);
      final comment = _commentController.text.trim().isEmpty ? null : _commentController.text.trim();
      for (final orderId in widget.orderIds) {
        await orderService.rateOrder(orderId: orderId, ratingValue: _rating, comment: comment);
        widget.ref.invalidate(orderProvider(orderId));
      }
      // The summaries carry the rating the bill's stars read
      await widget.ref.read(ordersProvider.notifier).refresh();

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      setState(() {
        _isSubmitting = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final l10n = AppLocalizations.of(context)!;

    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colors.mutedForeground,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Header
              Row(
                children: [
                  Expanded(
                    child: AppText(
                      l10n.rateYourOrder,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: colors.foreground,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Icon(FIcons.x, size: 24, color: colors.mutedForeground),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Star rating
              Center(
                child: StarRating(
                  rating: _rating,
                  size: 48,
                  onRatingChanged: (value) {
                    setState(() {
                      _rating = value;
                    });
                  },
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: AppText(
                  _getRatingLabel(_rating, l10n),
                  style: TextStyle(
                    fontSize: 15,
                    color: colors.mutedForeground,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Comment field
              AppText(
                l10n.yourReviewOptional,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: colors.foreground,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: colors.border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: TextField(
                  controller: _commentController,
                  maxLines: 3,
                  maxLength: 500,
                  decoration: InputDecoration(
                    hintText: l10n.shareYourExperience,
                    hintStyle: TextStyle(color: colors.mutedForeground),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.all(12),
                    counterText: '',
                  ),
                  style: TextStyle(
                    fontSize: 15,
                    color: colors.foreground,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Error message
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colors.destructive.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        FIcons.circleAlert,
                        size: 18,
                        color: colors.destructive,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: AppText(
                          _errorMessage!,
                          style: TextStyle(
                            color: colors.destructive,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Submit button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitRating,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.primary,
                    foregroundColor: colors.primaryForeground,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: const StadiumBorder(),
                  ),
                  child: _isSubmitting
                      ? SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: colors.primaryForeground,
                            strokeWidth: 2,
                          ),
                        )
                      : AppText(
                          l10n.submitRating,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                ),
              ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _getRatingLabel(int rating, AppLocalizations l10n) {
    switch (rating) {
      case 1:
        return l10n.ratingPoor;
      case 2:
        return l10n.ratingFair;
      case 3:
        return l10n.ratingGood;
      case 4:
        return l10n.ratingVeryGood;
      case 5:
        return l10n.ratingExcellent;
      default:
        return '';
    }
  }
}
