/// Transaction type
enum TransactionType {
  charge,
  payment;

  static TransactionType fromString(String value) {
    return TransactionType.values.firstWhere(
      (e) => e.name.toLowerCase() == value.toLowerCase(),
      orElse: () => TransactionType.charge,
    );
  }
}

/// Account transaction
class AccountTransaction {
  final int id;
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
    required this.type,
    required this.amount,
    this.description,
    this.source = 'manual',
    this.sourceNumber,
    required this.recordedBy,
    required this.createdAt,
  });

  factory AccountTransaction.fromJson(Map<String, dynamic> json) {
    return AccountTransaction(
      id: json['id'] as int,
      type: TransactionType.fromString(json['type'] as String),
      amount: (json['amount'] as num).toDouble(),
      description: json['description'] as String?,
      source: json['source'] as String? ?? 'manual',
      sourceNumber: (json['sourceNumber'] as num?)?.toInt(),
      recordedBy: json['recordedBy'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  bool get isCharge => type == TransactionType.charge;
  bool get isPayment => type == TransactionType.payment;

  String get typeDisplay => isCharge ? 'Charge' : 'Payment';
}

/// Customer account balance info
class AccountBalance {
  final int id;
  final String customerId;
  final String? customerName;
  final double balance;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<AccountTransaction> transactions;

  const AccountBalance({
    required this.id,
    required this.customerId,
    this.customerName,
    required this.balance,
    required this.createdAt,
    required this.updatedAt,
    this.transactions = const [],
  });

  factory AccountBalance.fromJson(Map<String, dynamic> json) {
    return AccountBalance(
      id: json['id'] as int,
      customerId: json['customerId'] as String,
      customerName: json['customerName'] as String?,
      balance: (json['balance'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      transactions: (json['transactions'] as List<dynamic>?)
              ?.map((e) => AccountTransaction.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  /// Check if customer has outstanding balance
  bool get hasBalance => balance != 0;

  /// Check if customer owes money
  bool get owesAmount => balance > 0;

  /// Check if customer has credit
  bool get hasCredit => balance < 0;
}
