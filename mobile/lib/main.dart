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
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: AppColors.background,
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
            final Widget page = !session.ready
                ? const Scaffold(key: ValueKey('wait'), body: Spinner())
                : session.loggedIn
                    ? const Shell(key: ValueKey('shell'))
                    : const LoginScreen(key: ValueKey('login'));
            return AnimatedSwitcher(duration: const Duration(milliseconds: 300), child: page);
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
  final _home = GlobalKey<HomeScreenState>();
  var _tab = 0;

  void _open(int tab) {
    if (tab == 0 && _tab != 0) _home.currentState?.reload();
    setState(() => _tab = tab);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: IndexedStack(
          index: _tab,
          children: [
            HomeScreen(key: _home, onOpenTab: _open),
            const JobsScreen(),
            const HousingScreen(),
            const DocumentsScreen(),
            const ProfileScreen(),
          ],
        ),
        bottomNavigationBar: DecoratedBox(
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.line))),
          child: NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: _open,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: const [
              NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Асосӣ'),
              NavigationDestination(icon: Icon(Icons.work_outline_rounded), selectedIcon: Icon(Icons.work_rounded), label: 'Кор'),
              NavigationDestination(icon: Icon(Icons.apartment_outlined), selectedIcon: Icon(Icons.apartment_rounded), label: 'Манзил'),
              NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description_rounded), label: 'Ҳуҷҷат'),
              NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Профил'),
            ],
          ),
        ),
      );
}
