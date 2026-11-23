import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../format.dart';
import '../theme.dart';
import '../widgets.dart';
import 'jobs.dart';

const _kinds = {
  'bed': 'Ҷойи хоб',
  'room': 'Ҳуҷра',
  'flat': 'Хонаи пурра',
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
        appBar: AppBar(title: const Text('Манзил')),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: SearchBox(hint: 'Шаҳр, масалан Москва', onChanged: (v) => setState(() => _city = v)),
            ),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  for (final entry in _kinds.entries)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(entry.value),
                        selected: _kind == entry.key,
                        onSelected: (v) => setState(() => _kind = v ? entry.key : null),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: PagedList(
                path: '/housing/',
                query: {
                  if (_city.isNotEmpty) 'city': _city,
                  if (_kind != null) 'kind': _kind!,
                },
                emptyIcon: Icons.house_siding_rounded,
                emptyText: 'Эълон ёфт нашуд.',
                itemBuilder: (context, item) => HousingCard(item: item),
              ),
            ),
          ],
        ),
      );
}

class HousingCard extends StatelessWidget {
  const HousingCard({super.key, required this.item});

  final Map item;

  @override
  Widget build(BuildContext context) {
    final photos = item['photos'] as List? ?? [];
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => HousingDetailScreen(item: item))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (photos.isNotEmpty)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    NetImage(photos.first['url']),
                    Positioned(
                      left: 12,
                      top: 12,
                      child: Tag(item['kind_label'] ?? '', color: AppColors.text, background: const Color(0xCC0A1228)),
                    ),
                    if (photos.length > 1)
                      Positioned(
                        right: 12,
                        top: 12,
                        child: Tag('${photos.length}', icon: Icons.photo_library_outlined,
                            color: AppColors.text, background: const Color(0xCC0A1228)),
                      ),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(rentPrice(item),
                      style: const TextStyle(color: AppColors.gold, fontSize: 20, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(item['title'] ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15.5)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.place_outlined, size: 16, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          item['address']?.toString().isNotEmpty == true ? item['address'] : item['city'] ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                        ),
                      ),
                      Text(ago(item['created_at']), style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    ],
                  ),
                  if (photos.isEmpty) ...[
                    const SizedBox(height: 10),
                    Tag(item['kind_label'] ?? ''),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class HousingDetailScreen extends StatelessWidget {
  const HousingDetailScreen({super.key, required this.item});

  final Map item;

  List<(IconData, String, Uri)> get _contacts {
    final phone = (item['phone'] as String?) ?? '';
    final whatsapp = (item['whatsapp'] as String?) ?? '';
    final telegram = ((item['telegram'] as String?) ?? '').replaceFirst('@', '');
    final source = (item['source_url'] as String?) ?? '';
    return [
      if (phone.isNotEmpty) (Icons.call_rounded, 'Занг задан', Uri.parse('tel:$phone')),
      if (whatsapp.isNotEmpty)
        (Icons.chat_rounded, 'WhatsApp', Uri.parse('https://wa.me/${whatsapp.replaceAll(RegExp(r'\D'), '')}')),
      if (telegram.isNotEmpty) (Icons.send_rounded, 'Telegram', Uri.parse('https://t.me/$telegram')),
      if (source.isNotEmpty) (Icons.open_in_new_rounded, 'Эълони аслӣ', Uri.parse(source)),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final photos = item['photos'] as List? ?? [];
    final features = [
      if (item['rooms'] != null) '${item['rooms']} ҳуҷра',
      if (item['places'] != null) '${item['places']} ҷой',
      if (item['for_whom_label'] != null) item['for_whom_label'],
      if (item['registration'] == true) 'Бо бақайдгирӣ',
      if (item['utilities_included'] == true) 'Коммуналӣ дохил',
      if (item['no_deposit'] == true) 'Бе гарав',
      if ((item['metro'] as String?)?.isNotEmpty == true) 'м. ${item['metro']}',
    ];

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(backgroundColor: Colors.transparent),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          if (photos.isNotEmpty)
            SizedBox(
              height: 300,
              child: PageView(children: [for (final photo in photos) NetImage(photo['url'])]),
            )
          else
            const SizedBox(height: 100),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(rentPrice(item),
                    style: const TextStyle(color: AppColors.gold, fontSize: 26, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(item['title'] ?? '', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(item['address'] ?? item['city'] ?? '', style: const TextStyle(color: AppColors.textMuted)),
                const SizedBox(height: 16),
                Wrap(spacing: 6, runSpacing: 6, children: [for (final f in features) Tag('$f')]),
                const SectionTitle('Тавсиф'),
                Text(item['description'] ?? '', style: const TextStyle(height: 1.55, color: Color(0xFFD5DCEB))),
                const SizedBox(height: 20),
                for (final (icon, label, uri) in _contacts)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(50),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      onPressed: () => launchUrl(uri, mode: LaunchMode.externalApplication),
                      icon: Icon(icon),
                      label: Text(label),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
