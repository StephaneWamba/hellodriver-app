import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

final driverLiveLocationProvider = NotifierProvider<_DriverLiveLocationNotifier, LatLng?>(
  _DriverLiveLocationNotifier.new,
);

class _DriverLiveLocationNotifier extends Notifier<LatLng?> {
  @override
  LatLng? build() => null;

  void update(double lat, double lng) => state = LatLng(lat, lng);
  void clear() => state = null;
}
