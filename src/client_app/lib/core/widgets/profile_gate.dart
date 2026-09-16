import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../auth/auth_service.dart';
import '../../features/settings/providers/settings_provider.dart';
import '../../l10n/app_localizations.dart';
import 'app_text.dart';

/// Ensures the user has a complete profile (name + phone) before proceeding.
///
/// Returns `true` if the profile is already complete or was just completed.
/// Returns `false` if the user dismissed the prompt.
///
/// This is a pure local state check — no network call. The profile is loaded
/// once at app startup and cached in [AuthState].
Future<bool> ensureProfileComplete(BuildContext context, WidgetRef ref) async {
  final authState = ref.read(authServiceProvider);
  if (authState.isProfileComplete) return true;

  if (!context.mounted) return false;

  final result = await showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    backgroundColor: Colors.transparent,
    builder: (context) => PopScope(
      canPop: false,
      child: _ProfilePromptSheet(
        hasName: authState.hasName,
        hasPhone: authState.hasPhone,
        currentName: authState.hasName ? authState.name : null,
        currentPhone: authState.hasPhone ? authState.phoneNumber : null,
      ),
    ),
  );

  return result == true;
}

class _ProfilePromptSheet extends ConsumerStatefulWidget {
  final bool hasName;
  final bool hasPhone;
  final String? currentName;
  final String? currentPhone;

  const _ProfilePromptSheet({
    required this.hasName,
    required this.hasPhone,
    this.currentName,
    this.currentPhone,
  });

  @override
  ConsumerState<_ProfilePromptSheet> createState() =>
      _ProfilePromptSheetState();
}

class _ProfilePromptSheetState extends ConsumerState<_ProfilePromptSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.currentName ?? '');
    _phoneController = TextEditingController(text: widget.currentPhone ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final l10n = AppLocalizations.of(context)!;
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();

    if ((!widget.hasName && name.isEmpty) || (!widget.hasPhone && phone.isEmpty)) {
      setState(() => _error = l10n.fillAllFields);
      return;
    }

    // Egyptian phone validation
    if (!widget.hasPhone && !RegExp(r'^01[0-9]{9}$').hasMatch(phone)) {
      setState(() => _error = l10n.invalidPhone);
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });

    final submitName = name.isNotEmpty ? name : widget.currentName ?? '';
    final submitPhone = phone.isNotEmpty ? phone : widget.currentPhone ?? '';

    final success = await ref
        .read(settingsProvider.notifier)
        .updateProfile(submitName, submitPhone);

    if (!mounted) return;

    if (success) {
      // Update auth state with new profile data so subsequent checks are instant
      ref.read(authServiceProvider.notifier).setProfile(submitName, submitPhone);
      Navigator.pop(context, true);
    } else {
      setState(() {
        _isSaving = false;
        _error = l10n.failedToUpdateProfile;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;

    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final viewPadding = MediaQuery.of(context).viewPadding.bottom;
    // When keyboard is open, viewInsets covers the bottom area already
    final bottomPadding = viewInsets > 0 ? viewInsets : viewPadding;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomPadding),
      child: Container(
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: colors.mutedForeground,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Title
            AppText(
              l10n.completeYourInfo,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: colors.foreground,
              ),
            ),
            const SizedBox(height: 16),

            // Error
            if (_error != null) ...[
              FAlert(
                variant: FAlertVariant.destructive,
                icon: Icon(FIcons.circleAlert),
                title: AppText(l10n.error),
                subtitle: AppText(_error!),
              ),
              const SizedBox(height: 12),
            ],

            // Name field (only show if missing)
            if (!widget.hasName) ...[
              FTextField(
                control:
                    FTextFieldControl.managed(controller: _nameController),
                label: AppText(l10n.name),
                hint: l10n.yourDisplayName,
                enabled: !_isSaving,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
            ],

            // Phone field (only show if missing)
            if (!widget.hasPhone) ...[
              FTextField(
                control:
                    FTextFieldControl.managed(controller: _phoneController),
                label: AppText(l10n.phoneNumber),
                hint: l10n.enterPhoneNumber,
                enabled: !_isSaving,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                onSubmit: (_) => _handleSave(),
              ),
              const SizedBox(height: 16),
            ],

            // Save button
            SizedBox(
              width: double.infinity,
              child: FButton(
                onPress: _isSaving ? null : _handleSave,
                child: _isSaving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : AppText(l10n.done),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
