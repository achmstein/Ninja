import 'dart:async';
import 'package:flutter/material.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';
import 'pressable.dart';

/// What the island says: a line, an icon before it, and a way to act on it
/// (an Undo)
class IslandFace {
  final Widget title;
  final Widget? icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  const IslandFace({required this.title, this.icon, this.actionLabel, this.onAction});
}

/// The island (client_web's lib/island.ts): one pill in the top bar's end
/// corner through which the app says everything that is not on the page. A
/// new line morphs the one showing into it, with a short blur, and it goes
/// after a moment. While it shows, the top bar's chips step aside
/// ([IslandController.busy]).
class IslandController extends ChangeNotifier {
  IslandFace? _face;
  int _serial = 0;
  Duration _duration = Duration.zero;

  IslandFace? get face => _face;

  /// How long the face showing now stays: the host times it, so the timer goes with the app

  /// Each face shown gets its own number, for the morph from one to the next
  int get serial => _serial;

  /// The island is up: the chips it shares the corner with step aside
  final ValueNotifier<bool> busy = ValueNotifier(false);

  Duration get duration => _duration;

  void flash(IslandFace face, {Duration duration = const Duration(seconds: 3)}) {
    _face = face;
    _duration = duration;
    _serial++;
    busy.value = true;
    notifyListeners();
  }

  /// Takes the island away now
  void end() {
    if (_face == null) return;
    _face = null;
    busy.value = false;
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
    if (controller.face == null) {
      _timer?.cancel();
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
    return Material(
      type: MaterialType.transparency,
      child: GestureDetector(
        onTap: onDone,
        child: Container(
          constraints: const BoxConstraints(minHeight: 40, maxWidth: 340),
          padding: EdgeInsetsDirectional.only(start: face.icon != null ? 10 : 16, end: face.actionLabel != null ? 6 : 16, top: 6, bottom: 6),
          decoration: ShapeDecoration(color: c.slab, shape: const StadiumBorder(), shadows: Ninja.slabShadow),
          child: Row(
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
              if (face.actionLabel != null) ...[
                const SizedBox(width: 10),
                Pressable(
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
                      face.actionLabel!,
                      style: context.localeText(theme.typography.caption.copyWith(color: c.slabInk, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
