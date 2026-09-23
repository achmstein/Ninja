/// ESC/POS printing for the apps in the shop: a widget drawn off-screen,
/// turned into printer dots, and sent raw to a network printer. Arabic
/// prints like everything else, because everything prints as an image.
library;

export 'src/escpos_builder.dart';
export 'src/image_raster.dart';
export 'src/network_escpos_printer.dart';
export 'src/widget_rasterizer.dart';
