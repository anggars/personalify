import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:personalify/screens/home_screen.dart';
import 'package:personalify/screens/dashboard_screen.dart';
import 'package:personalify/screens/analyzer_screen.dart';
import 'package:personalify/screens/about_screen.dart';
import 'package:personalify/screens/settings_screen.dart';
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
                const DashboardScreen(),
                AnalyzerScreen(), // Stateful
                const AboutScreen(),
              ],
            ),
          ),
          
          // "iOS 26" Liquid Glass Navbar Overlay
          Positioned(
            left: 16, // Matches Dashboard Card Margin (16)
            right: 16,
            bottom: 32, 
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: Container(
                  height: 72, // Slightly taller for labels
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.08), // "Bening" (Clear) Glass effect
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.15), // Glass edge
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 30,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      // Modern "Rounded" Icon Set (Filled vs Outlined)
                      // Labels: Home, Dashboard, Analyzer, About
                      _buildNavItem(0, Icons.home_outlined, Icons.home_rounded, "Home"),
                      _buildNavItem(1, Icons.grid_view_outlined, Icons.grid_view_rounded, "Dashboard"),
                      _buildNavItem(2, Icons.insights_outlined, Icons.insights_rounded, "Analyzer"),
                      _buildNavItem(3, Icons.menu_book_outlined, Icons.menu_book_rounded, "About"), // "Read" for About
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

  Widget _buildNavItem(int index, IconData icon, IconData activeIcon, String label) {
    final isSelected = _currentIndex == index;
    return GestureDetector(
      onTap: () => _onItemTapped(index),
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            // User requested cleaner look without the circle background ("Jangan kayak gitu")
            // We'll rely on the color shift (White/Green) and Icon transition (Outlined -> Rounded/Filled)
            child: Icon(
              isSelected ? activeIcon : icon,
              color: isSelected ? const Color(0xFF1DB954) : const Color(0xFFB3B3B3),
              size: 24,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: isSelected ? const Color(0xFF1DB954) : const Color(0xFFB3B3B3),
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            ),
          )
        ],
      ),
    );
  }
}
