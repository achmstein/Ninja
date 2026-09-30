import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../brand/brand_style.dart';
import '../ui/ui.dart';
import '../auth/auth_service.dart';
import '../../features/settings/providers/settings_provider.dart';
import '../../l10n/app_localizations.dart';
import 'app_text.dart';
import '../brand/brand_provider.dart';

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

  // Asked on the slab, like every question; it stays until answered
  final result = await showNinjaSheet<bool>(
    context: context,
    dismissible: false,
    builder: (context) => PopScope(
      canPop: false,
      child: _ProfilePromptSheet(
        hasName: authState.hasName,
        hasPhone: authState.hasPhone,
        // Whatever part of the name there is (an Apple account may hold a first name alone)
        currentName: authState.nameParts,
        currentPhone: authState.hasPhone ? authState.phoneNumber : null,
      ),
    ),
  );

  return result == true;
}

class _ProfilePromptSheet extends ConsumerStatefulWidget {
  final bool hasName;
  final bool hasPhone;
  final (String, String)? currentName;
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
  late final TextEditingController _firstNameController;
  late final TextEditingController _lastNameController;
  late final TextEditingController _phoneController;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _firstNameController = TextEditingController(text: widget.currentName?.$1 ?? '');
    _lastNameController = TextEditingController(text: widget.currentName?.$2 ?? '');
    _phoneController = TextEditingController(text: widget.currentPhone ?? '');
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final l10n = AppLocalizations.of(context)!;
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final phone = _phoneController.text.trim();

    if ((!widget.hasName && (firstName.isEmpty || lastName.isEmpty)) || (!widget.hasPhone && phone.isEmpty)) {
      setState(() => _error = l10n.fillAllFields);
      return;
    }

    if (!widget.hasPhone && !ref.read(brandProvider).locale.isValidPhone(phone)) {
      setState(() => _error = l10n.invalidPhone);
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });

    final submitFirst = firstName.isNotEmpty ? firstName : widget.currentName?.$1 ?? '';
    final submitLast = lastName.isNotEmpty ? lastName : widget.currentName?.$2 ?? '';
    final submitPhone = phone.isNotEmpty ? phone : widget.currentPhone ?? '';

    final success = await ref
        .read(settingsProvider.notifier)
        .updateProfile(submitFirst, submitLast, submitPhone);

    if (!mounted) return;

    if (success) {
      // Update auth state with new profile data so subsequent checks are instant
      ref.read(authServiceProvider.notifier).setProfile(submitFirst, submitLast, submitPhone);
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

    return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title
            BrandHeading(
              l10n.completeYourInfo,
              style: context.theme.typography.headline.copyWith(color: colors.foreground),
            ),
            const SizedBox(height: 16),

            // Error
            if (_error != null) ...[
              NinjaAlert(
                variant: NinjaAlertVariant.destructive,
                icon: Icon(LucideIcons.circleAlert),
                title: AppText(l10n.error),
                subtitle: AppText(_error!),
              ),
              const SizedBox(height: 12),
            ],

            // First and last name (only when missing)
            if (!widget.hasName) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: NinjaField(
                      controller: _firstNameController,
                      label: AppText(l10n.firstName),
                      enabled: !_isSaving,
                      textInputAction: TextInputAction.next,
                      textCapitalization: TextCapitalization.words,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: NinjaField(
                      controller: _lastNameController,
                      label: AppText(l10n.lastName),
                      enabled: !_isSaving,
                      textInputAction: TextInputAction.next,
                      textCapitalization: TextCapitalization.words,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],

            // Phone field (only show if missing)
            if (!widget.hasPhone) ...[
              NinjaField(
                controller: _phoneController,
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
              child: NinjaButton(
                onPress: _isSaving ? null : _handleSave,
                busy: _isSaving,
                child: AppText(l10n.done),
              ),
            ),
          ],
        );
  }
}
