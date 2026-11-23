import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets.dart';

enum _Mode { phone, email, register }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _login = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  var _mode = _Mode.phone;
  var _busy = false;
  var _hidden = true;
  String? _error;

  @override
  void dispose() {
    _login.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = Session.instance;
    final login = _login.text.trim();
    try {
      switch (_mode) {
        case _Mode.phone:
          await session.loginPhone(login, _password.text);
        case _Mode.email:
          await session.loginEmail(login, _password.text);
        case _Mode.register:
          await session.registerPhone(login, _password.text, _name.text.trim());
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _switch(_Mode mode) => setState(() {
        _mode = mode;
        _error = null;
        _login.clear();
      });

  @override
  Widget build(BuildContext context) {
    final isEmail = _mode == _Mode.email;
    final isRegister = _mode == _Mode.register;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Image.asset('assets/logo.png', width: 52, height: 52),
                      ),
                    ),
                    const SizedBox(height: 36),
                    Text(
                      isRegister ? 'Ҳисоби нав' : 'Хуш омадед',
                      style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w700, letterSpacing: -0.8),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Ҳуҷҷатҳо, кор, манзил ва қурби рубл — дар як ҷо.',
                      style: TextStyle(color: AppColors.muted, fontSize: 15, height: 1.5),
                    ),
                    const SizedBox(height: 36),
                    if (!isRegister) ...[
                      Row(
                        children: [
                          Pill('Телефон', selected: !isEmail, onTap: () => _switch(_Mode.phone)),
                          const SizedBox(width: 8),
                          Pill('Почта', selected: isEmail, onTap: () => _switch(_Mode.email)),
                        ],
                      ),
                      const SizedBox(height: 20),
                    ],
                    if (isRegister) ...[
                      TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(hintText: 'Ном ва насаб'),
                      ),
                      const SizedBox(height: 10),
                    ],
                    TextFormField(
                      controller: _login,
                      keyboardType: isEmail ? TextInputType.emailAddress : TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      decoration: InputDecoration(hintText: isEmail ? 'Почтаи электронӣ' : 'Рақами телефон'),
                      validator: (value) {
                        final text = value?.trim() ?? '';
                        if (text.isEmpty) return isEmail ? 'Почтаро нависед' : 'Рақамро нависед';
                        if (isEmail && !text.contains('@')) return 'Почта нодуруст аст';
                        return null;
                      },
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _password,
                      obscureText: _hidden,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        hintText: 'Парол',
                        suffixIcon: IconButton(
                          icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 20),
                          onPressed: () => setState(() => _hidden = !_hidden),
                        ),
                      ),
                      validator: (value) {
                        if ((value ?? '').isEmpty) return 'Паролро нависед';
                        if (isRegister && value!.length < 8) return 'Ақаллан 8 аломат';
                        return null;
                      },
                    ),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 200),
                      child: _error == null
                          ? const SizedBox(width: double.infinity)
                          : Padding(
                              padding: const EdgeInsets.only(top: 14),
                              child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 14)),
                            ),
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const Spinner(size: 20, color: AppColors.muted)
                          : Text(isRegister ? 'Сохтани ҳисоб' : 'Ворид шудан'),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _busy ? null : () => _switch(isRegister ? _Mode.phone : _Mode.register),
                      child: Text.rich(
                        TextSpan(
                          text: isRegister ? 'Ҳисоб доред? ' : 'Ҳисоб надоред? ',
                          children: [
                            TextSpan(
                              text: isRegister ? 'Ворид шавед' : 'Сабти ном',
                              style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
