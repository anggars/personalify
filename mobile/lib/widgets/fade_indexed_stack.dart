import 'package:flutter/material.dart';

class FadeIndexedStack extends StatefulWidget {
  final int index;
  final List<Widget> children;
  final Duration duration;

  const FadeIndexedStack({
    super.key,
    required this.index,
    required this.children,
    this.duration = const Duration(milliseconds: 300),
  });

  @override
  State<FadeIndexedStack> createState() => _FadeIndexedStackState();
}

class _FadeIndexedStackState extends State<FadeIndexedStack> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _scaleAnimation;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.index;
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 600)); // Longer duration for smooth curve
    
    // "Framer Motion" styled Curve (Fast Out, Slow Settle)
    const curve = Curves.fastLinearToSlowEaseIn;

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutQuad));
    _slideAnimation = Tween<Offset>(begin: const Offset(0, 0.05), end: Offset.zero).animate(CurvedAnimation(parent: _controller, curve: curve)); // Smooth slide up
    _scaleAnimation = Tween<double>(begin: 0.98, end: 1.0).animate(CurvedAnimation(parent: _controller, curve: curve)); // Very subtle scale

    _controller.forward();
  }

  @override
  void didUpdateWidget(FadeIndexedStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.index != _currentIndex) {
      // Instant reverse? Or smooth?
      // For "Framer" feel, usually existing page vanishes quickly, new page springs in.
      _controller.value = 0; 
      setState(() => _currentIndex = widget.index);
      _controller.forward();
      // Skipping reverse animation makes it feel snappier like React/Framer switching tabs.
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SlideTransition(
        position: _slideAnimation,
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: IndexedStack(
            index: _currentIndex,
            children: widget.children,
          ),
        ),
      ),
    );
  }
}
