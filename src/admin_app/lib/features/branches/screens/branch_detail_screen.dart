import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/models/branch.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../../admins/models/admin_user.dart';
import '../../admins/services/admins_service.dart';
import '../widgets/branch_form_sheet.dart';

class BranchDetailScreen extends ConsumerStatefulWidget {
  final int branchId;

  const BranchDetailScreen({super.key, required this.branchId});

  @override
  ConsumerState<BranchDetailScreen> createState() => _BranchDetailScreenState();
}

class _BranchDetailScreenState extends ConsumerState<BranchDetailScreen> {
  List<AdminUser>? _allAdmins;
  List<AdminUser>? _assignedAdmins;
  bool _isLoadingAdmins = true;

  @override
  void initState() {
    super.initState();
    _loadAdmins();
  }

  Future<void> _loadAdmins() async {
    setState(() => _isLoadingAdmins = true);
    try {
      // Membership is on the account: one list, no per-admin round trips
      final adminsRepo = ref.read(adminsRepositoryProvider);
      final allAdmins = await adminsRepo.getAdmins(role: 'Admin,Cashier', max: 100);
      final assignedAdmins = allAdmins.where((a) => a.branches.contains(widget.branchId)).toList();

      if (mounted) {
        setState(() {
          _allAdmins = allAdmins;
          _assignedAdmins = assignedAdmins;
          _isLoadingAdmins = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingAdmins = false);
      }
    }
  }

  bool get _isOwner => ref.read(isOwnerProvider);

  Branch? get _branch {
    final branchState = ref.watch(branchProvider);
    return branchState.branches.where((b) => b.id == widget.branchId).firstOrNull;
  }

  Future<void> _assignAdmin() async {
    if (_allAdmins == null) return;

    final assignedIds = _assignedAdmins?.map((a) => a.id).toSet() ?? {};
    final available = _allAdmins!.where((a) => !assignedIds.contains(a.id)).toList();

    if (available.isEmpty) return;

    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;

    final selected = await showModalBottomSheet<AdminUser>(
      context: context,
      useRootNavigator: true,
      backgroundColor: theme.colors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, top: 2, bottom: 8),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: AppText(
                  l10n.selectAdmin,
                  style: theme.typography.base.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ),
            ...available.map((admin) => ListTile(
                  dense: true,
                  leading: CircleAvatar(
                    radius: 16,
                    backgroundColor: theme.colors.secondary,
                    child: AppText(
                      admin.initials,
                      style: theme.typography.xs.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  title: AppText(
                    admin.displayName,
                    style: theme.typography.sm,
                  ),
                  subtitle: admin.email != null
                      ? AppText(
                          admin.email!,
                          style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground),
                        )
                      : null,
                  onTap: () => Navigator.pop(ctx, admin),
                )),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (selected != null) {
      bool success = false;
      try {
        await ref.read(adminsRepositoryProvider).setBranches(selected.id, {...selected.branches, widget.branchId}.toList()..sort());
        success = true;
      } catch (_) {}
      if (success && mounted) {
        final l10n = AppLocalizations.of(context)!;
        showSuccessToast(context, l10n.adminAssigned);
        _loadAdmins();
      }
    }
  }

  Future<void> _removeAdmin(AdminUser admin) async {
    final l10n = AppLocalizations.of(context)!;

    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      builder: (context) => FDialog(
        direction: Axis.horizontal,
        title: AppText(l10n.removeAdmin),
        body: AppText(l10n.confirmRemoveAdmin),
        actions: [
          FButton(
            variant: FButtonVariant.outline,
            child: AppText(l10n.cancel),
            onPress: () => Navigator.of(context).pop(false),
          ),
          FButton(
            variant: FButtonVariant.destructive,
            child: AppText(l10n.removeAdmin),
            onPress: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      bool success = false;
      try {
        await ref.read(adminsRepositoryProvider).setBranches(admin.id, admin.branches.where((id) => id != widget.branchId).toList());
        success = true;
      } catch (_) {}
      if (success && mounted) {
        showSuccessToast(context, l10n.adminRemoved);
        _loadAdmins();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final branch = _branch;

    void goBack() {
      if (_isOwner) {
        context.go('/branches');
      } else {
        context.go('/orders');
      }
    }

    if (branch == null) {
      return Scaffold(
        backgroundColor: theme.colors.background,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(FIcons.arrowLeft),
                      onPressed: goBack,
                    ),
                  ],
                ),
              ),
              Expanded(child: Center(child: CircularProgressIndicator(color: theme.colors.primary))),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: theme.colors.background,
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(FIcons.arrowLeft),
                    onPressed: goBack,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: AppText(
                      branch.name.localized(context),
                      style: theme.typography.lg.copyWith(fontSize: 18, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (_isOwner)
                    IconButton(
                      icon: const Icon(FIcons.pencil, size: 20),
                      onPressed: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          useRootNavigator: true,
                          backgroundColor: Colors.transparent,
                          barrierColor: Colors.black.withValues(alpha: 0.5),
                          builder: (context) => BranchFormSheet(branch: branch),
                        );
                      },
                      tooltip: l10n.editBranch,
                    ),
                ],
              ),
            ),

            // Body
            Expanded(
              child: RefreshIndicator(
                color: theme.colors.primary,
                backgroundColor: theme.colors.background,
                onRefresh: () => ref.read(branchProvider.notifier).refresh(),
                child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Branch info
                    FTileGroup(
                      label: AppText(l10n.branchDetails),
                      children: [
                        FTile(
                          prefix: const Icon(FIcons.building),
                          title: AppText(l10n.branchName),
                          subtitle: AppText(branch.name.localized(context)),
                        ),
                        if (branch.address != null)
                          FTile(
                            prefix: const Icon(FIcons.mapPin),
                            title: AppText(l10n.branchAddress),
                            subtitle: AppText(branch.address!.localized(context)),
                          ),
                        if (branch.phone != null)
                          FTile(
                            prefix: const Icon(FIcons.phone),
                            title: AppText(l10n.branchPhone),
                            subtitle: AppText(branch.phone!),
                          ),
                        FTile(
                          prefix: const Icon(FIcons.clock),
                          title: AppText(l10n.businessHours),
                          subtitle: AppText('${branch.dayStartTime} - ${branch.dayEndTime}'),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Operational status
                    FTileGroup(
                      label: AppText(l10n.status),
                      children: [
                        FTile(
                          prefix: Icon(
                            branch.isActive ? FIcons.circleCheck : FIcons.circleX,
                            color: branch.isActive ? Colors.green : theme.colors.mutedForeground,
                          ),
                          title: AppText(branch.isActive ? l10n.active : l10n.inactive),
                        ),
                        FTile(
                          prefix: Icon(
                            FIcons.shoppingCart,
                            color: branch.isOrderingEnabled ? Colors.green : theme.colors.mutedForeground,
                          ),
                          title: AppText(branch.isOrderingEnabled ? l10n.orderingEnabled : l10n.orderingDisabled),
                        ),
                        FTile(
                          prefix: Icon(
                            FIcons.gamepad2,
                            color: branch.isReservationsEnabled ? Colors.green : theme.colors.mutedForeground,
                          ),
                          title: AppText(branch.isReservationsEnabled ? l10n.reservationsEnabled : l10n.reservationsDisabled),
                        ),
                      ],
                    ),

                    if (_isOwner) ...[
                    const SizedBox(height: 24),

                    // Assigned admins
                    Row(
                      children: [
                        AppText(
                          l10n.assignedAdmins,
                          style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const Spacer(),
                        IconButton(
                          icon: const Icon(Icons.person_add_outlined, size: 20),
                          onPressed: _assignAdmin,
                          tooltip: l10n.assignAdmin,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    if (_isLoadingAdmins)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: CircularProgressIndicator(color: theme.colors.primary),
                        ),
                      )
                    else if (_assignedAdmins == null || _assignedAdmins!.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: AppText(
                            l10n.noAdminsAssigned,
                            style: theme.typography.sm.copyWith(
                              color: theme.colors.mutedForeground,
                            ),
                          ),
                        ),
                      )
                    else
                      ...(_assignedAdmins!.map((admin) => _AdminTile(
                            admin: admin,
                            onRemove: admin.isOwner ? null : () => _removeAdmin(admin),
                          ))),
                    ], // end if (_isOwner)
                  ],
                ),
              ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdminTile extends StatelessWidget {
  final AdminUser admin;
  final VoidCallback? onRemove;

  const _AdminTile({required this.admin, this.onRemove});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: theme.colors.secondary,
            child: AppText(
              admin.initials,
              style: theme.typography.xs.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(
                  admin.displayName,
                  style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                ),
                if (admin.email != null)
                  AppText(
                    admin.email!,
                    style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground),
                  ),
              ],
            ),
          ),
          if (onRemove != null)
            IconButton(
              icon: Icon(
                Icons.person_remove_outlined,
                size: 18,
                color: theme.colors.destructive,
              ),
              onPressed: onRemove,
            ),
        ],
      ),
    );
  }
}
