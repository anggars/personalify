import 'dart:async';
import 'package:flutter/material.dart';

class PingPongScrollingText extends StatefulWidget {
  final String text;
  final TextStyle style;
  final double width;
  final Alignment alignment;

  const PingPongScrollingText({
    super.key,
    required this.text,
    required this.style,
    required this.width,
    this.alignment = Alignment.centerLeft,
  });

  @override
  State<PingPongScrollingText> createState() => _PingPongScrollingTextState();
}

class _PingPongScrollingTextState extends State<PingPongScrollingText> {
  final ScrollController _scrollController = ScrollController();
  bool _scrollingRight = true;
  bool _isAnimating = false; // OPTIMIZE: Track animation state

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startScrolling();
    });
  }

  void _startScrolling() async {
    if (!mounted) return;
    
    // OPTIMIZE: Check if TickerMode is enabled (widget is visible in tree)
    if (!TickerMode.of(context)) {
      // Retry after a delay when TickerMode might be enabled again
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) _startScrolling();
      return;
    }
    
    if (_scrollController.hasClients && _scrollController.position.maxScrollExtent <= 0) return;
    if (_isAnimating) return; // Prevent multiple animations

    try {
      _isAnimating = true;
      final maxScroll = _scrollController.position.maxScrollExtent;
      // OPTIMIZE: Slower speed = less CPU (50ms per pixel)
      final duration = Duration(milliseconds: (maxScroll * 50).toInt()); 

      if (_scrollingRight) {
        await _scrollController.animateTo(
          maxScroll,
          duration: duration,
          curve: Curves.linear,
        );
      } else {
        await _scrollController.animateTo(
          0.0,
          duration: duration,
          curve: Curves.linear,
        );
      }
      
      if (!mounted) return;

      // Pause at ends
      await Future.delayed(const Duration(seconds: 2));
      
      if (mounted && TickerMode.of(context)) { // OPTIMIZE: Check visibility again
        setState(() {
          _scrollingRight = !_scrollingRight;
        });
        _isAnimating = false;
        _startScrolling();
      } else {
        _isAnimating = false;
      }
    } catch (_) {
      _isAnimating = false;
      // Handle ScrollController detached during disposal
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: SizedBox(
        width: widget.width,
        child: SingleChildScrollView(
          controller: _scrollController,
          scrollDirection: Axis.horizontal,
          physics: const NeverScrollableScrollPhysics(), 
          child: Container(
            constraints: BoxConstraints(minWidth: widget.width),
            alignment: widget.alignment,
            child: Text(widget.text, style: widget.style),
          ),
        ),
      ),
    );
  }
}

