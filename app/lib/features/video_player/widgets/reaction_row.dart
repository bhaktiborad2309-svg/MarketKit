
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../../downloads/widgets/download_button.dart';
import '../../favorites/widgets/favorite_button.dart';
import '../../home/models/video_model.dart';
import '../models/video_reaction_model.dart';
import 'reaction_button.dart';

class ReactionRow extends StatelessWidget {
  final VideoReactionState reactions;
  final void Function(String) onToggle;
  final VideoModel video;

  const ReactionRow({
    super.key,
    required this.reactions,
    required this.onToggle,
    required this.video,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        ReactionButton(
          icon: Icons.thumb_up_alt_outlined,
          activeIcon: Icons.thumb_up_alt,
          label: '${reactions.likeCount}',
          isActive: reactions.userReaction == 'like',
          onTap: () => onToggle('like'),
        ),
        const SizedBox(width: 12),
        ReactionButton(
          icon: Icons.thumb_down_alt_outlined,
          activeIcon: Icons.thumb_down_alt,
          label: '${reactions.dislikeCount}',
          isActive: reactions.userReaction == 'dislike',
          onTap: () => onToggle('dislike'),
        ),
        if (!kIsWeb && video.accessible) ...[
          const SizedBox(width: 4),
          DownloadButton(video: video, darkBackground: false),
        ],
        FavoriteButton(video: video, darkBackground: false),
      ],
    );
  }
}
