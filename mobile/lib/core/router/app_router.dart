import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../../features/auth/screens/phone_screen.dart';
import '../../features/auth/screens/otp_screen.dart';
import '../../features/auth/screens/role_screen.dart';
import '../../features/shell/main_shell.dart';

class _AuthNotifier extends ChangeNotifier {
  _AuthNotifier(Ref ref) {
    ref.listen<AuthState>(authProvider, (prev, next) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthNotifier(ref);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      if (authState.isLoading) return null;

      final isAuth = authState.isAuthenticated;
      final needsRole = authState.needsRoleSelection;
      final path = state.uri.path;

      final authPaths = ['/', '/otp', '/role'];
      final isOnAuthPath = authPaths.any((p) => path == p || path.startsWith('$p/'));

      if (!isAuth && !isOnAuthPath) return '/';
      if (isAuth && needsRole && path != '/role') return '/role';
      if (isAuth && !needsRole && isOnAuthPath) return '/app';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const PhoneScreen()),
      GoRoute(
        path: '/otp',
        builder: (context, state) =>
            OtpScreen(phone: state.extra as String? ?? ''),
      ),
      GoRoute(path: '/role', builder: (context, state) => const RoleScreen()),
      GoRoute(path: '/app', builder: (context, state) => const MainShell()),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Page introuvable: ${state.uri}')),
    ),
  );
});
