class BidModel {
  const BidModel({
    required this.id,
    required this.tripId,
    required this.driverId,
    required this.amountXaf,
    required this.etaMinutes,
    required this.status,
    this.driverName,
    this.driverRating,
    this.driverAvatarUrl,
    this.vehicleModel,
    this.vehiclePlate,
  });

  final String id;
  final String tripId;
  final String driverId;
  final int amountXaf;
  final int etaMinutes;
  final String status; // 'pending' | 'accepted' | 'rejected' | 'expired'
  final String? driverName;
  final double? driverRating;
  final String? driverAvatarUrl;
  final String? vehicleModel;
  final String? vehiclePlate;

  factory BidModel.fromJson(Map<String, dynamic> json) => BidModel(
        id: json['id'] as String,
        tripId: json['tripId'] as String? ?? json['trip_id'] as String? ?? '',
        driverId: json['driverId'] as String? ?? json['driver_id'] as String? ?? '',
        amountXaf: (json['amountXaf'] as num?)?.toInt() ?? 0,
        etaMinutes: (json['etaMinutes'] as num?)?.toInt() ?? 5,
        status: json['status'] as String? ?? 'pending',
        driverName: json['driverName'] as String?,
        driverRating: (json['driverRating'] as num?)?.toDouble(),
        driverAvatarUrl: json['driverAvatarUrl'] as String?,
        vehicleModel: json['vehicleModel'] as String?,
        vehiclePlate: json['vehiclePlate'] as String?,
      );
}

class TripModel {
  const TripModel({
    required this.id,
    required this.status,
    required this.originLatitude,
    required this.originLongitude,
    required this.destinationLatitude,
    required this.destinationLongitude,
    this.originAddress,
    this.destinationAddress,
    this.fareEstimateXaf,
    this.finalFareXaf,
    this.driverId,
    this.driverName,
    this.driverPhone,
    this.driverAvatarUrl,
    this.driverRating,
    this.vehicleModel,
    this.vehiclePlate,
    this.createdAt,
  });

  final String id;
  final String status;
  final double originLatitude;
  final double originLongitude;
  final double destinationLatitude;
  final double destinationLongitude;
  final String? originAddress;
  final String? destinationAddress;
  final int? fareEstimateXaf;
  final int? finalFareXaf;
  final String? driverId;
  final String? driverName;
  final String? driverPhone;
  final String? driverAvatarUrl;
  final double? driverRating;
  final String? vehicleModel;
  final String? vehiclePlate;
  final DateTime? createdAt;

  // Convenience getters for UI
  String get pickupAddress => originAddress ?? '';
  String get dropoffAddress => destinationAddress ?? '';
  double? get price => (finalFareXaf ?? fareEstimateXaf)?.toDouble();

  factory TripModel.fromJson(Map<String, dynamic> json) {
    // Backend wraps bookTrip response as { trip: {...}, fareEstimateXaf, availableDriverCount }
    final tripData = json.containsKey('trip') ? json['trip'] as Map<String, dynamic> : json;
    return TripModel(
      id: tripData['id'] as String? ?? '',
      status: tripData['status'] as String? ?? 'unknown',
      originLatitude: double.tryParse(tripData['originLatitude']?.toString() ?? '') ?? 0,
      originLongitude: double.tryParse(tripData['originLongitude']?.toString() ?? '') ?? 0,
      destinationLatitude: double.tryParse(tripData['destinationLatitude']?.toString() ?? '') ?? 0,
      destinationLongitude: double.tryParse(tripData['destinationLongitude']?.toString() ?? '') ?? 0,
      originAddress: tripData['originAddress'] as String?,
      destinationAddress: tripData['destinationAddress'] as String?,
      fareEstimateXaf: (tripData['fareEstimateXaf'] as num?)?.toInt() ??
          (json['fareEstimateXaf'] as num?)?.toInt(),
      finalFareXaf: (tripData['finalFareXaf'] as num?)?.toInt(),
      driverId: tripData['driverId'] as String?,
      driverName: tripData['driverName'] as String?,
      driverPhone: tripData['driverPhone'] as String?,
      driverAvatarUrl: tripData['driverAvatarUrl'] as String?,
      driverRating: (tripData['driverRating'] as num?)?.toDouble(),
      vehicleModel: tripData['vehicleModel'] as String?,
      vehiclePlate: tripData['vehiclePlate'] as String?,
      createdAt: tripData['createdAt'] != null
          ? DateTime.tryParse(tripData['createdAt'].toString())
          : null,
    );
  }
}
