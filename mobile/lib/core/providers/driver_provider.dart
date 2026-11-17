import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../services/socket_service.dart';

/// Verification status returned by GET /drivers/verification-status.
enum DriverVerificationStatus { pending, approved, rejected }

class DriverVerification {
  const DriverVerification({
    required this.status,
    required this.isVerified,
    required this.verifiedDocsCount,
    required this.totalDocsRequired,
    this.uploadedDocumentTypes = const [],
  });

  final DriverVerificationStatus status;
  final bool isVerified;
  final int verifiedDocsCount;
  final int totalDocsRequired;
  final List<String> uploadedDocumentTypes;

  factory DriverVerification.fromJson(Map<String, dynamic> json) {
    final status = switch (json['verificationStatus'] as String? ?? 'pending') {
      'approved' => DriverVerificationStatus.approved,
      'rejected' => DriverVerificationStatus.rejected,
      _ => DriverVerificationStatus.pending,
    };
    final docs = (json['documents'] as List<dynamic>?) ?? [];
    return DriverVerification(
      status: status,
      isVerified: json['isVerified'] as bool? ?? false,
      verifiedDocsCount: json['verifiedDocsCount'] as int? ?? 0,
      totalDocsRequired: json['totalDocsRequired'] as int? ?? 3,
      uploadedDocumentTypes: docs
          .map((d) => (d as Map<String, dynamic>)['documentType'] as String? ?? '')
          .where((s) => s.isNotEmpty)
          .toList(),
    );
  }
}

class DriverState {
  const DriverState({
    this.isOnline = false,
    this.isLoading = false,
    this.error,
    this.earnings,
    this.verification,
    this.isSubmittingProfile = false,
    this.isUploadingDocument = false,
  });

  final bool isOnline;
  final bool isLoading;
  final String? error;
  final Map<String, dynamic>? earnings;
  final DriverVerification? verification;
  final bool isSubmittingProfile;
  final bool isUploadingDocument;

  DriverState copyWith({
    bool? isOnline,
    bool? isLoading,
    String? error,
    Map<String, dynamic>? earnings,
    DriverVerification? verification,
    bool? isSubmittingProfile,
    bool? isUploadingDocument,
    bool clearError = false,
  }) =>
      DriverState(
        isOnline: isOnline ?? this.isOnline,
        isLoading: isLoading ?? this.isLoading,
        error: clearError ? null : error ?? this.error,
        earnings: earnings ?? this.earnings,
        verification: verification ?? this.verification,
        isSubmittingProfile: isSubmittingProfile ?? this.isSubmittingProfile,
        isUploadingDocument: isUploadingDocument ?? this.isUploadingDocument,
      );
}

class DriverNotifier extends Notifier<DriverState> {
  @override
  DriverState build() => const DriverState();

  ApiClient get _api => ref.read(apiClientProvider);

  Future<void> toggleOnline() async {
    if (state.isLoading) return;
    final previousOnline = state.isOnline;
    final targetOnline = !previousOnline;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final res = await _api.patch<Map<String, dynamic>>(
        '/drivers/toggle-online',
        data: {'isOnline': targetOnline},
      );
      final payload = res.data!;
      final inner = payload['data'] as Map<String, dynamic>? ?? payload;
      final isOnline = inner['isOnline'] as bool? ?? targetOnline;
      state = state.copyWith(isOnline: isOnline, isLoading: false);
    } catch (e) {
      // Rollback to previous online state on failure
      state = state.copyWith(isOnline: previousOnline, isLoading: false, error: _extractError(e));
    }
  }

  Future<void> updateLocation(double lat, double lng) async {
    try {
      await _api.post<dynamic>('/drivers/location', data: {'latitude': lat, 'longitude': lng});
    } catch (_) {}
  }

  Future<void> fetchVerificationStatus() async {
    try {
      final res = await _api.get<Map<String, dynamic>>('/drivers/verification-status');
      state = state.copyWith(verification: DriverVerification.fromJson(res.data!));
    } catch (_) {}
  }

  Future<void> submitVehicleProfile({
    required String dateOfBirth,
    required String vehicleBrand,
    required String vehicleModel,
    required int vehicleYear,
    required String vehicleRegistration,
    required String residentialArea,
    required bool hasAc,
    required String mobileMoneyAccount,
  }) async {
    state = state.copyWith(isSubmittingProfile: true, clearError: true);
    try {
      await _api.post<dynamic>('/drivers/profile', data: {
        'dateOfBirth': dateOfBirth,
        'vehicleBrand': vehicleBrand,
        'vehicleModel': vehicleModel,
        'vehicleYear': vehicleYear,
        'vehicleRegistration': vehicleRegistration,
        'residentialArea': residentialArea,
        'hasAc': hasAc,
        'mobileMoneyAccount': mobileMoneyAccount,
      });
      state = state.copyWith(isSubmittingProfile: false);
      await fetchVerificationStatus();
    } catch (e) {
      state = state.copyWith(isSubmittingProfile: false, error: _extractError(e));
      rethrow;
    }
  }

  Future<void> uploadDocument(String documentType, File file) async {
    state = state.copyWith(isUploadingDocument: true, clearError: true);
    try {
      final ext = file.path.split('.').last.toLowerCase();
      final mimeType = switch (ext) {
        'png' => 'image/png',
        'webp' => 'image/webp',
        'pdf' => 'application/pdf',
        _ => 'image/jpeg',
      };
      await _api.uploadFile<dynamic>(
        '/drivers/documents/upload',
        file,
        mimeType,
        fields: {'documentType': documentType},
      );
      state = state.copyWith(isUploadingDocument: false);
      await fetchVerificationStatus();
    } catch (e) {
      state = state.copyWith(isUploadingDocument: false, error: _extractError(e));
      rethrow;
    }
  }

  Future<void> acceptTrip(String tripId, {required int amountXaf, required int etaMinutes}) async {
    if (state.isLoading) return;
    state = state.copyWith(isLoading: true);
    try {
      await _api.post<dynamic>(
        '/trips/$tripId/bid',
        data: {'amountXaf': amountXaf, 'etaMinutes': etaMinutes},
      );
      state = state.copyWith(isLoading: false);
      // Join the trip room so a later status change (bid accepted/rejected,
      // client cancels) reaches this socket.
      ref.read(socketServiceProvider).joinTrip(tripId);
      // Clear pending request so the modal cannot re-appear on reconnect
      ref.read(pendingTripRequestProvider.notifier).set(null);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
    }
  }

  String _extractError(Object e) {
    try {
      // ignore: avoid_dynamic_calls
      final msg = (e as dynamic).response?.data?['message'];
      if (msg is String) return msg;
    } catch (_) {}
    return 'Une erreur est survenue';
  }
}

final driverProvider = NotifierProvider<DriverNotifier, DriverState>(DriverNotifier.new);
