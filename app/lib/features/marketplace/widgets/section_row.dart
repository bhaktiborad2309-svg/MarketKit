import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../models/product_category_model.dart';
import '../providers/products_provider.dart';
import 'section_photo.dart';

/// One collapsed section row: a full-bleed "photo" tile (the admin-set
/// section photo if one exists, otherwise the first product's own preview,
/// otherwise a placeholder) with a dark gradient scrim washing in from one
/// side and the section name sitting directly on top of it, alternating side
/// down the list. The product photos themselves stay hidden until the section
/// is tapped open — this row never shows more than the one representative
/// photo.
class SectionRow extends ConsumerWidget {
  final ProductCategorySection section;
  final int index;
  final VoidCallback onOpen;
  const SectionRow({
    super.key,
    required this.section,
    required this.index,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // An admin-set section photo always wins; only fall back to the first
    // product's own preview when the admin hasn't uploaded one.
    String? previewUrl = section.parent.photoUrl;
    if (previewUrl == null || previewUrl.isEmpty) {
      final productsAsync = ref.watch(sectionProductsProvider(section.parent.id));
      previewUrl = productsAsync.maybeWhen(
        data: (products) => products.isNotEmpty && products.first.previewUrls.isNotEmpty
            ? products.first.previewUrls.first
            : null,
        orElse: () => null,
      );
    }
    final labelOnLeft = index.isEven;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Material(
          color: kCard,
          child: InkWell(
            onTap: onOpen,
            child: SizedBox(
              height: 104,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  SectionPhoto(previewUrl: previewUrl),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: labelOnLeft
                            ? Alignment.centerLeft
                            : Alignment.centerRight,
                        end: labelOnLeft
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        stops: const [0.0, 0.32],
                        colors: [
                          Colors.black.withValues(alpha: 0.82),
                          Colors.black.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                  Align(
                    alignment: labelOnLeft
                        ? Alignment.centerLeft
                        : Alignment.centerRight,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        section.parent.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign:
                            labelOnLeft ? TextAlign.left : TextAlign.right,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          height: 1.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
