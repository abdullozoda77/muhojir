import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../format.dart';
import '../theme.dart';
import '../widgets.dart';

class SearchBox extends StatefulWidget {
  const SearchBox({super.key, required this.hint, required this.onChanged});

  final String hint;
  final ValueChanged<String> onChanged;

  @override
  State<SearchBox> createState() => _SearchBoxState();
}

class _SearchBoxState extends State<SearchBox> {
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(hintText: widget.hint, prefixIcon: const Icon(Icons.search_rounded)),
        onChanged: (value) {
          _timer?.cancel();
          _timer = Timer(const Duration(milliseconds: 450), () => widget.onChanged(value.trim()));
        },
      );
}

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
        appBar: AppBar(title: const Text('Кор')),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: SearchBox(hint: 'Касб ё шаҳр…', onChanged: (v) => setState(() => _search = v)),
            ),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  FilterChip(
                    label: const Text('Бо манзил'),
                    selected: _housing,
                    onSelected: (v) => setState(() => _housing = v),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Ёрӣ бо ҳуҷҷат'),
                    selected: _documents,
                    onSelected: (v) => setState(() => _documents = v),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PagedList(
                path: '/jobs/jobs/',
                query: {
                  if (_search.isNotEmpty) 'search': _search,
                  if (_housing) 'housing_provided': 'true',
                  if (_documents) 'helps_with_documents': 'true',
                },
                emptyIcon: Icons.work_off_outlined,
                emptyText: 'Чунин кор ёфт нашуд.',
                itemBuilder: (context, job) => JobCard(job: job),
              ),
            ),
          ],
        ),
      );
}

class JobCard extends StatelessWidget {
  const JobCard({super.key, required this.job});

  final Map job;

  @override
  Widget build(BuildContext context) {
    final employer = job['employer'] as Map? ?? {};
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => JobDetailScreen(job: job))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(job['title'] ?? '',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.25)),
                  ),
                  if (employer['is_blacklisted'] == true)
                    const Padding(
                      padding: EdgeInsets.only(left: 8),
                      child: Icon(Icons.gpp_bad_rounded, color: AppColors.error),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                [employer['name'], job['city']].where((s) => s != null && '$s'.isNotEmpty).join(' · '),
                style: const TextStyle(color: AppColors.textMuted, fontSize: 13.5),
              ),
              const SizedBox(height: 12),
              Text(salary(job),
                  style: const TextStyle(color: AppColors.green, fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (job['industry_label'] != null) Tag(job['industry_label']),
                  if (job['housing_provided'] == true) const Tag('Манзил', icon: Icons.home_outlined),
                  if (job['meals_provided'] == true) const Tag('Хӯрок', icon: Icons.restaurant_outlined),
                  if (job['helps_with_documents'] == true) const Tag('Ҳуҷҷат', icon: Icons.description_outlined),
                  Tag(ago(job['created_at']), icon: Icons.schedule_rounded),
                ],
              ),
            ],
          ),
        ),
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

    return Scaffold(
      appBar: AppBar(),
      bottomNavigationBar: url.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FilledButton.icon(
                  onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('Дархост фиристодан'),
                ),
              ),
            ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          Text(job['title'] ?? '', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1.2)),
          const SizedBox(height: 12),
          Text(salary(job), style: const TextStyle(color: AppColors.green, fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 20),
          Card(
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              leading: CircleAvatar(
                backgroundColor: AppColors.container,
                child: Icon(
                  employer['is_blacklisted'] == true ? Icons.gpp_bad_rounded : Icons.business_rounded,
                  color: employer['is_blacklisted'] == true ? AppColors.error : AppColors.primary,
                ),
              ),
              title: Text(employer['name'] ?? 'Корфармо', style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(
                employer['is_blacklisted'] == true
                    ? 'Дар рӯйхати сиёҳ! Эҳтиёт бошед.'
                    : rating == null
                        ? 'Ҳоло баҳо нест'
                        : '★ ${rating.toStringAsFixed(1)} · ${employer['reviews_count']} шарҳ',
                style: TextStyle(
                  color: employer['is_blacklisted'] == true ? AppColors.error : AppColors.textMuted,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          _InfoRow(Icons.place_outlined, job['address'] ?? job['city'] ?? ''),
          if ((job['schedule'] as String?)?.isNotEmpty == true) _InfoRow(Icons.schedule_rounded, job['schedule']),
          if (job['housing_provided'] == true) const _InfoRow(Icons.home_outlined, 'Манзил медиҳанд'),
          if (job['meals_provided'] == true) const _InfoRow(Icons.restaurant_outlined, 'Хӯрок медиҳанд'),
          if (job['helps_with_documents'] == true)
            const _InfoRow(Icons.description_outlined, 'Бо ҳуҷҷатҳо ёрӣ медиҳанд'),
          const SectionTitle('Тавсиф'),
          Text(job['description'] ?? '', style: const TextStyle(height: 1.55, color: Color(0xFFD5DCEB))),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: AppColors.textMuted),
            const SizedBox(width: 12),
            Expanded(child: Text(text, style: const TextStyle(height: 1.4))),
          ],
        ),
      );
}
