import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Plus, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { videosService, type Video, type EngagementStats, type VideoComment } from "@/services/videos";
import { timeAgo } from "@/lib/format";

/** Comments come back a page at a time; a short page means we have them all. */
const COMMENTS_PER_PAGE = 20;

/**
 * The Engagement modal: reaction counts for a video, its comment thread, and
 * the admin's reply box.
 *
 * Rendered only while a video is selected, and it reloads whenever that
 * changes, so all nine pieces of thread state belong here rather than on the
 * page — none of them mean anything once the modal is shut.
 */
export function VideoEngagementDialog({ video, onClose }: { video: Video | null; onClose: () => void }) {
  const [engagement, setEngagement] = useState<EngagementStats | null>(null);
  const [engComments, setEngComments] = useState<VideoComment[]>([]);
  const [engPage, setEngPage] = useState(1);
  const [engLoading, setEngLoading] = useState(false);
  const [engHasMore, setEngHasMore] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

  // Load stats and the first page of comments whenever a different video is
  // opened, and clear the previous video's thread so it never flashes up
  // under the new title.
  useEffect(() => {
    if (!video) return;

    setEngagement(null);
    setEngComments([]);
    setEngPage(1);
    setEngHasMore(false);
    setReplyTargetId(null);
    setReplyText("");
    setEngLoading(true);

    let cancelled = false;
    Promise.all([
      videosService.getEngagement(video.id),
      videosService.getComments(video.id, 1),
    ])
      .then(([stats, comments]) => {
        if (cancelled) return;
        setEngagement(stats);
        setEngComments(comments);
        setEngHasMore(comments.length === COMMENTS_PER_PAGE);
      })
      .catch(() => { if (!cancelled) toast.error("Failed to load engagement data."); })
      .finally(() => { if (!cancelled) setEngLoading(false); });

    return () => { cancelled = true; };
  }, [video?.id]);

  const loadMoreEngComments = async () => {
    if (!video || engLoading) return;
    const nextPage = engPage + 1;
    setEngLoading(true);
    try {
      const more = await videosService.getComments(video.id, nextPage);
      setEngComments(prev => [...prev, ...more]);
      setEngPage(nextPage);
      setEngHasMore(more.length === COMMENTS_PER_PAGE);
    } catch {
      toast.error("Failed to load more comments.");
    } finally {
      setEngLoading(false);
    }
  };

  const handleDeleteEngComment = async (commentId: string) => {
    if (!video) return;
    try {
      await videosService.deleteComment(video.id, commentId);
      setEngComments(prev => prev.filter(c => c.id !== commentId));
      if (engagement) setEngagement({ ...engagement, comment_count: engagement.comment_count - 1 });
    } catch {
      toast.error("Failed to delete comment.");
    }
  };

  const handleSendReply = async (c: VideoComment) => {
    if (!video || !replyText.trim() || replySending) return;
    setReplySending(true);
    try {
      const reply = await videosService.replyToComment(video.id, c.thread_user_id, replyText.trim());
      setEngComments(prev => [reply, ...prev]);
      if (engagement) setEngagement({ ...engagement, comment_count: engagement.comment_count + 1 });
      setReplyText("");
      setReplyTargetId(null);
    } catch {
      toast.error("Failed to send reply.");
    } finally {
      setReplySending(false);
    }
  };

  if (!video) return null;

  return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60"
        onClick={() => onClose()}
      >
        <div
          className="bg-card rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-section-title">Engagement</h2>
              <p className="text-caption mt-0.5 truncate max-w-[320px]">{video.title}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onClose()}>
              <Plus className="h-4 w-4 rotate-45" />
            </Button>
          </div>

          {engLoading && !engagement ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* Reaction counts */}
              {engagement && (
                <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-border shrink-0">
                  <div className="flex flex-col items-center gap-1 bg-muted rounded-xl py-3">
                    <ThumbsUp className="h-5 w-5 text-primary" />
                    <span className="text-xl font-bold text-foreground">{engagement.like_count}</span>
                    <span className="text-xs text-muted-foreground">Likes</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-muted rounded-xl py-3">
                    <ThumbsDown className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xl font-bold text-foreground">{engagement.dislike_count}</span>
                    <span className="text-xs text-muted-foreground">Dislikes</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 bg-muted rounded-xl py-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xl font-bold text-foreground">{engagement.comment_count}</span>
                    <span className="text-xs text-muted-foreground">Comments</span>
                  </div>
                </div>
              )}

              {/* Comments list */}
              <div className="overflow-y-auto flex-1 px-6 py-4">
                <p className="text-sm font-semibold text-foreground mb-3">
                  Private messages ({engagement?.comment_count ?? 0})
                </p>
                <p className="text-xs text-muted-foreground -mt-2 mb-3">
                  Each user only sees their own messages and your replies to them.
                </p>
                {engComments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {engComments.map(c => (
                      <div key={c.id} className={c.is_admin ? "rounded-lg bg-primary/5 -mx-2 px-2 py-2" : ""}>
                        <div className="flex items-start gap-3">
                          {c.is_admin ? (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <MessageSquare className="h-4 w-4 text-primary-foreground" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                              {c.user_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {c.is_admin ? `${c.user_name} (Admin)` : c.user_name}
                              </span>
                              <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 break-words">{c.content}</p>
                            {!c.is_admin && (
                              <button
                                className="text-xs text-primary hover:underline mt-1"
                                onClick={() => {
                                  setReplyTargetId(replyTargetId === c.id ? null : c.id);
                                  setReplyText("");
                                }}
                              >
                                Reply
                              </button>
                            )}
                            {replyTargetId === c.id && (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  className="flex-1 h-8 rounded-lg border border-border bg-muted px-2 text-sm"
                                  placeholder={`Reply to ${c.user_name}…`}
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSendReply(c); } }}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  disabled={replySending || !replyText.trim()}
                                  onClick={() => handleSendReply(c)}
                                >
                                  {replySending ? "Sending…" : "Send"}
                                </Button>
                              </div>
                            )}
                          </div>
                          <button
                            className="shrink-0 text-muted-foreground hover:text-danger transition-colors"
                            title="Delete comment"
                            onClick={() => handleDeleteEngComment(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {engHasMore && (
                  <button
                    className="mt-4 w-full text-sm text-primary hover:underline disabled:opacity-50"
                    disabled={engLoading}
                    onClick={loadMoreEngComments}
                  >
                    {engLoading ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
  );
}
