import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/services/branch_service.dart';

/// Every active branch of the business, off the public list: not only the
/// ones this account works at (the switcher's), since a phone delivery is
/// sent to, or comes from, any of them
final allBranchesProvider = FutureProvider<List<Branch>>((ref) => ref.read(branchRepositoryProvider).getBranches());

/// A branch by name in the till's language; its number while the list is
/// not in, or when the list does not have it
String branchNameOf(List<Branch>? branches, int? branchId, BuildContext context) {
  if (branchId == null) return '';
  for (final b in branches ?? const <Branch>[]) {
    if (b.id == branchId) {
      final name = b.name.localized(context);
      if (name.isNotEmpty) return name;
    }
  }
  return '#$branchId';
}
