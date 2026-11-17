import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/driver_location_provider.dart';
import '../../../core/providers/trip_provider.dart';
import '../../../core/services/socket_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/hd_button.dart';
import '../../../shared/widgets/hd_logo.dart';
import '../../../core/providers/wallet_provider.dart';
import '../../../shared/widgets/hd_pulse_loader.dart';
import '../../../shared/widgets/hd_success_check.dart';
import '../../shell/main_shell.dart';
import '../widgets/address_search_sheet.dart';
import '../widgets/bids_sheet.dart';
import '../widgets/rating_sheet.dart';
import '../widgets/trip_status_sheet.dart';

// Libreville, Gabon
const _librevilleCenter = LatLng(0.4162, 9.4673);

class ClientHomeScreen extends ConsumerStatefulWidget {
  const ClientHomeScreen({super.key});

  @override
  ConsumerState<ClientHomeScreen> createState() => _ClientHomeScreenState();
}

class _ClientHomeScreenState extends ConsumerState<ClientHomeScreen> {
  GoogleMapController? _mapController;
  final Set<Marker> _markers = {};
  final Set<Polyline> _polylines = {};
  Timer? _searchTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(socketServiceProvider).connect();
    });
  }

  @override
  void dispose() {
    _searchTimer?.cancel();
    super.dispose();
  }

  // Decode a Google encoded polyline string into a list of LatLng points.
  List<LatLng> _decodePolyline(String encoded) {
    final List<LatLng> points = [];
    int index = 0;
    int lat = 0;
    int lng = 0;

    while (index < encoded.length) {
      int shift = 0;
      int result = 0;
      int b;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      final dlat = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      final dlng = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      points.add(LatLng(lat / 1e5, lng / 1e5));
    }
    return points;
  }

  Future<void> _fetchRoutePolyline({
    required double originLat,
    required double originLng,
    required double destLat,
    required double destLng,
  }) async {
    try {
      final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
        '/places/directions',
        params: {
          'originLat': originLat,
          'originLng': originLng,
          'destLat': destLat,
          'destLng': destLng,
        },
      );
      final routes = res.data?['routes'] as List<dynamic>?;
      if (routes == null || routes.isEmpty) return;

      final encoded =
          routes.first['overview_polyline']?['points'] as String?;
      if (encoded == null || encoded.isEmpty) return;

      final points = _decodePolyline(encoded);
      if (!mounted) return;

      setState(() {
        _polylines
          ..removeWhere((p) => p.polylineId.value == 'route')
          ..add(Polyline(
            polylineId: const PolylineId('route'),
            points: points,
            color: AppColors.primary,
            width: 4,
            patterns: [],
          ));
      });

      // Fit camera to show full route
      if (points.isNotEmpty && _mapController != null) {
        double minLat = points.first.latitude;
        double maxLat = points.first.latitude;
        double minLng = points.first.longitude;
        double maxLng = points.first.longitude;
        for (final p in points) {
          if (p.latitude < minLat) minLat = p.latitude;
          if (p.latitude > maxLat) maxLat = p.latitude;
          if (p.longitude < minLng) minLng = p.longitude;
          if (p.longitude > maxLng) maxLng = p.longitude;
        }
        _mapController!.animateCamera(
          CameraUpdate.newLatLngBounds(
            LatLngBounds(
              southwest: LatLng(minLat, minLng),
              northeast: LatLng(maxLat, maxLng),
            ),
            72,
          ),
        );
      }
    } catch (_) {
      // Silently ignore — map still works without polyline
    }
  }

  void _clearPolyline() {
    setState(() => _polylines.removeWhere((p) => p.polylineId.value == 'route'));
  }

  void _onTripStateChanged(TripState? prev, TripState next) {
    final wasSearching = prev?.phase == TripPhase.searching;
    final isSearching = next.phase == TripPhase.searching;

    if (!wasSearching && isSearching) {
      _searchTimer = Timer(const Duration(seconds: 30), () {
        if (!mounted) return;
        if (ref.read(tripProvider).phase == TripPhase.searching) {
          ref.read(tripProvider.notifier).reset();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Aucun chauffeur disponible. Réessayez dans quelques minutes.'),
              duration: Duration(seconds: 4),
            ),
          );
        }
      });
    } else if (wasSearching && !isSearching) {
      _searchTimer?.cancel();
      _searchTimer = null;
    }

    // Bid accepted → draw route polyline
    if (prev?.phase != TripPhase.accepted && next.phase == TripPhase.accepted) {
      final trip = next.activeTrip;
      if (trip != null) {
        _fetchRoutePolyline(
          originLat: trip.originLatitude,
          originLng: trip.originLongitude,
          destLat: trip.destinationLatitude,
          destLng: trip.destinationLongitude,
        );
      }
    }

    // Trip ended → clear polyline
    if (next.phase == TripPhase.completed ||
        next.phase == TripPhase.cancelled ||
        next.phase == TripPhase.idle) {
      _clearPolyline();
    }

    // Trip just completed → refresh wallet then open rating sheet
    if (prev?.phase != TripPhase.completed && next.phase == TripPhase.completed) {
      ref.read(walletProvider.notifier).refresh();
      if (next.activeTrip != null && mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            isDismissible: false,
            builder: (_) => RatingSheet(trip: next.activeTrip!),
          );
        });
      }
    }
  }

  void _updateDriverMarker(LatLng? pos) {
    if (pos == null) {
      setState(() => _markers.removeWhere((m) => m.markerId.value == 'driver'));
      return;
    }
    setState(() {
      _markers
        ..removeWhere((m) => m.markerId.value == 'driver')
        ..add(Marker(
          markerId: const MarkerId('driver'),
          position: pos,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: const InfoWindow(title: 'Votre chauffeur'),
        ));
    });
    _mapController?.animateCamera(CameraUpdate.newLatLng(pos));
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<TripState>(tripProvider, _onTripStateChanged);
    ref.listen<LatLng?>(driverLiveLocationProvider, (_, pos) => _updateDriverMarker(pos));
    final tripState = ref.watch(tripProvider);
    final user = ref.watch(authProvider).user;

    return Scaffold(
      body: Stack(
        children: [
          // Map
          GoogleMap(
            initialCameraPosition: const CameraPosition(
              target: _librevilleCenter,
              zoom: 13,
            ),
            onMapCreated: (c) => _mapController = c,
            markers: _markers,
            polylines: _polylines,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
          ),

          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const HdLogo(size: 40),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Bonjour 👋', style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
                        Text(
                          user?.name ?? user?.phone ?? '',
                          style: AppTextStyles.h3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  _ProfileButton(user?.avatarUrl),
                ],
              ),
            ),
          ),

          // Bottom content — depends on trip phase
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _buildBottomContent(tripState),
          ),

          // My location FAB
          Positioned(
            right: 16,
            bottom: _bottomContentHeight(tripState) + 16,
            child: FloatingActionButton.small(
              onPressed: () => _mapController?.animateCamera(
                CameraUpdate.newLatLng(_librevilleCenter),
              ),
              backgroundColor: AppColors.white,
              foregroundColor: AppColors.dark,
              elevation: 4,
              child: const Icon(Icons.my_location_rounded),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomContent(TripState tripState) {
    switch (tripState.phase) {
      case TripPhase.idle:
        return _IdleSheet(onSearchTap: _openSearch);
      case TripPhase.searching:
        return const _SearchingSheet();
      case TripPhase.selectingBid:
        return BidsSheet(
          bids: tripState.bids,
          tripId: tripState.activeTrip?.id ?? '',
        );
      case TripPhase.accepted:
      case TripPhase.driverArrived:
      case TripPhase.inProgress:
        if (tripState.activeTrip == null) return const _SearchingSheet();
        return TripStatusSheet(trip: tripState.activeTrip!);
      case TripPhase.completed:
        if (tripState.activeTrip == null) return const SizedBox.shrink();
        return _CompletedSheet(trip: tripState.activeTrip!);
      case TripPhase.cancelled:
        return _CancelledSheet(onDismiss: () => ref.read(tripProvider.notifier).reset());
    }
  }

  double _bottomContentHeight(TripState tripState) {
    switch (tripState.phase) {
      case TripPhase.idle:
        return 160;
      case TripPhase.searching:
        return 120;
      case TripPhase.selectingBid:
        return 300;
      default:
        return 200;
    }
  }

  Future<void> _openSearch() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const AddressSearchSheet(),
    );
  }
}

