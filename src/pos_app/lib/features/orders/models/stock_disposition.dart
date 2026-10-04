/// What becomes of a confirmed order's food once it will never be sold:
/// written off as waste, or its ingredients back on the shelf
enum StockDisposition {
  waste('Waste'),
  restock('Restock');

  const StockDisposition(this.wire);

  /// As the server reads it
  final String wire;

  /// What the till offers first when it cancels or voids: waste once the
  /// food was made (the kitchen marked it ready, or it went out with a
  /// rider), back to stock when it never was. The cashier confirms or changes it.
  static StockDisposition defaultFor(bool prepared) => prepared ? waste : restock;

  /// A bill's orders: waste if any of them was made, since the bill goes as one
  static StockDisposition defaultForAll(Iterable<bool> prepared) => defaultFor(prepared.any((p) => p));
}
