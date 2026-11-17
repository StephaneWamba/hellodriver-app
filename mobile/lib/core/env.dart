/// Single source of truth for build-time configuration. Every other file
/// (ApiClient, SocketService, ...) must read from here instead of hardcoding
/// its own copy — a second hardcoded URL is how "the API works but sockets
/// don't" bugs happen after a backend URL change.
class Env {
  Env._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://hellodriver-main.fly.dev',
  );
}
