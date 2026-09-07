import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../../core/auth/auth_service.dart';
import '../../../core/models/branch.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../../branches/providers/branches_provider.dart';
import '../models/admin_user.dart';
import '../providers/admins_provider.dart';
import '../services/admins_service.dart';

class AdminDetailScreen extends ConsumerStatefulWidget {
  final String adminId;

  const AdminDetailScreen({super.key, required this.adminId});

  @override
  ConsumerState<AdminDetailScreen> createState() => _AdminDetailScreenState();
}

class _AdminDetailScreenState extends ConsumerState<AdminDetailScreen> {
  List<Branch> _branches = [];
  bool _isLoadingBranches = true;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(adminsProvider.notifier).loadAdmins();
      _loadBranches();
    });
  }

  Future<void> _loadBranches() async {
    setState(() => _isLoadingBranches = true);
    try {
      // The account carries its branch ids; the owner's full list names them
      final admin = await ref.read(adminsRepositoryProvider).getAdmin(widget.adminId);
      await ref.read(branchesManagementProvider.notifier).loadBranches();
      if (!mounted) return;
      final all = ref.read(branchesManagementProvider).branches;
      final branches = all.where((b) => admin.branches.contains(b.id)).toList();
      setState(() {
        _branches = branches;
        _isLoadingBranches = false;
      });
    } catch (e) {
      setState(() => _isLoadingBranches = false);
    }
  }

  Future<void> _refresh() async {
    await Future.wait([
      ref.read(adminsProvider.notifier).loadAdmins(),
      _loadBranches(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(adminsProvider);
    final isOwner = ref.watch(isOwnerProvider);
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context);

    final admin =
        state.admins.where((a) => a.id == widget.adminId).firstOrNull;

    if (admin == null) {
      return Scaffold(
        backgroundColor: theme.colors.background,
        body: SafeArea(
          child: Column(
            children: [
              _buildHeader(context, theme, null, l10n, false),
              Expanded(
                child: state.isLoading
                    ? Center(child: CircularProgressIndicator(color: theme.colors.primary))
                    : Center(
                        child: AppText(
                          l10n.adminNotFound,
                          style: theme.typography.sm.copyWith(
                            color: theme.colors.mutedForeground,
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ),
      );
    }

    final bool isAdminOwner = admin.realmRoles.contains('Owner');

    return Scaffold(
      backgroundColor: theme.colors.background,
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        child: RefreshIndicator(
          color: theme.colors.primary,
          backgroundColor: theme.colors.background,
          onRefresh: _refresh,
          child: CustomScrollView(
            slivers: [
              // Header
              SliverToBoxAdapter(
                child: _buildHeader(context, theme, admin, l10n, isOwner),
              ),

              // Stats row
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Row(
                    children: [
                      if (admin.createdAt != null)
                        Expanded(
                          child: _StatItem(
                            label: l10n.memberSince,
                            value: DateFormat('MMM yyyy', locale.languageCode)
                                .format(admin.createdAt!),
                          ),
                        ),
                      Expanded(
                        child: _StatItem(
                          label: l10n.status,
                          value: admin.enabled ? l10n.active : l10n.disabled,
                          valueColor: admin.enabled
                              ? const Color(0xFF22C55E)
                              : theme.colors.mutedForeground,
                        ),
                      ),
                      Expanded(
                        child: _StatItem(
                          label: l10n.role,
                          value: isAdminOwner ? l10n.owner : l10n.adminRole,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 24)),

              // Branches section
              SliverToBoxAdapter(
                child: _BranchesSection(
                  branches: _branches,
                  isLoading: _isLoadingBranches,
                  isOwner: isOwner,
                  isAdminOwner: isAdminOwner,
                  adminId: widget.adminId,
                  onBranchRemoved: _loadBranches,
                  onAssignBranch: () => _showAssignBranchSheet(context),
                  l10n: l10n,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, FThemeData theme,
      AdminUser? admin, AppLocalizations l10n, bool isOwner) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.go('/admins'),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(
                  admin?.displayName ?? l10n.adminDetails,
                  style: theme.typography.base.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (admin?.email != null)
                  AppText(
                    admin!.email!,
                    style: theme.typography.xs.copyWith(
                      color: theme.colors.mutedForeground,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          if (admin != null && isOwner) ...[
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 22),
              onPressed: () => _showEditNameSheet(context, admin),
              tooltip: l10n.editName,
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 22),
              onSelected: (value) {
                if (value == 'reset_password') {
                  _showResetPasswordSheet(context, admin);
                } else if (value == 'toggle_enabled') {
                  _showToggleEnabledDialog(context, admin);
                }
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'reset_password',
                  child: Row(
                    children: [
                      const Icon(Icons.lock_reset, size: 20),
                      const SizedBox(width: 8),
                      Text(l10n.resetPassword),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: 'toggle_enabled',
                  child: Row(
                    children: [
                      Icon(
                        admin.enabled
                            ? Icons.block
                            : Icons.check_circle_outline,
                        size: 20,
                        color: admin.enabled ? const Color(0xFFEF4444) : null,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        admin.enabled ? l10n.blockAdmin : l10n.unblockAdmin,
                        style: TextStyle(
                          color:
                              admin.enabled ? const Color(0xFFEF4444) : null,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  void _showEditNameSheet(BuildContext context, AdminUser admin) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final nameController = TextEditingController(text: admin.displayName);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Container(
          decoration: BoxDecoration(
            color: theme.colors.background,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: theme.colors.mutedForeground,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    l10n.editName,
                  style: theme.typography.lg
                      .copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                AppText(l10n.newName,
                    style: theme.typography.sm
                        .copyWith(fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                FTextField(
                  control:
                      FTextFieldControl.managed(controller: nameController),
                  hint: l10n.enterNewName,
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: () => Navigator.pop(context),
                        child: AppText(l10n.cancel),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FButton(
                        onPress: () async {
                          final newName = nameController.text.trim();
                          if (newName.isEmpty) return;

                          final success = await ref
                              .read(adminsProvider.notifier)
                              .updateAdminName(admin.id, newName);

                          if (context.mounted) {
                            Navigator.pop(context);
                            if (success) {
                              showSuccessToast(context, l10n.nameUpdatedSuccessfully);
                            } else {
                              showErrorToast(context, l10n.failedToUpdateName);
                            }
                          }
                        },
                        child: AppText(l10n.save),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      ),
    );
  }

  void _showResetPasswordSheet(BuildContext context, AdminUser admin) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final passwordController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Container(
          decoration: BoxDecoration(
            color: theme.colors.background,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: theme.colors.mutedForeground,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppText(
                    l10n.resetPassword,
                  style: theme.typography.lg
                      .copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                AppText(l10n.newPassword,
                    style: theme.typography.sm
                        .copyWith(fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                FTextField.password(
                  control: FTextFieldControl.managed(
                      controller: passwordController),
                  hint: l10n.enterNewPassword,
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: () => Navigator.pop(context),
                        child: AppText(l10n.cancel),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FButton(
                        onPress: () async {
                          final newPassword = passwordController.text;
                          if (newPassword.length < 8) {
                            showErrorToast(context, l10n.passwordMinLength);
                            return;
                          }

                          final success = await ref
                              .read(adminsProvider.notifier)
                              .resetAdminPassword(admin.id, newPassword);

                          if (context.mounted) {
                            Navigator.pop(context);
                            if (success) {
                              showSuccessToast(context, l10n.passwordResetSuccess);
                            } else {
                              showErrorToast(context, l10n.failedToResetPassword);
                            }
                          }
                        },
                        child: AppText(l10n.resetPassword),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      ),
    );
  }

  void _showToggleEnabledDialog(BuildContext context, AdminUser admin) async {
    final l10n = AppLocalizations.of(context)!;
    final isBlocking = admin.enabled;

    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(isBlocking ? l10n.blockAdmin : l10n.unblockAdmin),
        body: AppText(isBlocking
            ? l10n.blockAdminConfirmation
            : l10n.unblockAdminConfirmation),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            variant: isBlocking ? FButtonVariant.destructive : null,
            child: AppText(l10n.confirm),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    final success =
        await ref.read(adminsProvider.notifier).toggleAdminEnabled(admin.id);
    if (context.mounted) {
      if (success) {
        showSuccessToast(context, isBlocking ? l10n.adminBlocked : l10n.adminUnblocked);
      } else {
        showErrorToast(context, l10n.failedToToggleAdmin);
      }
    }
  }

  void _showAssignBranchSheet(BuildContext context) async {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;

    // Load all branches
    await ref.read(branchesManagementProvider.notifier).loadBranches();
    if (!context.mounted) return;

    final branchesState = ref.read(branchesManagementProvider);
    final assignedIds = _branches.map((b) => b.id).toSet();
    final availableBranches =
        branchesState.branches.where((b) => !assignedIds.contains(b.id)).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.6,
        ),
        decoration: BoxDecoration(
          color: theme.colors.background,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: theme.colors.mutedForeground,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: AppText(
                  l10n.assignBranch,
                  style: theme.typography.lg
                      .copyWith(fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 12),
              if (availableBranches.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(32),
                  child: AppText(
                    l10n.noBranchesFound,
                    style: theme.typography.sm
                        .copyWith(color: theme.colors.mutedForeground),
                  ),
                )
              else
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: availableBranches.length,
                    itemBuilder: (context, index) {
                      final branch = availableBranches[index];
                      return ListTile(
                        title: AppText(
                          branch.name.getLocalizedText(context),
                          style: theme.typography.sm,
                        ),
                        subtitle: branch.address != null
                            ? AppText(
                                branch.address!.getLocalizedText(context),
                                style: theme.typography.xs.copyWith(
                                    color: theme.colors.mutedForeground),
                              )
                            : null,
                        onTap: () async {
                          Navigator.pop(context);
                          final success = await ref
                              .read(adminsProvider.notifier)
                              .setBranches(widget.adminId, [..._branches.map((b) => b.id), branch.id]..sort());
                          if (success) {
                            await _loadBranches();
                          }
                          if (context.mounted) {
                            if (success) {
                              showSuccessToast(context, l10n.adminAssigned);
                            } else {
                              showErrorToast(context, l10n.failedToLoad);
                            }
                          }
                        },
                      );
                    },
                  ),
                ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _StatItem({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;

    return Column(
      children: [
        AppText(
          value,
          style: theme.typography.base.copyWith(
            fontWeight: FontWeight.w600,
            color: valueColor,
          ),
        ),
        const SizedBox(height: 2),
        AppText(
          label,
          style: theme.typography.xs
              .copyWith(color: theme.colors.mutedForeground),
        ),
      ],
    );
  }
}

class _BranchesSection extends ConsumerWidget {
  final List<Branch> branches;
  final bool isLoading;
  final bool isOwner;
  final bool isAdminOwner;
  final String adminId;
  final VoidCallback onBranchRemoved;
  final VoidCallback onAssignBranch;
  final AppLocalizations l10n;

  const _BranchesSection({
    required this.branches,
    required this.isLoading,
    required this.isOwner,
    required this.isAdminOwner,
    required this.adminId,
    required this.onBranchRemoved,
    required this.onAssignBranch,
    required this.l10n,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Row(
            children: [
              AppText(
                l10n.assignedBranches,
                style: theme.typography.sm.copyWith(
                  fontWeight: FontWeight.w600,
                  color: theme.colors.mutedForeground,
                ),
              ),
              const Spacer(),
              if (isOwner && !isAdminOwner)
                IconButton(
                  icon: const Icon(Icons.add, size: 20),
                  onPressed: onAssignBranch,
                  tooltip: l10n.assignBranch,
                ),
            ],
          ),
        ),

        if (isLoading && branches.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: CircularProgressIndicator(color: theme.colors.primary),
            ),
          )
        else if (branches.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(
                    Icons.store_outlined,
                    size: 48,
                    color: theme.colors.mutedForeground,
                  ),
                  const SizedBox(height: 12),
                  AppText(
                    l10n.noBranchesAssigned,
                    style: theme.typography.sm.copyWith(
                      color: theme.colors.mutedForeground,
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          ...branches.map((branch) => Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: theme.colors.secondary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.store_outlined, size: 16),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppText(
                            branch.name.getLocalizedText(context),
                            style: theme.typography.sm
                                .copyWith(fontWeight: FontWeight.w500),
                          ),
                          if (branch.address != null)
                            AppText(
                              branch.address!.getLocalizedText(context),
                              style: theme.typography.xs.copyWith(
                                  color: theme.colors.mutedForeground),
                            ),
                        ],
                      ),
                    ),
                    if (isOwner && !isAdminOwner)
                      IconButton(
                        icon: Icon(
                          Icons.remove_circle_outline,
                          size: 20,
                          color: theme.colors.mutedForeground,
                        ),
                        onPressed: () async {
                          final confirmed =
                              await showAdaptiveDialog<bool>(
                            context: context,
                            builder: (context) => FDialog(
                              direction: Axis.horizontal,
                              title: AppText(l10n.removeAdmin),
                              body: AppText(l10n.confirmRemoveAdmin),
                              actions: [
                                FButton(
                                  variant: FButtonVariant.outline,
                                  child: AppText(l10n.cancel),
                                  onPress: () =>
                                      Navigator.of(context).pop(false),
                                ),
                                FButton(
                                  variant: FButtonVariant.destructive,
                                  child: AppText(l10n.confirm),
                                  onPress: () =>
                                      Navigator.of(context).pop(true),
                                ),
                              ],
                            ),
                          );

                          if (confirmed != true) return;

                          final success = await ref
                              .read(adminsProvider.notifier)
                              .setBranches(adminId, branches.where((b) => b.id != branch.id).map((b) => b.id).toList());
                          if (success) {
                            onBranchRemoved();
                          }
                          if (context.mounted) {
                            if (success) {
                              showSuccessToast(context, l10n.adminRemoved);
                            } else {
                              showErrorToast(context, l10n.failedToLoad);
                            }
                          }
                        },
                      ),
                  ],
                ),
              )),
      ],
    );
  }
}
