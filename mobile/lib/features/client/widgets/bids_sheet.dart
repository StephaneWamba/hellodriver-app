import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/trip_model.dart';
import '../../../core/providers/trip_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/hd_button.dart';
import 'payment_method_picker_sheet.dart';

class BidsSheet extends ConsumerWidget {
  const BidsSheet({super.key, required this.bids, required this.tripId});

  final List<BidModel> bids;
  final String tripId;

  Future<void> _chooseBid(BuildContext context, WidgetRef ref, BidModel bid) async {
    // Sheet resolves to: null (dismissed, do nothing), the `walletChoice`
    // sentinel (pay from Hello Money), or a mobile money method uuid.
    final choice = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PaymentMethodPickerSheet(fareXaf: bid.amountXaf),
    );
    if (choice == null || !context.mounted) return;
    await ref.read(tripProvider.notifier).acceptBid(
          tripId,
          bid.id,
          paymentMethodId: choice == PaymentMethodPickerSheet.walletChoice ? null : choice,
        );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLoading = ref.watch(tripProvider).isLoading;
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
          Row(
            children: [
              Text('Offres disponibles', style: AppTextStyles.h3),
              const Spacer(),
              Text('${bids.length} chauffeur${bids.length > 1 ? 's' : ''}',
                  style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
            ],
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 280),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: bids.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _BidCard(
                bid: bids[i],
                disabled: isLoading,
                onAccept: () => _chooseBid(context, ref, bids[i]),
              ),
            ),
          ),
          const SizedBox(height: 12),
          HdButton(
            label: 'Annuler la recherche',
            variant: HdButtonVariant.outline,
            onPressed: () => ref.read(tripProvider.notifier).cancelTrip(tripId),
          ),
        ],
      ),
    );
  }
}

class _BidCard extends StatelessWidget {
  const _BidCard({required this.bid, required this.onAccept, this.disabled = false});

  final BidModel bid;
  final VoidCallback onAccept;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.greyLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.greyBorder),
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primaryLight,
            ),
            child: bid.driverAvatarUrl != null
                ? ClipOval(child: CachedNetworkImage(imageUrl: bid.driverAvatarUrl!, fit: BoxFit.cover))
                : const Icon(Icons.person_rounded, color: AppColors.primary, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(bid.driverName ?? '—', style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.star_rounded, color: Colors.amber, size: 14),
                    const SizedBox(width: 2),
                    Text(
                      bid.driverRating?.toStringAsFixed(1) ?? '—',
                      style: AppTextStyles.caption,
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.access_time_rounded, color: AppColors.grey, size: 14),
                    const SizedBox(width: 2),
                    Text('${bid.etaMinutes} min', style: AppTextStyles.caption),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${bid.amountXaf} XAF',
                style: AppTextStyles.price,
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: 32,
                child: ElevatedButton(
                  onPressed: disabled ? null : onAccept,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: Size.zero,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text('Choisir', style: AppTextStyles.caption.copyWith(color: AppColors.white)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
