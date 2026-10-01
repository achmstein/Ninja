import 'dart:async';
import 'package:flutter/material.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';
import 'pressable.dart';

/// What the island says: a line, an icon before it, and a way to act on it
/// (an Undo). Opened out, a few lines under it say more (an order's dishes).
class IslandFace {
  final Widget title;
  final Widget? icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// The action's word, looked up where the island draws it: for a face
  /// raised away from any page, in the app's language as it is then
  final String Function(BuildContext context)? actionLabelOf;

  /// Said under the line, the island opened out to hold it
  final Widget? description;

  const IslandFace({required this.title, this.icon, this.actionLabel, this.actionLabelOf, this.onAction, this.description});
}

/// The island (client_web's lib/island.ts): one pill in the top bar's end
/// corner through which the app says everything that is not on the page.
/// It has two kinds of face:
/// - the live face ([live]): what the customer is waiting on, sticky,
///   changing in place as it moves on;
/// - a flash ([flash]): something to say now (a failure, an Undo, an order
///   turned down), which morphs the island for a moment and then morphs back
///   to the live face, or away when there is none.
/// Each new face morphs the one showing into it, with a short blur. While
/// the island is up, the top bar's chips step aside ([busy]).
class IslandController extends ChangeNotifier {
  IslandFace? _live;
  IslandFace? _flash;
  int _serial = 0;
  Duration _duration = Duration.zero;

  /// The face showing: a flash over the live face, else the live face
  IslandFace? get face => _flash ?? _live;

  /// A flash is showing, which the host times; the live face stays until changed
  bool get flashing => _flash != null;

  /// Each face shown gets its own number, for the morph from one to the next
  int get serial => _serial;

  /// The island is up: the chips it shares the corner with step aside
  final ValueNotifier<bool> busy = ValueNotifier(false);

  /// How long the flash showing now stays: the host times it, so the timer goes with the app
  Duration get duration => _duration;

  /// What the customer is waiting on, or null when there is nothing. Under a
  /// flash it waits its turn, and shows once the flash is over.
  void live(IslandFace? face) {
    _live = face;
    if (_flash == null) _settle();
  }

  void flash(IslandFace face, {Duration duration = const Duration(seconds: 3)}) {
    _flash = face;
    _duration = duration;
    _settle();
  }

  /// Ends a flash now: back to the live face, or away
  void end() {
    if (_flash == null) return;
    _flash = null;
    _settle();
  }

  void _settle() {
    _serial++;
    busy.value = face != null;
    notifyListeners();
  }
}

/// The app's one island
final island = IslandController();

/// Says [title] on the island for a moment: the app's toast. [context] is
/// the caller's, kept so the call reads as the toast it replaced did.
void showIsland({
  BuildContext? context,
  required Widget title,
  Widget? icon,
  String? actionLabel,
  VoidCallback? onAction,
  Duration duration = const Duration(seconds: 3),
}) {
  island.flash(IslandFace(title: title, icon: icon, actionLabel: actionLabel, onAction: onAction), duration: duration);
}

/// Hosts the island over the whole app, under the status bar at the end,
/// and takes each face away when its moment is up
class IslandHost extends StatefulWidget {
  final Widget child;
  final IslandController? controller;

  const IslandHost({super.key, required this.child, this.controller});

  @override
  State<IslandHost> createState() => _IslandHostState();
}

class _IslandHostState extends State<IslandHost> {
  IslandController get controller => widget.controller ?? island;
  Timer? _timer;
  int _timed = -1;

  @override
  void initState() {
    super.initState();
    controller.addListener(_time);
  }

  @override
  void dispose() {
    controller.removeListener(_time);
    _timer?.cancel();
    super.dispose();
  }

  void _time() {
    // Only a flash goes on its own; the live face stays until it is changed
    if (!controller.flashing) {
      _timer?.cancel();
      _timed = -1;
      return;
    }
    if (controller.serial == _timed) return;
    _timed = controller.serial;
    _timer?.cancel();
    _timer = Timer(controller.duration, controller.end);
  }

  @override
  Widget build(BuildContext context) {
    final child = widget.child;
    final top = MediaQuery.paddingOf(context).top;
    return Stack(
      children: [
        child,
        PositionedDirectional(
          top: top + 12,
          end: 12,
          start: 12,
          child: Align(
            alignment: AlignmentDirectional.topEnd,
            child: ListenableBuilder(
              listenable: controller,
              builder: (context, _) {
                final face = controller.face;
                return AnimatedSize(
                  duration: Motion.base,
                  curve: Motion.enter,
                  alignment: AlignmentDirectional.topEnd,
                  child: BlurSwap(
                    alignment: AlignmentDirectional.topEnd,
                    child: face == null
                        ? const SizedBox.shrink(key: ValueKey('island-none'))
                        : _Pill(key: ValueKey(controller.serial), face: face, onDone: controller.end),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  final IslandFace face;
  final VoidCallback onDone;

  const _Pill({super.key, required this.face, required this.onDone});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final description = face.description;
    final actionLabel = face.actionLabel ?? face.actionLabelOf?.call(context);
    final action = actionLabel == null
        ? null
        : Pressable(
            onTap: () {
              face.onAction?.call();
              onDone();
            },
            child: Container(
              height: 28,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: Alignment.center,
              decoration: ShapeDecoration(color: c.slabInk.withValues(alpha: 0.15), shape: const StadiumBorder()),
              child: Text(
                actionLabel,
                style: context.localeText(theme.typography.caption.copyWith(color: c.slabInk, fontWeight: FontWeight.w700)),
              ),
            ),
          );
    final line = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (face.icon != null) ...[
          IconTheme.merge(data: IconThemeData(size: 18, color: c.slabInk), child: face.icon!),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: DefaultTextStyle.merge(
            style: context.localeText(theme.typography.note.copyWith(color: c.slabInk, fontWeight: FontWeight.w600)),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            child: face.title,
          ),
        ),
        // A line alone keeps its action beside it; opened out, the action goes under what it says
        if (action != null && description == null) ...[const SizedBox(width: 10), action],
      ],
    );
    return Material(
      type: MaterialType.transparency,
      child: GestureDetector(
        onTap: onDone,
        child: Container(
          constraints: const BoxConstraints(minHeight: 40, maxWidth: 340),
          padding: description != null
              ? const EdgeInsetsDirectional.fromSTEB(14, 12, 16, 14)
              : EdgeInsetsDirectional.only(start: face.icon != null ? 10 : 16, end: action != null ? 6 : 16, top: 6, bottom: 6),
          decoration: ShapeDecoration(
            color: c.slab,
            // Opened out, the pill rounds into a card the size of what it holds
            shape: description != null ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)) : const StadiumBorder(),
            shadows: Ninja.slabShadow,
          ),
          child: description == null
              ? line
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    line,
                    const SizedBox(height: 8),
                    Padding(
                      padding: EdgeInsetsDirectional.only(start: face.icon != null ? 26 : 0),
                      child: DefaultTextStyle.merge(
                        style: context.localeText(theme.typography.caption.copyWith(color: c.slabInk)),
                        child: description,
                      ),
                    ),
                    if (action != null) ...[
                      const SizedBox(height: 12),
                      Padding(padding: EdgeInsetsDirectional.only(start: face.icon != null ? 26 : 0), child: action),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}
