import 'package:flutter/material.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';

/// One detail of an address the customer may add: its name, where it is kept
class AddressDetail {
  final String label;
  final TextEditingController controller;

  /// A number is typed (a floor)
  final bool numeric;

  const AddressDetail({required this.label, required this.controller, this.numeric = false});
}

/// What helps the rider find the door, each added only if the customer wants
/// to: the building, the floor, the apartment (client_web's detail-chips).
/// Three empty boxes under the street read as three things owed; a row of
/// small "+ Building" chips reads as nothing owed at all. A tap turns a chip
/// into its field, the keyboard's Next goes on to the next one not yet given,
/// and a given one shows what was typed and opens again on a tap. The row
/// never stacks: on a narrow phone it scrolls sideways.
///
/// A note for the rider is a sentence, not a number, so it is not a chip: a
/// quiet line under the row that opens a field across the sheet, and folds
/// back when left empty.
class DetailChips extends StatefulWidget {
  final String title;
  final String optional;
  final List<AddressDetail> details;
  final String noteLabel;
  final TextEditingController note;

  const DetailChips({
    super.key,
    required this.title,
    required this.optional,
    required this.details,
    required this.noteLabel,
    required this.note,
  });

  @override
  State<DetailChips> createState() => _DetailChipsState();
}

class _DetailChipsState extends State<DetailChips> {
  int? _editing;
  bool _noting = false;
  final _noteFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    // Left empty, the note folds back to its quiet line
    _noteFocus.addListener(() {
      if (!_noteFocus.hasFocus && _noting) setState(() => _noting = false);
    });
  }

  @override
  void dispose() {
    _noteFocus.dispose();
    super.dispose();
  }

  void _next(int from) {
    final next = widget.details.indexWhere((d) => d.controller.text.trim().isEmpty, from + 1);
    setState(() => _editing = next < 0 ? null : next);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final note = context.localeText(theme.typography.note);
    final quiet = note.copyWith(color: c.mutedForeground);

    Widget chip(int index) {
      final detail = widget.details[index];
      final value = detail.controller.text.trim();
      if (_editing == index) {
        return Container(
          height: 44,
          padding: const EdgeInsetsDirectional.only(start: 16, end: 12),
          decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: c.primary, width: 2))),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppText(detail.label, style: quiet),
              const SizedBox(width: 8),
              SizedBox(
                width: 64,
                child: TextField(
                  controller: detail.controller,
                  autofocus: true,
                  keyboardType: detail.numeric ? TextInputType.number : TextInputType.text,
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) => _next(index),
                  onTapOutside: (_) => setState(() => _editing = null),
                  style: note.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: c.foreground),
                  cursorColor: c.primary,
                  decoration: const InputDecoration.collapsed(hintText: ''),
                ),
              ),
            ],
          ),
        );
      }
      final filled = value.isNotEmpty;
      return Pressable(
        onTap: () => setState(() => _editing = index),
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: ShapeDecoration(
            color: filled ? c.primary : null,
            shape: StadiumBorder(side: filled ? BorderSide.none : BorderSide(color: c.border)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!filled) ...[Icon(LucideIcons.plus, size: 14, color: c.mutedForeground), const SizedBox(width: 6)],
              AppText(
                detail.label,
                style: filled ? note.copyWith(color: c.primaryForeground.withValues(alpha: 0.8), fontWeight: FontWeight.w600) : quiet,
              ),
              if (filled) ...[
                const SizedBox(width: 6),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 140),
                  child: Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: note.copyWith(color: c.primaryForeground, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    final showsNote = _noting || widget.note.text.trim().isNotEmpty;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Expanded(child: AppText(widget.title, style: note.copyWith(fontWeight: FontWeight.w600, color: c.foreground))),
              AppText(widget.optional, style: context.localeText(theme.typography.caption.copyWith(color: c.mutedForeground))),
            ],
          ),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (var i = 0; i < widget.details.length; i++) ...[if (i > 0) const SizedBox(width: 8), chip(i)],
            ],
          ),
        ),
        const SizedBox(height: 8),
        if (showsNote)
          NinjaField(controller: widget.note, hint: widget.noteLabel, autofocus: _noting, focusNode: _noteFocus, maxLines: 2)
        else
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Pressable(
              onTap: () => setState(() => _noting = true),
              child: SizedBox(
                height: 44,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(width: 4),
                    Icon(LucideIcons.plus, size: 14, color: c.mutedForeground),
                    const SizedBox(width: 6),
                    AppText(widget.noteLabel, style: quiet),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
