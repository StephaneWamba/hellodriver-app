import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/trip_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/hd_button.dart';

class _Place {
  const _Place(this.name, this.placeId, this.lat, this.lng);
  final String name;
  final String placeId;
  final double lat;
  final double lng;
}

class AddressSearchSheet extends ConsumerStatefulWidget {
  const AddressSearchSheet({super.key});

  @override
  ConsumerState<AddressSearchSheet> createState() => _AddressSearchSheetState();
}

class _AddressSearchSheetState extends ConsumerState<AddressSearchSheet> {
  final _pickupCtrl = TextEditingController(text: 'Ma position');
  final _dropoffCtrl = TextEditingController();

  _Place? _pickup;
  _Place? _dropoff;
  bool _confirming = false;
  bool _loadingGps = false;

  List<_Place> _pickupSuggestions = [];
  List<_Place> _dropoffSuggestions = [];
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _fetchGpsPosition();
  }

  @override
  void dispose() {
    _pickupCtrl.dispose();
    _dropoffCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _fetchGpsPosition() async {
    setState(() => _loadingGps = true);
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (!mounted) return;

      // Reverse geocode via our backend proxy (keeps the Places key server-side)
      final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
        '/places/geocode',
        params: {'lat': pos.latitude, 'lng': pos.longitude},
      );
      final results = res.data?['results'] as List<dynamic>?;
      final address = results != null && results.isNotEmpty
          ? results.first['formatted_address'] as String? ?? 'Ma position'
          : 'Ma position';

      if (!mounted) return;
      setState(() {
        _pickup = _Place(address, '', pos.latitude, pos.longitude);
        _pickupCtrl.text = address;
      });
    } catch (_) {
      // Keep "Ma position" label, coordinates will use Libreville center fallback
    } finally {
      if (mounted) setState(() => _loadingGps = false);
    }
  }

  Future<List<_Place>> _autocomplete(String input) async {
    if (input.trim().isEmpty) return [];
    try {
      final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
        '/places/autocomplete',
        params: {'input': input},
      );
      final predictions = res.data?['predictions'] as List<dynamic>? ?? [];
      return predictions.map((p) {
        final desc = p['description'] as String? ?? '';
        final id = p['place_id'] as String? ?? '';
        return _Place(desc, id, 0, 0);
      }).toList();
    } catch (_) {
      return [];
    }
  }

  Future<_Place?> _getPlaceDetails(_Place partial) async {
    if (partial.placeId.isEmpty) return partial;
    try {
      final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
        '/places/details',
        params: {'placeId': partial.placeId},
      );
      final loc = res.data?['result']?['geometry']?['location'];
      if (loc == null) return null;
      return _Place(
        partial.name,
        partial.placeId,
        (loc['lat'] as num).toDouble(),
        (loc['lng'] as num).toDouble(),
      );
    } catch (_) {
      return null;
    }
  }

  void _onPickupChanged(String q) {
    _debounce?.cancel();
    if (q.isEmpty) {
      setState(() => _pickupSuggestions = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      final results = await _autocomplete(q);
      if (mounted) setState(() => _pickupSuggestions = results);
    });
  }

  void _onDropoffChanged(String q) {
    _debounce?.cancel();
    if (q.isEmpty) {
      setState(() => _dropoffSuggestions = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      final results = await _autocomplete(q);
      if (mounted) setState(() => _dropoffSuggestions = results);
    });
  }

  Future<void> _selectPickup(_Place p) async {
    final detail = await _getPlaceDetails(p);
    if (!mounted || detail == null) return;
    setState(() {
      _pickup = detail;
      _pickupCtrl.text = detail.name;
      _pickupSuggestions = [];
    });
  }

  Future<void> _selectDropoff(_Place p) async {
    final detail = await _getPlaceDetails(p);
    if (!mounted || detail == null) return;
    setState(() {
      _dropoff = detail;
      _dropoffCtrl.text = detail.name;
      _dropoffSuggestions = [];
    });
  }

  Future<void> _confirm() async {
    if (_dropoff == null || _confirming) return;
    _confirming = true;
    Navigator.of(context).pop();
    try {
      await ref.read(tripProvider.notifier).bookTrip(
            pickupLat: _pickup?.lat ?? 0.4162,
            pickupLng: _pickup?.lng ?? 9.4673,
            dropoffLat: _dropoff!.lat,
            dropoffLng: _dropoff!.lng,
            pickupAddress: _pickup?.name ?? 'Ma position',
            dropoffAddress: _dropoff!.name,
          );
    } catch (_) {
    } finally {
      _confirming = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 24 + bottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.greyBorder,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          Text('Votre trajet', style: AppTextStyles.h3),
          const SizedBox(height: 16),

          // Pickup
          _AddressField(
            controller: _pickupCtrl,
            label: 'Départ',
            icon: Icons.radio_button_checked_rounded,
            iconColor: AppColors.primary,
            suggestions: _pickupSuggestions,
            isLoading: _loadingGps,
            onChanged: _onPickupChanged,
            onSelected: _selectPickup,
          ),
          const SizedBox(height: 8),

          // Dropoff
          _AddressField(
            controller: _dropoffCtrl,
            label: 'Destination',
            icon: Icons.location_on_rounded,
            iconColor: AppColors.error,
            autofocus: true,
            suggestions: _dropoffSuggestions,
            onChanged: _onDropoffChanged,
            onSelected: _selectDropoff,
          ),
          const SizedBox(height: 20),

          HdButton(
            label: 'Trouver un chauffeur',
            onPressed: _dropoff != null ? _confirm : null,
          ),
        ],
      ),
    );
  }
}

class _AddressField extends StatelessWidget {
  const _AddressField({
    required this.controller,
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.suggestions,
    required this.onChanged,
    required this.onSelected,
    this.autofocus = false,
    this.isLoading = false,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final Color iconColor;
  final List<_Place> suggestions;
  final ValueChanged<String> onChanged;
  final Future<void> Function(_Place) onSelected;
  final bool autofocus;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextFormField(
          controller: controller,
          autofocus: autofocus,
          onChanged: onChanged,
          decoration: InputDecoration(
            labelText: label,
            prefixIcon: Icon(icon, color: iconColor, size: 20),
            suffixIcon: isLoading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : null,
          ),
        ),
        if (suggestions.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 220),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.greyBorder),
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: suggestions.length,
              itemBuilder: (_, i) {
                final p = suggestions[i];
                return ListTile(
                  dense: true,
                  leading: const Icon(Icons.place_rounded, color: AppColors.grey, size: 18),
                  title: Text(p.name, style: AppTextStyles.body, maxLines: 2),
                  onTap: () => onSelected(p),
                );
              },
            ),
          ),
      ],
    );
  }
}
