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

  Future<void> _add() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (_) => const _DocumentForm(),
    );
    if (added == true && mounted) {
      setState(() => _version++);
      toast(context, 'Ҳуҷҷат илова шуд');
    }
  }

  Future<void> _delete(Map doc) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.containerLow,
        title: const Text('Ҳуҷҷатро нест кунем?'),
        content: Text(doc['document_type_title'] ?? ''),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Не')),
          FilledButton.tonal(onPressed: () => Navigator.pop(context, true), child: const Text('Нест кардан')),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    try {
      await Api.instance.request('DELETE', '/documents/my-documents/${doc['id']}/');
      if (mounted) setState(() => _version++);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Ҳуҷҷатҳои ман')),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _add,
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.onPrimary,
          icon: const Icon(Icons.add),
          label: const Text('Илова', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
        body: PagedList(
          key: ValueKey(_version),
          path: '/documents/my-documents/',
          emptyIcon: Icons.badge_outlined,
          emptyText: 'Ҳоло ҳуҷҷат нест.\nПатент, бақайдгирӣ ё шиносномаро илова кунед — мо пеш аз тамом шудани мӯҳлат хабар медиҳем.',
          itemBuilder: (context, doc) => DocumentCard(doc: doc, onLongPress: () => _delete(doc)),
        ),
      );
}

class DocumentCard extends StatelessWidget {
  const DocumentCard({super.key, required this.doc, this.onLongPress});

  final Map doc;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final daysLeft = doc['days_left'] as int? ?? 0;
    final (color, background, label) = switch (doc['status']) {
      'expired' => (AppColors.error, AppColors.errorContainer, 'Мӯҳлат гузашт'),
      'expiring' => (AppColors.warning, AppColors.warningContainer, '$daysLeft рӯз монд'),
      _ => (AppColors.green, AppColors.greenContainer, '$daysLeft рӯз'),
    };
    final number = (doc['number'] as String?) ?? '';

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onLongPress: onLongPress,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 5, color: color),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(doc['document_type_title'] ?? '',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 4),
                            Text(
                              'то ${day(doc['expires_at'])}${number.isEmpty ? '' : ' · №$number'}',
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      Tag(label, color: color, background: background),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
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
      setState(() => _error = 'Навъи ҳуҷҷат ва санаи тамомшударо интихоб кунед.');
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

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 24),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Ҳуҷҷати нав', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 18),
              if (_types.isEmpty && _error == null)
                const Padding(padding: EdgeInsets.all(12), child: Spinner(size: 22))
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final type in _types)
                      ChoiceChip(
                        label: Text(type['title']),
                        selected: _type == type['id'],
                        onSelected: (_) => setState(() {
                          _type = type['id'];
                          final days = type['default_validity_days'] as int?;
                          if (days != null && _expires == null) {
                            _expires = DateTime.now().add(Duration(days: days));
                          }
                        }),
                      ),
                  ],
                ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: AppColors.outlineVariant),
                ),
                tileColor: AppColors.containerLow,
                leading: const Icon(Icons.event_rounded),
                title: Text(_expires == null ? 'Мӯҳлат то кай?' : 'то ${day(_expires!.toIso8601String())}'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: _pickDate,
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _number,
                decoration: const InputDecoration(hintText: 'Рақами ҳуҷҷат (ихтиёрӣ)', prefixIcon: Icon(Icons.tag)),
              ),
              const SizedBox(height: 18),
              const Text('Пешакӣ хабар диҳем', style: TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final days in const [30, 14, 7, 3, 1])
                    ChoiceChip(
                      label: Text('$days рӯз'),
                      selected: _remind == days,
                      onSelected: (_) => setState(() => _remind = days),
                    ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(_error!, style: const TextStyle(color: AppColors.error)),
              ],
              const SizedBox(height: 22),
              FilledButton(
                onPressed: _busy ? null : _save,
                child: _busy ? const Spinner(size: 22) : const Text('Захира кардан'),
              ),
            ],
          ),
        ),
      );
}
