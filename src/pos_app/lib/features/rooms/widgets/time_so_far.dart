import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/models/money.dart';
import '../models/room.dart';
import '../status.dart';

/// The running session's cost so far, as money, ticking on its own clock
/// so the ticket around it does not rebuild every second. Same figure the
/// session card shows; the ticket repeats it where the bill is read (the
/// lines and the total), because the time is not on the bill until the
/// session ends.
class TimeSoFar extends StatefulWidget {
  final RoomSession session;
  final TextStyle? style;

  const TimeSoFar({super.key, required this.session, this.style});

  @override
  State<TimeSoFar> createState() => _TimeSoFarState();
}

class _TimeSoFarState extends State<TimeSoFar> {
  late final Timer _clock = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      Text(money(context, widget.session.estimate(DateTime.now()).amount), style: widget.style);
}
