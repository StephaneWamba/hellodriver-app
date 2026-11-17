import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../api/api_client.dart';
import '../env.dart';
import '../models/trip_model.dart';
import '../providers/driver_location_provider.dart';
import '../providers/trip_provider.dart';

const _serverUrl = Env.apiBaseUrl;

class SocketService {
  SocketService(this._ref);

  final Ref _ref;
  io.Socket? _socket;

  bool get isConnected => _socket != null;

  Future<void> connect() async {
    // Guard: skip only if a socket exists AND is actively connected/connecting.
    // A non-null but disconnected socket (spontaneous server disconnect) should
    // be torn down and replaced.
    if (_socket != null && _socket!.connected) return;
    if (_socket != null) {
      _socket!.clearListeners();
      _socket!.dispose();
      _socket = null;
    }

    final token = await _ref.read(apiClientProvider).getToken();
    if (token == null) return;

    _socket = io.io(
      _serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );

    _socket!
      ..on('new_bid', _onNewBid)
      ..on('trip_updated', _onTripUpdated)
      ..on('driver_location', _onDriverLocation)
      ..on('new_trip_request', _onNewTripRequest)
      ..connect();
  }

  void disconnect() {
    // Clear all listeners before disposing so callbacks from a dead socket
    // never fire and mutate shared provider state.
    _socket?.clearListeners();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void emit(String event, dynamic data) => _socket?.emit(event, data);

  /// Joins the room the backend uses to broadcast bid/status/payment events
  /// for this trip (`trip:<id>`). Without this, those events are emitted
  /// server-side but never reach this socket.
  void joinTrip(String tripId) => _socket?.emit('join:trip', tripId);

  void _onNewBid(dynamic data) {
    try {
      final bid = BidModel.fromJson(Map<String, dynamic>.from(data as Map));
      _ref.read(tripProvider.notifier).addBid(bid);
    } catch (_) {}
  }

  void _onTripUpdated(dynamic data) {
    try {
      _ref
          .read(tripProvider.notifier)
          .updateTripFromSocket(Map<String, dynamic>.from(data as Map));
    } catch (_) {}
  }

  void _onDriverLocation(dynamic data) {
    try {
      final map = Map<String, dynamic>.from(data as Map);
      final lat = (map['latitude'] as num?)?.toDouble();
      final lng = (map['longitude'] as num?)?.toDouble();
      if (lat != null && lng != null) {
        _ref.read(driverLiveLocationProvider.notifier).update(lat, lng);
      }
    } catch (_) {}
  }

  void _onNewTripRequest(dynamic data) {
    try {
      final payload = Map<String, dynamic>.from(data as Map);
      _ref.read(pendingTripRequestProvider.notifier).set(payload);
    } catch (_) {}
  }
}

// Holds an incoming trip request for the driver to accept/refuse
final pendingTripRequestProvider =
    NotifierProvider<_PendingTripNotifier, Map<String, dynamic>?>(
        _PendingTripNotifier.new);

class _PendingTripNotifier extends Notifier<Map<String, dynamic>?> {
  @override
  Map<String, dynamic>? build() => null;

  void set(Map<String, dynamic>? data) => state = data;
}

final socketServiceProvider = Provider<SocketService>((ref) {
  final service = SocketService(ref);
  ref.onDispose(service.disconnect);
  return service;
});
