import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import 'home.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Аз ҳисоб бароем?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Не')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Баромадан'),
          ),
        ],
      ),
    );
    if (yes == true) await Session.instance.logout();
  }

  @override
  Widget build(BuildContext context) {
    final session = Session.instance;
    final user = session.user ?? {};
    final city = (user['city'] as String?) ?? '';
    final language = switch (user['language']) {
      'ru' => 'Русский',
      'en' => 'English',
      _ => 'Тоҷикӣ',
    };

    return Scaffold(
      body: SafeArea(
        child: ListView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 32, 20, 32),
          children: [
            const Center(child: Avatar(size: 88)),
            const SizedBox(height: 16),
            Text(session.name,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.4)),
            const SizedBox(height: 4),
            Text(
              [if (city.isNotEmpty) city, 'аз ${day(user['date_joined'])}'].join('  ·  '),
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, fontSize: 14),
            ),
            const SizedBox(height: 32),
            _Group(children: [
              if (user['phone'] != null) _Row('Телефон', value: user['phone']),
              if (user['email'] != null) _Row('Почта', value: user['email']),
              _Row('Забон', value: language),
            ]),
            const SizedBox(height: 12),
            _Group(children: [
              _Row('Сайти Muhojir',
                  icon: Icons.north_east_rounded,
                  onTap: () => launchUrl(Uri.parse(apiBase), mode: LaunchMode.externalApplication)),
              _Row('Баромадан', color: AppColors.danger, onTap: () => _logout(context)),
            ]),
            const SizedBox(height: 32),
            const Text('Muhojir 1.0', textAlign: TextAlign.center, style: TextStyle(color: AppColors.faint, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) const Divider(indent: 18, endIndent: 18),
              children[i],
            ],
          ],
        ),
      );
}

class _Row extends StatelessWidget {
  const _Row(this.label, {this.value, this.icon, this.onTap, this.color = AppColors.text});

  final String label;
  final String? value;
  final IconData? icon;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
          child: Row(
            children: [
              Expanded(child: Text(label, style: TextStyle(fontSize: 15, color: color))),
              if (value != null) Text(value!, style: const TextStyle(color: AppColors.muted, fontSize: 15)),
              if (icon != null) Icon(icon, size: 18, color: AppColors.faint),
            ],
          ),
        ),
      );
}
