import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'theme.dart';

class Spinner extends StatelessWidget {
  const Spinner({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) => Center(
        child: SizedBox(
          width: size,
          height: size,
          child: const CircularProgressIndicator(
            strokeWidth: 2.5,
            color: AppColors.green,
            backgroundColor: AppColors.outlineVariant,
          ),
        ),
      );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_rounded, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 16),
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted)),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Боз кӯшиш'),
              ),
            ],
          ),
        ),
      );
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 52, color: AppColors.outline),
              const SizedBox(height: 14),
              Text(text, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted)),
            ],
          ),
        ),
      );
}

class Tag extends StatelessWidget {
  const Tag(this.text, {super.key, this.icon, this.color = AppColors.textMuted, this.background});

  final String text;
  final IconData? icon;
  final Color color;
  final Color? background;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: background ?? AppColors.container,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 14, color: color), const SizedBox(width: 5)],
            Flexible(
              child: Text(
                text,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: color),
              ),
            ),
          ],
        ),
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.action});

  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 24, 4, 12),
        child: Row(
          children: [
            Expanded(
              child: Text(text, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            ),
            if (action != null) action!,
          ],
        ),
      );
}

class NetImage extends StatelessWidget {
  const NetImage(this.path, {super.key, this.fit = BoxFit.cover});

  final String path;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) => Image.network(
        mediaUrl(path),
        fit: fit,
        loadingBuilder: (context, child, progress) =>
            progress == null ? child : Container(color: AppColors.container),
        errorBuilder: (context, error, stack) => Container(
          color: AppColors.container,
          child: const Icon(Icons.image_not_supported_outlined, color: AppColors.outline),
        ),
      );
}

void toast(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

class PagedList extends StatefulWidget {
  const PagedList({
    super.key,
    required this.path,
    required this.itemBuilder,
    required this.emptyIcon,
    required this.emptyText,
    this.query = const {},
    this.header,
  });

  final String path;
  final Map<String, String> query;
  final Widget Function(BuildContext, Map<String, dynamic>) itemBuilder;
  final IconData emptyIcon;
  final String emptyText;
  final Widget? header;

  @override
  State<PagedList> createState() => _PagedListState();
}

class _PagedListState extends State<PagedList> {
  final _items = <Map<String, dynamic>>[];
  final _scroll = ScrollController();
  int _page = 0;
  int _count = 0;
  bool _hasNext = true;
  bool _loading = false;
  String? _error;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 600) _loadMore();
    });
    _loadMore();
  }

  @override
  void didUpdateWidget(PagedList old) {
    super.didUpdateWidget(old);
    if (old.path != widget.path || !_sameQuery(old.query, widget.query)) _reload();
  }

  bool _sameQuery(Map<String, String> a, Map<String, String> b) =>
      a.length == b.length && a.entries.every((e) => b[e.key] == e.value);

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    _generation++;
    setState(() {
      _items.clear();
      _page = 0;
      _count = 0;
      _hasNext = true;
      _loading = false;
      _error = null;
    });
    await _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasNext) return;
    final generation = _generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await Api.instance.page(widget.path, page: _page + 1, query: widget.query);
      if (!mounted || generation != _generation) return;
      setState(() {
        _page++;
        _items.addAll(result.items);
        _count = result.count;
        _hasNext = result.hasNext;
      });
    } on ApiException catch (e) {
      if (mounted && generation == _generation) setState(() => _error = e.message);
    } finally {
      if (mounted && generation == _generation) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty && _loading) return const Spinner();
    if (_items.isEmpty && _error != null) return ErrorView(message: _error!, onRetry: _reload);

    return RefreshIndicator(
      color: AppColors.green,
      backgroundColor: AppColors.containerHigh,
      onRefresh: _reload,
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: _items.length + 2,
        separatorBuilder: (_, index) => SizedBox(height: index == 0 ? 0 : 12),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (widget.header != null) widget.header!,
                  if (_items.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(left: 4, top: 4),
                      child: Text('Ҳамагӣ: $_count',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                    ),
                ],
              ),
            );
          }
          if (index == _items.length + 1) {
            if (_items.isEmpty) {
              return SizedBox(height: 360, child: EmptyView(icon: widget.emptyIcon, text: widget.emptyText));
            }
            if (_error != null) {
              return TextButton(onPressed: _loadMore, child: const Text('Боз кӯшиш'));
            }
            return _hasNext ? const Padding(padding: EdgeInsets.all(16), child: Spinner(size: 22)) : const SizedBox();
          }
          return widget.itemBuilder(context, _items[index - 1]);
        },
      ),
    );
  }
}
