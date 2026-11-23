import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../format.dart';
import '../theme.dart';
import '../widgets.dart';

const _kinds = {
  'bed': 'Ҷойи хоб',
  'room': 'Ҳуҷра',
  'flat': 'Хона',
  'hostel': 'Хостел',
  'roommate': 'Ҳамхона',
};

class HousingScreen extends StatefulWidget {
  const HousingScreen({super.key});

  @override
  State<HousingScreen> createState() => _HousingScreenState();
}

class _HousingScreenState extends State<HousingScreen> {
  var _city = '';
  String? _kind;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const PageTitle('Манзил'),
              SearchBox(hint: 'Шаҳр', onChanged: (v) => setState(() => _city = v)),
              PillRow(children: [
                Pill('Ҳама', selected: _kind == null, onTap: () => setState(() => _kind = null)),
                for (final entry in _kinds.entries)
                  Pill(entry.value, selected: _kind == entry.key, onTap: () => setState(() => _kind = entry.key)),
              ]),
              const SizedBox(height: 16),
              Expanded(
                child: PagedList(
                  path: '/housing/',
                  query: {
                    if (_city.isNotEmpty) 'city': _city,
                    'kind': ?_kind,
                  },
                  gap: 28,
                  emptyIcon: Icons.home_outlined,
                  emptyText: 'Эълон ёфт нашуд.',
                  itemBuilder: (context, item) => HousingCard(item: item),
                ),
              ),
            ],
          ),
        ),
      );
}

String _place(Map item) {
  final address = (item['address'] as String?) ?? '';
  return address.isNotEmpty ? address : (item['city'] ?? '');
}

class HousingCard extends StatelessWidget {
  const HousingCard({super.key, required this.item});

  final Map item;

  @override
  Widget build(BuildContext context) {
    final photos = item['photos'] as List? ?? [];
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).push(slideRoute(HousingDetailScreen(item: item))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: AspectRatio(
              aspectRatio: 4 / 3,
              child: photos.isEmpty
                  ? const ColoredBox(
                      color: AppColors.surface,
                      child: Center(child: Icon(Icons.home_outlined, size: 36, color: AppColors.faint)),
                    )
                  : NetImage(photos.first['url']),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(rentPrice(item), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              ),
              Text(item['kind_label'] ?? '', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 4),
          Text(item['title'] ?? '',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14.5, color: AppColors.text)),
          const SizedBox(height: 2),
          Meta([_place(item), ago(item['created_at'])], color: AppColors.faint),
        ],
      ),
    );
  }
}

class HousingDetailScreen extends StatefulWidget {
  const HousingDetailScreen({super.key, required this.item});

  final Map item;

  @override
  State<HousingDetailScreen> createState() => _HousingDetailScreenState();
}

class _HousingDetailScreenState extends State<HousingDetailScreen> {
  var _photo = 0;

  Map get item => widget.item;

  List<(String, Uri)> get _contacts {
    final phone = (item['phone'] as String?) ?? '';
    final whatsapp = (item['whatsapp'] as String?) ?? '';
    final telegram = ((item['telegram'] as String?) ?? '').replaceFirst('@', '');
    final source = (item['source_url'] as String?) ?? '';
    return [
      if (phone.isNotEmpty) ('Занг задан', Uri.parse('tel:$phone')),
      if (whatsapp.isNotEmpty) ('WhatsApp', Uri.parse('https://wa.me/${whatsapp.replaceAll(RegExp(r'\D'), '')}')),
      if (telegram.isNotEmpty) ('Telegram', Uri.parse('https://t.me/$telegram')),
      if (source.isNotEmpty) ('Эълони аслӣ', Uri.parse(source)),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final photos = item['photos'] as List? ?? [];
    final features = [
      if (item['rooms'] != null) '${item['rooms']} ҳуҷра',
      if (item['places'] != null) '${item['places']} ҷой',
      if (item['for_whom_label'] != null) '${item['for_whom_label']}',
      if (item['registration'] == true) 'Бо бақайдгирӣ',
      if (item['utilities_included'] == true) 'Коммуналӣ дохил',
      if (item['no_deposit'] == true) 'Бе гарав',
      if ((item['metro'] as String?)?.isNotEmpty == true) 'м. ${item['metro']}',
    ];
    final contacts = _contacts;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: const BackBar(overlay: true),
      bottomNavigationBar: contacts.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: () => launchUrl(contacts.first.$2, mode: LaunchMode.externalApplication),
                        child: Text(contacts.first.$1),
                      ),
                    ),
                    for (final (label, uri) in contacts.skip(1)) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(54)),
                          onPressed: () => launchUrl(uri, mode: LaunchMode.externalApplication),
                          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
      body: ListView(
        padding: EdgeInsets.zero,
        physics: const BouncingScrollPhysics(),
        children: [
          if (photos.isNotEmpty)
            SizedBox(
              height: 340,
              child: Stack(
                children: [
                  PageView(
                    onPageChanged: (index) => setState(() => _photo = index),
                    children: [for (final photo in photos) NetImage(photo['url'])],
                  ),
                  if (photos.length > 1)
                    Positioned(
                      bottom: 14,
                      left: 0,
                      right: 0,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < photos.length; i++)
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              width: i == _photo ? 18 : 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: i == _photo ? Colors.white : Colors.white54,
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            )
          else
            const SizedBox(height: 100),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(rentPrice(item),
                    style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: -0.6)),
                const SizedBox(height: 8),
                Text(item['title'] ?? '', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w500, height: 1.35)),
                const SizedBox(height: 6),
                Text(_place(item), style: const TextStyle(color: AppColors.muted, fontSize: 14, height: 1.4)),
                if (features.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final f in features)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                          decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(100)),
                          child: Text(f, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                        ),
                    ],
                  ),
                ],
                const SectionTitle('Тавсиф'),
                Text(item['description'] ?? '',
                    style: const TextStyle(height: 1.65, color: AppColors.muted, fontSize: 15)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
