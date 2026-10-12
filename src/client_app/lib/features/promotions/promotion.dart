import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/models/localized_text.dart';
import '../../core/network/api_client.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/ui/ui.dart';
import '../../l10n/app_localizations.dart';
import '../menu/dish_link.dart';

/// Where a promotion's button goes
enum PromotionLink { none, item, category, book }

/// What the business promotes in the app (client_web's components/promotions):
/// a designed picture with its headline drawn in, and a button to a dish, a
/// category or booking
class Promotion {
  final int id;
  final LocalizedText headline;
  final String? pictureUri;
  final PromotionLink link;
  final int? linkId;

  const Promotion({required this.id, required this.headline, required this.pictureUri, required this.link, required this.linkId});

  factory Promotion.fromJson(Map<String, dynamic> json) => Promotion(
    id: (json['id'] as num).toInt(),
    headline: LocalizedText.fromJson((json['headline'] as Map?)?.cast<String, dynamic>() ?? const {}),
    pictureUri: json['pictureUri'] as String?,
    link: switch ((json['link'] as String? ?? '').toLowerCase()) {
      'item' => PromotionLink.item,
      'category' => PromotionLink.category,
      'book' => PromotionLink.book,
      _ => PromotionLink.none,
    },
    linkId: (json['linkId'] as num?)?.toInt(),
  );

  /// The device's word for having shown it: a new picture is a new promotion seen afresh
  String get seenKey => '$id:${pictureUri ?? ''}';

  /// The picture this many pixels wide (320, 640 or 1280)
  // The gateway passes only the dishes' pictures without an api-version
  String? pictureAt(int width) => pictureUri == null ? null : '$pictureUri&api-version=1.0&w=$width';
}

/// The promotion running now at the customer's branch, or null
final livePromotionProvider = FutureProvider.autoDispose<Promotion?>((ref) async {
  final branchId = ref.watch(selectedBranchIdProvider);
  final api = ref.watch(catalogApiProvider);
  try {
    final response = await api.get<dynamic>('promotions/live', queryParameters: {'branchId': ?branchId});
    final data = response.data;
    return data is Map<String, dynamic> && data['id'] != null ? Promotion.fromJson(data) : null;
  } catch (_) {
    // Nothing to promote is never an error the customer sees
    return null;
  }
});

/// The promotion a tap on a category's button asked for, for the menu to turn to once it is the page
final pendingCategory = ValueNotifier<int?>(null);

/// The promotions this device has been shown, kept across launches
class SeenPromotions extends Notifier<Set<String>> {
  static const _key = 'promotions_seen';
  static const _keep = 30;

  /// Read from storage once, a moment after the first ask
  late final Future<void> loaded = SharedPreferences.getInstance().then((prefs) {
    final kept = prefs.getStringList(_key);
    if (kept != null) state = {...state, ...kept};
  });

  @override
  Set<String> build() {
    loaded;
    return {};
  }

  void see(Promotion promotion) {
    if (state.contains(promotion.seenKey)) return;
    final next = [...state, promotion.seenKey];
    state = next.skip(next.length > _keep ? next.length - _keep : 0).toSet();
    SharedPreferences.getInstance().then((prefs) => prefs.setStringList(_key, state.toList()));
  }
}

final seenPromotionsProvider = NotifierProvider<SeenPromotions, Set<String>>(SeenPromotions.new);

/// The promotion as a sheet out of the dock: its picture as the business
/// designed it, and its one button. The headline is read out (it is drawn in
/// the picture)
Future<void> showPromotion(BuildContext context, Promotion promotion) {
  final router = GoRouter.maybeOf(context);
  return showNinjaSheet<void>(
    context: context,
    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
    builder: (context) {
      final l10n = AppLocalizations.of(context)!;
      final action = switch (promotion.link) {
        PromotionLink.item => l10n.promoOrderNow,
        PromotionLink.category => l10n.promoSeeMenu,
        PromotionLink.book => l10n.promoBookNow,
        PromotionLink.none => null,
      };
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            label: promotion.headline.localized(context),
            image: true,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.62),
                child: AspectRatio(
                  aspectRatio: 4 / 5,
                  child: CachedNetworkImage(
                    imageUrl: promotion.pictureAt(1280) ?? '',
                    fit: BoxFit.cover,
                    placeholder: (context, _) => ColoredBox(color: context.theme.colors.muted),
                    errorWidget: (context, _, _) => ColoredBox(color: context.theme.colors.muted),
                  ),
                ),
              ),
            ),
          ),
          if (action != null) ...[
            const SizedBox(height: 12),
            NinjaButton(
              onPress: () {
                Navigator.of(context).pop();
                switch (promotion.link) {
                  case PromotionLink.item:
                    if (promotion.linkId != null) pendingDish.value = promotion.linkId;
                    router?.go('/menu');
                  case PromotionLink.category:
                    pendingCategory.value = promotion.linkId;
                    router?.go('/menu');
                  case PromotionLink.book:
                    router?.go('/places');
                  case PromotionLink.none:
                    break;
                }
              },
              child: Text(action),
            ),
          ],
        ],
      );
    },
  );
}

/// The promotion kept in the top bar once it has been shown: its picture in a small circle, opening it again
class PromotionChip extends ConsumerWidget {
  const PromotionChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final promotion = ref.watch(livePromotionProvider).value;
    final seen = ref.watch(seenPromotionsProvider);
    if (promotion == null || !seen.contains(promotion.seenKey)) return const SizedBox.shrink();
    final c = context.theme.colors;
    return Semantics(
      button: true,
      label: AppLocalizations.of(context)!.promoShowAgain,
      child: Pressable(
        onTap: () => showPromotion(context, promotion),
        child: Container(
          width: 36,
          height: 36,
          margin: const EdgeInsetsDirectional.only(end: 8),
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.primary, width: 2)),
          child: ClipOval(
            child: CachedNetworkImage(
              imageUrl: promotion.pictureAt(320) ?? '',
              fit: BoxFit.cover,
              errorWidget: (context, _, _) => ColoredBox(color: c.muted),
            ),
          ),
        ),
      ),
    );
  }
}
