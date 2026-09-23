import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Paints a widget into a bitmap without ever putting it on screen: its
/// own render tree, laid out at `width` logical pixels and as tall as the
/// content wants, then snapshotted. The receipt is a widget so Arabic,
/// tabular figures and the brand come out exactly as Flutter draws them;
/// the printer only ever sees dots.
///
/// The widget must be self-sufficient — no `Localizations`, `Theme` or
/// `MediaQuery` ancestors exist here, so pass strings, fonts and colours in.
Future<ui.Image> rasterizeWidget(Widget widget, {required double width, double pixelRatio = 1}) async {
  final dispatcher = WidgetsBinding.instance.platformDispatcher;
  final view = dispatcher.implicitView ?? dispatcher.views.first;

  // Tall enough for any bill, finite so layout stays finite
  const maxHeight = 16384.0;
  final boundary = RenderRepaintBoundary();
  final renderView = RenderView(
    view: view,
    // Tight width, loose height: the view takes the content's height
    configuration: ViewConfiguration(
      logicalConstraints: BoxConstraints(minWidth: width, maxWidth: width, minHeight: 0, maxHeight: maxHeight),
      physicalConstraints: BoxConstraints(
        minWidth: width * pixelRatio,
        maxWidth: width * pixelRatio,
        minHeight: 0,
        maxHeight: maxHeight * pixelRatio,
      ),
      devicePixelRatio: pixelRatio,
    ),
    child: boundary,
  );

  final pipelineOwner = PipelineOwner();
  final buildOwner = BuildOwner(focusManager: FocusManager());
  pipelineOwner.rootNode = renderView;
  renderView.prepareInitialFrame();

  final root = RenderObjectToWidgetAdapter<RenderBox>(
    container: boundary,
    child: widget,
  ).attachToRenderTree(buildOwner);

  buildOwner.buildScope(root);
  buildOwner.finalizeTree();
  pipelineOwner.flushLayout();
  pipelineOwner.flushCompositingBits();
  pipelineOwner.flushPaint();

  return boundary.toImage(pixelRatio: pixelRatio);
}
