import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'documents.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.onOpenTab});

  final void Function(int tab) onOpenTab;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _rates;
  List<Map<String, dynamic>> _documents = [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        Api.instance.get('/rates/'),
        Api.instance.page('/documents/my-documents/'),
      ]);
      if (!mounted) return;
      setState(() {
        _rates = Map<String, dynamic>.from(results[0] as Map);
        _documents = (results[1] as Paged<Map<String, dynamic>>).items;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 5) return 'Шаби хуш';
    if (hour < 12) return 'Субҳ ба хайр';
    if (hour < 18) return 'Рӯз ба хайр';
    return 'Шом ба хайр';
  }

  @override
  Widget build(BuildContext context) {
    final name = Session.instance.name.split(' ').first;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.green,
          backgroundColor: AppColors.containerHigh,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 4, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_greeting, style: const TextStyle(color: AppColors.textMuted, fontSize: 15)),
                    const SizedBox(height: 4),
                    Text(
                      name.isEmpty ? 'Муҳоҷир' : name,
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
              if (_loading && _rates == null)
                const SizedBox(height: 300, child: Spinner())
              else if (_error != null && _rates == null)
                ErrorView(message: _error!, onRetry: _load)
              else ...[
                _RateCard(rates: _rates!),
                const SectionTitle('Зуд кушоед'),
                _QuickActions(onOpenTab: widget.onOpenTab),
                SectionTitle(
                  'Ҳуҷҷатҳои ман',
                  action: TextButton(onPressed: () => widget.onOpenTab(3), child: const Text('Ҳама')),
                ),
                if (_documents.isEmpty)
                  _AddDocumentHint(onTap: () => widget.onOpenTab(3))
                else
                  ..._documents.take(3).map(
                        (doc) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: DocumentCard(doc: doc),
                        ),
                      ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RateCard extends StatelessWidget {
  const _RateCard({required this.rates});

  final Map<String, dynamic> rates;

  @override
  Widget build(BuildContext context) {
    final latest = rates['latest'] as Map? ?? {};
    final nbt = latest['nbt'] as Map?;
    final value = (nbt?['value'] as num?)?.toDouble();
    final history = (rates['history'] as List? ?? [])
        .map((row) => (row['nbt'] as num?)?.toDouble())
        .whereType<double>()
        .toList();
    final change = history.length > 1 ? history.last - history[history.length - 2] : 0.0;
    final up = change >= 0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF1A3478), Color(0xFF101B38)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: AppColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Tag('RUB · TJS', icon: Icons.currency_exchange, color: AppColors.gold, background: Color(0x33DEB86E)),
              const Spacer(),
              Text(day(nbt?['day']), style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5)),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value == null ? '—' : (value * 1000).toStringAsFixed(2),
                style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, height: 1),
              ),
              const SizedBox(width: 8),
              const Padding(
                padding: EdgeInsets.only(bottom: 4),
                child: Text('сомонӣ', style: TextStyle(color: AppColors.textMuted, fontSize: 15)),
              ),
              const Spacer(),
              if (history.length > 1)
                Tag(
                  '${up ? '+' : ''}${(change * 1000).toStringAsFixed(2)}',
                  icon: up ? Icons.trending_up : Icons.trending_down,
                  color: up ? AppColors.green : AppColors.error,
                  background: up ? AppColors.greenContainer : AppColors.errorContainer,
                ),
            ],
          ),
          const SizedBox(height: 6),
          const Text('барои 1000 рубл · қурби Бонки миллӣ',
              style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
          if (history.length > 2) ...[
            const SizedBox(height: 18),
            SizedBox(height: 56, child: CustomPaint(size: Size.infinite, painter: _Sparkline(history))),
          ],
        ],
      ),
    );
  }
}

class _Sparkline extends CustomPainter {
  _Sparkline(this.values);

  final List<double> values;

  @override
  void paint(Canvas canvas, Size size) {
    final low = values.reduce((a, b) => a < b ? a : b);
    final high = values.reduce((a, b) => a > b ? a : b);
    final span = (high - low).abs() < 1e-9 ? 1.0 : high - low;
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      final y = size.height - (values[i] - low) / span * (size.height - 6) - 3;
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }
    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          colors: [AppColors.green.withValues(alpha: 0.25), AppColors.green.withValues(alpha: 0)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ).createShader(Offset.zero & size),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.green
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_Sparkline old) => old.values != values;
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onOpenTab});

  final void Function(int tab) onOpenTab;

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.work_outline_rounded, 'Кор', 'Ҷойҳои кори нав', AppColors.primary, 1),
      (Icons.apartment_rounded, 'Манзил', 'Хона ва ҷойи хоб', AppColors.gold, 2),
      (Icons.badge_outlined, 'Ҳуҷҷатҳо', 'Мӯҳлатҳо', AppColors.green, 3),
      (Icons.person_outline_rounded, 'Профил', 'Ҳисоби ман', Color(0xFFC4A7FF), 4),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.55,
      children: [
        for (final (icon, title, subtitle, color, tab) in items)
          Material(
            color: AppColors.containerLow,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: AppColors.outlineVariant),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => onOpenTab(tab),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, color: color, size: 22),
                    ),
                    const Spacer(),
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    Text(subtitle, style: const TextStyle(color: AppColors.textMuted, fontSize: 12.5)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _AddDocumentHint extends StatelessWidget {
  const _AddDocumentHint({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
          leading: const Icon(Icons.add_card_rounded, color: AppColors.green),
          title: const Text('Патент ё бақайдгириро илова кунед'),
          subtitle: const Text('Пеш аз тамом шудани мӯҳлат хабар медиҳем',
              style: TextStyle(color: AppColors.textMuted)),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: onTap,
        ),
      );
}