class _IdleSheet extends StatelessWidget {
  const _IdleSheet({required this.onSearchTap});
  final VoidCallback onSearchTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(color: Color(0x18000000), blurRadius: 24, offset: Offset(0, -4)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 36, height: 4, decoration: BoxDecoration(
            color: AppColors.greyBorder,
            borderRadius: BorderRadius.circular(2),
          )),
          const SizedBox(height: 16),
          Text('Où voulez-vous aller ?', style: AppTextStyles.h3),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: onSearchTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.greyLight,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.greyBorder),
              ),
              child: Row(
                children: [
                  const Icon(Icons.search_rounded, color: AppColors.grey, size: 20),
                  const SizedBox(width: 10),
                  Text('Rechercher une destination',
                      style: AppTextStyles.body.copyWith(color: AppColors.grey)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchingSheet extends StatelessWidget {
  const _SearchingSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(color: Color(0x18000000), blurRadius: 24, offset: Offset(0, -4)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 36, height: 4, decoration: BoxDecoration(
            color: AppColors.greyBorder, borderRadius: BorderRadius.circular(2),
          )),
          const SizedBox(height: 12),
          const HdPulseLoader(icon: Icons.directions_car_rounded, color: AppColors.primary, size: 88),
          const SizedBox(height: 12),
          Text('Recherche de chauffeurs…', style: AppTextStyles.h3),
          const SizedBox(height: 4),
          Text('Veuillez patienter', style: AppTextStyles.body.copyWith(color: AppColors.grey)),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _CompletedSheet extends ConsumerWidget {
  const _CompletedSheet({required this.trip});
  final dynamic trip;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(color: Color(0x18000000), blurRadius: 24, offset: Offset(0, -4)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const HdSuccessCheck(color: AppColors.success),
          const SizedBox(height: 12),
          Text('Course terminée !', style: AppTextStyles.h2),
          const SizedBox(height: 24),
          HdButton(
            label: 'Retour à l\'accueil',
            onPressed: () => ref.read(tripProvider.notifier).reset(),
          ),
        ],
      ),
    );
  }
}

class _CancelledSheet extends StatelessWidget {
  const _CancelledSheet({required this.onDismiss});
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(color: Color(0x18000000), blurRadius: 24, offset: Offset(0, -4)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cancel_rounded, color: AppColors.error, size: 48),
          const SizedBox(height: 12),
          Text('Course annulée', style: AppTextStyles.h2),
          const SizedBox(height: 24),
          HdButton(label: 'Retour à l\'accueil', onPressed: onDismiss),
        ],
      ),
    );
  }
}

class _ProfileButton extends ConsumerWidget {
  const _ProfileButton(this.avatarUrl);
  final String? avatarUrl;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () => ref.read(shellIndexProvider.notifier).setIndex(2),
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.greyLight,
          border: Border.all(color: AppColors.greyBorder),
        ),
        child: avatarUrl != null
            ? ClipOval(child: CachedNetworkImage(imageUrl: avatarUrl!, fit: BoxFit.cover))
            : const Icon(Icons.person_rounded, color: AppColors.grey, size: 22),
      ),
    );
  }
}
