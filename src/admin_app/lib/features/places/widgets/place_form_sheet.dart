import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/localized_text_field.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../models/place.dart';
import '../providers/places_provider.dart';

/// Sheet for creating or editing a place: what it is, what it is called,
/// and how its time is charged
class PlaceFormSheet extends ConsumerStatefulWidget {
  final Place? place;

  const PlaceFormSheet({super.key, this.place});

  bool get isEditing => place != null;

  @override
  ConsumerState<PlaceFormSheet> createState() => _PlaceFormSheetState();
}

/// The controllers behind one rate option row
class _OptionFields {
  final code = TextEditingController();
  final nameEn = TextEditingController();
  final nameAr = TextEditingController();
  final rate = TextEditingController();

  _OptionFields();

  _OptionFields.from(RateOption option) {
    code.text = option.code;
    nameEn.text = option.name.en;
    nameAr.text = option.name.ar ?? '';
    rate.text = _rateText(option.hourlyRate);
  }

  _OptionFields.seed(String code, String en, String ar, double? hourlyRate) {
    this.code.text = code;
    nameEn.text = en;
    nameAr.text = ar;
    rate.text = hourlyRate == null ? '' : _rateText(hourlyRate);
  }

  static String _rateText(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  RateOption? toOption() {
    final c = code.text.trim();
    final r = double.tryParse(rate.text.trim());
    if (c.isEmpty || r == null || r <= 0) return null;
    return RateOption(
      code: c,
      name: LocalizedTextControllers.getValue(nameEn, nameAr),
      hourlyRate: r,
    );
  }

  void dispose() {
    code.dispose();
    nameEn.dispose();
    nameAr.dispose();
    rate.dispose();
  }
}

class _PlaceFormSheetState extends ConsumerState<PlaceFormSheet> {
  late PlaceKind _kind;
  late TextEditingController _nameEnController;
  late TextEditingController _nameArController;
  late TextEditingController _descriptionEnController;
  late TextEditingController _descriptionArController;
  late TextEditingController _roundingController;
  late bool _timed;
  final List<_OptionFields> _options = [];
  bool _isSubmitting = false;
  String? _validationError;

  @override
  void initState() {
    super.initState();
    final place = widget.place;
    _kind = place?.kind ?? PlaceKind.room;
    _nameEnController = TextEditingController(text: place?.name.en ?? '');
    _nameArController = TextEditingController(text: place?.name.ar ?? '');
    _descriptionEnController = TextEditingController(text: place?.description?.en ?? '');
    _descriptionArController = TextEditingController(text: place?.description?.ar ?? '');
    _roundingController = TextEditingController(text: '${place?.roundingMinutes ?? 15}');
    _timed = place?.isTimed ?? _kind == PlaceKind.room;
    if (place != null) {
      _options.addAll(place.options.map(_OptionFields.from));
    } else if (_timed) {
      _seedOptions();
    }
  }

  /// The rates a new place starts with: a room charges single and multi
  /// like the rooms already there, a table or station has one rate
  void _seedOptions() {
    for (final o in _options) {
      o.dispose();
    }
    _options.clear();
    if (_kind == PlaceKind.room) {
      final rooms = ref.read(placesProvider).places.where((p) => p.kind == PlaceKind.room && p.isTimed);
      final single = rooms.map((p) => p.option('single')).whereType<RateOption>().firstOrNull;
      final multi = rooms.map((p) => p.option('multi')).whereType<RateOption>().firstOrNull;
      _options.add(_OptionFields.seed('single', single?.name.en ?? 'Single', single?.name.ar ?? 'فردي', single?.hourlyRate));
      _options.add(_OptionFields.seed('multi', multi?.name.en ?? 'Multi', multi?.name.ar ?? 'جماعي', multi?.hourlyRate));
    } else {
      _options.add(_OptionFields.seed('standard', 'Standard', 'عادي', null));
    }
  }

  @override
  void dispose() {
    _nameEnController.dispose();
    _nameArController.dispose();
    _descriptionEnController.dispose();
    _descriptionArController.dispose();
    _roundingController.dispose();
    for (final o in _options) {
      o.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: theme.colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colors.mutedForeground,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.only(left: 16, right: 16, top: 2, bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: AppText(
                        widget.isEditing ? l10n.editPlace : l10n.newPlace,
                        style: theme.typography.lg.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Icon(Icons.close, color: theme.colors.mutedForeground),
                    ),
                  ],
                ),
              ),

