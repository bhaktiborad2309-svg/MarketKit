import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../../core/services/app_mode_service.dart';
import '../../../core/services/update_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/avatar_upload_controller.dart';
import '../../../shared/widgets/menu_card.dart';
import '../../../shared/widgets/profile_header.dart';
import '../../../shared/widgets/update_dialog.dart';
import '../../auth/providers/auth_provider.dart';
import '../../market_plans/providers/market_plans_provider.dart';
import '../providers/my_market_provider.dart';
import '../providers/wallet_provider.dart';
import '../widgets/add_money_sheet.dart';
import '../widgets/withdraw_sheet.dart';
import '../widgets/market_plan_card.dart';
import '../widgets/profile_empty_row.dart';
import '../widgets/profile_loading_row.dart';
import '../widgets/purchase_tile.dart';
import '../widgets/wallet_action_button.dart';

class MarketProfileTab extends ConsumerStatefulWidget {
  final VoidCallback? onViewPlans;

  const MarketProfileTab({super.key, this.onViewPlans});

  @override
  ConsumerState<MarketProfileTab> createState() => _MarketProfileTabState();
}

class _MarketProfileTabState extends ConsumerState<MarketProfileTab> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(marketPlansProvider.notifier).load());
  }

  Future<void> _switchToLearning() async {
    if (AppModeService.learningLocked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Learning is coming soon — stay tuned!')),
      );
      return;
    }
    final userId = ref.read(authProvider).user?.id;
    if (userId != null) {
      await AppModeService.setMode(userId, AppModeService.learning);
    }
    try {
      await ref.read(authProvider.notifier).setAppMode(AppModeService.learning);
    } catch (_) {
      // Best-effort — local state already updated, don't block navigation.
    }
    if (!mounted) return;
    context.go('/home');
  }

  Future<void> _confirmCancelPlan() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel plan?'),
        content: const Text(
          'Your market plan will end immediately. No refund will be issued.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep plan'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: kDanger),
            child: const Text('Cancel plan'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(marketPlansProvider.notifier).cancelMyPlan();
      await ref.read(marketPlansProvider.notifier).load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Market plan cancelled'),
          backgroundColor: kSuccess,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not cancel plan: $e'),
          backgroundColor: kDanger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final wallet = ref.watch(walletSummaryProvider);
    final earnings = ref.watch(earningsProvider);
    final myProducts = ref.watch(myProductsProvider);
    final myPurchases = ref.watch(myPurchasesProvider);
    final marketPlans = ref.watch(marketPlansProvider);
    final mySub = marketPlans.mySubscription;

    return RefreshIndicator(
      color: kPrimary,
      onRefresh: () async {
        ref.invalidate(walletSummaryProvider);
        ref.invalidate(earningsProvider);
        ref.invalidate(myProductsProvider);
        ref.invalidate(myPurchasesProvider);
        await ref.read(marketPlansProvider.notifier).load();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        children: [
          const SizedBox(height: 4),
          const _MarketProfileHeader(),
          const SizedBox(height: 24),

          // Wallet card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: kPrimaryGradient,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'Wallet Balance',
                      style: TextStyle(fontSize: 13, color: Colors.white70),
                    ),
                    const Spacer(),
                    earnings.when(
                      data: (e) => Text(
                        'Earned ${e.formattedTotal} · ${e.totalSales} sale${e.totalSales == 1 ? '' : 's'}',
                        style: const TextStyle(
                            fontSize: 11, color: Colors.white70),
                      ),
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                wallet.when(
                  data: (w) => Text(
                    w.formattedBalance,
                    style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Colors.white),
                  ),
                  loading: () => const SizedBox(
                    height: 34,
                    width: 34,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2),
                  ),
                  error: (_, __) => const Text('—',
                      style: TextStyle(fontSize: 28, color: Colors.white)),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    WalletActionButton(
                      icon: Icons.add_rounded,
                      label: 'Add Money',
                      onTap: () => AddMoneySheet.show(context),
                    ),
                    const SizedBox(width: 8),
                    WalletActionButton(
                      icon: Icons.arrow_outward_rounded,
                      label: 'Withdraw',
                      onTap: () {
                        final w = wallet.valueOrNull;
                        if (w == null) return;
                        WithdrawSheet.show(context, w);
                      },
                    ),
                    const SizedBox(width: 8),
                    WalletActionButton(
                      icon: Icons.receipt_long_outlined,
                      label: 'History',
                      onTap: () =>
                          context.push('/market/wallet/transactions'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          MarketPlanCard(
            subscription: mySub,
            isProcessing: marketPlans.isPaymentProcessing,
            onViewPlans: widget.onViewPlans,
            onCancel: _confirmCancelPlan,
          ),
          const SizedBox(height: 20),

          // Account
          const SectionHeader(title: 'ACCOUNT'),
          MenuCard(children: [
            MenuTile(
              icon: Icons.account_balance_outlined,
              label: 'Payout details (UPI / bank)',
              onTap: () => context.push('/market/wallet/payout-details'),
            ),
            const MenuDivider(),
            MenuTile(
              icon: AppModeService.learningLocked
                  ? Icons.lock_outline_rounded
                  : Icons.play_circle_outline_rounded,
              label: AppModeService.learningLocked
                  ? 'Learning — Coming soon…'
                  : 'Switch to Learning',
              onTap: _switchToLearning,
            ),
          ]),
          const SizedBox(height: 20),

          // My purchases
          const SectionHeader(title: 'MY PURCHASES'),
          myPurchases.when(
            data: (purchases) => purchases.isEmpty
                ? const ProfileEmptyRow(text: 'No purchases yet.')
                : Column(
                    children: [
                      for (final p in purchases)
                        PurchaseTile(purchase: p),
                    ],
                  ),
            loading: () => const ProfileLoadingRow(),
            error: (_, __) =>
                const ProfileEmptyRow(text: 'Could not load purchases.'),
          ),
          const SizedBox(height: 20),

          // My products — dedicated analytics screen
          GestureDetector(
            onTap: () => context.push('/market/my-products'),
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(child: SectionHeader(title: 'MY PRODUCTS')),
                  Icon(Icons.chevron_right_rounded, color: kMutedForeground),
                ],
              ),
            ),
          ),
          myProducts.when(
            data: (products) => products.isEmpty
                ? const ProfileEmptyRow(
                    text: 'No products listed yet. Upload one to start selling!')
                : ProfileEmptyRow(
                    text:
                        '${products.length} product${products.length == 1 ? '' : 's'} · tap to view sales & views',
                  ),
            loading: () => const ProfileLoadingRow(),
            error: (_, __) => const ProfileEmptyRow(text: 'Could not load products.'),
          ),
          const SizedBox(height: 20),

          // About (same update flow as the Learning profile)
          const SectionHeader(title: 'ABOUT'),
          MenuCard(children: [
            if (UpdateService.instance.latestUpdate != null)
              MenuTile(
                icon: Icons.system_update_rounded,
                iconColor: kPrimary,
                label: 'Update Available',
                trailing: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: kPrimary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'v${UpdateService.instance.latestUpdate!.versionName}',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: kPrimary,
                    ),
                  ),
                ),
                onTap: () => showDialog(
                  context: context,
                  builder: (_) =>
                      UpdateDialog(info: UpdateService.instance.latestUpdate!),
                ),
              )
            else
              MenuTile(
                icon: Icons.info_outline_rounded,
                label: 'App Version',
                trailing: FutureBuilder<PackageInfo>(
                  future: PackageInfo.fromPlatform(),
                  builder: (context, snapshot) => Text(
                    snapshot.hasData ? 'v${snapshot.data!.version}' : '',
                    style: const TextStyle(
                        fontSize: 13, color: kMutedForeground),
                  ),
                ),
                onTap: null,
              ),
          ]),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: kDanger,
                side: const BorderSide(color: kDanger),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              icon: const Icon(Icons.logout_rounded),
              label: const Text(
                'Sign Out',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

/// Profile header with avatar upload — same flow as Learning ProfileScreen.
class _MarketProfileHeader extends ConsumerStatefulWidget {
  const _MarketProfileHeader();

  @override
  ConsumerState<_MarketProfileHeader> createState() =>
      _MarketProfileHeaderState();
}

class _MarketProfileHeaderState extends ConsumerState<_MarketProfileHeader>
    with AvatarUploadController {
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return ProfileHeader(
      onAvatarTap: () => showAvatarOptions(user?.avatarUrl != null),
      busy: avatarBusy,
      showCameraBadge: true,
    );
  }
}
