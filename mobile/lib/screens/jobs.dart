import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../format.dart';
import '../theme.dart';
import '../widgets.dart';

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  var _search = '';
  var _housing = false;
  var _documents = false;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const PageTitle('Кор'),
              SearchBox(hint: 'Касб ё шаҳр', onChanged: (v) => setState(() => _search = v)),
              PillRow(children: [
                Pill('Ҳама', selected: !_housing && !_documents, onTap: () => setState(() {
                      _housing = false;
                      _documents = false;
                    })),
                Pill('Бо манзил', selected: _housing, onTap: () => setState(() => _housing = !_housing)),
                Pill('Ёрӣ бо ҳуҷҷат', selected: _documents, onTap: () => setState(() => _documents = !_documents)),
              ]),
              const SizedBox(height: 16),
              Expanded(
                child: PagedList(
                  path: '/jobs/jobs/',
                  query: {
                    if (_search.isNotEmpty) 'search': _search,
                    if (_housing) 'housing_provided': 'true',
                    if (_documents) 'helps_with_documents': 'true',
                  },
                  gap: 10,
                  emptyIcon: Icons.work_outline_rounded,
                  emptyText: 'Чунин кор ёфт нашуд.',
                  itemBuilder: (context, job) => JobCard(job: job),
                ),
              ),
            ],
          ),
        ),
      );
}

class JobCard extends StatelessWidget {
  const JobCard({super.key, required this.job});

  final Map job;

  @override
  Widget build(BuildContext context) {
    final employer = job['employer'] as Map? ?? {};
    final blacklisted = employer['is_blacklisted'] == true;
    final perks = [
      if (job['housing_provided'] == true) 'Манзил',
      if (job['meals_provided'] == true) 'Хӯрок',
      if (job['helps_with_documents'] == true) 'Ҳуҷҷат',
    ];

    return Surface(
      onTap: () => Navigator.of(context).push(slideRoute(JobDetailScreen(job: job))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(job['title'] ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, height: 1.3)),
              ),
              const SizedBox(width: 12),
              Text(ago(job['created_at']), style: const TextStyle(color: AppColors.faint, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 4),
          Meta([employer['name'], job['city']]),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Text(salary(job),
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.accent)),
              ),
              if (blacklisted)
                const Text('Рӯйхати сиёҳ', style: TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600))
              else if (perks.isNotEmpty)
                Text(perks.join(' · '), style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}

class JobDetailScreen extends StatelessWidget {
  const JobDetailScreen({super.key, required this.job});

  final Map job;

  @override
  Widget build(BuildContext context) {
    final employer = job['employer'] as Map? ?? {};
    final url = (job['external_url'] as String?) ?? '';
    final rating = employer['rating'] as num?;
    final blacklisted = employer['is_blacklisted'] == true;
    final facts = [
      (Icons.place_outlined, job['address'] ?? job['city']),
      (Icons.schedule_outlined, job['schedule']),
      if (job['housing_provided'] == true) (Icons.home_outlined, 'Манзил медиҳанд'),
      if (job['meals_provided'] == true) (Icons.restaurant_outlined, 'Хӯрок медиҳанд'),
      if (job['helps_with_documents'] == true) (Icons.description_outlined, 'Бо ҳуҷҷатҳо ёрӣ медиҳанд'),
    ].where((f) => (f.$2 as String?)?.isNotEmpty == true).toList();

    return Scaffold(
      appBar: const BackBar(),
      bottomNavigationBar: url.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: FilledButton(
                  onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                  child: const Text('Дархост фиристодан'),
                ),
              ),
            ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Text(job['title'] ?? '',
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.6, height: 1.15)),
          const SizedBox(height: 12),
          Text(salary(job), style: const TextStyle(color: AppColors.accent, fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 24),
          Surface(
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: AppColors.raised, borderRadius: BorderRadius.circular(14)),
                  alignment: Alignment.center,
                  child: Text(
                    ((employer['name'] as String?) ?? '?').characters.first.toUpperCase(),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(employer['name'] ?? 'Корфармо',
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 3),
                      Text(
                        blacklisted
                            ? 'Дар рӯйхати сиёҳ — эҳтиёт бошед'
                            : rating == null
                                ? 'Ҳоло баҳо нест'
                                : '★ ${rating.toStringAsFixed(1)}  ·  ${employer['reviews_count']} шарҳ',
                        style: TextStyle(color: blacklisted ? AppColors.danger : AppColors.muted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          for (final (icon, text) in facts)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, size: 19, color: AppColors.faint),
                  const SizedBox(width: 14),
                  Expanded(child: Text('$text', style: const TextStyle(height: 1.45, fontSize: 14.5))),
                ],
              ),
            ),
          const SectionTitle('Тавсиф'),
          Text(job['description'] ?? '', style: const TextStyle(height: 1.65, color: AppColors.muted, fontSize: 15)),
        ],
      ),
    );
  }
}
