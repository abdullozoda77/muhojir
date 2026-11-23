import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../session.dart';
import '../theme.dart';

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
      body: Stack(
        children: [
          const Positioned.fill(child: _Glow()),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Form(
                    key: _form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const _Logo(),
                        const SizedBox(height: 28),
                        Text(
                          isRegister ? 'Сабти ном' : 'Хуш омадед',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Ёрдамчии муҳоҷир дар Русия: ҳуҷҷатҳо, кор, манзил ва қурби рубл.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.textMuted, height: 1.4),
                        ),
                        const SizedBox(height: 28),
                        if (!isRegister) ...[
                          SegmentedButton<_Mode>(
                            segments: const [
                              ButtonSegment(value: _Mode.phone, label: Text('Телефон'), icon: Icon(Icons.phone_iphone)),
                              ButtonSegment(value: _Mode.email, label: Text('Почта'), icon: Icon(Icons.alternate_email)),
                            ],
                            selected: {_mode},
                            showSelectedIcon: false,
                            onSelectionChanged: (value) => _switch(value.first),
                          ),
                          const SizedBox(height: 20),
                        ],
                        if (isRegister) ...[
                          TextFormField(
                            controller: _name,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                              hintText: 'Ном ва насаб',
                              prefixIcon: Icon(Icons.person_outline),
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],
                        TextFormField(
                          controller: _login,
                          keyboardType: isEmail ? TextInputType.emailAddress : TextInputType.phone,
                          textInputAction: TextInputAction.next,
                          autocorrect: false,
                          decoration: InputDecoration(
                            hintText: isEmail ? 'Почтаи электронӣ' : '+7 900 000 00 00',
                            prefixIcon: Icon(isEmail ? Icons.alternate_email : Icons.phone_iphone),
                          ),
                          validator: (value) {
                            final text = value?.trim() ?? '';
                            if (text.isEmpty) return isEmail ? 'Почтаро нависед' : 'Рақамро нависед';
                            if (isEmail && !text.contains('@')) return 'Почта нодуруст аст';
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _password,
                          obscureText: _hidden,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _submit(),
                          decoration: InputDecoration(
                            hintText: 'Парол',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              onPressed: () => setState(() => _hidden = !_hidden),
                            ),
                          ),
                          validator: (value) {
                            if ((value ?? '').isEmpty) return 'Паролро нависед';
                            if (isRegister && value!.length < 8) return 'Парол на камтар аз 8 аломат';
                            return null;
                          },
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.errorContainer,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Text(_error!, style: const TextStyle(color: Color(0xFFFECDCD))),
                          ),
                        ],
                        const SizedBox(height: 22),
                        FilledButton(
                          onPressed: _busy ? null : _submit,
                          child: _busy
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.onPrimary),
                                )
                              : Text(isRegister ? 'Сабт шудан' : 'Ворид шудан'),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: _busy ? null : () => _switch(isRegister ? _Mode.phone : _Mode.register),
                          child: Text(isRegister ? 'Аллакай ҳисоб доред? Ворид шавед' : 'Ҳисоб надоред? Сабти ном'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) => Center(
        child: Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            gradient: const LinearGradient(
              colors: [AppColors.primaryContainer, Color(0xFF182A5A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.5)),
            boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.25), blurRadius: 30)],
          ),
          child: const Icon(Icons.flight_takeoff_rounded, size: 40, color: AppColors.gold),
        ),
      );
}

class _Glow extends StatelessWidget {
  const _Glow();

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(0, -0.9),
            radius: 1.1,
            colors: [AppColors.primaryContainer.withValues(alpha: 0.28), AppColors.background],
          ),
        ),
      );
}
