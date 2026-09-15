import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/branch.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/localized_text_field.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/branches_provider.dart';

class BranchEditScreen extends ConsumerStatefulWidget {
  final int? branchId;

  const BranchEditScreen({super.key, this.branchId});

  @override
  ConsumerState<BranchEditScreen> createState() => _BranchEditScreenState();
}

class _BranchEditScreenState extends ConsumerState<BranchEditScreen> {
  final _nameEnController = TextEditingController();
  final _nameArController = TextEditingController();
  final _addressEnController = TextEditingController();
  final _addressArController = TextEditingController();
  final _phoneController = TextEditingController();
  final _displayOrderController = TextEditingController(text: '0');
  bool _isActive = true;
  bool _isSaving = false;

  bool get _isEditing => widget.branchId != null;

  @override
  void initState() {
    super.initState();
    if (_isEditing) {
      _loadBranchData();
    }
  }

  void _loadBranchData() {
    final state = ref.read(branchesManagementProvider);
    final branch = state.branches.where((b) => b.id == widget.branchId).firstOrNull;
    if (branch != null) {
      _nameEnController.text = branch.name.en;
      _nameArController.text = branch.name.ar ?? '';
      _addressEnController.text = branch.address?.en ?? '';
      _addressArController.text = branch.address?.ar ?? '';
      _phoneController.text = branch.phone ?? '';
      _displayOrderController.text = branch.displayOrder.toString();
      _isActive = branch.isActive;
    }
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
    };

    final notifier = ref.read(branchesManagementProvider.notifier);
    bool success;

    if (_isEditing) {
      success = await notifier.updateBranch(widget.branchId!, data);
    } else {
      success = await notifier.createBranch(data);
    }

    if (success && mounted) {
      final l10n = AppLocalizations.of(context)!;
      showSuccessToast(context, _isEditing ? l10n.branchUpdatedSuccess : l10n.branchCreatedSuccess);
      if (_isEditing) {
        context.go('/branches/${widget.branchId}');
      } else {
        context.go('/branches');
      }
    }

    if (mounted) {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: theme.colors.background,
      body: SafeArea(
        child: Column(
      children: [
        // Header with back button
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(FIcons.arrowLeft),
                onPressed: () {
                  if (_isEditing) {
                    context.go('/branches/${widget.branchId}');
                  } else {
                    context.go('/branches');
                  }
                },
              ),
              const SizedBox(width: 4),
              AppText(
                _isEditing ? l10n.editBranch : l10n.createBranch,
                style: theme.typography.lg.copyWith(fontSize: 18, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),

        // Form
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
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

                const SizedBox(height: 20),

                // Address
                LocalizedTextField(
                  label: l10n.branchAddress,
                  enController: _addressEnController,
                  arController: _addressArController,
                ),

                const SizedBox(height: 20),

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

                const SizedBox(height: 20),

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

                const SizedBox(height: 20),

                // Active toggle
                if (_isEditing)
                  FTile(
                    prefix: Icon(
                      _isActive ? FIcons.circleCheck : FIcons.circleX,
                      color: _isActive ? Colors.green : theme.colors.mutedForeground,
                    ),
                    title: AppText(l10n.branchActive),
                    suffix: FSwitch(
                      value: _isActive,
                      onChange: (v) => setState(() => _isActive = v),
                    ),
                  ),

                const SizedBox(height: 32),

                // Save button
                SizedBox(
                  width: double.infinity,
                  child: FButton(
                    onPress: _isSaving ? null : _save,
                    child: _isSaving
                        ? SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: theme.colors.primaryForeground,
                            ),
                          )
                        : AppText(l10n.save),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
      ),
    );
  }
}
