import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppMode { client, driver }

class AppModeNotifier extends Notifier<AppMode> {
  @override
  AppMode build() => AppMode.client;

  void setMode(AppMode mode) => state = mode;
  void toggle() => state = state == AppMode.client ? AppMode.driver : AppMode.client;
}

final appModeProvider = NotifierProvider<AppModeNotifier, AppMode>(AppModeNotifier.new);
