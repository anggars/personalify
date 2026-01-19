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
                const DashboardScreen(),
                AnalyzerScreen(),
                const HistoryScreen(),
                const ProfileScreen(),
              ],
            ),
          ),
          
          // "Liquid Glass" Navbar Overlay
          Positioned(
            left: 16, 
            right: 16,
            bottom: 24, 
            child: ClipRRect(
              borderRadius: BorderRadius.circular(30),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 40, sigmaY: 40), // Reduced from 20 (as requested: "jangan terlalu kenceng")
                child: Container(
                  height: 72, 
                  decoration: BoxDecoration(
                    // "Agak Abu Dikit": Using white with slightly higher opacity to create a milky/greyish glass feel
                    // This mimics the section card tone when over a dark background.
                    color: Colors.white.withOpacity(0.12), 
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.15),
                      width: 1.0,
                    ),
                    // Inset-like feel using gradient
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Colors.white.withOpacity(0.1),
                        Colors.white.withOpacity(0.05),
                        Colors.white.withOpacity(0.0),
                      ],
                      stops: const [0.0, 0.4, 1.0],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 30,
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
    
    // Scale animation could be added here, but keeping it simple/performant first
    return GestureDetector(
      onTap: () => _onItemTapped(index),
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            color: isSelected ? const Color(0xFF1DB954) : Colors.white.withOpacity(0.6),
            size: 24,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: isSelected ? const Color(0xFF1DB954) : Colors.white.withOpacity(0.6),
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            ),
          )
        ],
      ),
    );
  }
}
