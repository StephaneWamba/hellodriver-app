import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/trip_model.dart';
import '../services/socket_service.dart';

enum TripPhase {
  idle,
  searching,
  selectingBid,
  accepted,
  driverArrived,
  inProgress,
  completed,
  cancelled,
}

class TripState {
  const TripState({
    this.activeTrip,
    this.bids = const [],
    this.isLoading = false,
    this.error,
    this.phase = TripPhase.idle,
  });

  final TripModel? activeTrip;
  final List<BidModel> bids;
  final bool isLoading;
  final String? error;
  final TripPhase phase;

  TripState copyWith({
    TripModel? activeTrip,
    List<BidModel>? bids,
    bool? isLoading,
    String? error,
    TripPhase? phase,
    bool clearTrip = false,
    bool clearError = false,
  }) =>
      TripState(
        activeTrip: clearTrip ? null : activeTrip ?? this.activeTrip,
        bids: bids ?? this.bids,
        isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : error ?? this.error,
        phase: phase ?? this.phase,
      );
}

class TripNotifier extends Notifier<TripState> {
  @override
  TripState build() => const TripState();

  ApiClient get _api => ref.read(apiClientProvider);

  Future<TripModel> bookTrip({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required String pickupAddress,
    required String dropoffAddress,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true, phase: TripPhase.searching);
    try {
      final res = await _api.post<Map<String, dynamic>>(
        '/trips/book',
        data: {
          'originLatitude': pickupLat,
          'originLongitude': pickupLng,
          'destinationLatitude': dropoffLat,
          'destinationLongitude': dropoffLng,
          'originAddress': pickupAddress,
          'destinationAddress': dropoffAddress,
          'tripType': 'exclusive',
        },
      );
      final trip = TripModel.fromJson(res.data!);
      state = state.copyWith(activeTrip: trip, isLoading: false);
      ref.read(socketServiceProvider).joinTrip(trip.id);
      return trip;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        phase: TripPhase.idle,
        error: _extractError(e),
      );
      rethrow;
    }
  }

  Future<void> acceptBid(String tripId, String bidId, {String? paymentMethodId}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final res = await _api.patch<Map<String, dynamic>>(
        '/trips/$tripId/accept-bid',
        data: {'bidId': bidId, 'paymentMethodId': paymentMethodId},
      );
      state = state.copyWith(
        activeTrip: TripModel.fromJson(res.data!),
        isLoading: false,
        phase: TripPhase.accepted,
        bids: [],
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      rethrow;
    }
  }

  Future<void> cancelTrip(String tripId) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _api.patch<dynamic>(
        '/trips/$tripId/status',
        data: {'status': 'cancelled_by_client'},
      );
      state = state.copyWith(
        isLoading: false,
        phase: TripPhase.cancelled,
        bids: [],
        clearTrip: true,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      rethrow;
    }
  }

  void addBid(BidModel bid) {
    state = state.copyWith(
      bids: [...state.bids, bid],
      phase: TripPhase.selectingBid,
    );
  }

  void updateTripFromSocket(Map<String, dynamic> data) {
    final trip = TripModel.fromJson(data);
    final phase = _phaseFromStatus(trip.status);
    // Clear stale bids when transitioning away from bid-selection phase
    final clearBids = phase != TripPhase.selectingBid && state.bids.isNotEmpty;
    state = state.copyWith(
      activeTrip: trip,
      phase: phase,
      bids: clearBids ? [] : null,
    );
  }

  TripPhase _phaseFromStatus(String status) => switch (status) {
        'pending_bids' => TripPhase.searching,
        'bid_accepted' => TripPhase.accepted,
        'driver_en_route' => TripPhase.accepted,
        'driver_arrived' => TripPhase.driverArrived,
        'in_transit' => TripPhase.inProgress,
        'completed' || 'rated' => TripPhase.completed,
        'cancelled_by_client' ||
        'cancelled_by_driver' ||
        'no_bids' ||
        'expired' =>
          TripPhase.cancelled,
        _ => state.phase,
      };

  void reset() => state = const TripState();

  String _extractError(Object e) {
    try {
      // ignore: avoid_dynamic_calls
      final msg = (e as dynamic).response?.data?['message'];
      if (msg is String) return msg;
    } catch (_) {}
    return 'Une erreur est survenue';
  }
}

final tripProvider = NotifierProvider<TripNotifier, TripState>(TripNotifier.new);
