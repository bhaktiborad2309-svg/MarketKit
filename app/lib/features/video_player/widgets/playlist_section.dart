
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../home/models/video_model.dart';
import '../../library/widgets/library_video_tile.dart';

class PlaylistSection extends StatelessWidget {
  final String categoryLabel;
  final List<VideoModel> playlist;
  final bool isLoading;

  const PlaylistSection({
    super.key,
    required this.categoryLabel,
    required this.playlist,
    required this.isLoading,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.playlist_play_rounded, size: 20, color: kPrimary),
            const SizedBox(width: 8),
            Text(
              'More $categoryLabel Videos',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: kForeground,
              ),
            ),
            if (!isLoading && playlist.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: kPrimary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${playlist.length}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: kPrimary,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        if (isLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: LinearProgressIndicator(color: kPrimary, backgroundColor: kMuted),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: playlist.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final v = playlist[i];
              return LibraryVideoTile(
                video: v,
                // Replace (not push) so switching videos from inside the
                // player doesn't stack up player screens — Back should
                // return to wherever the player was originally opened from
                // (Library, Playlist, Home, etc.), not to another player.
                onTap: () => context.replace('/video/${v.id}', extra: v),
              );
            },
          ),
      ],
    );
  }
}
