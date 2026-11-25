
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class PlayerErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const PlayerErrorView({super.key, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: Colors.white54, size: 48),
          const SizedBox(height: 12),
          const Text('Failed to load video', style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 16),
          TextButton(
            onPressed: onRetry,
            child: const Text('Retry', style: TextStyle(color: kPrimary)),
          ),
        ],
      ),
    );
  }
}
