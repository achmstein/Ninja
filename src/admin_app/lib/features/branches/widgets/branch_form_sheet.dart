import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/branch.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/localized_text_field.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/branches_provider.dart';

class BranchFormSheet extends ConsumerStatefulWidget {
  final Branch? branch;

  const BranchFormSheet({super.key, this.branch});

  bool get isEditing => branch != null;

  @override
  ConsumerState<BranchFormSheet> createState() => _BranchFormSheetState();
}

class _BranchFormSheetState extends ConsumerState<BranchFormSheet> {
  late final TextEditingController _nameEnController;
  late final TextEditingController _nameArController;
  late final TextEditingController _addressEnController;
  late final TextEditingController _addressArController;
  late final TextEditingController _phoneController;
  late final TextEditingController _displayOrderController;
  late bool _isActive;
  late TimeOfDay _dayStartTime;
  late TimeOfDay _dayEndTime;
  late bool _isOrderingEnabled;
  late bool _isReservationsEnabled;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final branch = widget.branch;
    _nameEnController = TextEditingController(text: branch?.name.en ?? '');
    _nameArController = TextEditingController(text: branch?.name.ar ?? '');
    _addressEnController = TextEditingController(text: branch?.address?.en ?? '');
    _addressArController = TextEditingController(text: branch?.address?.ar ?? '');
    _phoneController = TextEditingController(text: branch?.phone ?? '');
    _displayOrderController = TextEditingController(text: (branch?.displayOrder ?? 0).toString());
    _isActive = branch?.isActive ?? true;
    _dayStartTime = _parseTime(branch?.dayStartTime ?? '17:00');
    _dayEndTime = _parseTime(branch?.dayEndTime ?? '05:00');
    _isOrderingEnabled = branch?.isOrderingEnabled ?? true;
    _isReservationsEnabled = branch?.isReservationsEnabled ?? true;
  }

  TimeOfDay _parseTime(String time) {
    final parts = time.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  String _formatTime(TimeOfDay time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _nameEnController.dispose();
    _nameArController.dispose();
    _addressEnController.dispose();
    _addressArController.dispose();
    _phoneController.dispose();
    _displayOrderController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final nameEn = _nameEnController.text.trim();
    if (nameEn.isEmpty) return;

    setState(() => _isSaving = true);

    final name = LocalizedTextControllers.getValue(_nameEnController, _nameArController);
    final address = LocalizedTextControllers.getValueOrNull(_addressEnController, _addressArController);

    final data = <String, dynamic>{
      'name': name.toJson(),
      'address': address?.toJson(),
      'phone': _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
      'isActive': _isActive,
      'displayOrder': int.tryParse(_displayOrderController.text.trim()) ?? 0,
      'dayStartTime': _formatTime(_dayStartTime),
      'dayEndTime': _formatTime(_dayEndTime),
      'isOrderingEnabled': _isOrderingEnabled,
      'isReservationsEnabled': _isReservationsEnabled,
    };

    final notifier = ref.read(branchesManagementProvider.notifier);
    bool success;

    if (widget.isEditing) {
      success = await notifier.updateBranch(widget.branch!.id, data);
    } else {
      success = await notifier.createBranch(data);
    }

    if (mounted) {
      final l10n = AppLocalizations.of(context)!;
      if (success) {
        Navigator.of(context).pop(true);
        showSuccessToast(context, widget.isEditing ? l10n.branchUpdatedSuccess : l10n.branchCreatedSuccess);
      } else {
        setState(() => _isSaving = false);
        showErrorToast(context, l10n.failedToSaveBranch);
      }
    }
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
                      widget.isEditing ? l10n.editBranch : l10n.createBranch,
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
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 16,
                  bottom: 0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Name
                    LocalizedTextField(
                      label: l10n.branchName,
                      enController: _nameEnController,
                      arController: _nameArController,
                      isRequired: true,
                    ),

                    const SizedBox(height: 16),

                    // Address
                    LocalizedTextField(
                      label: l10n.branchAddress,
                      enController: _addressEnController,
                      arController: _addressArController,
                    ),

                    const SizedBox(height: 16),

                    // Phone
                    AppText(
                      l10n.branchPhone,
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 8),
                    FTextField(
                      control: FTextFieldControl.managed(controller: _phoneController),
                      hint: '01XXXXXXXXX',
                      keyboardType: TextInputType.phone,
                      textDirection: TextDirection.ltr,
                    ),

                    const SizedBox(height: 16),

                    // Display Order
                    AppText(
                      l10n.displayOrder,
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: 100,
                      child: FTextField(
                        control: FTextFieldControl.managed(controller: _displayOrderController),
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        textDirection: TextDirection.ltr,
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Business hours
                    AppText(
                      l10n.businessHours,
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () async {
                              final picked = await showTimePicker(
                                context: context,
                                initialTime: _dayStartTime,
                              );
                              if (picked != null) setState(() => _dayStartTime = picked);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(
                                border: Border.all(color: theme.colors.border),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  Icon(FIcons.clock, size: 16, color: theme.colors.mutedForeground),
                                  const SizedBox(width: 8),
                                  AppText(
                                    '${l10n.dayStartTime}: ${_dayStartTime.format(context)}',
                                    style: theme.typography.sm,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: GestureDetector(
                            onTap: () async {
                              final picked = await showTimePicker(
                                context: context,
                                initialTime: _dayEndTime,
                              );
                              if (picked != null) setState(() => _dayEndTime = picked);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(
                                border: Border.all(color: theme.colors.border),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  Icon(FIcons.clock, size: 16, color: theme.colors.mutedForeground),
                                  const SizedBox(width: 8),
                                  AppText(
                                    '${l10n.dayEndTime}: ${_dayEndTime.format(context)}',
                                    style: theme.typography.sm,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),

                    // Status toggles
                    AppText(
                      l10n.status,
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 8),

                    // Active toggle
                    if (widget.isEditing) ...[
                      Row(
                        children: [
                          Icon(
                            _isActive ? FIcons.circleCheck : FIcons.circleX,
                            color: _isActive ? Colors.green : theme.colors.mutedForeground,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: AppText(
                              l10n.branchActive,
                              style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                            ),
                          ),
                          FSwitch(
                            value: _isActive,
                            onChange: (v) => setState(() => _isActive = v),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Ordering toggle
                    Row(
                      children: [
                        Icon(
                          FIcons.shoppingCart,
                          color: _isOrderingEnabled ? Colors.green : theme.colors.mutedForeground,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppText(
                            _isOrderingEnabled ? l10n.orderingEnabled : l10n.orderingDisabled,
                            style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                          ),
                        ),
                        FSwitch(
                          value: _isOrderingEnabled,
                          onChange: (v) => setState(() => _isOrderingEnabled = v),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Reservations toggle
                    Row(
                      children: [
                        Icon(
                          FIcons.gamepad2,
                          color: _isReservationsEnabled ? Colors.green : theme.colors.mutedForeground,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppText(
                            _isReservationsEnabled ? l10n.reservationsEnabled : l10n.reservationsDisabled,
                            style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                          ),
                        ),
                        FSwitch(
                          value: _isReservationsEnabled,
                          onChange: (v) => setState(() => _isReservationsEnabled = v),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Save button - stays at bottom
            Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 12,
                bottom: 12,
              ),
              child: SizedBox(
                width: double.infinity,
                child: FButton(
                  onPress: _isSaving ? null : _save,
                  child: _isSaving
                      ? SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: theme.colors.primaryForeground,
                          ),
                        )
                      : AppText(widget.isEditing ? l10n.update : l10n.create),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }
}
