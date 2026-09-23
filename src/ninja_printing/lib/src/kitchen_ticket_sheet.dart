import 'package:flutter/widgets.dart';
import 'kitchen_ticket.dart';

/// Paper width in printer dots: 72 mm at 203 dpi, the printable width of
/// every 80 mm thermal printer. Sheets are laid out at this size 1:1.
const ticketWidth = 576.0;

/// The words a kitchen ticket prints, in the ticket's language. The app
/// passes them in: the sheet is drawn outside any widget tree, so it has no
/// localizations of its own.
class KitchenTicketLabels {
  final String counter;
  final String pickup;
  final String reprint;
  final String test;

  /// What a test page says under the station's name
  final String testBody;

  const KitchenTicketLabels({
    required this.counter,
    required this.pickup,
    required this.reprint,
    required this.test,
    required this.testBody,
  });
}

/// A station's part of an order on paper, the way a kitchen reads one: the
/// station on top so the ticket goes to the right hands, then the order
/// number, where it goes and the time in large type, then each line as
/// quantity × product with how to make it underneath, and the customer's
/// note. REPRINT or TEST stands above everything when it is one. Nothing
/// about money. White paper, black ink, the language's direction.
class KitchenTicketSheet extends StatelessWidget {
  final KitchenTicket ticket;
  final KitchenTicketLabels labels;
  final String languageCode;
  final String fontFamily;

  const KitchenTicketSheet({
    super.key,
    required this.ticket,
    required this.labels,
    required this.languageCode,
    required this.fontFamily,
  });

  static const _ink = Color(0xFF000000);
  static const _paper = Color(0xFFFFFFFF);

  @override
  Widget build(BuildContext context) {
    final lang = languageCode;
    final rule = Container(height: 3, color: _ink, margin: const EdgeInsets.symmetric(vertical: 12));
    final thin = Container(height: 1, color: _ink, margin: const EdgeInsets.symmetric(vertical: 8));

    final place = ticket.placeName?.pick(lang) ?? '';
    final where = place.isNotEmpty ? place : (ticket.source == 'Pos' ? labels.counter : labels.pickup);
    final at = (ticket.confirmedAt ?? ticket.createdAt).toLocal();
    final time = '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';

    TextStyle style(double size, {FontWeight weight = FontWeight.w400}) =>
        TextStyle(fontSize: size, fontWeight: weight, color: _ink, height: 1.25);

    Widget banner(String text) => Container(
          color: _ink,
          padding: const EdgeInsets.symmetric(vertical: 6),
          margin: const EdgeInsets.only(bottom: 12),
          child: Text(text, textAlign: TextAlign.center, style: style(30, weight: FontWeight.w700).copyWith(color: _paper)),
        );

    return Directionality(
      textDirection: lang == 'ar' ? TextDirection.rtl : TextDirection.ltr,
      child: DefaultTextStyle(
        style: TextStyle(fontFamily: fontFamily, fontSize: 24, color: _ink, fontFeatures: const [FontFeature.tabularFigures()]),
        child: ColoredBox(
          color: _paper,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (ticket.isTest) banner(labels.test) else if (ticket.isReprint) banner(labels.reprint),
                Text(ticket.stationName.pick(lang), textAlign: TextAlign.center, style: style(40, weight: FontWeight.w700)),
                if (ticket.isTest) ...[
                  const SizedBox(height: 12),
                  Text(labels.testBody, textAlign: TextAlign.center, style: style(26)),
                ] else ...[
                  rule,
                  Row(
                    children: [
                      Text('#${ticket.orderNumber ?? ''}', style: style(40, weight: FontWeight.w700)),
                      const Spacer(),
                      Text(time, style: style(32, weight: FontWeight.w700)),
                    ],
                  ),
                  Text(where, style: style(32, weight: FontWeight.w700)),
                  if (ticket.customerName != null) Text(ticket.customerName!, style: style(26)),
                  rule,
                  for (final (index, line) in ticket.lines.indexed) ...[
                    if (index > 0) thin,
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(width: 72, child: Text('${line.units}×', style: style(34, weight: FontWeight.w700))),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(line.name.pick(lang), style: style(34, weight: FontWeight.w700)),
                              if (line.customizations != null) Text(line.customizations!.pick(lang), style: style(26)),
                              if (line.instructions != null) Text('» ${line.instructions}', style: style(26, weight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (ticket.customerNote != null) ...[
                    rule,
                    Container(
                      decoration: BoxDecoration(border: Border.all(color: _ink, width: 3)),
                      padding: const EdgeInsets.all(8),
                      child: Text(ticket.customerNote!, style: style(28, weight: FontWeight.w700)),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
