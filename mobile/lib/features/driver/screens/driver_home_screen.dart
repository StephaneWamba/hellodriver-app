import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/driver_provider.dart';
import '../../../core/providers/wallet_provider.dart';
import '../../../core/services/socket_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/driver_colors.dart';
import '../../../shared/widgets/hd_button.dart';
import '../../../shared/widgets/hd_logo.dart';
import '../../../shared/widgets/hd_pulse_loader.dart';
import '../widgets/new_trip_sheet.dart';
import 'driver_documents_screen.dart';
import 'driver_earnings_screen.dart';
import 'driver_vehicle_info_screen.dart';
const _librevilleCenter = LatLng(0.4162, 9.4673);

class DriverHomeScreen extends ConsumerStatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  ConsumerState<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends ConsumerState<DriverHomeScreen> {
  StreamSubscription<Position>? _locationSub;
  GoogleMapController? _mapController;
  final Set<Marker> _markers = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(socketServiceProvider).connect();
      ref.read(driverProvider.notifier).fetchVerificationStatus();
      _startLocationUpdates();
    });
  }

  @override
  void dispose() {
    _locationSub?.cancel();
    _mapController?.dispose();
    super.dispose();
  }

  Future<void> _startLocationUpdates() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return;
    }

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 20, // metres — only send when moved 20m
    );
    _locationSub = Geolocator.getPositionStream(locationSettings: settings).listen(
      (pos) {
        if (!mounted) return;
        final isOnline = ref.read(driverProvider).isOnline;
        if (isOnline) {
          ref.read(driverProvider.notifier).updateLocation(pos.latitude, pos.longitude);
        }
        final latLng = LatLng(pos.latitude, pos.longitude);
        // The map is swapped out for _VerificationRequiredView while the
        // driver isn't verified yet (see build()) — the State stays mounted
        // throughout, so `mounted` alone doesn't catch a position update
        // landing after that swap disposed the GoogleMap platform view.
        // Re-check the exact condition build() uses to decide whether the
        // map is currently in the tree, instead of a stale controller ref.
        final verification = ref.read(driverProvider).verification;
        final mapIsInTree = verification == null || verification.isVerified;
        if (mapIsInTree) {
          _mapController?.animateCamera(CameraUpdate.newLatLng(latLng));
        }
        setState(() {
          _markers
            ..removeWhere((m) => m.markerId.value == 'my_location')
            ..add(Marker(
              markerId: const MarkerId('my_location'),
              position: latLng,
              infoWindow: const InfoWindow(title: 'Ma position'),
            ));
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final driverState = ref.watch(driverProvider);
    final user = ref.watch(authProvider).user;

    // Show new trip request bottom sheet when one arrives
    ref.listen<Map<String, dynamic>?>(pendingTripRequestProvider, (_, request) {
      if (request == null) return;
      if (!mounted) return;
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        isDismissible: false,
        builder: (_) => NewTripSheet(
          tripId: request['trip_id'] as String? ?? '',
          pickupAddress: request['pickup_address'] as String? ?? '',
          dropoffAddress: request['dropoff_address'] as String? ?? '',
          estimatedPrice: (request['estimated_price'] as num?)?.toDouble() ?? 0,
          distanceKm: (request['distance_km'] as num?)?.toDouble() ?? 0,
          onDismiss: () {
            ref.read(pendingTripRequestProvider.notifier).set(null);
            Navigator.of(context).pop();
          },
        ),
      );
    });

    final verification = driverState.verification;
    if (verification != null && !verification.isVerified) {
      return _VerificationRequiredView(verification: verification);
    }

    return Scaffold(
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: const CameraPosition(
              target: _librevilleCenter,
              zoom: 13,
            ),
            onMapCreated: (c) => _mapController = c,
            markers: _markers,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            mapType: MapType.normal,
          ),

          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const HdLogo(size: 40, color: DriverColors.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          driverState.isOnline ? 'En ligne' : 'Hors ligne',
                          style: AppTextStyles.caption.copyWith(
                            color: driverState.isOnline
                                ? DriverColors.primary
                                : AppColors.grey,
                          ),
                        ),
                        Text(
                          user?.name ?? user?.phone ?? '',
                          style: AppTextStyles.h3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  // Online toggle
                  _OnlineToggle(
                    isOnline: driverState.isOnline,
                    isLoading: driverState.isLoading,
                    onToggle: () => ref.read(driverProvider.notifier).toggleOnline(),
                  ),
                ],
              ),
            ),
          ),

          // Offline overlay
          if (!driverState.isOnline)
            Positioned.fill(
              child: GestureDetector(
                onTap: () => ref.read(driverProvider.notifier).toggleOnline(),
                child: Container(
                  color: Colors.black.withValues(alpha: 0.35),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: DriverColors.primary,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: DriverColors.primary.withValues(alpha: 0.4),
                                blurRadius: 20,
                                spreadRadius: 4,
                              ),
                            ],
                          ),
                          child: const Icon(Icons.power_settings_new_rounded,
                              color: Colors.white, size: 36),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Vous êtes hors ligne',
                          style: AppTextStyles.h2
                              .copyWith(color: AppColors.white),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Appuyez pour activer',
                          style: AppTextStyles.body.copyWith(
                              color: AppColors.white.withValues(alpha: 0.8)),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

          // Bottom panel
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _DriverBottomPanel(isOnline: driverState.isOnline),
          ),
        ],
      ),
    );
  }
}

