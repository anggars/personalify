import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
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
  String _selectedTimeRange = 'short_term'; // Shared time range state
  
  // OPTIMIZE: Cache blur filter as static to avoid recreating every build
  static final _navbarBlur = ImageFilter.blur(sigmaX: 20, sigmaY: 20);
  static final _curtainBlur = ImageFilter.blur(sigmaX: 10, sigmaY: 10);

  void _onItemTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  void _onTimeRangeChanged(String timeRange) {
    setState(() {
      _selectedTimeRange = timeRange;
    });
  }

  @override
  Widget build(BuildContext context) {
    // Check if keyboard is visible
    final bool isKeyboardVisible = MediaQuery.of(context).viewInsets.bottom > 0;

    return GestureDetector(
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      child: Scaffold(
        resizeToAvoidBottomInset: false, // NO LAYOUT THRASHING
        extendBody: true, // Important for floating elements
        body: Stack(
          children: [
            // Content Layer
            Positioned.fill(
              child: FadeIndexedStack(
                index: _currentIndex,
                children: [
                  HomeScreen(
                    onTabChange: _onItemTapped,
                    selectedTimeRange: _selectedTimeRange,
                  ),
                  DashboardScreen(
                    onTimeRangeChanged: _onTimeRangeChanged,
                  ),
                  AnalyzerScreen(),
                  const HistoryScreen(),
                  const ProfileScreen(),
                ],
              ),
            ),
            
            // Bottom Privacy Curtain (Blur Gradient)
            if (!isKeyboardVisible)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                height: 25,
                child: RepaintBoundary( // OPTIMIZE: Isolate blur repaints
                  child: ClipRect(
                    child: BackdropFilter(
                      filter: _curtainBlur, // OPTIMIZE: Use cached filter
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Colors.black.withOpacity(0.8),
                            ],
                            stops: const [0.0, 0.8],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

             // "Liquid Glass" Navbar Overlay
            AnimatedPositioned(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              left: 16, 
              right: 16,
              bottom: isKeyboardVisible ? -100 : 24, // Hide when keyboard is open
              child: RepaintBoundary( // OPTIMIZE: Isolate navbar blur repaints
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: BackdropFilter(
                    filter: _navbarBlur, // OPTIMIZE: Use cached filter
                    child: Container(
                      height: 72,
                      decoration: BoxDecoration(
                        color: const Color(0xFF181818).withOpacity(0.75),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.1),
                          width: 1.0,
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
                          _buildNavItem(0, Symbols.home_app_logo, "Home"),
                          _buildNavItem(1, Symbols.space_dashboard, "Dashboard"),
                          _buildNavItem(2, Symbols.lyrics, "Analyzer"),
                          _buildNavItem(3, Symbols.music_history, "History"),
                          _buildNavItem(4, Symbols.person, "Profile"),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
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
