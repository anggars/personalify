import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:personalify/screens/login_screen.dart';
import 'package:personalify/screens/main_navigation.dart';
import 'package:personalify/services/api_service.dart';
import 'package:personalify/services/auth_service.dart';
import 'package:personalify/utils/navigation.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // OPTIMIZE: Limit memory usage for Image Cache
  // 50 MB Max total size (default is 100MB)
  PaintingBinding.instance.imageCache.maximumSizeBytes = 50 * 1024 * 1024;
  // 50 Images max count (default is 1000)
  PaintingBinding.instance.imageCache.maximumSize = 50;

  // Set system UI overlay style (status bar, navigation bar)
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF121212),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const PersonalifyApp());
}

class PersonalifyApp extends StatelessWidget {
  const PersonalifyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // WRAP WITH MULTI PROVIDER
    return MultiProvider(
      providers: [
        Provider<AuthService>(
          create: (_) => AuthService(),
        ),
        ProxyProvider<AuthService, ApiService>(
          update: (_, auth, __) => ApiService(auth),
        ),
      ],
      child: MaterialApp(
        title: 'Personalify',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          // Dark Mode Theme matching web design
          brightness: Brightness.dark,
          primaryColor: const Color(0xFF1DB954), // Spotify Green
          scaffoldBackgroundColor: const Color(0xFF121212), // Background Dark
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF1DB954),
            secondary: Color(0xFF1DB954),
            surface: Color(0xFF1E1E1E), // Card Dark
            error: Color(0xFFFF453A),
          ),

          // Card Theme
          cardTheme: CardThemeData(
            color: const Color(0xFF1E1E1E),
            elevation: 4,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(16)),
            ),
          ),

          // AppBar Theme
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF1E1E1E),
            elevation: 0,
            iconTheme: IconThemeData(color: Colors.white),
            titleTextStyle: TextStyle(
              color: Color(0xFF1DB954),
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),

          // Text Theme
          textTheme: const TextTheme(
            displayLarge: TextStyle(
              color: Color(0xFFFFFFFF),
              fontSize: 32,
              fontWeight: FontWeight.bold,
            ),
            displayMedium: TextStyle(
              color: Color(0xFFFFFFFF),
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
            bodyLarge: TextStyle(
              color: Color(0xFFFFFFFF),
              fontSize: 16,
            ),
            bodyMedium: TextStyle(
              color: Color(0xFFB3B3B3),
              fontSize: 14,
            ),
          ),

          // Button Theme
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1DB954),
              foregroundColor: Colors.black,
              elevation: 4,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              textStyle: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),

          // Input Decoration Theme
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: const Color(0xFF1E1E1E),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF282828)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF282828)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF1DB954), width: 2),
            ),
            hintStyle: const TextStyle(color: Color(0xFF908F8F)),
          ),

          // Icon Theme
          iconTheme: const IconThemeData(
            color: Color(0xFFFFFFFF),
          ),

          // Divider Theme
          dividerTheme: const DividerThemeData(
            color: Color(0xFF282828),
            thickness: 1,
          ),

          // Use Material 3
          useMaterial3: true,
        ),
        navigatorKey: navigatorKey,
        home: const LoginScreen(),
      ),
    );
  }
}