class _OnlineToggle extends StatelessWidget {
  const _OnlineToggle({
    required this.isOnline,
    required this.isLoading,
    required this.onToggle,
  });

  final bool isOnline;
  final bool isLoading;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: isLoading ? null : onToggle,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isOnline ? DriverColors.primary : AppColors.greyLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isOnline ? DriverColors.primary : AppColors.greyBorder,
          ),
        ),
        child: isLoading
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppColors.white),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isOnline ? AppColors.white : AppColors.grey,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isOnline ? 'En ligne' : 'Hors ligne',
                    style: AppTextStyles.caption.copyWith(
                      color: isOnline ? AppColors.white : AppColors.grey,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _DriverBottomPanel extends StatelessWidget {
  const _DriverBottomPanel({required this.isOnline});
  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
              color: Color(0x18000000), blurRadius: 24, offset: Offset(0, -4)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
                color: AppColors.greyBorder,
                borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          if (isOnline) ...[
            Row(
              children: [
                const Icon(Icons.access_time_rounded,
                    color: DriverColors.primary, size: 18),
                const SizedBox(width: 8),
                Text('En attente de courses…',
                    style:
                        AppTextStyles.body.copyWith(color: DriverColors.primary)),
              ],
            ),
          ] else ...[
            Row(
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: AppColors.grey, size: 18),
                const SizedBox(width: 8),
                Text('Activez le mode en ligne pour commencer',
                    style: AppTextStyles.body.copyWith(color: AppColors.grey)),
              ],
            ),
          ],
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const DriverEarningsScreen()),
            ),
            child: const _EarningsSummary(),
          ),
        ],
      ),
    );
  }
}

class _EarningsSummary extends ConsumerWidget {
  const _EarningsSummary();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(walletProvider);
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final weekStart = todayStart.subtract(Duration(days: now.weekday - 1));

    final credits = wallet.transactions.where((t) => t.isCredit && t.status == 'completed');
    final todayXaf = credits
        .where((t) => t.createdAt.isAfter(todayStart))
        .fold<double>(0, (sum, t) => sum + t.amount);
    final weekCredits = credits.where((t) => t.createdAt.isAfter(weekStart));
    final weekXaf = weekCredits.fold<double>(0, (sum, t) => sum + t.amount);
    final tripCount = weekCredits.where((t) => t.type == 'trip_earning').length;

    String fmt(double v) => '${v.toInt()} XAF';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.greyLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _Stat(label: "Aujourd'hui", value: wallet.isLoading ? '…' : fmt(todayXaf)),
          Container(width: 1, height: 32, color: AppColors.greyBorder),
          _Stat(label: 'Cette semaine', value: wallet.isLoading ? '…' : fmt(weekXaf)),
          Container(width: 1, height: 32, color: AppColors.greyBorder),
          _Stat(label: 'Courses (7j)', value: wallet.isLoading ? '…' : '$tripCount'),
        ],
      ),
    );
  }
}

class _VerificationRequiredView extends StatelessWidget {
  const _VerificationRequiredView({required this.verification});
  final DriverVerification verification;

  @override
  Widget build(BuildContext context) {
    final needsProfile = verification.uploadedDocumentTypes.isEmpty;
    final needsMoreDocs = !needsProfile &&
        verification.uploadedDocumentTypes.length < verification.totalDocsRequired;
    final isRejected = verification.status == DriverVerificationStatus.rejected;
    final awaitingReview = !needsProfile && !needsMoreDocs && !isRejected;

    final String title;
    final String subtitle;
    final IconData icon;
    final Color color;
    if (isRejected) {
      title = 'Dossier refusé';
      subtitle = 'Un ou plusieurs documents ont été refusés. Merci de les renvoyer.';
      icon = Iconsax.close_circle_copy;
      color = AppColors.error;
    } else if (awaitingReview) {
      title = 'Dossier en cours de vérification';
      subtitle = 'Votre dossier est complet. Nous le vérifions sous 24 à 48h — vous pourrez ensuite passer en ligne.';
      icon = Iconsax.clock_copy;
      color = AppColors.warning;
    } else if (needsMoreDocs) {
      title = 'Complétez vos documents';
      subtitle = 'Il manque encore des documents pour activer votre compte chauffeur.';
      icon = Iconsax.document_copy;
      color = DriverColors.primary;
    } else {
      title = 'Bienvenue chez HelloDriver';
      subtitle = 'Complétez votre profil chauffeur pour commencer à recevoir des courses.';
      icon = Iconsax.car_copy;
      color = DriverColors.primary;
    }

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (awaitingReview)
                HdPulseLoader(icon: icon, color: color, size: 88)
              else
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
                  child: Icon(icon, color: color, size: 40),
                ),
              const SizedBox(height: 24),
              Text(title, style: AppTextStyles.h2, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(subtitle, style: AppTextStyles.body.copyWith(color: AppColors.grey), textAlign: TextAlign.center),
              const SizedBox(height: 32),
              if (!awaitingReview)
                HdButton(
                  label: needsProfile ? 'Compléter mon profil' : 'Ajouter mes documents',
                  accentColor: DriverColors.primary,
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => needsProfile
                          ? const DriverVehicleInfoScreen()
                          : const DriverDocumentsScreen(),
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

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700)),
        Text(label,
            style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
      ],
    );
  }
}
