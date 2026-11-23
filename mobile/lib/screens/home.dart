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
  State<HomeScreen> createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _rates;
  List<Map<String, dynamic>> _documents = [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
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
          color: AppColors.text,
          backgroundColor: AppColors.raised,
          onRefresh: reload,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_greeting, style: const TextStyle(color: AppColors.muted, fontSize: 15)),
                        const SizedBox(height: 2),
                        Text(
                          name.isEmpty ? 'Муҳоҷир' : name,
                          style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: -0.6),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(onTap: () => widget.onOpenTab(4), child: const Avatar(size: 44)),
                ],
              ),
              const SizedBox(height: 28),
              if (_loading && _rates == null)
                const SizedBox(height: 300, child: Spinner())
              else if (_error != null && _rates == null)
                ErrorView(message: _error!, onRetry: reload)
              else ...[
                _RateCard(rates: _rates!),
                const SizedBox(height: 28),
                _QuickActions(onOpenTab: widget.onOpenTab),
                SectionTitle('Ҳуҷҷатҳо', action: 'Ҳама', onAction: () => widget.onOpenTab(3)),
                if (_documents.isEmpty)
                  Surface(
                    onTap: () => widget.onOpenTab(3),
                    child: const Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Ҳуҷҷат илова кунед', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                              SizedBox(height: 4),
                              Text('Пеш аз тамом шудани мӯҳлат хабар медиҳем',
                                  style: TextStyle(color: AppColors.muted, fontSize: 13)),
                            ],
                          ),
                        ),
                        Icon(Icons.add_rounded, color: AppColors.muted),
                      ],
                    ),
                  )
                else
                  for (final doc in _documents.take(3))
                    Padding(padding: const EdgeInsets.only(bottom: 8), child: DocumentRow(doc: doc)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context) {
    final session = Session.instance;
    final avatar = session.user?['avatar'] as String?;
    final name = session.name;
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: AppColors.raised, shape: BoxShape.circle),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: avatar != null
          ? NetImage(avatar)
          : Text(
              name.isEmpty ? '?' : name.characters.first.toUpperCase(),
              style: TextStyle(fontSize: size * 0.4, fontWeight: FontWeight.w600),
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
    final change = history.length > 1 ? (history.last - history[history.length - 2]) * 1000 : 0.0;
    final up = change >= 0;
    final changeColor = change.abs() < 0.005 ? AppColors.muted : (up ? AppColors.accent : AppColors.danger);

    return Surface(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('1 000 ₽', style: TextStyle(color: AppColors.muted, fontSize: 14)),
              const Spacer(),
              Text(day(nbt?['day']), style: const TextStyle(color: AppColors.faint, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value == null ? '—' : (value * 1000).toStringAsFixed(2),
                style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w700, letterSpacing: -1.5, height: 1),
              ),
              const SizedBox(width: 8),
              const Text('сомонӣ', style: TextStyle(color: AppColors.muted, fontSize: 16)),
              const Spacer(),
              if (history.length > 1)
                Text(
                  '${up ? '+' : '−'}${change.abs().toStringAsFixed(2)}',
                  style: TextStyle(color: changeColor, fontSize: 15, fontWeight: FontWeight.w600),
                ),
            ],
          ),
          if (history.length > 2) ...[
            const SizedBox(height: 20),
            SizedBox(
              height: 44,
              child: CustomPaint(size: Size.infinite, painter: _Sparkline(history, changeColor)),
            ),
          ],
          const SizedBox(height: 10),
          const Text('Бонки миллии Тоҷикистон', style: TextStyle(color: AppColors.faint, fontSize: 12)),
        ],
      ),
    );
  }
}

class _Sparkline extends CustomPainter {
  _Sparkline(this.values, this.color);

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final low = values.reduce((a, b) => a < b ? a : b);
    final high = values.reduce((a, b) => a > b ? a : b);
    final span = (high - low).abs() < 1e-9 ? 1.0 : high - low;
    Offset point(int i) => Offset(
          size.width * i / (values.length - 1),
          size.height - (values[i] - low) / span * (size.height - 8) - 4,
        );
    final path = Path()..moveTo(point(0).dx, point(0).dy);
    for (var i = 1; i < values.length; i++) {
      final a = point(i - 1);
      final b = point(i);
      final mid = (a.dx + b.dx) / 2;
      path.cubicTo(mid, a.dy, mid, b.dy, b.dx, b.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(point(values.length - 1), 3.5, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_Sparkline old) => old.values != values || old.color != color;
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onOpenTab});

  final void Function(int tab) onOpenTab;

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.work_outline_rounded, 'Кор', 1),
      (Icons.home_outlined, 'Манзил', 2),
      (Icons.description_outlined, 'Ҳуҷҷат', 3),
      (Icons.person_outline_rounded, 'Профил', 4),
    ];
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (final (icon, label, tab) in items)
          GestureDetector(
            onTap: () => onOpenTab(tab),
            behavior: HitTestBehavior.opaque,
            child: SizedBox(
              width: 72,
              child: Column(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(20)),
                    child: Icon(icon, color: AppColors.text, size: 24),
                  ),
                  const SizedBox(height: 8),
                  Text(label, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
