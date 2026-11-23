import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  var _version = 0;

  void _changed() => setState(() => _version++);

  Future<void> _add() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _DocumentForm(),
    );
    if (added == true && mounted) {
      _changed();
      toast(context, 'Ҳуҷҷат илова шуд');
    }
  }

  Future<void> _delete(Map doc) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Нест кунем?'),
        content: Text(doc['document_type_title'] ?? '', style: const TextStyle(color: AppColors.muted)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Не')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Нест кардан'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    try {
      await Api.instance.request('DELETE', '/documents/my-documents/${doc['id']}/');
      if (mounted) _changed();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PageTitle(
                'Ҳуҷҷатҳо',
                trailing: Material(
                  color: AppColors.text,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _add,
                    child: const SizedBox(
                      width: 40,
                      height: 40,
                      child: Icon(Icons.add_rounded, color: AppColors.background, size: 22),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: PagedList(
                  key: ValueKey(_version),
                  path: '/documents/my-documents/',
                  gap: 8,
                  emptyIcon: Icons.description_outlined,
                  emptyText: 'Ҳоло ҳуҷҷат нест.\nПатент ё бақайдгириро илова кунед —\nпеш аз тамом шудани мӯҳлат хабар медиҳем.',
                  itemBuilder: (context, doc) => DocumentRow(doc: doc, onLongPress: () => _delete(doc)),
                ),
              ),
            ],
          ),
        ),
      );
}

class DocumentRow extends StatelessWidget {
  const DocumentRow({super.key, required this.doc, this.onLongPress});

  final Map doc;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final daysLeft = doc['days_left'] as int? ?? 0;
    final color = switch (doc['status']) {
      'expired' => AppColors.danger,
      'expiring' => AppColors.warning,
      _ => AppColors.accent,
    };
    final number = (doc['number'] as String?) ?? '';

    return Surface(
      onLongPress: onLongPress,
      child: Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(doc['document_type_title'] ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                const SizedBox(height: 3),
                Meta(['то ${day(doc['expires_at'])}', if (number.isNotEmpty) '№$number']),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                daysLeft < 0 ? '0' : '$daysLeft',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: color, height: 1.1),
              ),
              Text(daysLeft < 0 ? 'гузашт' : 'рӯз', style: const TextStyle(color: AppColors.faint, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}

class _DocumentForm extends StatefulWidget {
  const _DocumentForm();

  @override
  State<_DocumentForm> createState() => _DocumentFormState();
}

class _DocumentFormState extends State<_DocumentForm> {
  final _number = TextEditingController();
  List<Map<String, dynamic>> _types = [];
  int? _type;
  DateTime? _expires;
  int _remind = 7;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Api.instance.page('/documents/document-types/').then((page) {
      if (mounted) setState(() => _types = page.items);
    }).catchError((Object e) {
      if (mounted) setState(() => _error = e.toString());
    });
  }

  @override
  void dispose() {
    _number.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expires ?? now.add(const Duration(days: 30)),
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 10)),
      helpText: 'Мӯҳлат то кай',
    );
    if (picked != null) setState(() => _expires = picked);
  }

  Future<void> _save() async {
    if (_type == null || _expires == null) {
      setState(() => _error = 'Намуд ва санаро интихоб кунед.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final date = _expires!;
    try {
      await Api.instance.post('/documents/my-documents/', {
        'document_type': _type,
        'expires_at': '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
        'number': _number.text.trim(),
        'remind_days_before': _remind,
      });
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(top: 22, bottom: 10),
        child: Text(text, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
      );

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 24),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Ҳуҷҷати нав',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.4)),
              _label('Намуд'),
              if (_types.isEmpty && _error == null)
                const Padding(padding: EdgeInsets.all(12), child: Spinner(size: 18))
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final type in _types)
                      Pill(
                        type['title'],
                        selected: _type == type['id'],
                        background: AppColors.raised,
                        onTap: () => setState(() {
                          _type = type['id'];
                          final days = type['default_validity_days'] as int?;
                          if (days != null && _expires == null) {
                            _expires = DateTime.now().add(Duration(days: days));
                          }
                        }),
                      ),
                  ],
                ),
              _label('Мӯҳлат то'),
              Material(
                color: AppColors.raised,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: _pickDate,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _expires == null ? 'Санаро интихоб кунед' : day(_expires!.toIso8601String()),
                            style: TextStyle(color: _expires == null ? AppColors.faint : AppColors.text, fontSize: 15),
                          ),
                        ),
                        const Icon(Icons.calendar_today_outlined, size: 18, color: AppColors.faint),
                      ],
                    ),
                  ),
                ),
              ),
              _label('Рақам (ихтиёрӣ)'),
              TextField(
                controller: _number,
                decoration: const InputDecoration(hintText: '№', fillColor: AppColors.raised),
              ),
              _label('Пешакӣ хабар диҳем'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final days in const [30, 14, 7, 3, 1])
                    Pill('$days рӯз', selected: _remind == days, background: AppColors.raised, onTap: () => setState(() => _remind = days)),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 14)),
              ],
              const SizedBox(height: 28),
              FilledButton(
                onPressed: _busy ? null : _save,
                child: _busy ? const Spinner(size: 20, color: AppColors.muted) : const Text('Захира кардан'),
              ),
            ],
          ),
        ),
      );
}
