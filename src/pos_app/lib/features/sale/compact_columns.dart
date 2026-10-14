/// How many compact tiles to a row for the menu's own width (not the
/// screen's): six beside the sale on a 1280 tablet, eight on a 1920 one, and
/// on anything narrower as many as fit at 112 wide.
int compactColumns(double width, {double gap = 8}) {
  if (width >= 1280) return 8;
  if (width >= 1024) return 7;
  if (width >= 768) return 6;
  final fit = (width + gap) ~/ (112 + gap);
  return fit < 1 ? 1 : fit;
}
