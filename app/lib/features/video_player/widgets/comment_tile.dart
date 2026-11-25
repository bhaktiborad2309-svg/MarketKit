
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/video_comment_model.dart';

class CommentTile extends StatelessWidget {
  final VideoComment comment;
  final VoidCallback onDelete;

  const CommentTile({super.key, required this.comment, required this.onDelete});

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${(diff.inDays / 7).floor()}w ago';
  }

  @override
  Widget build(BuildContext context) {
    final initial = comment.userName.isNotEmpty
        ? comment.userName[0].toUpperCase()
        : '?';

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: comment.isAdmin
          ? BoxDecoration(
              color: kPrimary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            )
          : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          comment.isAdmin
              ? CircleAvatar(
                  radius: 16,
                  backgroundColor: kPrimary,
                  child: const Icon(Icons.support_agent, size: 16, color: Colors.white),
                )
              : CircleAvatar(
                  radius: 16,
                  backgroundColor: kPrimary.withValues(alpha: 0.2),
                  child: Text(
                    initial,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: kPrimary,
                    ),
                  ),
                ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      comment.isAdmin ? '${comment.userName} (Admin)' : comment.userName,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: kForeground,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _timeAgo(comment.createdAt),
                      style: const TextStyle(
                        fontSize: 11,
                        color: kMutedForeground,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  comment.content,
                  style: const TextStyle(
                    fontSize: 13,
                    color: kMutedForeground,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          if (!comment.isAdmin)
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 18),
              color: kMutedForeground,
              splashRadius: 16,
              onPressed: onDelete,
              tooltip: 'Delete',
            ),
        ],
      ),
    );
  }
}
