import '../../../core/models/money.dart';

/// 100 points = 1 EGP — the constant Loyalty and Ordering each keep
const pointsPerEgp = 100;

/// A customer's loyalty account as Loyalty.API returns it. Information only
/// on the till: points are earned, joined and spent in the customer app.
class LoyaltyAccount {
  final String userId;
  final int pointsBalance;
  final String tier;

  const LoyaltyAccount({required this.userId, required this.pointsBalance, required this.tier});

  double get worth => pointsBalance / pointsPerEgp;

  factory LoyaltyAccount.fromJson(Map<String, dynamic> json) => LoyaltyAccount(
        userId: json['userId'] as String? ?? '',
        pointsBalance: toInt(json['pointsBalance']),
        tier: json['currentTier'] as String? ?? '',
      );
}

/// A customer's tab as Accounts.API summarises it: positive = owed.
class TabAccount {
  final String customerId;
  final String? customerName;
  final double balance;

  const TabAccount({required this.customerId, this.customerName, required this.balance});

  factory TabAccount.fromJson(Map<String, dynamic> json) => TabAccount(
        customerId: json['customerId'] as String? ?? '',
        customerName: json['customerName'] as String?,
        balance: toNumber(json['balance']),
      );
}

/// Someone the till can look up: an identity account, with what it knows of them.
class CardCustomer {
  final String id;
  final String name;
  final String? phone;

  const CardCustomer({required this.id, required this.name, this.phone});
}
