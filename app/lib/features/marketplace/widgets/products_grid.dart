import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/shimmer_loaders.dart';
import '../providers/products_provider.dart';
import '../widgets/product_card.dart';

class ProductsGrid extends ConsumerWidget {
  final ProductsState state;
  final ScrollController scrollCtrl;
  const ProductsGrid({super.key, required this.state, required this.scrollCtrl});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.isLoading) {
      return const ShimmerList(
        itemHeight: 180,
        count: 4,
        padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
      );
    }
    if (state.error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: kMutedForeground),
            const SizedBox(height: 12),
            Text(state.error!, style: const TextStyle(color: kMutedForeground)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => ref.read(productsProvider.notifier).load(),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }
    if (state.products.isEmpty) {
      final isFiltered = state.searchQuery.isNotEmpty || state.categoryId != null;
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isFiltered ? Icons.search_off_rounded : Icons.storefront_outlined,
              size: 48,
              color: kMutedForeground,
            ),
            const SizedBox(height: 12),
            Text(
              isFiltered
                  ? 'No products match this search.'
                  : 'No products for sale yet.\nBe the first to upload one!',
              textAlign: TextAlign.center,
              style: const TextStyle(color: kMutedForeground),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      color: kPrimary,
      onRefresh: () => ref.read(productsProvider.notifier).load(),
      child: GridView.builder(
        controller: scrollCtrl,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.8,
        ),
        itemCount: state.products.length + (state.isLoadingMore ? 2 : 0),
        itemBuilder: (_, i) {
          if (i >= state.products.length) {
            return const Center(
              child: CircularProgressIndicator(color: kPrimary, strokeWidth: 2),
            );
          }
          final product = state.products[i];
          return ProductCard(
            product: product,
            onTap: () => context.push('/market/product/${product.id}'),
          );
        },
      ),
    );
  }
}
