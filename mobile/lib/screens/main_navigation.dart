import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:personalify/screens/home_screen.dart';
import 'package:personalify/screens/dashboard_screen.dart';
import 'package:personalify/screens/analyzer_screen.dart';
import 'package:personalify/screens/history_screen.dart';
import 'package:personalify/screens/profile_screen.dart';
import 'package:personalify/widgets/fade_indexed_stack.dart';

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _currentIndex = 0;

  void _onItemTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true, // Important for floating elements
      body: Stack(
        children: [
          // Content Layer
          Positioned.fill(
            child: FadeIndexedStack(
              index: _currentIndex,
              children: [
                HomeScreen(onTabChange: _onItemTapped),
                const DashboardScreen(), // Using DashboardScreen as requested for "Dashboard" (StatsScreen was empty)
                AnalyzerScreen(),
                const HistoryScreen(),
                const ProfileScreen(),
              ],
            ),
          ),
          
          // "Capsule" Glass Navbar Overlay
          Positioned(
            left: 24,
            right: 24,
            bottom: 24, 
            child: ClipRRect(
              borderRadius: BorderRadius.circular(30),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                child: Container(
                  height: 72, 
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.85), 
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.1),
                      width: 0.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _buildNavItem(0, Icons.home_rounded, "Home"),
                      _buildNavItem(1, Icons.bar_chart_rounded, "Dashboard"),
                      _buildNavItem(2, Icons.auto_awesome_rounded, "Analyzer"),
                      _buildNavItem(3, Icons.history_rounded, "History"),
                      _buildNavItem(4, Icons.person_rounded, "Profile"),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isSelected = _currentIndex == index;
    return GestureDetector(
      onTap: () => _onItemTapped(index),
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            color: isSelected ? const Color(0xFF1DB954) : Colors.white.withOpacity(0.5),
            size: 26,
          ),
          if (isSelected) 
            Container(
              margin: const EdgeInsets.only(top: 4),
              width: 4,
              height: 4,
              decoration: const BoxDecoration(
                color: Color(0xFF1DB954),
                shape: BoxShape.circle,
              ),
            )
          else
            const SizedBox(height: 4),
        ],
      ),
    );
  }
}
