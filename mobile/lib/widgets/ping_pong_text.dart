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
  bool _isAnimating = false;
  Timer? _startTimer; // Timer buat delay

  @override
  void initState() {
    super.initState();
    // FITUR ANTI LAG: Smart Delay
    // Jangan langsung gerak! Tunggu 800ms.
    // Kalau user cuma scroll lewat (flinging), timer ini bakal ke-cancel di dispose()
    // sebelum sempet jalanin animasi. CPU lu bakal berterima kasih.
    _startTimer = Timer(const Duration(milliseconds: 800), () {
      if (mounted) {
        _startScrolling();
      }
    });
  }

  void _startScrolling() async {
    if (!mounted) return;
    
    // Cek apakah widget kelihatan
    if (!TickerMode.of(context)) {
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) _startScrolling();
      return;
    }
    
    // Cek apakah perlu scroll (konten > container)
    if (_scrollController.hasClients && _scrollController.position.maxScrollExtent <= 0) return;
    if (_isAnimating) return;

    try {
      _isAnimating = true;
      final maxScroll = _scrollController.position.maxScrollExtent;
      // Speed control: 50ms per pixel
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
      
      if (!mounted) {
        _isAnimating = false;
        return;
      }

      // Logic recursive: lanjut animasi terus
      if (mounted) { 
        setState(() {
          _scrollingRight = !_scrollingRight;
        });
        
        // Jeda dikit sebelum balik arah biar lebih natural
        await Future.delayed(const Duration(milliseconds: 500));
        
        if (mounted) {
          _isAnimating = false; 
          _startScrolling();
        }
      } 
    } catch (_) {
      _isAnimating = false;
    }
  }

  @override
  void dispose() {
    // PENTING: Cancel timer kalo widget di-kill (pas di-scroll lewat)
    _startTimer?.cancel(); 
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // RepaintBoundary udah bener, pertahankan!
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
