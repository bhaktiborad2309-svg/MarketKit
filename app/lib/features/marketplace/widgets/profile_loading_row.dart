import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class ProfileLoadingRow extends StatelessWidget {
  const ProfileLoadingRow({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: CircularProgressIndicator(color: kPrimary, strokeWidth: 2),
      ),
    );
  }
}
