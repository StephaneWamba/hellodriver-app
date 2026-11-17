import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/main.dart' as app;

const _testPhone = '77000042';
const _fullPhone = '+24177000042';
const _devKey = '21765bcba2f1dc319f29b155d451159a97855a263f54796e89552364c4fd4b34';
const _backendUrl = 'https://hellodriver-main.fly.dev';

Future<String> _fetchOtp(String phone) async {
  final client = HttpClient();
  final encoded = Uri.encodeComponent(phone);
  final req = await client.getUrl(Uri.parse('$_backendUrl/auth/dev/otp/$encoded'));
  req.headers.set('x-dev-key', _devKey);
  final res = await req.close();
  final body = await res.transform(utf8.decoder).join();
  client.close();
  final json = jsonDecode(body) as Map<String, dynamic>;
  return json['code'] as String;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Auth flow: phone → OTP → home screen', (tester) async {
    app.main();
    await tester.pumpAndSettle(const Duration(seconds: 4));

    // ── Phone screen ────────────────────────────────────────────────
    expect(find.textContaining('Bienvenue sur'), findsOneWidget);

    final phoneField = find.byType(TextFormField).first;
    await tester.tap(phoneField);
    await tester.pumpAndSettle();
    await tester.enterText(phoneField, _testPhone);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Continuer'));
    // Wait for sendOtp API call + navigation
    await tester.pumpAndSettle(const Duration(seconds: 6));

    // ── OTP screen ──────────────────────────────────────────────────
    expect(find.text('Vérification'), findsOneWidget);

    // Fetch the real OTP from the dev backdoor
    final otp = await _fetchOtp(_fullPhone);
    // ignore: avoid_print
    print('OTP fetched: $otp');

    // First field accepts 6 digits (paste mode)
    final otpFields = find.byType(TextFormField);
    await tester.tap(otpFields.first);
    await tester.pumpAndSettle();
    await tester.enterText(otpFields.first, otp);
    await tester.pumpAndSettle(const Duration(seconds: 6));

    // ── Should navigate away from OTP screen ────────────────────────
    final navigated = find.text('Vérification').evaluate().isEmpty;
    expect(navigated, isTrue,
        reason: 'Should navigate away from OTP screen. Auth error: ${find.byType(Text).evaluate().map((e) => (e.widget as Text).data).where((t) => t != null).join(" | ")}');
  });
}
