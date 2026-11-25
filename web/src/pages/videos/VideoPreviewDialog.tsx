import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Plus } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { categoryBadgeVariant, categoryLabel } from "@/lib/featureCatalog";
import { videoStatusVariant } from "@/lib/videoStatus";
import { formatDuration } from "@/lib/format";
import { videosService, type Video } from "@/services/videos";

/**
 * Preview player. Fetches a short-lived signed stream URL for the selected
 * video and plays it inline.
 *
 * The URL is fetched per open rather than held on the page, because it expires;
 * a stale one from a previous open would fail to play.
 */
export function VideoPreviewDialog({ video, onClose }: { video: Video | null; onClose: () => void }) {
  const [streamSrc, setStreamSrc] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (!video) { setStreamSrc(null); return; }

    setStreamSrc(null);
    setVideoError(false);

    // Guarded so a slow response for a video the user already closed does not
    // start playing over the top of the next one.
    let cancelled = false;
    videosService.fetchStreamUrl(video.id)
      .then(url => { if (!cancelled) setStreamSrc(url); })
      .catch(() => { if (!cancelled) setVideoError(true); });

    return () => { cancelled = true; };
  }, [video?.id]);

  if (!video) return null;

  return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60"
        onClick={() => onClose()}
      >
        <div
          className="bg-card rounded-2xl shadow-xl w-full max-w-3xl p-6"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-section-title">{video.title}</h2>
              {video.description && (
                <p className="text-caption mt-0.5">{video.description}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onClose()}>
              <Plus className="h-4 w-4 rotate-45" />
            </Button>
          </div>
          {videoError ? (
            <div className="w-full rounded-xl bg-muted flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-foreground">Unable to play this video</p>
              <p className="text-caption mt-1">The video file may not be available on the server yet.</p>
            </div>
          ) : !streamSrc ? (
            <div className="w-full rounded-xl bg-muted flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading video…</p>
            </div>
          ) : (
            <video
              key={video.id}
              src={streamSrc}
              controls
              autoPlay
              className="w-full rounded-xl bg-black max-h-[60vh]"
              onError={() => setVideoError(true)}
            >
              Your browser does not support the video tag.
            </video>
          )}
          <div className="flex items-center gap-3 mt-4">
            <StatusBadge variant={categoryBadgeVariant(video.category)}>{categoryLabel(video.category)}</StatusBadge>
            <StatusBadge variant={videoStatusVariant(video.status)}>
              {video.status.charAt(0) + video.status.slice(1).toLowerCase()}
            </StatusBadge>
            <StatusBadge variant={video.is_free ? "success" : "info"}>
              {video.is_free ? "Free" : "Paid"}
            </StatusBadge>
            {video.duration_seconds != null && video.duration_seconds > 0 && (
              <span className="text-sm text-muted-foreground font-mono ml-auto">
                {formatDuration(video.duration_seconds)}
              </span>
            )}
          </div>
        </div>
      </div>
  );
}
