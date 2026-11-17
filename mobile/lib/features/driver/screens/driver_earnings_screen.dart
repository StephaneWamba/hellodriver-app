import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/models/wallet_model.dart';
import '../../../core/providers/wallet_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/driver_colors.dart';
import '../../../shared/widgets/hd_card.dart';
import '../../../shared/widgets/hd_header_banner.dart';

enum _Period { week, month }

class DriverEarningsScreen extends ConsumerStatefulWidget {
  const DriverEarningsScreen({super.key});

  @override
  ConsumerState<DriverEarningsScreen> createState() => _DriverEarningsScreenState();
}

class _DriverEarningsScreenState extends ConsumerState<DriverEarningsScreen> {
  _Period _period = _Period.week;

  List<TransactionModel> _earnings(List<TransactionModel> all) => all
      .where((t) => t.type == 'trip_earning' && t.status == 'completed')
      .toList();

  /// Buckets earnings into 7 daily totals (week view) or 4 weekly totals
  /// (month view), oldest first.
  List<double> _bucketed(List<TransactionModel> earnings) {
    final now = DateTime.now();
    if (_period == _Period.week) {
      final todayStart = DateTime(now.year, now.month, now.day);
      return List.generate(7, (i) {
        final dayStart = todayStart.subtract(Duration(days: 6 - i));
        final dayEnd = dayStart.add(const Duration(days: 1));
        return earnings
            .where((t) => !t.createdAt.isBefore(dayStart) && t.createdAt.isBefore(dayEnd))
            .fold<double>(0, (sum, t) => sum + t.amount);
      });
    }
    final weekStart = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));
    return List.generate(4, (i) {
      final start = weekStart.subtract(Duration(days: 7 * (3 - i)));
      final end = start.add(const Duration(days: 7));
      return earnings
          .where((t) => !t.createdAt.isBefore(start) && t.createdAt.isBefore(end))
          .fold<double>(0, (sum, t) => sum + t.amount);
    });
  }

  List<String> get _labels {
    if (_period == _Period.week) {
      final now = DateTime.now();
      final fmt = DateFormat('E', 'fr_FR');
      return List.generate(7, (i) {
        final day = now.subtract(Duration(days: 6 - i));
        final label = fmt.format(day);
        return label.substring(0, 1).toUpperCase() + label.substring(1, label.length.clamp(0, 3));
      });
    }
    return ['S-3', 'S-2', 'S-1', 'Cette sem.'];
  }

  @override
  Widget build(BuildContext context) {
    final wallet = ref.watch(walletProvider);
    final earnings = _earnings(wallet.transactions);
    final buckets = _bucketed(earnings);
    final periodTotal = buckets.fold<double>(0, (a, b) => a + b);
    final periodTrips = earnings
        .where((t) => _period == _Period.week
            ? t.createdAt.isAfter(DateTime.now().subtract(const Duration(days: 7)))
            : t.createdAt.isAfter(DateTime.now().subtract(const Duration(days: 28))))
        .length;
    final avgPerTrip = periodTrips > 0 ? periodTotal / periodTrips : 0.0;
    final maxY = (buckets.isEmpty ? 0.0 : buckets.reduce((a, b) => a > b ? a : b));

    return Scaffold(
      backgroundColor: AppColors.greyLight,
      appBar: const HdHeaderBanner(title: 'Mes gains', color: DriverColors.primary),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          color: DriverColors.primary,
          onRefresh: () => ref.read(walletProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              HdCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Solde Hello Money', style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
                        const SizedBox(height: 4),
                        Text(
                          wallet.wallet != null ? '${wallet.wallet!.balance.toInt()} XAF' : '— XAF',
                          style: AppTextStyles.h2.copyWith(color: DriverColors.primary),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: DriverColors.primaryLight,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.account_balance_wallet_rounded, color: DriverColors.primary, size: 26),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.greyBorder),
                ),
                child: Row(
                  children: [
                    Expanded(child: _PeriodTab(label: 'Semaine', selected: _period == _Period.week, onTap: () => setState(() => _period = _Period.week))),
                    Expanded(child: _PeriodTab(label: 'Mois', selected: _period == _Period.month, onTap: () => setState(() => _period = _Period.month))),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              HdCard(
                padding: const EdgeInsets.fromLTRB(8, 20, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('${periodTotal.toInt()} XAF', style: AppTextStyles.h3),
                          Text('$periodTrips course${periodTrips > 1 ? 's' : ''}',
                              style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 160,
                      child: wallet.isLoading
                          ? const Center(child: CircularProgressIndicator(color: DriverColors.primary, strokeWidth: 2))
                          : BarChart(
                              BarChartData(
                                maxY: maxY <= 0 ? 1000 : maxY * 1.25,
                                alignment: BarChartAlignment.spaceAround,
                                gridData: const FlGridData(show: false),
                                borderData: FlBorderData(show: false),
                                barTouchData: BarTouchData(
                                  touchTooltipData: BarTouchTooltipData(
                                    getTooltipColor: (_) => DriverColors.primary,
                                    getTooltipItem: (group, groupIdx, rod, rodIdx) => BarTooltipItem(
                                      '${rod.toY.toInt()} XAF',
                                      const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ),
                                titlesData: FlTitlesData(
                                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                  bottomTitles: AxisTitles(
                                    sideTitles: SideTitles(
                                      showTitles: true,
                                      getTitlesWidget: (value, meta) {
                                        final i = value.toInt();
                                        if (i < 0 || i >= _labels.length) return const SizedBox.shrink();
                                        return Padding(
                                          padding: const EdgeInsets.only(top: 8),
                                          child: Text(_labels[i], style: AppTextStyles.caption.copyWith(fontSize: 11)),
                                        );
                                      },
                                    ),
                                  ),
                                ),
                                barGroups: List.generate(buckets.length, (i) {
                                  return BarChartGroupData(
                                    x: i,
                                    barRods: [
                                      BarChartRodData(
                                        toY: buckets[i],
                                        color: DriverColors.primary,
                                        width: _period == _Period.week ? 18 : 32,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                    ],
                                  );
                                }),
                              ),
                            ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: HdCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Moyenne / course', style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
                          const SizedBox(height: 4),
                          Text('${avgPerTrip.toInt()} XAF', style: AppTextStyles.h3),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: HdCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Courses', style: AppTextStyles.caption.copyWith(color: AppColors.grey)),
                          const SizedBox(height: 4),
                          Text('$periodTrips', style: AppTextStyles.h3),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text('Dernières courses', style: AppTextStyles.h3),
              const SizedBox(height: 12),
              if (earnings.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text('Aucun gain pour le moment', style: AppTextStyles.body.copyWith(color: AppColors.grey)),
                  ),
                )
              else
                ...earnings.take(15).map((t) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: HdCard(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: DriverColors.primaryLight,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.directions_car_rounded, color: DriverColors.primary, size: 18),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                DateFormat('EEEE d MMM · HH:mm', 'fr_FR').format(t.createdAt),
                                style: AppTextStyles.caption.copyWith(color: AppColors.grey),
                              ),
                            ),
                            Text('+${t.amount.toInt()} XAF',
                                style: AppTextStyles.bodySemiBold.copyWith(color: AppColors.success)),
                          ],
                        ),
                      ),
                    )),
            ],
          ),
        ),
      ),
    );
  }
}

class _PeriodTab extends StatelessWidget {
  const _PeriodTab({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? DriverColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: AppTextStyles.captionMedium.copyWith(
            color: selected ? AppColors.white : AppColors.grey,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
