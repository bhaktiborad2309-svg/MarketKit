
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class CommentInputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool isPosting;
  final VoidCallback onPost;

  const CommentInputBar({
    super.key,
    required this.controller,
    required this.isPosting,
    required this.onPost,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kCard,
      padding: EdgeInsets.fromLTRB(
        12,
        8,
        8,
        8 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onPost(),
              decoration: InputDecoration(
                hintText: 'Message admin…',
                hintStyle: const TextStyle(color: kMutedForeground, fontSize: 13),
                filled: true,
                fillColor: kMuted,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
              ),
              style: const TextStyle(fontSize: 13, color: kForeground),
            ),
          ),
          const SizedBox(width: 4),
          isPosting
              ? const SizedBox(
                  width: 40,
                  height: 40,
                  child: Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: kPrimary,
                        strokeWidth: 2,
                      ),
                    ),
                  ),
                )
              : IconButton(
                  icon: const Icon(Icons.send_rounded),
                  color: kPrimary,
                  onPressed: onPost,
                  tooltip: 'Post comment',
                ),
        ],
      ),
    );
  }
}
