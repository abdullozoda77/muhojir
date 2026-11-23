import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const apiBase = String.fromEnvironment('API_URL', defaultValue: 'https://muhojir.king.tj');

String mediaUrl(String path) => path.startsWith('http') ? path : '$apiBase$path';

class ApiException implements Exception {
  ApiException(this.message, [this.status = 0]);

  final String message;
  final int status;

  @override
  String toString() => message;
}

const _serverMessages = {
  'Wrong email or password.': 'Почта ё парол нодуруст аст.',
  'Wrong phone number or password.': 'Рақами телефон ё парол нодуруст аст.',
  'This account is blocked.': 'Ин ҳисоб баста шудааст.',
  'Confirm your email first. We sent you a code.': 'Аввал почтаро тасдиқ кунед. Мо рамз фиристодем.',
  'This phone number is already registered. Log in.': 'Ин рақам аллакай сабт шудааст. Ворид шавед.',
};

class Paged<T> {
  Paged(this.count, this.items, this.hasNext);

  final int count;
  final List<T> items;
  final bool hasNext;
}

class Api {
  Api._();

  static final instance = Api._();

  final _client = http.Client();
  String? _access;
  String? _refresh;
  Future<bool>? _refreshing;
  void Function()? onLogout;

  bool get hasTokens => _refresh != null;

  String? get refreshToken => _refresh;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _access = prefs.getString('access');
    _refresh = prefs.getString('refresh');
  }

  Future<void> saveTokens(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    if (data['access'] is String) {
      _access = data['access'];
      await prefs.setString('access', _access!);
    }
    if (data['refresh'] is String) {
      _refresh = data['refresh'];
      await prefs.setString('refresh', _refresh!);
    }
  }

  Future<void> clearTokens() async {
    _access = null;
    _refresh = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access');
    await prefs.remove('refresh');
  }

  Future<bool> _refreshAccess() {
    return _refreshing ??= () async {
      try {
        if (_refresh == null) return false;
        final res = await http.post(
          Uri.parse('$apiBase/api/auth/token/refresh/'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'refresh': _refresh}),
        );
        if (res.statusCode != 200) return false;
        await saveTokens(jsonDecode(utf8.decode(res.bodyBytes)));
        return true;
      } catch (_) {
        return false;
      }
    }()
        .whenComplete(() => _refreshing = null);
  }

  Future<http.Response> _send(String method, Uri uri, Object? body) {
    final headers = {
      'Accept': 'application/json',
      'Accept-Language': 'tg',
      if (body != null) 'Content-Type': 'application/json',
      if (_access != null) 'Authorization': 'Bearer $_access',
    };
    final request = http.Request(method, uri)..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);
    return _client.send(request).then(http.Response.fromStream);
  }

  Future<dynamic> request(String method, String path, {Map<String, String>? query, Object? body}) async {
    final uri = Uri.parse('$apiBase/api$path').replace(queryParameters: query);
    http.Response res;
    try {
      res = await _send(method, uri, body);
      if (res.statusCode == 401 && _refresh != null && await _refreshAccess()) {
        res = await _send(method, uri, body);
      }
    } catch (_) {
      throw ApiException('Интернет нест ё сервер ҷавоб намедиҳад.');
    }
    if (res.statusCode == 401 && _refresh != null) {
      await clearTokens();
      onLogout?.call();
    }
    final text = utf8.decode(res.bodyBytes);
    final data = text.isEmpty ? null : jsonDecode(text);
    if (res.statusCode >= 400) throw ApiException(_errorText(data), res.statusCode);
    return data;
  }

  String _errorText(dynamic data) {
    String raw = 'Хатогӣ рӯй дод. Боз кӯшиш кунед.';
    if (data is Map) {
      final detail = data['detail'] ?? data.values.first;
      if (detail is String) {
        raw = detail;
      } else if (detail is List && detail.isNotEmpty) {
        raw = detail.first.toString();
      }
    }
    return _serverMessages[raw] ?? raw;
  }

  Future<dynamic> get(String path, [Map<String, String>? query]) => request('GET', path, query: query);

  Future<dynamic> post(String path, [Object? body]) => request('POST', path, body: body ?? {});

  Future<Paged<Map<String, dynamic>>> page(String path, {int page = 1, Map<String, String> query = const {}}) async {
    final data = await get(path, {...query, 'page': '$page'});
    final results = (data['results'] as List).cast<Map<String, dynamic>>();
    return Paged(data['count'] ?? results.length, results, data['next'] != null);
  }
}