              // Form
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(left: 16, right: 16, top: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Kind: fixed once the place exists
                      _label(theme, l10n.kind),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          for (final kind in PlaceKind.values) ...[
                            Expanded(
                              child: FButton(
                                variant: _kind == kind ? null : FButtonVariant.outline,
                                onPress: widget.isEditing || _kind == kind ? null : () => _pickKind(kind),
                                child: AppText(_kindLabel(l10n, kind)),
                              ),
                            ),
                            if (kind != PlaceKind.values.last) const SizedBox(width: 8),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Name field (bilingual)
                      LocalizedTextField(
                        label: l10n.name,
                        isRequired: true,
                        enController: _nameEnController,
                        arController: _nameArController,
                      ),
                      const SizedBox(height: 16),

                      // Description field (bilingual)
                      LocalizedTextField(
                        label: l10n.description,
                        enController: _descriptionEnController,
                        arController: _descriptionArController,
                        isMultiline: true,
                        maxLines: 3,
                      ),
                      const SizedBox(height: 16),

                      // Timed: has a clock and rates; off means orders only
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _label(theme, l10n.timed),
                                const SizedBox(height: 2),
                                AppText(
                                  l10n.ordersOnly,
                                  style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground),
                                ),
                              ],
                            ),
                          ),
                          FSwitch(
                            value: _timed,
                            onChange: (value) => setState(() {
                              _timed = value;
                              if (value && _options.isEmpty) _seedOptions();
                            }),
                          ),
                        ],
                      ),

                      if (_timed) ...[
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(child: _label(theme, l10n.rateOptions)),
                            GestureDetector(
                              onTap: () => setState(() => _options.add(_OptionFields())),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.add, size: 18, color: theme.colors.primary),
                                  const SizedBox(width: 4),
                                  AppText(
                                    l10n.addRateOption,
                                    style: theme.typography.sm.copyWith(color: theme.colors.primary),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        for (var i = 0; i < _options.length; i++) ...[
                          _OptionRow(
                            fields: _options[i],
                            onRemove: _options.length > 1
                                ? () => setState(() => _options.removeAt(i).dispose())
                                : null,
                          ),
                          const SizedBox(height: 12),
                        ],

                        // Rounding step
                        _label(theme, l10n.roundingMinutes),
                        const SizedBox(height: 8),
                        FTextField(
                          control: FTextFieldControl.managed(controller: _roundingController),
                          hint: '15',
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        ),
                      ],

                      if (_validationError != null) ...[
                        const SizedBox(height: 12),
                        AppText(
                          _validationError!,
                          style: theme.typography.sm.copyWith(color: theme.colors.destructive),
                        ),
                      ],
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),

              // Actions
              Padding(
                padding: const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: () => Navigator.of(context).pop(),
                        child: AppText(l10n.cancel),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FButton(
                        onPress: _isSubmitting ? null : _submit,
                        child: _isSubmitting
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.primary),
                              )
                            : AppText(widget.isEditing ? l10n.update : l10n.create),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _label(FThemeData theme, String text) =>
      AppText(text, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500));

  String _kindLabel(AppLocalizations l10n, PlaceKind kind) => switch (kind) {
        PlaceKind.room => l10n.placeKindRoom,
        PlaceKind.table => l10n.placeKindTable,
        PlaceKind.station => l10n.placeKindStation,
      };

  void _pickKind(PlaceKind kind) {
    setState(() {
      _kind = kind;
      // A fresh form follows the kind: rooms are timed, the rest take orders
      _timed = kind == PlaceKind.room;
      if (_timed) _seedOptions();
    });
  }

  /// The tariff as the form has it, null for orders only; throws when a
  /// row is not filled in
  Tariff? _readTariff() {
    if (!_timed) return null;
    final options = <RateOption>[];
    for (final fields in _options) {
      final option = fields.toOption();
      if (option == null) throw const FormatException();
      if (options.any((o) => o.code == option.code)) throw const FormatException();
      options.add(option);
    }
    if (options.isEmpty) throw const FormatException();
    final rounding = int.tryParse(_roundingController.text.trim()) ?? 0;
    if (rounding <= 0) throw const FormatException();
    return Tariff(options: options, roundingMinutes: rounding);
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context)!;
    if (_nameEnController.text.trim().isEmpty) {
      setState(() => _validationError = l10n.nameRequired);
      return;
    }
    final Tariff? tariff;
    try {
      tariff = _readTariff();
    } on FormatException {
      setState(() => _validationError = l10n.fillEveryRate);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _validationError = null;
    });

    final name = LocalizedTextControllers.getValue(_nameEnController, _nameArController);
    final description = LocalizedTextControllers.getValueOrNull(_descriptionEnController, _descriptionArController);
    final notifier = ref.read(placesProvider.notifier);

    String? refusal;
    final place = widget.place;
    if (place == null) {
      refusal = await notifier.createPlace(kind: _kind, name: name, description: description, tariff: tariff);
    } else {
      refusal = await notifier.updatePlace(place.id, name: name, description: description);
      // The tariff has its own call, and the server refuses it while a stay runs
      if (refusal == null && tariff != place.tariff) {
        refusal = await notifier.setTariff(place.id, tariff);
      }
    }

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (refusal == null) {
      Navigator.of(context).pop(true);
      showSuccessToast(context, l10n.placeSaved);
    } else {
      showErrorToast(context, refusal.isEmpty ? l10n.failedToSavePlace : refusal);
    }
  }
}

/// One rate option: its code, its name in both languages, the hourly rate
class _OptionRow extends StatelessWidget {
  final _OptionFields fields;
  final VoidCallback? onRemove;

  const _OptionRow({required this.fields, this.onRemove});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: FTextField(
                  control: FTextFieldControl.managed(controller: fields.code),
                  hint: l10n.optionCode,
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-z0-9_-]'))],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FTextField(
                  control: FTextFieldControl.managed(controller: fields.rate),
                  hint: l10n.hourlyRate,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
                ),
              ),
              if (onRemove != null)
                IconButton(
                  icon: Icon(Icons.remove_circle_outline, size: 20, color: theme.colors.destructive),
                  onPressed: onRemove,
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: FTextField(
                  control: FTextFieldControl.managed(controller: fields.nameEn),
                  hint: '${l10n.name} (EN)',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FTextField(
                  control: FTextFieldControl.managed(controller: fields.nameAr),
                  hint: '${l10n.name} (AR)',
                  textDirection: TextDirection.rtl,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
