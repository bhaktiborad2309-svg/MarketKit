import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../market_plans/models/market_plan_model.dart';

class MarketPlanCard extends StatelessWidget {
  final MarketPlanSubscriptionModel? subscription;
  final bool isProcessing;
  final VoidCallback? onViewPlans;
  final VoidCallback onCancel;

  const MarketPlanCard({
    super.key,
    required this.subscription,
    required this.isProcessing,
    required this.onViewPlans,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final sub = subscription;
    final active = sub != null && sub.isActive;

    if (!active) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kCard,
          borderRadius: BorderRadius.circular(14),
          border: const Border(
            left: BorderSide(color: kMutedForeground, width: 4),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.workspace_premium_outlined,
                color: kMutedForeground, size: 20),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'No active plan',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: kMutedForeground,
                ),
              ),
            ),
            TextButton(
              onPressed: onViewPlans,
              child: const Text('View Plans', style: TextStyle(color: kPrimary)),
            ),
          ],
        ),
      );
    }

    final planName = sub.plan?.name ?? 'Market Plan';
    final expiry = sub.expiryDate;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kCard,
        borderRadius: BorderRadius.circular(14),
        border: const Border(
          left: BorderSide(color: kSuccess, width: 4),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.workspace_premium_rounded,
                  color: kSuccess, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  planName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: kForeground,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: kSuccess.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'Active',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: kSuccess,
                  ),
                ),
              ),
            ],
          ),
          if (expiry != null) ...[
            const SizedBox(height: 6),
            Text(
              'Valid until ${_formatDate(expiry)}',
              style: const TextStyle(fontSize: 12, color: kMutedForeground),
            ),
          ],
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: isProcessing ? null : onCancel,
              style: TextButton.styleFrom(foregroundColor: kDanger),
              child: isProcessing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Cancel plan'),
            ),
          ),
        ],
      ),
    );
  }

  static String _formatDate(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
  }
}
