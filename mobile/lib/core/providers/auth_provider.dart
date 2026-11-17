import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/user_model.dart';

class AuthState {
  const AuthState({
    this.user,
    this.isLoading = false,
    this.error,
    this.isNewUser = false,
  });

  final UserModel? user;
  final bool isLoading;
  final String? error;
  final bool isNewUser;

  bool get isAuthenticated => user != null;
  bool get needsRoleSelection => isNewUser && user != null;

  AuthState copyWith({
    UserModel? user,
    bool? isLoading,
    String? error,
    bool? isNewUser,
    bool clearUser = false,
    bool clearError = false,
  }) =>
      AuthState(
        user: clearUser ? null : user ?? this.user,
        isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : error ?? this.error,
        isNewUser: isNewUser ?? this.isNewUser,
      );
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    final api = ref.read(apiClientProvider);
    api.onAuthExpired = () => state = const AuthState();
    _init();
    return const AuthState(isLoading: true);
  }

  ApiClient get _api => ref.read(apiClientProvider);

  Future<void> _init() async {
    final token = await _api.getToken();
    if (token == null) {
      state = state.copyWith(isLoading: false);
      return;
    }
    try {
      final res = await _api.get<Map<String, dynamic>>('/auth/me');
      state = state.copyWith(user: UserModel.fromJson(res.data!), isLoading: false);
    } catch (e) {
      // Only clear token on auth errors (401/403); keep it on transient network failures
      // so offline users are not unexpectedly logged out.
      final statusCode = _extractStatusCode(e);
      if (statusCode == 401 || statusCode == 403) {
        await _api.clearToken();
        state = state.copyWith(isLoading: false, clearUser: true);
      } else {
        // Network error or server error — stay logged out of loading state
        // but preserve the token so the next foreground attempt can retry.
        state = state.copyWith(isLoading: false, clearUser: true);
      }
    }
  }

  int? _extractStatusCode(Object e) {
    try {
      // ignore: avoid_dynamic_calls
      return (e as dynamic).response?.statusCode as int?;
    } catch (_) {
      return null;
    }
  }


  Future<void> sendOtp(String phone) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _api.post<dynamic>('/auth/send-otp', data: {'phone': phone});
      state = state.copyWith(isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      rethrow;
    }
  }

  Future<UserModel> verifyOtp(String phone, String otp) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final res = await _api.post<Map<String, dynamic>>(
        '/auth/verify-otp-and-signup',
        data: {'phone': phone, 'code': otp},
      );
      final data = res.data!;
      final isNew = res.statusCode == 201;
      final session = data['session'] as Map<String, dynamic>? ?? data;
      final token = session['access_token'] as String? ?? data['access_token'] as String;
      final refreshToken = session['refresh_token'] as String? ?? data['refresh_token'] as String? ?? '';
      await _api.setToken(token, refreshToken);
      final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
      state = state.copyWith(user: user, isLoading: false, isNewUser: isNew);
      return user;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      rethrow;
    }
  }

  Future<void> setRole(String role) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final res = await _api.patch<Map<String, dynamic>>(
        '/auth/profile',
        data: {'role': role},
      );
      final data = res.data!;
      // Role is baked into the JWT — the backend issues a fresh token pair
      // whenever role changes (see PATCH /auth/profile), otherwise every
      // driver/client-only route would keep rejecting the stale token.
      final session = data['session'] as Map<String, dynamic>?;
      if (session != null) {
        await _api.setToken(
          session['access_token'] as String,
          session['refresh_token'] as String,
        );
      }
      state = state.copyWith(user: UserModel.fromJson(data), isLoading: false, isNewUser: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      rethrow;
    }
  }

  Future<void> updateProfile({String? name, String? email}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final res = await _api.patch<Map<String, dynamic>>(
        '/auth/profile',
        data: {
          'name': name,
          'email': email,
        }..removeWhere((_, v) => v == null),
      );
      state = state.copyWith(user: UserModel.fromJson(res.data!), isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      rethrow;
    }
  }

  /// Redeems a referral code entered at signup. Failures are non-fatal
  /// (invalid/expired code, already referred) — signup must not be blocked by this.
  Future<void> redeemReferralCode(String code) async {
    try {
      await _api.post<dynamic>('/referrals/redeem', data: {'code': code});
    } catch (_) {}
  }

  Future<void> uploadAvatar(File imageFile) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final ext = imageFile.path.split('.').last.toLowerCase();
      final mimeType = ext == 'png' ? 'image/png' : ext == 'webp' ? 'image/webp' : 'image/jpeg';
      final res = await _api.uploadFile<Map<String, dynamic>>('/auth/avatar', imageFile, mimeType);
      final avatarUrl = res.data!['avatarUrl'] as String;
      final updated = state.user!.copyWith(avatarUrl: avatarUrl);
      state = state.copyWith(user: updated, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _api.clearToken();
    state = const AuthState();
  }

  String _extractError(Object e) {
    try {
      // ignore: avoid_dynamic_calls
      final data = (e as dynamic).response?.data;
      final msg = data?['error']?['message'] ?? data?['message'];
      if (msg is String) return msg;
    } catch (_) {}
    // Return actual exception for debugging
    return e.toString();
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
