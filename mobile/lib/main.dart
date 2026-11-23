import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';

import 'screens/documents.dart';
import 'screens/home.dart';
import 'screens/housing.dart';
import 'screens/jobs.dart';
import 'screens/login.dart';
import 'screens/profile.dart';
import 'session.dart';
import 'theme.dart';
import 'widgets.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppColors.surface,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  Session.instance.start();
  runApp(const MuhojirApp());
}

class MuhojirApp extends StatelessWidget {
  const MuhojirApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Muhojir',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        darkTheme: buildTheme(),
        themeMode: ThemeMode.dark,
        home: ListenableBuilder(
          listenable: Session.instance,
          builder: (context, _) {
            final session = Session.instance;
            if (!session.ready) return const Scaffold(body: Spinner());
            return session.loggedIn ? const Shell() : const LoginScreen();
          },
        ),
      );
}

class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  var _tab = 0;

  void _open(int tab) => setState(() => _tab = tab);

  @override
  Widget build(BuildContext context) => Scaffold(
        body: IndexedStack(
          index: _tab,
          children: [
            HomeScreen(onOpenTab: _open),
            const JobsScreen(),
            const HousingScreen(),
            const DocumentsScreen(),
            const ProfileScreen(),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: _open,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Асосӣ'),
            NavigationDestination(icon: Icon(Icons.work_outline_rounded), selectedIcon: Icon(Icons.work_rounded), label: 'Кор'),
            NavigationDestination(icon: Icon(Icons.apartment_outlined), selectedIcon: Icon(Icons.apartment_rounded), label: 'Манзил'),
            NavigationDestination(icon: Icon(Icons.badge_outlined), selectedIcon: Icon(Icons.badge_rounded), label: 'Ҳуҷҷат'),
            NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Профил'),
          ],
        ),
      );
}
