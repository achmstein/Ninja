import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_mark.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../places/screens/qr_scan_screen.dart';
import 'claim_service.dart';

/// A customer the café added at the counter (a name and a phone, nothing
/// to sign in with) takes the account over: the link the till shared opens
/// here, or they bring the code in from the sign-in page by scanning the
/// till's QR or pasting the link. They give an email and a password; the
/// account, its points and its orders are the same, now theirs.
class ClaimScreen extends ConsumerStatefulWidget {
  /// From the link, when it opened the app; null from the sign-in page
  final String? token;

  const ClaimScreen({super.key, this.token});

  @override
  ConsumerState<ClaimScreen> createState() => _ClaimScreenState();
}

class _ClaimScreenState extends ConsumerState<ClaimScreen> {
  final _codeController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  String? _token;
  ClaimPreview? _preview;
  bool _loading = false;

  /// The link itself is no good: the whole page says so
  ClaimFailure? _linkFailure;

  /// Something about what they typed: said by the field or above the button
  String? _emailError;
  String? _formError;
  String? _codeError;

  @override
  void initState() {
    super.initState();
    final token = claimTokenFrom(widget.token);
    if (token != null) {
      _token = token;
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadPreview());
    } else if (widget.token != null) {
      _linkFailure = ClaimFailure.invalid;
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _loadPreview() async {
    final token = _token;
    if (token == null) return;
    setState(() {
      _loading = true;
      _linkFailure = null;
    });
    try {
      final preview = await ref.read(claimRepositoryProvider).preview(token);
      if (mounted) setState(() => _preview = preview);
    } on ClaimException catch (e) {
      if (mounted) setState(() => _linkFailure = e.failure);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _useCode(String? input) {
    final l10n = AppLocalizations.of(context)!;
    final token = claimTokenFrom(input);
    if (token == null) {
      setState(() => _codeError = l10n.claimInvalid);
      return;
    }
    setState(() {
      _codeError = null;
      _token = token;
    });
    _loadPreview();
  }

  Future<void> _scan() async {
    final scanned = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const ClaimScanScreen()),
    );
    if (scanned != null && mounted) _useCode(scanned);
  }

  void _startOver() {
    setState(() {
      _token = null;
      _preview = null;
      _linkFailure = null;
      _formError = null;
      _emailError = null;
      _codeController.clear();
    });
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context)!;
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _emailError = null;
      _formError = null;
    });
    if (email.isEmpty || password.isEmpty) {
      setState(() => _formError = l10n.fillAllFields);
      return;
    }
    if (!_looksLikeEmail(email)) {
      setState(() => _emailError = l10n.claimBadEmail);
      return;
    }
    if (password.length < 8) {
      setState(() => _formError = l10n.claimPasswordTooShort);
      return;
    }
    if (password != _confirmController.text) {
      setState(() => _formError = l10n.passwordsDontMatch);
      return;
    }

    setState(() => _loading = true);
    try {
      final signInEmail = await ref.read(claimRepositoryProvider).claim(_token!, email, password);
      if (!mounted) return;
      showFToast(
        context: context,
        title: Text(l10n.claimDone),
        icon: Icon(FIcons.check, color: context.theme.colors.primary),
      );
      // Signed straight in with what they just chose; if that fails the
      // account is still theirs, and the sign-in page is one step away
      final signedIn = await ref.read(authServiceProvider.notifier).signIn(signInEmail, password);
      if (!mounted) return;
      context.go(signedIn ? '/menu' : '/login');
    } on ClaimException catch (e) {
      if (!mounted) return;
      setState(() {
        switch (e.failure) {
          case ClaimFailure.invalid:
          case ClaimFailure.expired:
          case ClaimFailure.used:
            _linkFailure = e.failure;
          case ClaimFailure.emailTaken:
            _emailError = l10n.claimEmailTaken;
          case ClaimFailure.badEmail:
            _emailError = l10n.claimBadEmail;
          case ClaimFailure.badPassword:
            _formError = l10n.claimPasswordTooShort;
          case ClaimFailure.tooManyAttempts:
            _formError = l10n.claimTooMany;
          case ClaimFailure.network:
            _formError = l10n.claimFailed;
        }
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static bool _looksLikeEmail(String email) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email);

  String _linkMessage(AppLocalizations l10n, ClaimFailure failure) => switch (failure) {
        ClaimFailure.expired => l10n.claimExpired,
        ClaimFailure.used => l10n.claimUsed,
        ClaimFailure.tooManyAttempts => l10n.claimTooMany,
        ClaimFailure.network => l10n.claimFailed,
        _ => l10n.claimInvalid,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    final cafe = ref.watch(brandProvider).displayName(Localizations.localeOf(context));

    final Widget body;
    if (_linkFailure != null) {
      body = _failed(l10n, _linkFailure!);
    } else if (_token == null) {
      body = _entry(l10n);
    } else if (_preview == null) {
      body = const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(child: CircularProgressIndicator()),
      );
    } else {
      body = _form(l10n, _preview!);
    }

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(child: BrandWordmark(height: 96)),
                const SizedBox(height: 24),
                AppText(
                  _token == null && _linkFailure == null ? l10n.haveCafeCode : l10n.claimTitle(cafe),
                  style: TextStyle(fontWeight: FontWeight.bold, color: colors.foreground, fontSize: 24),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                body,
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AppText(
                      l10n.alreadyHaveAccount,
                      style: TextStyle(color: colors.mutedForeground, fontSize: 14),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/login'),
                      child: AppText(
                        l10n.signIn,
                        style: TextStyle(color: colors.primary, fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _entry(AppLocalizations l10n) {
    final colors = context.theme.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppText(
          l10n.claimScanOrPaste,
          style: TextStyle(color: colors.mutedForeground, fontSize: 15),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        FButton(
          onPress: _scan,
          prefix: Icon(FIcons.scanLine),
          child: AppText(l10n.claimScan),
        ),
        const SizedBox(height: 16),
        FTextField(
          control: FTextFieldControl.managed(controller: _codeController),
          label: AppText(l10n.claimPasteLabel),
          hint: l10n.claimPasteHint,
          textInputAction: TextInputAction.go,
          onSubmit: _useCode,
        ),
        if (_codeError != null) _fieldError(_codeError!),
        const SizedBox(height: 16),
        FButton(
          variant: FButtonVariant.outline,
          onPress: () => _useCode(_codeController.text),
          child: AppText(l10n.claimContinue),
        ),
      ],
    );
  }

  Widget _failed(AppLocalizations l10n, ClaimFailure failure) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FAlert(
          variant: FAlertVariant.destructive,
          icon: Icon(FIcons.circleAlert),
          title: AppText(l10n.error),
          subtitle: AppText(_linkMessage(l10n, failure)),
        ),
        const SizedBox(height: 16),
        if (failure == ClaimFailure.used)
          FButton(onPress: () => context.go('/login'), child: AppText(l10n.signIn))
        else
          FButton(
            variant: FButtonVariant.outline,
            onPress: _startOver,
            child: AppText(l10n.claimTryAnother),
          ),
      ],
    );
  }

  Widget _form(AppLocalizations l10n, ClaimPreview preview) {
    final colors = context.theme.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppText(
          l10n.claimIntro,
          style: TextStyle(color: colors.mutedForeground, fontSize: 15),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        if (_formError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: FAlert(
              variant: FAlertVariant.destructive,
              icon: Icon(FIcons.circleAlert),
              title: AppText(l10n.error),
              subtitle: AppText(_formError!),
            ),
          ),
        // Who the café added: theirs to read, not to change here
        _readOnly(l10n.name, preview.name),
        if (preview.phoneNumber != null) ...[
          const SizedBox(height: 12),
          _readOnly(l10n.phoneNumber, preview.phoneNumber!, ltr: true),
        ],
        const SizedBox(height: 16),
        FTextField.email(
          control: FTextFieldControl.managed(controller: _emailController),
          label: AppText(l10n.email),
          hint: l10n.enterEmail,
          textInputAction: TextInputAction.next,
        ),
        if (_emailError != null) _fieldError(_emailError!),
        const SizedBox(height: 16),
        FTextField.password(
          control: FTextFieldControl.managed(controller: _passwordController),
          label: AppText(l10n.password),
          hint: l10n.createPassword,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 16),
        FTextField.password(
          control: FTextFieldControl.managed(controller: _confirmController),
          label: AppText(l10n.confirmPassword),
          hint: l10n.confirmYourPassword,
          textInputAction: TextInputAction.done,
          onSubmit: (_) => _submit(),
        ),
        const SizedBox(height: 24),
        FButton(
          onPress: _loading ? null : _submit,
          child: _loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : AppText(l10n.claimSubmit),
        ),
      ],
    );
  }

  Widget _readOnly(String label, String value, {bool ltr = false}) {
    final colors = context.theme.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: colors.muted,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppText(label, style: TextStyle(color: colors.mutedForeground, fontSize: 12)),
          const SizedBox(height: 2),
          AppText(
            value,
            style: TextStyle(color: colors.foreground, fontSize: 16, fontWeight: FontWeight.w500),
            textDirection: ltr ? TextDirection.ltr : null,
          ),
        ],
      ),
    );
  }

  Widget _fieldError(String message) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: AppText(
          message,
          style: TextStyle(color: context.theme.colors.destructive, fontSize: 13),
        ),
      );
}

/// The till's QR, read with the camera; hands back whatever it says and
/// lets the claim screen decide whether that is a claim link
class ClaimScanScreen extends StatefulWidget {
  const ClaimScanScreen({super.key});

  @override
  State<ClaimScanScreen> createState() => _ClaimScanScreenState();
}

class _ClaimScanScreenState extends State<ClaimScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    final value = capture.barcodes.firstOrNull?.rawValue;
    if (_done || value == null || claimTokenFrom(value) == null) return;
    _done = true;
    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: AppText(
          l10n.claimScan,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          ScanOverlay(hint: l10n.claimPointCamera),
        ],
      ),
    );
  }
}
