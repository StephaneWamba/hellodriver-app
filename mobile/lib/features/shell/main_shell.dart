import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/app_mode_provider.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/wallet_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/driver_colors.dart';
import '../client/screens/client_home_screen.dart';
import '../driver/screens/driver_home_screen.dart';
import '../wallet/wallet_screen.dart';
import '../profile/profile_screen.dart';

class _ShellIndexNotifier extends Notifier<int> {
  @override
  int build() => 0;
  void setIndex(int i) => state = i;
}

final shellIndexProvider =
    NotifierProvider<_ShellIndexNotifier, int>(_ShellIndexNotifier.new);

class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  String? _lastRole;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final isDriverAccount = user?.role == 'driver';

    // Sync appMode when user first loads (driver → driver mode, client → client mode)
    final role = user?.role;
    if (role != _lastRole) {
      _lastRole = role;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(appModeProvider.notifier).setMode(
              isDriverAccount ? AppMode.driver : AppMode.client,
            );
        ref.read(shellIndexProvider.notifier).setIndex(0);
      });
    }

    ref.listen<int>(shellIndexProvider, (prev, next) {
      if (next == 1 && prev != 1) {
        ref.read(walletProvider.notifier).refresh();
      }
    });

    final index = ref.watch(shellIndexProvider);
    final mode = ref.watch(appModeProvider);
    final isDriverMode = mode == AppMode.driver;

    final Color navPrimary =
        isDriverMode ? DriverColors.primary : AppColors.primary;
    final Color navPrimaryLight =
        isDriverMode ? DriverColors.primaryLight : AppColors.primaryLight;

    final screens = isDriverMode
        ? const [DriverHomeScreen(), WalletScreen(), ProfileScreen()]
        : const [ClientHomeScreen(), WalletScreen(), ProfileScreen()];

    return Scaffold(
      body: IndexedStack(index: index, children: screens),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Role switch banner — only for driver accounts
          if (isDriverAccount)
            _ModeSwitchBanner(
              isDriverMode: isDriverMode,
              onSwitch: () {
                final newMode =
                    isDriverMode ? AppMode.client : AppMode.driver;
                ref.read(appModeProvider.notifier).setMode(newMode);
                ref.read(shellIndexProvider.notifier).setIndex(0);
              },
            ),
          NavigationBar(
            selectedIndex: index,
            onDestinationSelected: (i) =>
                ref.read(shellIndexProvider.notifier).setIndex(i),
            backgroundColor: AppColors.white,
            indicatorColor: navPrimaryLight,
            destinations: [
              NavigationDestination(
                icon: Icon(isDriverMode
                    ? Icons.directions_car_outlined
                    : Icons.home_outlined),
                selectedIcon: Icon(
                  isDriverMode
                      ? Icons.directions_car_rounded
                      : Icons.home_rounded,
                  color: navPrimary,
                ),
                label: isDriverMode ? 'Conduite' : 'Accueil',
              ),
              NavigationDestination(
                icon: const Icon(Icons.account_balance_wallet_outlined),
                selectedIcon: Icon(Icons.account_balance_wallet_rounded,
                    color: navPrimary),
                label: 'Portefeuille',
              ),
              NavigationDestination(
                icon: const Icon(Icons.person_outline_rounded),
                selectedIcon:
                    Icon(Icons.person_rounded, color: navPrimary),
                label: 'Profil',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ModeSwitchBanner extends StatelessWidget {
  const _ModeSwitchBanner({
    required this.isDriverMode,
    required this.onSwitch,
  });
  final bool isDriverMode;
  final VoidCallback onSwitch;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onSwitch,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: double.infinity,
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          gradient: isDriverMode
              ? const LinearGradient(
                  colors: [Color(0xFF1A73E8), Color(0xFF1557B0)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                )
              : const LinearGradient(
                  colors: [Color(0xFF2DC9A0), Color(0xFF22A882)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isDriverMode
                  ? Icons.person_rounded
                  : Icons.directions_car_rounded,
              color: Colors.white,
              size: 16,
            ),
            const SizedBox(width: 8),
            Text(
              isDriverMode
                  ? 'Passer en mode Passager'
                  : 'Passer en mode Chauffeur',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.swap_horiz_rounded,
                color: Colors.white, size: 16),
          ],
        ),
      ),
    );
  }
}
