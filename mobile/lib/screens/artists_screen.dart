import 'package:flutter/material.dart';

/// Artists screen - shows top artists in grid layout
class ArtistsScreen extends StatelessWidget {
  const ArtistsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Top Artists'),
        centerTitle: true,
      ),
      body: const Center(
        child: Text(
          'Artists Screen - Coming Soon',
          style: TextStyle(fontSize: 18),
        ),
      ),
    );
  }
}
