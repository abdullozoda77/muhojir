const _months = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];

String money(num value) {
  final digits = value.round().toString();
  final out = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(' ');
    out.write(digits[i]);
  }
  return out.toString();
}

String salary(Map job) {
  final from = job['salary_from'] as num?;
  final to = job['salary_to'] as num?;
  final period = switch (job['salary_period']) {
    'hour' => ' ₽/соат',
    'day' => ' ₽/рӯз',
    _ => ' ₽/моҳ',
  };
  if (from != null && to != null && from != to) return '${money(from)} – ${money(to)}$period';
  if (from != null) return 'аз ${money(from)}$period';
  if (to != null) return 'то ${money(to)}$period';
  return 'Маош бо мусоҳиба';
}

String rentPrice(Map housing) {
  final price = housing['price'] as num?;
  if (price == null) return 'Нарх бо гуфтугӯ';
  final period = switch (housing['period']) {
    'day' => '/шабонарӯз',
    _ => '/моҳ',
  };
  return '${money(price)} ₽$period';
}

String day(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final date = DateTime.tryParse(iso);
  if (date == null) return iso;
  final local = date.toLocal();
  return '${local.day} ${_months[local.month - 1]} ${local.year}';
}

String ago(String? iso) {
  final date = iso == null ? null : DateTime.tryParse(iso);
  if (date == null) return '';
  final diff = DateTime.now().difference(date.toLocal());
  if (diff.inMinutes < 1) return 'ҳозир';
  if (diff.inMinutes < 60) return '${diff.inMinutes} дақ. пеш';
  if (diff.inHours < 24) return '${diff.inHours} соат пеш';
  if (diff.inDays < 7) return '${diff.inDays} рӯз пеш';
  return day(iso);
}
