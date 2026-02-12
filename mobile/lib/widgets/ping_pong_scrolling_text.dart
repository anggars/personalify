import 'package:flutter/material.dart';

class PingPongScrollingText extends StatefulWidget {
  final String text;
  final TextStyle style;
  final double width;
  final Duration pauseDuration;
  final double velocity; // Pixels per second
  final TextAlign textAlign; // Added parameter

  const PingPongScrollingText({
    super.key,
    required this.text,
    required this.style,
    required this.width,
    this.pauseDuration = const Duration(seconds: 2),
    this.velocity = 30.0,
    this.textAlign = TextAlign.center, // Default to center for stats
  });

  @override
  State<PingPongScrollingText> createState() => _PingPongScrollingTextState();
}

class _PingPongScrollingTextState extends State<PingPongScrollingText> with SingleTickerProviderStateMixin {
  late ScrollController _scrollController;
  late AnimationController _animationController;
  double _textWidth = 0.0;
  bool _shouldScroll = false;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _animationController = AnimationController(vsync: this);
    
    // Calculate text width after layout
    WidgetsBinding.instance.addPostFrameCallback((_) => _calculateWidthAndAnimate());
  }

  void _calculateWidthAndAnimate() {
    if (!mounted) return;
    
    final textPainter = TextPainter(
      text: TextSpan(text: widget.text, style: widget.style),
      maxLines: 1,
      textDirection: TextDirection.ltr,
    )..layout();

    _textWidth = textPainter.width;
    
    // Check if scrolling is needed
    if (_textWidth > widget.width) {
       setState(() {
         _shouldScroll = true;
       });
       _startAnimation();
    } else {
       if (_shouldScroll) {
         setState(() {
           _shouldScroll = false;
         });
       }
    }
  }

  void _startAnimation() {
    _animationController.stop();
    
    final maxScrollExtent = _textWidth - widget.width;
    final duration = Duration(milliseconds: (maxScrollExtent / widget.velocity * 1000).toInt());

    _animationController.duration = duration;
    
    _animate();
  }

  Future<void> _animate() async {
     if (!mounted || !_shouldScroll) return;

     // Wait initial pause
     await Future.delayed(widget.pauseDuration);
     if (!mounted || !_shouldScroll) return;

     // Scroll to end
     if (_scrollController.hasClients) {
       await _scrollController.animateTo(
         _scrollController.position.maxScrollExtent,
         duration: _animationController.duration!,
         curve: Curves.linear,
       );
     }

     if (!mounted || !_shouldScroll) return;
     await Future.delayed(widget.pauseDuration);

     if (!mounted || !_shouldScroll) return;

     // Scroll back to start
     if (_scrollController.hasClients) {
       await _scrollController.animateTo(
         0.0,
         duration: _animationController.duration!,
         curve: Curves.linear,
       );
     }

     if (mounted && _shouldScroll) {
       _animate(); // Loop
     }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      child: _shouldScroll
          ? SingleChildScrollView(
              controller: _scrollController,
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              child: Text(widget.text, style: widget.style),
            )
          : Text(
              widget.text, 
              style: widget.style,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: widget.textAlign, // Use aligned text instead of Center
            ),
    );
  }
}
