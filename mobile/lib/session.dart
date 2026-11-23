import 'package:flutter/foundation.dart';

import 'api.dart';

class Session extends ChangeNotifier {
  Session._();

  static final instance = Session._();

  final api = Api.instance;
  Map<String, dynamic>? user;
  bool ready = false;

  bool get loggedIn => user != null;

  String get name {
    final full = (user?['full_name'] as String?)?.trim() ?? '';
    if (full.isNotEmpty) return full;
    return user?['phone'] ?? user?['email'] ?? '';
  }

  Future<void> start() async {
    api.onLogout = _forget;
    await api.load();
    if (api.hasTokens) {
      try {
        user = Map<String, dynamic>.from(await api.get('/auth/profile/'));
      } on ApiException catch (e) {
        if (e.status == 401) await api.clearTokens();
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> _enter(dynamic data) async {
    await api.saveTokens(Map<String, dynamic>.from(data));
    user = Map<String, dynamic>.from(data['user']);
    notifyListeners();
  }

  Future<void> loginEmail(String email, String password) async =>
      _enter(await api.post('/auth/login/', {'email': email, 'password': password}));

  Future<void> loginPhone(String phone, String password) async =>
      _enter(await api.post('/auth/phone/login/', {'phone': phone, 'password': password}));

  Future<void> registerPhone(String phone, String password, String fullName) async => _enter(
      await api.post('/auth/phone/register/', {'phone': phone, 'password': password, 'full_name': fullName}));

  Future<void> logout() async {
    try {
      if (api.refreshToken != null) await api.post('/auth/logout/', {'refresh': api.refreshToken});
    } catch (_) {}
    await api.clearTokens();
    _forget();
  }

  void _forget() {
    user = null;
    notifyListeners();
  }
}
