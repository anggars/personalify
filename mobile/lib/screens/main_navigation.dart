import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:personalify/screens/home_screen.dart';
import 'package:personalify/screens/dashboard_screen.dart';
import 'package:personalify/screens/analyzer_screen.dart';
import 'package:personalify/screens/about_screen.dart';
import 'package:personalify/screens/settings_screen.dart';

/// Main navigation with bottom navbar
class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _currentIndex = 1; // Default to Dashboard

  final List<Widget> _screens = [
    const HomeScreen(),
    const DashboardScreen(),
    const AnalyzerScreen(),
    const AboutScreen(),
    const SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      extendBody: true,
      bottomNavigationBar: SafeArea(
        child: Container(
          margin: const EdgeInsets.fromLTRB(24, 0, 24, 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(30),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E).withOpacity(0.8),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(
                    color: Colors.white.withOpacity(0.1),
                    width: 1.5,
                  ),
                ),
                child: BottomNavigationBar(
                  currentIndex: _currentIndex,
                  onTap: (index) => setState(() => _currentIndex = index),
                  type: BottomNavigationBarType.fixed,
                  backgroundColor: Colors.transparent,
                  elevation: 0,
                  selectedItemColor: const Color(0xFF1DB954),
                  unselectedItemColor: const Color(0xFF908F8F),
                  selectedFontSize: 11,
                  unselectedFontSize: 10,
                  showSelectedLabels: true,
                  showUnselectedLabels: true,
                  items: const [
                    BottomNavigationBarItem(
                      icon: Icon(Icons.home_outlined, size: 24),
                      activeIcon: Icon(Icons.home, size: 24),
                      label: 'Home',
                    ),
                    BottomNavigationBarItem(
                      icon: Icon(Icons.space_dashboard_outlined, size: 24),
                      activeIcon: Icon(Icons.space_dashboard, size: 24),
                      label: 'Dashboard',
                    ),
                    BottomNavigationBarItem(
                      icon: Icon(Icons.mic_external_on_outlined, size: 24),
                      activeIcon: Icon(Icons.mic_external_on, size: 24),
                      label: 'Analyzer',
                    ),
                    BottomNavigationBarItem(
                      icon: Icon(Icons.info_outline, size: 24),
                      activeIcon: Icon(Icons.info, size: 24),
                      label: 'About',
                    ),
                    BottomNavigationBarItem(
                      icon: Icon(Icons.settings_outlined, size: 24),
                      activeIcon: Icon(Icons.settings, size: 24),
                      label: 'Settings',
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
