import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/product_category_model.dart';

class CategorySuggestions extends StatelessWidget {
  final List<ProductCategoryModel> suggestions;
  final void Function(ProductCategoryModel) onSelect;

  const CategorySuggestions({super.key, required this.suggestions, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: suggestions.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) {
        final c = suggestions[i];
        return ListTile(
          leading: const Icon(Icons.sell_outlined, color: kPrimary, size: 20),
          title: Text(c.name, style: const TextStyle(fontSize: 14)),
          onTap: () => onSelect(c),
        );
      },
    );
  }
}
