import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/hd_button.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});
  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  final List<FocusNode> _keyListenerNodes = List.generate(6, (_) => FocusNode());
  int _secondsLeft = 60;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    for (final f in _keyListenerNodes) {
      f.dispose();
    }
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _secondsLeft = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      if (_secondsLeft == 0) {
        t.cancel();
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  String get _otp => _controllers.map((c) => c.text).join();

  Future<void> _submit() async {
    if (_otp.length < 6) return;
    try {
      await ref.read(authProvider.notifier).verifyOtp(widget.phone, _otp);
      // router redirect handles navigation
    } catch (_) {}
  }

  Future<void> _resend() async {
    try {
      await ref.read(authProvider.notifier).sendOtp(widget.phone);
      _startTimer();
    } catch (_) {}
  }

  void _onChanged(int index, String value) {
    if (value.length == 6) {
      // Paste of full OTP — fill all fields then submit once.
      for (int i = 0; i < 6; i++) {
        _controllers[i].text = value[i];
      }
      _focusNodes[5].requestFocus();
      _submit();
      return; // early return prevents the _otp.length == 6 check below from firing again
    }
    if (value.isNotEmpty && index < 5) {
      _focusNodes[index + 1].requestFocus();
    }
    // Only submit when completing the last digit manually (not via the paste path above).
    if (value.isNotEmpty && _otp.length == 6) _submit();
  }

  void _onKeyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _controllers[index].text.isEmpty &&
        index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authProvider).isLoading;
    final error = ref.watch(authProvider).error;

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Vérification', style: AppTextStyles.h2),
              const SizedBox(height: 8),
              Text(
                'Entrez le code envoyé au ${widget.phone}',
                style: AppTextStyles.body.copyWith(color: AppColors.grey),
              ),
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(
                  6,
                  (i) => SizedBox(
                    width: 48,
                    height: 56,
                    child: KeyboardListener(
                      focusNode: _keyListenerNodes[i],
                      onKeyEvent: (e) => _onKeyEvent(i, e),
                      child: TextFormField(
                        controller: _controllers[i],
                        focusNode: _focusNodes[i],
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        maxLength: i == 0 ? 6 : 1,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        style: AppTextStyles.h3,
                        decoration: InputDecoration(
                          counterText: '',
                          filled: true,
                          fillColor: AppColors.greyLight,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: AppColors.primary,
                              width: 2,
                            ),
                          ),
                        ),
                        onChanged: (v) => _onChanged(i, v),
                      ),
                    ),
                  ),
                ),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error,
                    style: AppTextStyles.caption.copyWith(color: AppColors.error)),
              ],
              const SizedBox(height: 32),
              HdButton(
                label: 'Vérifier',
                isLoading: isLoading,
                onPressed: _otp.length == 6 ? _submit : null,
              ),
              const SizedBox(height: 24),
              Center(
                child: _secondsLeft > 0
                    ? Text(
                        'Renvoyer le code dans ${_secondsLeft}s',
                        style: AppTextStyles.body.copyWith(color: AppColors.grey),
                      )
                    : TextButton(
                        onPressed: _resend,
                        child: Text(
                          'Renvoyer le code',
                          style: AppTextStyles.body.copyWith(color: AppColors.primary),
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
