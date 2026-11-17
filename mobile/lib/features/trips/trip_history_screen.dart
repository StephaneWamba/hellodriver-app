import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/theme/driver_colors.dart';
import '../../core/providers/app_mode_provider.dart';

// ── Provider ────────────────────────────────────────────────────────────────

class _TripSummary {
  const _TripSummary({
    required this.id,
    required this.status,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.fareXaf,
    required this.createdAt,
    this.rating,
    this.driverName,
    this.clientName,
  });

  final String id;
  final String status;
  final String pickupAddress;
  final String dropoffAddress;
  final int fareXaf;
  final DateTime createdAt;
  final int? rating;
  final String? driverName;
  final String? clientName;

  factory _TripSummary.fromJson(Map<String, dynamic> j) => _TripSummary(
        id: j['id'] as String,
        status: j['status'] as String,
        pickupAddress: j['originAddress'] as String? ?? '—',
        dropoffAddress: j['destinationAddress'] as String? ?? '—',
        fareXaf: (j['finalFareXaf'] ?? j['fareEstimateXaf'] ?? 0) as int,
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
        rating: j['clientRating'] as int?,
        driverName: (j['driver'] as Map<String, dynamic>?)?['firstName'] as String?,
        clientName: (j['client'] as Map<String, dynamic>?)?['firstName'] as String?,
      );
}

final _historyProvider = FutureProvider.autoDispose<List<_TripSummary>>((ref) async {
  final api = ref.read(apiClientProvider);
  final res = await api.get<Map<String, dynamic>>('/trips/history');
  final list = (res.data?['trips'] as List<dynamic>?) ?? [];
  return list
      .map((e) => _TripSummary.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Screen ───────────────────────────────────────────────────────────────────

class TripHistoryScreen extends ConsumerWidget {
  const TripHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(appModeProvider);
    final isDriverMode = mode == AppMode.driver;
    final primary = isDriverMode ? DriverColors.primary : AppColors.primary;

    final historyAsync = ref.watch(_historyProvider);

    return Scaffold(
      backgroundColor: AppColors.greyLight,
      appBar: AppBar(
        title: const Text('Historique des courses'),
        backgroundColor: AppColors.white,
      ),
      body: historyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  size: 48, color: AppColors.grey),
              const SizedBox(height: 12),
              Text('Impossible de charger l\'historique',
                  style: AppTextStyles.body.copyWith(color: AppColors.grey)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(_historyProvider),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
        data: (trips) {
          if (trips.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isDriverMode
                        ? Icons.directions_car_outlined
                        : Icons.history_rounded,
                    size: 64,
                    color: AppColors.greyBorder,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    isDriverMode
                        ? 'Aucune course effectuée'
                        : 'Aucune course pour le moment',
                    style:
                        AppTextStyles.body.copyWith(color: AppColors.grey),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: primary,
            onRefresh: () async => ref.invalidate(_historyProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: trips.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (_, i) =>
                  _TripCard(trip: trips[i], isDriverMode: isDriverMode),
            ),
          );
        },
      ),
    );
  }
}

class _TripCard extends StatelessWidget {
  const _TripCard({required this.trip, required this.isDriverMode});
  final _TripSummary trip;
  final bool isDriverMode;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd MMM yyyy · HH:mm', 'fr_FR');
    final isCompleted =
        trip.status == 'completed' || trip.status == 'rated';
    final isCancelled = trip.status.contains('cancelled');

    Color statusColor = isCompleted
        ? AppColors.success
        : isCancelled
            ? AppColors.error
            : AppColors.warning;

    String statusLabel = switch (trip.status) {
      'completed' || 'rated' => 'Terminée',
      'cancelled_by_client' => 'Annulée par vous',
      'cancelled_by_driver' => 'Annulée par le chauffeur',
      'no_bids' => 'Aucun chauffeur',
      'expired' => 'Expirée',
      _ => 'En cours',
    };

    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
              color: Color(0x08000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: date + status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  fmt.format(trip.createdAt.toLocal()),
                  style:
                      AppTextStyles.caption.copyWith(color: AppColors.grey),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    statusLabel,
                    style: AppTextStyles.caption.copyWith(
                        color: statusColor, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Route
            Row(
              children: [
                const Icon(Icons.radio_button_checked_rounded,
                    color: AppColors.primary, size: 14),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(trip.pickupAddress,
                      style: AppTextStyles.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(left: 6),
              child: Container(
                  width: 1, height: 12, color: AppColors.greyBorder),
            ),
            Row(
              children: [
                const Icon(Icons.location_on_rounded,
                    color: AppColors.error, size: 14),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(trip.dropoffAddress,
                      style: AppTextStyles.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Footer: fare + rating + driver/client name
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  trip.fareXaf > 0
                      ? '${trip.fareXaf.toStringAsFixed(0)} XAF'
                      : '—',
                  style: AppTextStyles.body
                      .copyWith(fontWeight: FontWeight.w700),
                ),
                Row(
                  children: [
                    if (!isDriverMode && trip.rating != null) ...[
                      const Icon(Icons.star_rounded,
                          color: Colors.amber, size: 14),
                      const SizedBox(width: 2),
                      Text('${trip.rating}',
                          style: AppTextStyles.caption.copyWith(
                              fontWeight: FontWeight.w600)),
                      const SizedBox(width: 8),
                    ],
                    if (isDriverMode && trip.clientName != null)
                      Text(
                        trip.clientName!,
                        style: AppTextStyles.caption
                            .copyWith(color: AppColors.grey),
                      )
                    else if (!isDriverMode && trip.driverName != null)
                      Text(
                        trip.driverName!,
                        style: AppTextStyles.caption
                            .copyWith(color: AppColors.grey),
                      ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
