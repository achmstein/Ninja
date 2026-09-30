import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';

/// A field in the Ninja style (client_web's ui/input.tsx): filled, not
/// outlined, a finger's height, the corners of the pills around it, 16 px
/// text. A [label] over it when given; the password kind has a way to show
/// what was typed.
class NinjaField extends StatefulWidget {
  final TextEditingController? controller;
  final Widget? label;
  final String? hint;
  final bool enabled;
  final bool autofocus;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final ValueChanged<String>? onSubmit;
  final ValueChanged<String>? onChange;
  final List<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final int minLines;
  final int maxLines;
  final FocusNode? focusNode;

  const NinjaField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.enabled = true,
    this.autofocus = false,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.onSubmit,
    this.onChange,
    this.autofillHints,
    this.inputFormatters,
    this.minLines = 1,
    this.maxLines = 1,
    this.focusNode,
  });

  const NinjaField.email({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.enabled = true,
    this.autofocus = false,
    this.textInputAction,
    this.onSubmit,
    this.onChange,
    this.focusNode,
  })  : obscure = false,
        keyboardType = TextInputType.emailAddress,
        textCapitalization = TextCapitalization.none,
        autofillHints = const [AutofillHints.email],
        inputFormatters = null,
        minLines = 1,
        maxLines = 1;

  const NinjaField.password({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.enabled = true,
    this.autofocus = false,
    this.textInputAction,
    this.onSubmit,
    this.onChange,
    this.focusNode,
  })  : obscure = true,
        keyboardType = TextInputType.visiblePassword,
        textCapitalization = TextCapitalization.none,
        autofillHints = const [AutofillHints.password],
        inputFormatters = null,
        minLines = 1,
        maxLines = 1;

  @override
  State<NinjaField> createState() => _NinjaFieldState();
}

class _NinjaFieldState extends State<NinjaField> {
  late bool _hidden = widget.obscure;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final c = theme.colors;
    final radius = BorderRadius.circular(16);
    OutlineInputBorder border(Color color, double width) => OutlineInputBorder(
          borderRadius: radius,
          borderSide: width == 0 ? BorderSide.none : BorderSide(color: color, width: width),
        );
    final field = TextField(
      controller: widget.controller,
      focusNode: widget.focusNode,
      enabled: widget.enabled,
      autofocus: widget.autofocus,
      obscureText: _hidden,
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      textCapitalization: widget.textCapitalization,
      onSubmitted: widget.onSubmit,
      onChanged: widget.onChange,
      autofillHints: widget.autofillHints,
      inputFormatters: widget.inputFormatters,
      minLines: widget.minLines,
      maxLines: widget.obscure ? 1 : widget.maxLines,
      style: context.localeText(TextStyle(fontSize: 16, color: c.foreground)),
      cursorColor: c.foreground,
      decoration: InputDecoration(
        hintText: widget.hint,
        hintStyle: context.localeText(TextStyle(fontSize: 16, color: c.mutedForeground)),
        filled: true,
        fillColor: c.muted,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: border(c.border, 0),
        enabledBorder: border(c.border, 0),
        disabledBorder: border(c.border, 0),
        focusedBorder: border(c.primary.withValues(alpha: 0.4), 2),
        suffixIcon: widget.obscure
            ? IconButton(
                onPressed: () => setState(() => _hidden = !_hidden),
                icon: Icon(_hidden ? LucideIcons.eye : LucideIcons.eyeOff, size: 18, color: c.mutedForeground),
              )
            : null,
      ),
    );
    final body = Opacity(opacity: widget.enabled ? 1 : 0.5, child: field);
    if (widget.label == null) return body;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        DefaultTextStyle.merge(
          style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w500, color: c.foreground)),
          child: widget.label!,
        ),
        const SizedBox(height: 8),
        body,
      ],
    );
  }
}
