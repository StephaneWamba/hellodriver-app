import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import '../../../core/providers/driver_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/driver_colors.dart';
import '../../../shared/widgets/hd_button.dart';
import '../../../shared/widgets/hd_header_banner.dart';
import 'driver_documents_screen.dart';

/// Self-service driver onboarding — step 1: personal + vehicle info.
/// Mirrors backend's driverProfileSchema (POST /drivers/profile) exactly.
class DriverVehicleInfoScreen extends ConsumerStatefulWidget {
  const DriverVehicleInfoScreen({super.key});

  @override
  ConsumerState<DriverVehicleInfoScreen> createState() => _DriverVehicleInfoScreenState();
}

class _DriverVehicleInfoScreenState extends ConsumerState<DriverVehicleInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _brandCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _yearCtrl = TextEditingController();
  final _registrationCtrl = TextEditingController();
  final _areaCtrl = TextEditingController();
  final _mobileMoneyCtrl = TextEditingController();
  DateTime? _dateOfBirth;
  bool _hasAc = false;

  @override
  void dispose() {
    _brandCtrl.dispose();
    _modelCtrl.dispose();
    _yearCtrl.dispose();
    _registrationCtrl.dispose();
    _areaCtrl.dispose();
    _mobileMoneyCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 25),
      firstDate: DateTime(now.year - 100),
      lastDate: DateTime(now.year - 18),
      helpText: 'Date de naissance',
      builder: (context, child) => Theme(data: AppTheme.driver, child: child!),
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _dateOfBirth == null) {
      if (_dateOfBirth == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Merci d\'indiquer votre date de naissance')),
        );
      }
      return;
    }
    final dob =
        '${_dateOfBirth!.year.toString().padLeft(4, '0')}-${_dateOfBirth!.month.toString().padLeft(2, '0')}-${_dateOfBirth!.day.toString().padLeft(2, '0')}';
    try {
      await ref.read(driverProvider.notifier).submitVehicleProfile(
            dateOfBirth: dob,
            vehicleBrand: _brandCtrl.text.trim(),
            vehicleModel: _modelCtrl.text.trim(),
            vehicleYear: int.parse(_yearCtrl.text.trim()),
            vehicleRegistration: _registrationCtrl.text.trim().toUpperCase(),
            residentialArea: _areaCtrl.text.trim(),
            hasAc: _hasAc,
            mobileMoneyAccount: _mobileMoneyCtrl.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => const DriverDocumentsScreen()),
      );
    } catch (e) {
      if (!mounted) return;
      final err = ref.read(driverProvider).error ?? 'Une erreur est survenue';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(driverProvider).isSubmittingProfile;

    return Theme(
      data: AppTheme.driver,
      child: Scaffold(
      backgroundColor: AppColors.greyLight,
      appBar: const HdHeaderBanner(title: 'Devenir chauffeur', color: DriverColors.primary),
      body: SafeArea(
        top: false,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _StepBanner(step: 1, total: 2, label: 'Vos informations'),
              const SizedBox(height: 20),
              Text('Informations personnelles', style: AppTextStyles.h3),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: _pickDateOfBirth,
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Date de naissance',
                    prefixIcon: Icon(Iconsax.calendar_copy),
                  ),
                  child: Text(
                    _dateOfBirth == null
                        ? 'Sélectionner'
                        : '${_dateOfBirth!.day.toString().padLeft(2, '0')}/${_dateOfBirth!.month.toString().padLeft(2, '0')}/${_dateOfBirth!.year}',
                    style: AppTextStyles.body,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _areaCtrl,
                decoration: const InputDecoration(
                  labelText: 'Quartier de résidence',
                  prefixIcon: Icon(Iconsax.location_copy),
                ),
                validator: (v) => (v == null || v.trim().length < 2) ? 'Champ requis' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _mobileMoneyCtrl,
                decoration: const InputDecoration(
                  labelText: 'Numéro Mobile Money (paiement des gains)',
                  hintText: '+24177XXXXXX',
                  prefixIcon: Icon(Iconsax.wallet_copy),
                ),
                keyboardType: TextInputType.phone,
                validator: (v) => (v == null || !RegExp(r'^\+241[0-9]{8}$').hasMatch(v.trim()))
                    ? 'Format invalide — ex. +24177123456'
                    : null,
              ),
              const SizedBox(height: 24),
              Text('Votre véhicule', style: AppTextStyles.h3),
              const SizedBox(height: 12),
              TextFormField(
                controller: _brandCtrl,
                decoration: const InputDecoration(
                  labelText: 'Marque',
                  hintText: 'Toyota',
                  prefixIcon: Icon(Iconsax.car_copy),
                ),
                validator: (v) => (v == null || v.trim().length < 2) ? 'Champ requis' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _modelCtrl,
                decoration: const InputDecoration(
                  labelText: 'Modèle',
                  hintText: 'Corolla',
                  prefixIcon: Icon(Iconsax.car_copy),
                ),
                validator: (v) => (v == null || v.trim().length < 2) ? 'Champ requis' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _yearCtrl,
                decoration: const InputDecoration(
                  labelText: 'Année',
                  hintText: '2018',
                  prefixIcon: Icon(Iconsax.calendar_1_copy),
                ),
                keyboardType: TextInputType.number,
                validator: (v) {
                  final year = int.tryParse(v?.trim() ?? '');
                  if (year == null || year < 1990 || year > DateTime.now().year) {
                    return 'Année invalide';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _registrationCtrl,
                decoration: const InputDecoration(
                  labelText: 'Immatriculation',
                  hintText: 'LB-1234-AB',
                  prefixIcon: Icon(Iconsax.document_copy),
                ),
                textCapitalization: TextCapitalization.characters,
                validator: (v) => (v == null || v.trim().length < 5) ? 'Champ requis' : null,
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _hasAc,
                onChanged: (v) => setState(() => _hasAc = v),
                activeThumbColor: DriverColors.primary,
                title: Text('Véhicule climatisé', style: AppTextStyles.body),
              ),
              const SizedBox(height: 24),
              HdButton(
                label: 'Continuer',
                accentColor: DriverColors.primary,
                isLoading: isLoading,
                onPressed: _submit,
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

class _StepBanner extends StatelessWidget {
  const _StepBanner({required this.step, required this.total, required this.label});
  final int step;
  final int total;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text('Étape $step/$total', style: AppTextStyles.captionMedium.copyWith(color: DriverColors.primary)),
        const SizedBox(width: 8),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: step / total,
              minHeight: 6,
              backgroundColor: AppColors.greyBorder,
              valueColor: const AlwaysStoppedAnimation(DriverColors.primary),
            ),
          ),
        ),
      ],
    );
  }
}
