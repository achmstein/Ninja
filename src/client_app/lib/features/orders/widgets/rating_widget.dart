import 'package:flutter/material.dart';
import '../../../core/ui/ui.dart';
import '../models/rating.dart';

/// Star rating widget - can be interactive or read-only
class StarRating extends StatelessWidget {
  final int rating;
  final int maxRating;
  final double size;
  final Color activeColor;

  /// The stars not given; the page's muted ink, faint, when none is passed (client_web's bill-rating)
  final Color? inactiveColor;
  final ValueChanged<int>? onRatingChanged;

  const StarRating({
    super.key,
    required this.rating,
    this.maxRating = 5,
    this.size = 32.0,
    this.activeColor = NinjaColors.warning,
    this.inactiveColor,
    this.onRatingChanged,
  });

  @override
  Widget build(BuildContext context) {
    final inactive = inactiveColor ?? context.theme.colors.mutedForeground.withValues(alpha: 0.4);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(maxRating, (index) {
        final starIndex = index + 1;
        final isFilled = starIndex <= rating;

        return GestureDetector(
          onTap: onRatingChanged != null ? () => onRatingChanged!(starIndex) : null,
          child: Icon(
            isFilled ? Icons.star : Icons.star_border,
            size: size,
            color: isFilled ? activeColor : inactive,
          ),
        );
      }),
    );
  }
}

/// Display an existing rating - minimalistic inline design
class RatingDisplay extends StatelessWidget {
  final OrderRating rating;
  final Color? color;

  const RatingDisplay({
    super.key,
    required this.rating,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return StarRating(
      rating: rating.ratingValue,
      size: 16,
      inactiveColor: color,
    );
  }
}
