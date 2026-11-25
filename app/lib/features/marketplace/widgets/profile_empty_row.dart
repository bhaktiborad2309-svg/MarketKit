import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class ProfileEmptyRow extends StatelessWidget {
  final String text;
  const ProfileEmptyRow({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      child: Text(text,
          style: const TextStyle(fontSize: 13, color: kMutedForeground)),
    );
  }
}
