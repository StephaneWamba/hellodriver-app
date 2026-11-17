import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../env.dart';

const String _baseUrl = Env.apiBaseUrl;

class AuthExpiredException implements Exception {
  const AuthExpiredException();
}

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

class ApiClient {
  /// Set by AuthNotifier to clear state when refresh fails.
  void Function()? onAuthExpired;

  // Serializes concurrent refresh attempts — only one call to /auth/refresh at a time.
  Completer<bool>? _refreshCompleter;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final isRefreshCall = error.requestOptions.path.contains('/auth/refresh');
          if (!isRefreshCall) {
            final refreshed = await _tryRefresh();
            if (refreshed) {
              try {
                final prefs = await SharedPreferences.getInstance();
                final newToken = prefs.getString('access_token');
                final opts = error.requestOptions;
                opts.headers['Authorization'] = 'Bearer $newToken';
                final response = await _dio.fetch(opts);
                return handler.resolve(response);
              } catch (_) {}
            }
            await clearToken();
            // Defer the state mutation so it never fires during a widget build.
            Future.microtask(() => onAuthExpired?.call());
            return handler.reject(
              DioException(
                requestOptions: error.requestOptions,
                error: const AuthExpiredException(),
                type: DioExceptionType.badResponse,
              ),
            );
          }
        }
        handler.next(error);
      },
    ));
  }

  late final Dio _dio;

  Future<bool> _tryRefresh() async {
    // If a refresh is already in-flight, wait for it instead of making a second call.
    if (_refreshCompleter != null) return _refreshCompleter!.future;

    _refreshCompleter = Completer<bool>();
    try {
      final prefs = await SharedPreferences.getInstance();
      final refreshToken = prefs.getString('refresh_token');
      if (refreshToken == null) {
        _refreshCompleter!.complete(false);
        return false;
      }

      final bare = Dio(BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
      ));
      final res = await bare.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
      );
      final accessToken = res.data?['access_token'] as String?;
      if (accessToken == null) {
        _refreshCompleter!.complete(false);
        return false;
      }
      await prefs.setString('access_token', accessToken);
      // Persist rotated refresh token if the server returned one.
      final newRefreshToken = res.data?['refresh_token'] as String?;
      if (newRefreshToken != null) {
        await prefs.setString('refresh_token', newRefreshToken);
      }
      _refreshCompleter!.complete(true);
      return true;
    } catch (_) {
      _refreshCompleter!.complete(false);
      return false;
    } finally {
      _refreshCompleter = null;
    }
  }

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? params}) =>
      _dio.get<T>(path, queryParameters: params);

  Future<Response<T>> post<T>(String path, {dynamic data}) =>
      _dio.post<T>(path, data: data);

  Future<Response<T>> patch<T>(String path, {dynamic data}) =>
      _dio.patch<T>(path, data: data);

  Future<Response<T>> delete<T>(String path) => _dio.delete<T>(path);

  Future<Response<T>> uploadFile<T>(
    String path,
    File file,
    String mimeType, {
    Map<String, String> fields = const {},
  }) async {
    final formData = FormData.fromMap({
      ...fields,
      'file': await MultipartFile.fromFile(file.path, contentType: DioMediaType.parse(mimeType)),
    });
    return _dio.post<T>(path, data: formData, options: Options(contentType: 'multipart/form-data'));
  }

  Future<void> setToken(String accessToken, String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', accessToken);
    await prefs.setString('refresh_token', refreshToken);
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }
}
