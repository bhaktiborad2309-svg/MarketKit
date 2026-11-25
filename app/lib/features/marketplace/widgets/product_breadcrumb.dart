import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

/// "Product Market > Parent > Child" trail. Every crumb but the last is
/// tappable and jumps back to that level.
class ProductBreadcrumb extends StatelessWidget {
  final String? parentName;
  final String? childName;
  final VoidCallback onHome;
  final VoidCallback? onParent;

  const ProductBreadcrumb({
    super.key,
    this.parentName,
    this.childName,
    required this.onHome,
    this.onParent,
  });

  @override
  Widget build(BuildContext context) {
    final crumbs = <Crumb>[
      Crumb('Product Market', onHome),
      if (parentName != null) Crumb(parentName!, onParent),
      if (childName != null) Crumb(childName!, null),
    ];
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (var i = 0; i < crumbs.length; i++) ...[
          if (i > 0)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child:
                  Icon(Icons.chevron_right, size: 14, color: kMutedForeground),
            ),
          GestureDetector(
            onTap: crumbs[i].onTap,
            child: Text(
              crumbs[i].label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: i == crumbs.length - 1
                    ? FontWeight.w700
                    : FontWeight.w600,
                color: i == crumbs.length - 1 ? kPrimary : kMutedForeground,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class Crumb {
  final String label;
  final VoidCallback? onTap;
  const Crumb(this.label, this.onTap);
}
