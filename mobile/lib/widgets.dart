import 'dart:async';

import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'theme.dart';

class Spinner extends StatelessWidget {
  const Spinner({super.key, this.size = 22, this.color = AppColors.text});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Center(
        child: SizedBox(
          width: size,
          height: size,
          child: CircularProgressIndicator(strokeWidth: 2, color: color, backgroundColor: AppColors.line),
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
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, height: 1.5)),
              const SizedBox(height: 12),
              TextButton(onPressed: onRetry, child: const Text('Боз кӯшиш')),
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
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 32, color: AppColors.faint),
              const SizedBox(height: 14),
              Text(text, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, height: 1.5)),
            ],
          ),
        ),
      );
}

class PageTitle extends StatelessWidget {
  const PageTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
        child: Row(
          children: [
            Expanded(
              child: Text(text,
                  style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: -0.6, height: 1.1)),
            ),
            ?trailing,
          ],
        ),
      );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.action, this.onAction});

  final String text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 32, 0, 12),
        child: Row(
          children: [
            Expanded(
              child: Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, letterSpacing: -0.2)),
            ),
            if (action != null)
              GestureDetector(
                onTap: onAction,
                child: Text(action!, style: const TextStyle(color: AppColors.muted, fontSize: 14)),
              ),
          ],
        ),
      );
}

class Surface extends StatelessWidget {
  const Surface({super.key, required this.child, this.onTap, this.onLongPress, this.padding = const EdgeInsets.all(18)});

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          child: Padding(padding: padding, child: child),
        ),
      );
}

class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, required this.selected, required this.onTap, this.background = AppColors.surface});

  final String label;
  final Color background;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? AppColors.text : background,
            borderRadius: BorderRadius.circular(100),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: selected ? AppColors.background : AppColors.muted,
            ),
          ),
        ),
      );
}

class PillRow extends StatelessWidget {
  const PillRow({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 38,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          itemCount: children.length,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (_, index) => children[index],
        ),
      );
}

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
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        child: TextField(
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: widget.hint,
            prefixIcon: const Icon(Icons.search_rounded, size: 22),
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onChanged: (value) {
            _timer?.cancel();
            _timer = Timer(const Duration(milliseconds: 450), () => widget.onChanged(value.trim()));
          },
        ),
      );
}

class Meta extends StatelessWidget {
  const Meta(this.parts, {super.key, this.color = AppColors.muted, this.size = 13});

  final List<String?> parts;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final text = parts.where((p) => p != null && p.trim().isNotEmpty).join('  ·  ');
    return Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: color, fontSize: size));
  }
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
            progress == null ? child : const ColoredBox(color: AppColors.raised),
        errorBuilder: (context, error, stack) => const ColoredBox(
          color: AppColors.raised,
          child: Center(child: Icon(Icons.image_outlined, color: AppColors.faint)),
        ),
      );
}

class BackBar extends StatelessWidget implements PreferredSizeWidget {
  const BackBar({super.key, this.overlay = false});

  final bool overlay;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) => AppBar(
        backgroundColor: overlay ? Colors.transparent : AppColors.background,
        automaticallyImplyLeading: false,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Center(
            child: Material(
              color: overlay ? const Color(0xB30A0A0B) : AppColors.surface,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => Navigator.of(context).maybePop(),
                child: const SizedBox(
                  width: 40,
                  height: 40,
                  child: Icon(Icons.arrow_back_rounded, size: 20, color: AppColors.text),
                ),
              ),
            ),
          ),
        ),
        leadingWidth: 64,
      );
}

void toast(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

Route<T> slideRoute<T>(Widget page) => PageRouteBuilder<T>(
      transitionDuration: const Duration(milliseconds: 280),
      reverseTransitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (_, animation, _, child) {
        final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
        return FadeTransition(
          opacity: curved,
          child: SlideTransition(
            position: Tween(begin: const Offset(0.06, 0), end: Offset.zero).animate(curved),
            child: child,
          ),
        );
      },
    );

class PagedList extends StatefulWidget {
  const PagedList({
    super.key,
    required this.path,
    required this.itemBuilder,
    required this.emptyIcon,
    required this.emptyText,
    this.query = const {},
    this.header,
    this.gap = 12,
  });

  final String path;
  final Map<String, String> query;
  final Widget Function(BuildContext, Map<String, dynamic>) itemBuilder;
  final IconData emptyIcon;
  final String emptyText;
  final Widget? header;
  final double gap;

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
      color: AppColors.text,
      backgroundColor: AppColors.raised,
      onRefresh: _reload,
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        itemCount: _items.length + 2,
        separatorBuilder: (_, index) => SizedBox(height: index == 0 ? 0 : widget.gap),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (widget.header != null) widget.header!,
                  if (_items.isNotEmpty)
                    Text('$_count натиҷа', style: const TextStyle(color: AppColors.faint, fontSize: 13)),
                ],
              ),
            );
          }
          if (index == _items.length + 1) {
            if (_items.isEmpty) {
              return SizedBox(height: 360, child: EmptyView(icon: widget.emptyIcon, text: widget.emptyText));
            }
            if (_error != null) return TextButton(onPressed: _loadMore, child: const Text('Боз кӯшиш'));
            return _hasNext ? const Padding(padding: EdgeInsets.all(20), child: Spinner(size: 18)) : const SizedBox();
          }
          return widget.itemBuilder(context, _items[index - 1]);
        },
      ),
    );
  }
}
