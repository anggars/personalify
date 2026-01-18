import 'dart:async';
import 'package:flutter/material.dart';

class PingPongScrollingText extends StatefulWidget {
  final String text;
  final TextStyle style;
  final double width;

  const PingPongScrollingText({
    super.key,
    required this.text,
    required this.style,
    required this.width,
  });

  @override
  State<PingPongScrollingText> createState() => _PingPongScrollingTextState();
}

class _PingPongScrollingTextState extends State<PingPongScrollingText> {
  final ScrollController _scrollController = ScrollController();
  bool _scrollingRight = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startScrolling();
    });
  }

  void _startScrolling() async {
    if (!mounted) return;
    if (_scrollController.hasClients && _scrollController.position.maxScrollExtent <= 0) return;

    try {
      final maxScroll = _scrollController.position.maxScrollExtent;
      // SLOWER SPEED: 50ms per pixel (was 30ms) for smoother, readable text
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
      
      if (mounted) {
        setState(() {
          _scrollingRight = !_scrollingRight;
        });
        _startScrolling();
      }
    } catch (_) {
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
    return SizedBox(
      width: widget.width,
      child: SingleChildScrollView(
        controller: _scrollController,
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(), 
        child: Text(widget.text, style: widget.style),
      ),
    );
  }
}
