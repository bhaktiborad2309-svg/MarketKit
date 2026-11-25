import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../models/product_category_model.dart';
import '../providers/products_provider.dart';
import '../widgets/category_sections.dart';
import '../widgets/category_suggestions.dart';
import '../widgets/filter_button.dart';
import '../widgets/product_breadcrumb.dart';
import '../widgets/products_grid.dart';

class AllProductsTab extends ConsumerStatefulWidget {
  const AllProductsTab({super.key});

  @override
  ConsumerState<AllProductsTab> createState() => _AllProductsTabState();
}

class _AllProductsTabState extends ConsumerState<AllProductsTab> {
  final _searchCtrl = TextEditingController();
  final _searchFocus = FocusNode();
  final _scrollCtrl = ScrollController();

  /// The parent section currently being drilled into (its children shown as
  /// a grid). Null while browsing the top-level sections or after a product
  /// list is reached via search suggestions.
  ProductCategorySection? _selectedSection;

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    _searchCtrl.addListener(() => setState(() {}));
    _searchFocus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _searchFocus.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 300) {
      ref.read(productsProvider.notifier).loadMore();
    }
  }

  void _selectCategory(ProductCategoryModel category) {
    _searchCtrl.text = category.name;
    _searchFocus.unfocus();
    setState(() => _selectedSection = null);
    ref.read(productsProvider.notifier).setCategory(category.id);
  }

  /// Tapping a top-level section: open it and show every product across all
  /// of its sub-sections at once (the backend expands a parent category id
  /// to all its child leaves). A filter button then lets the user narrow to
  /// a single sub-section.
  void _openSection(ProductCategorySection section) {
    _searchFocus.unfocus();
    _searchCtrl.clear();
    setState(() => _selectedSection = section);
    ref.read(productsProvider.notifier).setCategory(section.parent.id);
  }

  /// Filter the open section's products to one sub-section, or back to all of
  /// them. Passing null (or the parent itself) means "All".
  void _filterByChild(ProductCategoryModel? child) {
    final section = _selectedSection;
    if (section == null) return;
    _searchFocus.unfocus();
    ref
        .read(productsProvider.notifier)
        .setCategory(child?.id ?? section.parent.id);
  }

  /// Breadcrumb "Product Market" — back to the top-level sections.
  void _backToSections() {
    setState(() => _selectedSection = null);
    _searchCtrl.clear();
    ref.read(productsProvider.notifier).setCategory(null);
  }

  void _clearFilters() {
    _searchCtrl.clear();
    _searchFocus.unfocus();
    setState(() => _selectedSection = null);
    ref.read(productsProvider.notifier).setCategory(null);
  }

  /// Bottom-sheet filter menu: the open section's sub-sections plus "All".
  /// Mirrors the circular filter button in the product mockup.
  void _openFilterSheet() {
    final section = _selectedSection;
    if (section == null || section.children.isEmpty) return;
    final activeId = ref.read(productsProvider).categoryId;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: kCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        Widget tile(String label, bool selected, VoidCallback onTap) {
          return ListTile(
            title: Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? kPrimary : kForeground,
              ),
            ),
            trailing: selected
                ? const Icon(Icons.check_rounded, color: kPrimary, size: 20)
                : null,
            onTap: () {
              Navigator.pop(ctx);
              onTap();
            },
          );
        }

        final allSelected = activeId == null || activeId == section.parent.id;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: kBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    section.parent.name,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: kMutedForeground,
                    ),
                  ),
                ),
              ),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      tile('All', allSelected, () => _filterByChild(null)),
                      for (final child in section.children)
                        tile(child.name, activeId == child.id,
                            () => _filterByChild(child)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(productsProvider);
    final categoriesAsync = ref.watch(categoriesProvider);
    final query = _searchCtrl.text.trim().toLowerCase();

    final suggestions = query.isEmpty
        ? const <ProductCategoryModel>[]
        : categoriesAsync.maybeWhen(
            data: (cats) => cats
                .where((c) => !c.isOther && c.name.toLowerCase().contains(query))
                .toList(),
            orElse: () => const <ProductCategoryModel>[],
          );
    final showSuggestions =
        _searchFocus.hasFocus && query.isNotEmpty && suggestions.isNotEmpty;

    final isBrowsingSections = state.searchQuery.isEmpty &&
        state.categoryId == null &&
        _selectedSection == null;

    // A specific sub-section is active (not "All") when the current filter is
    // one of the open section's children rather than the parent itself.
    final section = _selectedSection;
    String? crumbChildName;
    if (section != null &&
        state.categoryId != null &&
        state.categoryId != section.parent.id) {
      for (final c in section.children) {
        if (c.id == state.categoryId) {
          crumbChildName = c.name;
          break;
        }
      }
    }

    // The filter button shows whenever a multi-child section is open.
    final showFilterButton =
        section != null && section.children.isNotEmpty && !showSuggestions;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          child: TextField(
            controller: _searchCtrl,
            focusNode: _searchFocus,
            decoration: InputDecoration(
              hintText: 'Search products or categories…',
              hintStyle:
                  const TextStyle(color: kMutedForeground, fontSize: 14),
              prefixIcon:
                  const Icon(Icons.search, color: kMutedForeground, size: 20),
              suffixIcon: _searchCtrl.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close,
                          color: kMutedForeground, size: 18),
                      onPressed: _clearFilters,
                    )
                  : null,
              filled: true,
              fillColor: kCard,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
            ),
            onSubmitted: (q) {
              setState(() => _selectedSection = null);
              ref.read(productsProvider.notifier).setSearch(q);
            },
          ),
        ),
        if (!showSuggestions && section != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: ProductBreadcrumb(
              parentName: section.parent.name,
              childName: crumbChildName,
              onHome: _backToSections,
              onParent: crumbChildName != null ? () => _filterByChild(null) : null,
            ),
          ),
        Expanded(
          child: showSuggestions
              ? CategorySuggestions(
                  suggestions: suggestions, onSelect: _selectCategory)
              : isBrowsingSections
                  ? CategorySections(onOpenSection: _openSection)
                  : Stack(
                      children: [
                        ProductsGrid(state: state, scrollCtrl: _scrollCtrl),
                        if (showFilterButton)
                          Positioned(
                            right: 16,
                            bottom: 16,
                            child: FilterButton(onTap: _openFilterSheet),
                          ),
                      ],
                    ),
        ),
      ],
    );
  }
}
