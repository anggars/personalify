import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// Placeholder for Analyzer Screen with Tabs
// TODO: Implement full logic later, this is structure matching web
class AnalyzerScreen extends StatefulWidget {
  const AnalyzerScreen({super.key});

  @override
  State<AnalyzerScreen> createState() => _AnalyzerScreenState();
}

class _AnalyzerScreenState extends State<AnalyzerScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const Color kBgColor = Color(0xFF0a0a0a);
  static const Color kSurfaceColor = Color(0xFF181818); 
  static const Color kAccentColor = Color(0xFF1DB954); 
  static const Color kTextPrimary = Color(0xFFFFFFFF);
  static const Color kTextSecondary = Color(0xFFB3B3B3);
  static const Color kBorderColor = Color(0xFF282828);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgColor,
      appBar: AppBar(
        backgroundColor: kBgColor,
        surfaceTintColor: kBgColor,
        elevation: 0,
        toolbarHeight: 70,
        titleSpacing: 16,
        centerTitle: true,
        title: Text(
          'Analyzer',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800,
            color: kAccentColor,
            letterSpacing: -0.5,
            fontSize: 24,
          ),
        ),
      ),
      body: Column(
        children: [
          Container(
             color: kBgColor,
             child: TabBar(
               controller: _tabController,
               isScrollable: false,
               labelColor: kAccentColor,
               unselectedLabelColor: kTextSecondary,
               indicatorSize: TabBarIndicatorSize.label,
               indicatorColor: kAccentColor,
               indicatorWeight: 3,
               dividerColor: Colors.transparent,
               labelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13),
               unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13),
               tabs: const [
                 Tab(text: 'Key & BPM', height: 40),
                 Tab(text: 'Lyrics & Emotion', height: 40),
               ],
             ),
           ),
           Expanded(
             child: TabBarView(
               controller: _tabController,
               children: [
                 _buildKeyBpmTab(),
                 _buildLyricsTab(),
               ],
             ),
           ),
        ],
      ),
    );
  }

  Widget _buildKeyBpmTab() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.music_note_rounded, size: 64, color: kAccentColor.withOpacity(0.5)),
          const SizedBox(height: 16),
          Text(
            'BPM Counter & Key Finder',
            style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.bold, color: kTextPrimary),
          ),
          const SizedBox(height: 8),
          Text(
            'Tap or play audio to analyze.',
            style: GoogleFonts.plusJakartaSans(color: kTextSecondary),
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: kAccentColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            child: const Text('Start Analysis'),
          )
        ],
      ),
    );
  }

  Widget _buildLyricsTab() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.lyrics_rounded, size: 64, color: kAccentColor.withOpacity(0.5)),
          const SizedBox(height: 16),
          Text(
            'Lyrics Emotion Analysis',
            style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.bold, color: kTextPrimary),
          ),
          const SizedBox(height: 8),
          Text(
            'Paste lyrics or fetch from Genius.',
            style: GoogleFonts.plusJakartaSans(color: kTextSecondary),
          ),
           const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: kSurfaceColor,
              side: const BorderSide(color: kAccentColor),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              foregroundColor: kAccentColor
            ),
            child: const Text('Search Song'),
          )
        ],
      ),
    );
  }
}
