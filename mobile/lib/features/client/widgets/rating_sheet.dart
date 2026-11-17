import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/models/trip_model.dart';
import '../../../core/providers/trip_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/hd_button.dart';

class RatingSheet extends ConsumerStatefulWidget {
  const RatingSheet({super.key, required this.trip});
  final TripModel trip;

  @override
  ConsumerState<RatingSheet> createState() => _RatingSheetState();
}

class _RatingSheetState extends ConsumerState<RatingSheet> {
  int _rating = 0;
  final _commentCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0 || _submitting) return;
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post<void>(
        '/trips/${widget.trip.id}/rate',
        data: {
          'rating': _rating,
          if (_commentCtrl.text.trim().isNotEmpty)
            'comment': _commentCtrl.text.trim(),
        },
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      ref.read(tripProvider.notifier).reset();
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data?['error']?['message'] ?? 'Erreur inattendue';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg)),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(24, 12, 24, 32 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.greyBorder,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 24),

          // Driver avatar
          if (widget.trip.driverAvatarUrl != null)
            CircleAvatar(
              radius: 36,
              backgroundImage: CachedNetworkImageProvider(widget.trip.driverAvatarUrl!),
            )
          else
            CircleAvatar(
              radius: 36,
              backgroundColor: AppColors.primaryLight,
              child: const Icon(Icons.person_rounded,
                  color: AppColors.primary, size: 32),
            ),
          const SizedBox(height: 12),

          Text(
            'Comment était ${widget.trip.driverName ?? 'votre chauffeur'} ?',
            style: AppTextStyles.h3,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            widget.trip.vehicleModel != null
                ? '${widget.trip.vehicleModel} · ${widget.trip.vehiclePlate ?? ''}'
                : '',
            style: AppTextStyles.caption.copyWith(color: AppColors.grey),
          ),
          const SizedBox(height: 24),

          // Stars
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final filled = i < _rating;
              return GestureDetector(
                onTap: () => setState(() => _rating = i + 1),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Icon(
                    filled ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: filled ? Colors.amber : AppColors.greyBorder,
                    size: 44,
                  ),
                ),
              );
            }),
          ),

          // Star label
          if (_rating > 0) ...[
            const SizedBox(height: 8),
            Text(
              _ratingLabel(_rating),
              style: AppTextStyles.body.copyWith(
                color: Colors.amber[700],
                fontWeight: FontWeight.w600,
              ),
            ),
          ],

          const SizedBox(height: 20),

          // Optional comment
          TextFormField(
            controller: _commentCtrl,
            decoration: const InputDecoration(
              hintText: 'Laisser un commentaire (optionnel)',
              prefixIcon: Icon(Icons.edit_note_rounded),
            ),
            maxLines: 2,
            maxLength: 500,
          ),

          const SizedBox(height: 20),

          HdButton(
            label: 'Envoyer l\'évaluation',
            isLoading: _submitting,
            onPressed: _rating > 0 ? _submit : null,
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              ref.read(tripProvider.notifier).reset();
            },
            child: Text(
              'Passer',
              style: AppTextStyles.body.copyWith(color: AppColors.grey),
            ),
          ),
        ],
      ),
    );
  }

  String _ratingLabel(int r) => switch (r) {
        1 => 'Très mauvais',
        2 => 'Mauvais',
        3 => 'Correct',
        4 => 'Bien',
        5 => 'Excellent !',
        _ => '',
      };
}
