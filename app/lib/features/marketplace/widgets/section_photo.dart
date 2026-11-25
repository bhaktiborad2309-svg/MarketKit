import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class SectionPhoto extends StatelessWidget {
  final String? previewUrl;
  const SectionPhoto({super.key, required this.previewUrl});

  @override
  Widget build(BuildContext context) {
    return previewUrl != null
        ? CachedNetworkImage(
            imageUrl: previewUrl!,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          )
        : Container(
            color: kMuted,
            alignment: Alignment.center,
            child: const Icon(
              Icons.image_outlined,
              size: 26,
              color: kMutedForeground,
            ),
          );
  }
}
