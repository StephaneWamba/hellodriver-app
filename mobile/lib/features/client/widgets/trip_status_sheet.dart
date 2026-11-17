import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/trip_model.dart';
import '../../../core/providers/trip_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/hd_button.dart';

class TripStatusSheet extends ConsumerWidget {
  const TripStatusSheet({super.key, required this.trip});
  final TripModel trip;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final phase = ref.watch(tripProvider).phase;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
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
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
                color: AppColors.greyBorder, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),

          // Status banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
            decoration: BoxDecoration(
              color: _statusColor(phase).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(_statusIcon(phase), color: _statusColor(phase), size: 20),
                const SizedBox(width: 8),
                Text(_statusLabel(phase),
                    style: AppTextStyles.body.copyWith(
                        color: _statusColor(phase), fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Driver info
          if (trip.driverName != null)
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.primaryLight,
                    border: Border.all(color: AppColors.primary, width: 2),
                  ),
                  child: trip.driverAvatarUrl != null
                      ? ClipOval(
                          child: CachedNetworkImage(imageUrl: trip.driverAvatarUrl!, fit: BoxFit.cover))
                      : const Icon(Icons.person_rounded, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(trip.driverName!,
                          style: AppTextStyles.body
                              .copyWith(fontWeight: FontWeight.w600)),
                      if (trip.vehicleModel != null)
                        Text(
                          '${trip.vehicleModel} · ${trip.vehiclePlate ?? ''}',
                          style: AppTextStyles.caption
                              .copyWith(color: AppColors.grey),
                        ),
                    ],
                  ),
                ),
                if (trip.driverPhone != null)
                  IconButton(
                    onPressed: () async {
                      final uri = Uri(scheme: 'tel', path: trip.driverPhone);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri);
                      }
                    },
                    icon: const Icon(Icons.phone_rounded,
                        color: AppColors.primary, size: 22),
                  ),
                if (trip.driverRating != null)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star_rounded,
                          color: Colors.amber, size: 16),
                      const SizedBox(width: 2),
                      Text(trip.driverRating!.toStringAsFixed(1),
                          style: AppTextStyles.caption),
                    ],
                  ),
              ],
            ),

          const SizedBox(height: 12),

          // Route summary
          _RouteSummary(
              pickup: trip.pickupAddress, dropoff: trip.dropoffAddress),

          if (trip.price != null) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Tarif', style: AppTextStyles.body.copyWith(color: AppColors.grey)),
                Text('${trip.price!.toStringAsFixed(0)} XAF',
                    style: AppTextStyles.price),
              ],
            ),
          ],

          if (phase == TripPhase.accepted) ...[
            const SizedBox(height: 16),
            HdButton(
              label: 'Annuler la course',
              variant: HdButtonVariant.outline,
              height: 44,
              onPressed: () =>
                  ref.read(tripProvider.notifier).cancelTrip(trip.id),
            ),
          ],
        ],
      ),
    );
  }

  Color _statusColor(TripPhase phase) => switch (phase) {
        TripPhase.accepted => AppColors.warning,
        TripPhase.driverArrived => AppColors.primary,
        TripPhase.inProgress => AppColors.secondary,
        _ => AppColors.grey,
      };

  IconData _statusIcon(TripPhase phase) => switch (phase) {
        TripPhase.accepted => Icons.directions_car_rounded,
        TripPhase.driverArrived => Icons.where_to_vote_rounded,
        TripPhase.inProgress => Icons.navigation_rounded,
        _ => Icons.info_rounded,
      };

  String _statusLabel(TripPhase phase) => switch (phase) {
        TripPhase.accepted => 'Le chauffeur arrive…',
        TripPhase.driverArrived => 'Le chauffeur est arrivé !',
        TripPhase.inProgress => 'En route vers la destination',
        TripPhase.completed => 'Course terminée',
        TripPhase.cancelled => 'Course annulée',
        _ => 'En attente…',
      };
}

class _RouteSummary extends StatelessWidget {
  const _RouteSummary({required this.pickup, required this.dropoff});
  final String pickup;
  final String dropoff;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.greyLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.radio_button_checked_rounded,
                  color: AppColors.primary, size: 16),
              const SizedBox(width: 8),
              Expanded(
                  child: Text(pickup,
                      style: AppTextStyles.body, overflow: TextOverflow.ellipsis)),
            ],
          ),
          const Padding(
            padding: EdgeInsets.only(left: 7),
            child: SizedBox(
              height: 16,
              child: VerticalDivider(
                  color: AppColors.greyBorder, width: 1, thickness: 1),
            ),
          ),
          Row(
            children: [
              const Icon(Icons.location_on_rounded,
                  color: AppColors.error, size: 16),
              const SizedBox(width: 8),
              Expanded(
                  child: Text(dropoff,
                      style: AppTextStyles.body, overflow: TextOverflow.ellipsis)),
            ],
          ),
        ],
      ),
    );
  }
}
