import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

/// The circular filter button (bottom-right) from the mockup — tapping it
/// opens the sub-section filter sheet.
class FilterButton extends StatelessWidget {
  final VoidCallback onTap;
  const FilterButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kPrimary,
      shape: const CircleBorder(),
      elevation: 3,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: const SizedBox(
          width: 56,
          height: 56,
          child: Icon(Icons.tune_rounded, color: Colors.white, size: 26),
        ),
      ),
    );
  }
}
