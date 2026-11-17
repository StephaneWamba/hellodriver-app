import 'package:flutter/material.dart';

/// Radar-style pulsing rings around a center icon — used for "searching"
/// states (looking for a driver, waiting for a match). Code-drawn, no
/// external asset: reliable offline and avoids licensing an imported animation.
class HdPulseLoader extends StatefulWidget {
  const HdPulseLoader({
    super.key,
    required this.icon,
    required this.color,
    this.size = 96,
  });

  final IconData icon;
  final Color color;
  final double size;

  @override
  State<HdPulseLoader> createState() => _HdPulseLoaderState();
}

class _HdPulseLoaderState extends State<HdPulseLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return Stack(
            alignment: Alignment.center,
            children: [
              for (final delay in [0.0, 0.33, 0.66]) _ring(delay),
              Container(
                width: widget.size * 0.42,
                height: widget.size * 0.42,
                decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
                child: Icon(widget.icon, color: Colors.white, size: widget.size * 0.22),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _ring(double delay) {
    final t = (_controller.value + delay) % 1.0;
    final scale = 0.42 + t * 0.58;
    final opacity = (1 - t).clamp(0.0, 1.0);
    return Opacity(
      opacity: opacity * 0.5,
      child: Container(
        width: widget.size * scale,
        height: widget.size * scale,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: widget.color, width: 2),
        ),
      ),
    );
  }
}
