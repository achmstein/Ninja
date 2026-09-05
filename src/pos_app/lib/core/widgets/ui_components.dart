import 'dart:async';

import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:shimmer/shimmer.dart';
import 'app_text.dart';

/// Standard screen padding for all screens
const kScreenPadding = EdgeInsets.all(16);

/// A wrapper that delays showing shimmer and ensures minimum display time.
/// This prevents the "flash" effect when data loads quickly.
///
/// - [delayBeforeShow]: How long to wait before showing shimmer (default 150ms)
/// - [minimumDisplayTime]: Once shown, keep shimmer visible for at least this long (default 300ms)
class DelayedShimmer extends StatefulWidget {
  final bool isLoading;
  final Widget shimmer;
  final Widget child;
  final Duration delayBeforeShow;
  final Duration minimumDisplayTime;

  const DelayedShimmer({
    super.key,
    required this.isLoading,
    required this.shimmer,
    required this.child,
    this.delayBeforeShow = const Duration(milliseconds: 150),
    this.minimumDisplayTime = const Duration(milliseconds: 300),
  });

  @override
  State<DelayedShimmer> createState() => _DelayedShimmerState();
}

class _DelayedShimmerState extends State<DelayedShimmer> {
  bool _showShimmer = false;
  Timer? _delayTimer;
  Timer? _minimumTimer;
  DateTime? _shimmerShownAt;

  @override
  void initState() {
    super.initState();
    if (widget.isLoading) {
      _startDelayTimer();
    }
  }

  @override
  void didUpdateWidget(DelayedShimmer oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.isLoading && !oldWidget.isLoading) {
      // Started loading
      _startDelayTimer();
    } else if (!widget.isLoading && oldWidget.isLoading) {
      // Finished loading
      _handleLoadingComplete();
    }
  }

  void _startDelayTimer() {
    _delayTimer?.cancel();
    _delayTimer = Timer(widget.delayBeforeShow, () {
      if (mounted && widget.isLoading) {
        setState(() {
          _showShimmer = true;
          _shimmerShownAt = DateTime.now();
        });
      }
    });
  }

  void _handleLoadingComplete() {
    _delayTimer?.cancel();

    if (_showShimmer && _shimmerShownAt != null) {
      // Shimmer is visible - ensure minimum display time
      final elapsed = DateTime.now().difference(_shimmerShownAt!);
      final remaining = widget.minimumDisplayTime - elapsed;

      if (remaining > Duration.zero) {
        _minimumTimer?.cancel();
        _minimumTimer = Timer(remaining, () {
          if (mounted) {
            setState(() => _showShimmer = false);
          }
        });
      } else {
        setState(() => _showShimmer = false);
      }
    } else {
      // Shimmer never shown - just hide immediately
      setState(() => _showShimmer = false);
    }
  }

  @override
  void dispose() {
    _delayTimer?.cancel();
    _minimumTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: _showShimmer ? widget.shimmer : widget.child,
    );
  }
}

/// Shimmer loading list - replaces FProgress/CircularProgressIndicator for list loading states
class ShimmerLoadingList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final bool showLeadingCircle;

  const ShimmerLoadingList({
    super.key,
    this.itemCount = 5,
    this.itemHeight = 72,
    this.showLeadingCircle = true,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final baseColor = theme.colors.secondary;
    final highlightColor = theme.colors.background;

    return Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: ListView.separated(
        padding: kScreenPadding,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) => ShimmerListTile(
          height: itemHeight,
          showLeadingCircle: showLeadingCircle,
        ),
      ),
    );
  }
}

/// Individual shimmer placeholder tile
class ShimmerListTile extends StatelessWidget {
  final double height;
  final bool showLeadingCircle;

  const ShimmerListTile({
    super.key,
    this.height = 72,
    this.showLeadingCircle = true,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Row(
        children: [
          if (showLeadingCircle) ...[
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  height: 14,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  height: 12,
                  width: 150,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Standardized empty state widget
/// - Icon: 48px
/// - Title: typography.base
/// - Subtitle: typography.sm
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 48,
              color: theme.colors.mutedForeground,
            ),
            const SizedBox(height: 12),
            AppText(
              title,
              style: theme.typography.base.copyWith(
                color: theme.colors.mutedForeground,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              AppText(
                subtitle!,
                style: theme.typography.sm.copyWith(
                  color: theme.colors.mutedForeground,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Consistent section header with optional count badge and action
class SectionHeader extends StatelessWidget {
  final String title;
  final int? count;
  final String? actionText;
  final VoidCallback? onAction;

  const SectionHeader({
    super.key,
    required this.title,
    this.count,
    this.actionText,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;

    return Row(
      children: [
        AppText(
          title,
          style: theme.typography.base.copyWith(fontWeight: FontWeight.w600),
        ),
        if (count != null && count! > 0) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: theme.colors.secondary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: AppText(
              '$count',
              style: theme.typography.xs.copyWith(fontWeight: FontWeight.w500),
            ),
          ),
        ],
        const Spacer(),
        if (actionText != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            child: AppText(
              actionText!,
              style: theme.typography.sm.copyWith(color: theme.colors.primary),
            ),
          ),
      ],
    );
  }
}
