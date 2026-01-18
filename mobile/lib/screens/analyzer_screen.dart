import 'package:flutter/material.dart';

/// Analyzer screen placeholder - for lyrics emotion analysis
class AnalyzerScreen extends StatelessWidget {
  const AnalyzerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Lyrics Analyzer',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1DB954),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Analyze emotions in song lyrics',
                style: TextStyle(fontSize: 14, color: Color(0xFF908F8F)),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF282828)),
                ),
                child: const Center(
                  child: Text(
                    '🎤 Coming Soon\n\nPaste lyrics or search Genius to analyze emotions.',
                    style: TextStyle(color: Color(0xFFB3B3B3), fontSize: 14),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
