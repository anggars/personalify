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

class _PingPongScrollingTextState extends State<PingPongScrollingText> with WidgetsBindingObserver {
  final ScrollController _scrollController = ScrollController();
  bool _scrollingRight = true;
  bool _isAnimating = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) _startScrolling();
    });
  }

  void _startScrolling() async {
    if (!mounted) return;
    
    if (!TickerMode.of(context)) {
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) _startScrolling();
      return;
    }
    
    if (_scrollController.hasClients && _scrollController.position.maxScrollExtent <= 0) return;
    if (_isAnimating) return;

    try {
      _isAnimating = true;
      final maxScroll = _scrollController.position.maxScrollExtent;
      final duration = Duration(milliseconds: (maxScroll * 40).toInt()); 

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
      
      // OPTIMIZE: Add 2 second pause at the end
      await Future.delayed(const Duration(seconds: 2));
      
      if (!mounted) {
        _isAnimating = false;
        return;
      }
      
      // OPTIMIZE: Flip direction WITHOUT setState to avoid rebuild
      _scrollingRight = !_scrollingRight;
      _isAnimating = false; 
      
      if (mounted) {
        _startScrolling();
      }
    } catch (_) {
      _isAnimating = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      _isAnimating = false;
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.offset); 
      }
    } else if (state == AppLifecycleState.resumed) {
      if (mounted) _startScrolling();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
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
