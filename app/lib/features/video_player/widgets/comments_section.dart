
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../models/video_comment_model.dart';
import 'comment_tile.dart';

class CommentsSection extends StatelessWidget {
  final List<VideoComment> comments;
  final bool isLoading;
  final void Function(String) onDelete;

  const CommentsSection({
    super.key,
    required this.comments,
    required this.isLoading,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Messages with Admin (${comments.length})',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: kForeground,
          ),
        ),
        const SizedBox(height: 12),
        if (isLoading)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: CircularProgressIndicator(color: kPrimary, strokeWidth: 2),
            ),
          )
        else if (comments.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text(
                'Ask a question — only you and the admin can see this',
                textAlign: TextAlign.center,
                style: TextStyle(color: kMutedForeground, fontSize: 13),
              ),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: comments.length,
            separatorBuilder: (context, index) => const Divider(height: 1),
            itemBuilder: (_, i) => CommentTile(
              comment: comments[i],
              onDelete: () => onDelete(comments[i].id),
            ),
          ),
      ],
    );
  }
}
