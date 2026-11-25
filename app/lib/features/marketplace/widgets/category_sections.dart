import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/shimmer_loaders.dart';
import '../models/product_category_model.dart';
import '../providers/products_provider.dart';
import 'section_row.dart';

class CategorySections extends ConsumerWidget {
  final void Function(ProductCategorySection) onOpenSection;
  const CategorySections({super.key, required this.onOpenSection});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);

    return categoriesAsync.when(
      loading: () => const ShimmerList(
        itemHeight: 92,
        count: 5,
        padding: EdgeInsets.fromLTRB(16, 12, 16, 16),
      ),
      error: (_, __) => const Center(
        child: Text('Could not load categories.',
            style: TextStyle(color: kMutedForeground)),
      ),
      data: (categories) {
        final sections = buildProductCategorySections(categories);
        if (sections.isEmpty) {
          return const Center(
            child: Text('No products for sale yet.\nBe the first to upload one!',
                textAlign: TextAlign.center,
                style: TextStyle(color: kMutedForeground)),
          );
        }
        // Every admin-defined section is always listed, whether or not it
        // has products yet — sections with none show a placeholder photo
        // until something is uploaded into them.
        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(0, 12, 0, 100),
          itemCount: sections.length,
          itemBuilder: (_, i) => SectionRow(
            section: sections[i],
            index: i,
            onOpen: () => onOpenSection(sections[i]),
          ),
        );
      },
    );
  }
}
