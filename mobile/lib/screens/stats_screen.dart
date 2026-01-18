import 'package:flutter/material.dart';

/// Stats screen - shows genre breakdown and listening statistics  
class StatsScreen extends StatelessWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Stats'),
        centerTitle: true,
      ),
      body: const Center(
        child: Text(
          'Stats Screen - Coming Soon',
          style: TextStyle(fontSize: 18),
        ),
      ),
    );
  }
}
