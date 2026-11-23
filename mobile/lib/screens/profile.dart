import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.containerLow,
        title: const Text('Аз ҳисоб бароем?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Не')),
          FilledButton.tonal(onPressed: () => Navigator.pop(context, true), child: const Text('Баромадан')),
        ],
      ),
    );
    if (yes == true) await Session.instance.logout();
  }

  @override
  Widget build(BuildContext context) {
    final session = Session.instance;
    final user = session.user ?? {};
    final avatar = user['avatar'] as String?;
    final name = session.name;

    return Scaffold(
      appBar: AppBar(title: const Text('Профил')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 34,
                    backgroundColor: AppColors.primaryContainer,
                    backgroundImage: avatar == null ? null : NetworkImage(mediaUrl(avatar)),
                    child: avatar == null
                        ? Text(name.isEmpty ? '?' : name.characters.first.toUpperCase(),
                            style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white))
                        : null,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        if (user['city'] != null && '${user['city']}'.isNotEmpty)
                          Text(user['city'], style: const TextStyle(color: AppColors.textMuted)),
                        Text('Аз ${day(user['date_joined'])}',
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                if (user['phone'] != null) _Row(Icons.phone_iphone, 'Телефон', user['phone']),
                if (user['email'] != null) _Row(Icons.alternate_email, 'Почта', user['email']),
                _Row(Icons.translate_rounded, 'Забон', switch (user['language']) {
                  'ru' => 'Русский',
                  'en' => 'English',
                  _ => 'Тоҷикӣ',
                }),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.language_rounded, color: AppColors.primary),
                  title: const Text('Сайти Muhojir'),
                  subtitle: const Text('Ҳамаи имкониятҳо', style: TextStyle(color: AppColors.textMuted)),
                  trailing: const Icon(Icons.open_in_new_rounded, size: 20),
                  onTap: () => launchUrl(Uri.parse(apiBase), mode: LaunchMode.externalApplication),
                ),
                const Divider(indent: 16, endIndent: 16),
                ListTile(
                  leading: const Icon(Icons.logout_rounded, color: AppColors.error),
                  title: const Text('Баромадан', style: TextStyle(color: AppColors.error)),
                  onTap: () => _logout(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Center(
            child: Text('Muhojir · 1.0.0', style: TextStyle(color: AppColors.outline, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.icon, this.label, this.value);

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Icon(icon, color: AppColors.textMuted),
        title: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
        subtitle: Text(value, style: const TextStyle(color: AppColors.text, fontSize: 15.5)),
      );
}
