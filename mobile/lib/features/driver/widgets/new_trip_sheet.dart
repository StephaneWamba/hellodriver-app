import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import '../../../core/providers/driver_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/driver_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/hd_button.dart';

class NewTripSheet extends ConsumerStatefulWidget {
  const NewTripSheet({
    super.key,
    required this.tripId,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.estimatedPrice,
    required this.distanceKm,
    required this.onDismiss,
  });

  final String tripId;
  final String pickupAddress;
  final String dropoffAddress;
  final double estimatedPrice;
  final double distanceKm;
  final VoidCallback onDismiss;

  @override
  ConsumerState<NewTripSheet> createState() => _NewTripSheetState();
}

class _NewTripSheetState extends ConsumerState<NewTripSheet> {
  static const int _stepXaf = 500;
  late int _offerXaf;

  @override
  void initState() {
    super.initState();
    // Arrondi au multiple de 500 le plus proche pour un montant propre à ajuster.
    _offerXaf = (widget.estimatedPrice / _stepXaf).round() * _stepXaf;
    if (_offerXaf <= 0) _offerXaf = widget.estimatedPrice.round();
  }

  void _adjust(int delta) {
    HapticFeedback.selectionClick();
    setState(() => _offerXaf = (_offerXaf + delta).clamp(_stepXaf, 500000));
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(driverProvider).isLoading;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(color: Color(0x28000000), blurRadius: 32, offset: Offset(0, -8)),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: DriverColors.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Iconsax.car_copy,
                    color: DriverColors.primary, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Nouvelle course !', style: AppTextStyles.h3),
                    Text('${widget.distanceKm.toStringAsFixed(1)} km · suggéré ${widget.estimatedPrice.toStringAsFixed(0)} XAF',
                        style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _RouteRow(
            icon: Iconsax.record_circle_copy,
            iconColor: DriverColors.primary,
            address: widget.pickupAddress,
          ),
          const SizedBox(height: 6),
          _RouteRow(
            icon: Iconsax.location_copy,
            iconColor: AppColors.error,
            address: widget.dropoffAddress,
          ),
          const SizedBox(height: 20),

          // ── Votre prix ────────────────────────────────────────────────
          Text('Votre offre', style: AppTextStyles.captionMedium),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            decoration: BoxDecoration(
              color: DriverColors.primaryLight,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _StepperButton(
                  icon: Iconsax.minus_copy,
                  onTap: () => _adjust(-_stepXaf),
                ),
                Text('$_offerXaf XAF', style: AppTextStyles.priceLarge.copyWith(color: DriverColors.primary)),
                _StepperButton(
                  icon: Iconsax.add_copy,
                  onTap: () => _adjust(_stepXaf),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: HdButton(
                  label: 'Refuser',
                  variant: HdButtonVariant.outline,
                  accentColor: DriverColors.primary,
                  height: 48,
                  onPressed: widget.onDismiss,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: HdButton(
                  label: 'Proposer',
                  accentColor: DriverColors.primary,
                  height: 48,
                  isLoading: isLoading,
                  onPressed: () async {
                    // Rough ETA from distance — 25 km/h average urban speed,
                    // clamped to the backend's accepted 1-60 min range.
                    final etaMinutes = (widget.distanceKm / 25 * 60).round().clamp(1, 60);
                    await ref.read(driverProvider.notifier).acceptTrip(
                      widget.tripId,
                      amountXaf: _offerXaf,
                      etaMinutes: etaMinutes,
                    );
                    // Only dismiss if the accept succeeded (no error set).
                    if (ref.read(driverProvider).error == null) {
                      widget.onDismiss();
                    }
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.white,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Icon(icon, color: DriverColors.primary, size: 20),
        ),
      ),
    );
  }
}

class _RouteRow extends StatelessWidget {
  const _RouteRow({
    required this.icon,
    required this.iconColor,
    required this.address,
  });

  final IconData icon;
  final Color iconColor;
  final String address;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: iconColor, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Text(address,
              style: AppTextStyles.body, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}
