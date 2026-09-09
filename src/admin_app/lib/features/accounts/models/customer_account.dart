/// Transaction type enumeration
enum TransactionType {
  charge,
  payment;

  static TransactionType fromString(String value) {
    return TransactionType.values.firstWhere(
      (e) => e.name.toLowerCase() == value.toLowerCase(),
      orElse: () => TransactionType.charge,
    );
  }

  static TransactionType fromInt(int value) {
    switch (value) {
      case 1:
        return TransactionType.charge;
      case 2:
        return TransactionType.payment;
      default:
        return TransactionType.charge;
    }
  }
}

/// Represents a transaction on a customer account
class AccountTransaction {
  final int id;
  final int customerAccountId;
  final TransactionType type;
  final double amount;
  final String? description;

  /// manual, posReceipt or posCreditNote — and the till's number for the
  /// last two, so the label is built in the user's language
  final String source;
  final int? sourceNumber;
  final String recordedBy;
  final DateTime createdAt;

  const AccountTransaction({
    required this.id,
    required this.customerAccountId,
    required this.type,
    required this.amount,
    this.description,
    this.source = 'manual',
    this.sourceNumber,
    required this.recordedBy,
    required this.createdAt,
  });

  factory AccountTransaction.fromJson(Map<String, dynamic> json) {
    final typeValue = json['type'];
    TransactionType type;
    if (typeValue is int) {
      type = TransactionType.fromInt(typeValue);
    } else if (typeValue is String) {
      type = TransactionType.fromString(typeValue);
    } else {
      type = TransactionType.charge;
    }

    return AccountTransaction(
      id: json['id'] as int? ?? 0,
      customerAccountId: json['customerAccountId'] as int? ?? 0,
      type: type,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      description: json['description'] as String?,
      source: json['source'] as String? ?? 'manual',
      sourceNumber: (json['sourceNumber'] as num?)?.toInt(),
      recordedBy: json['recordedBy'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'customerAccountId': customerAccountId,
        'type': type.name,
        'amount': amount,
        'description': description,
        'recordedBy': recordedBy,
        'createdAt': createdAt.toIso8601String(),
      };

  /// Get display color for transaction type
  int get typeColorValue {
    switch (type) {
      case TransactionType.charge:
        return 0xFFEF4444; // Red for charges (customer owes more)
      case TransactionType.payment:
        return 0xFF22C55E; // Green for payments
    }
  }

  /// Get display icon for transaction type
  String get typeIcon {
    switch (type) {
      case TransactionType.charge:
        return '+';
      case TransactionType.payment:
        return '-';
    }
  }
}

/// Represents a customer's account with balance tracking
class CustomerAccount {
  final int id;
  final String customerId;
  final String? customerName;
  final double balance;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<AccountTransaction> transactions;

  const CustomerAccount({
    required this.id,
    required this.customerId,
    this.customerName,
    required this.balance,
    required this.createdAt,
    required this.updatedAt,
    this.transactions = const [],
  });

  factory CustomerAccount.fromJson(Map<String, dynamic> json) {
    final transactionsData = json['transactions'] as List<dynamic>? ?? [];

    // Safely extract customerId - handle both null and non-string types
    final customerIdRaw = json['customerId'];
    final customerId = customerIdRaw?.toString() ?? '';

    return CustomerAccount(
      id: json['id'] as int,
      customerId: customerId,
      customerName: json['customerName'] as String?,
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : DateTime.now(),
      transactions: transactionsData
          .map((e) => AccountTransaction.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'customerId': customerId,
        'customerName': customerName,
        'balance': balance,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
        'transactions': transactions.map((t) => t.toJson()).toList(),
      };

  /// Get display name (falls back to customer ID if no name)
  String get displayName => customerName ?? customerId;

  /// Check if customer has outstanding balance
  bool get hasBalance => balance > 0;

  /// Get balance display color
  int get balanceColorValue {
    if (balance > 0) {
      return 0xFFEF4444; // Red for owing money
    } else if (balance < 0) {
      return 0xFF22C55E; // Green for credit
    }
    return 0xFF6B7280; // Gray for zero
  }
}
