import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, MoreHorizontal, Upload, Trash2, Eye, Lock, Play, CheckCircle, MessageSquare, Pencil, Star } from "lucide-react";
import { toast } from "sonner";
import { videosService, type Video } from "@/services/videos";
import { CONTENT_CATEGORIES, categoryLabel, categoryBadgeVariant } from "@/lib/featureCatalog";
import { videoStatusVariant } from "@/lib/videoStatus";
import { VideoUploadDialog } from "./videos/VideoUploadDialog";
import { VideoEngagementDialog } from "./videos/VideoEngagementDialog";
import { VideoEditDialog } from "./videos/VideoEditDialog";
import { VideoPreviewDialog } from "./videos/VideoPreviewDialog";
import { formatDuration, formatElapsed } from "@/lib/format";

/// Transcode column: live state while processing, error message + retry
/// button on failure, and how long the transcode took once complete — so the
/// client can always see what's happening with a video.
function TranscodeCell({ video: v, onRetry }: { video: Video; onRetry: () => void }) {
  if (v.status === "PROCESSING") {
    const elapsed = v.transcode_started_at && !v.transcode_finished_at
      ? formatElapsed(Date.now() - new Date(v.transcode_started_at).getTime())
      : null;
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <span>Transcoding…{elapsed ? ` ${elapsed}` : ""}</span>
      </div>
    );
  }
  if (v.status === "ERROR") {
    return (
      <div className="text-xs max-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="font-medium text-danger">Failed</span>
          <button
            className="px-2 py-0.5 rounded-md border border-danger/40 text-danger font-medium hover:bg-danger/10 transition-colors"
            onClick={onRetry}
          >
            Retry Transcode
          </button>
        </div>
        {v.transcode_error && (
          <p className="text-muted-foreground truncate mt-0.5 cursor-help" title={v.transcode_error}>
            {v.transcode_error}
          </p>
        )}
      </div>
    );
  }
  if (v.transcode_started_at && v.transcode_finished_at) {
    const took =
      new Date(v.transcode_finished_at).getTime() -
      new Date(v.transcode_started_at).getTime();
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Completed <span className="text-muted-foreground">in {formatElapsed(took)}</span></span>
      </div>
    );
  }
  if (v.has_hls) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Completed</span>
      </div>
    );
  }
  // Legacy: published before the transcode pipeline — offer to transcode now.
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Not transcoded</span>
      <button
        className="px-2 py-0.5 rounded-md border border-border text-foreground font-medium hover:bg-muted transition-colors"
        onClick={onRetry}
      >
        Transcode
      </button>
    </div>
  );
}

export default function VideosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isFreeFilter, setIsFreeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [playVideo, setPlayVideo] = useState<Video | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Video | null>(null);

  // Edit modal state
  const [editVideo, setEditVideo] = useState<Video | null>(null);

  // Engagement modal state
  const [engVideo, setEngVideo] = useState<Video | null>(null);

  const prevStatusRef = useRef<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["videos", page, search, catFilter, statusFilter, isFreeFilter],
    queryFn: () => videosService.list({
      page, limit: 10,
      search: search || undefined,
      category: catFilter || undefined,
      status: statusFilter || undefined,
      is_free: isFreeFilter !== "" ? isFreeFilter === "true" : undefined,
    }),
    refetchInterval: (query) => {
      const vids: Video[] = (query.state.data as { data?: Video[] } | undefined)?.data ?? [];
      return vids.some(v => v.status === "PROCESSING") ? 10_000 : false;
    },
  });

  const videos: Video[] = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    const prev = prevStatusRef.current;
    videos.forEach(v => {
      if (prev[v.id] === "PROCESSING") {
        if (v.status === "PUBLISHED") toast.success(`"${v.title}" finished processing and is now published.`);
        else if (v.status === "ERROR") toast.error(`"${v.title}" failed to process.`);
      }
    });
    prevStatusRef.current = Object.fromEntries(videos.map(v => [v.id, v.status]));
  }, [videos]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => videosService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); toast.success("Video deleted."); },
    onError: () => toast.error("Failed to delete video."),
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => videosService.retry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); toast.success("Video requeued for transcoding."); },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err?.response?.data?.message ?? "Failed to retry."),
  });

  const togglePreviewMut = useMutation({
    mutationFn: ({ id, is_preview }: { id: string; is_preview: boolean }) =>
      videosService.update(id, { is_preview }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); },
    onError: () => toast.error("Failed to update preview."),
  });

  const toggleFreeMut = useMutation({
    mutationFn: ({ id, is_free }: { id: string; is_free: boolean }) =>
      videosService.update(id, { is_free }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); },
    onError: () => toast.error("Failed to update access."),
  });

  const toggleIntroMut = useMutation({
    mutationFn: ({ id, is_intro }: { id: string; is_intro: boolean }) =>
      videosService.update(id, { is_intro }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); },
    onError: () => toast.error("Failed to update intro status."),
  });

  const togglePublishMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      videosService.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); },
    // Surface the API's reason (e.g. "video is still transcoding — it can
    // be published once transcoding completes") instead of a generic error.
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err?.response?.data?.message ?? "Failed to update status."),
  });

  const createMut = useMutation({
    mutationFn: (data: object) => videosService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); },
    onError: () => {},
  });

  const handleTogglePublish = (v: Video) => {
    const next = v.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    togglePublishMut.mutate({ id: v.id, status: next });
    toast.success(`"${v.title}" ${next === "PUBLISHED" ? "published" : "unpublished"}.`);
    setActionMenu(null);
  };

  const handleTogglePreview = (v: Video) => {
    togglePreviewMut.mutate({ id: v.id, is_preview: !v.is_preview });
    toast.success(`Preview ${v.is_preview ? "disabled" : "enabled"} for "${v.title}".`);
    setActionMenu(null);
  };

  const handleToggleFree = (v: Video) => {
    toggleFreeMut.mutate({ id: v.id, is_free: !v.is_free });
    toast.success(`"${v.title}" changed to ${v.is_free ? "Paid" : "Free"}.`);
    setActionMenu(null);
  };

  const handleToggleIntro = (v: Video) => {
    if (v.is_intro) {
      toggleIntroMut.mutate({ id: v.id, is_intro: false });
      toast.success(`Intro unset for "${v.title}".`);
    } else {
      toggleIntroMut.mutate({ id: v.id, is_intro: true });
      toast.success(`"${v.title}" set as intro video.`);
    }
    setActionMenu(null);
  };

  const handleDelete = (v: Video) => {
    setDeleteTarget(v);
    setActionMenu(null);
  };

  return (
    <div onClick={() => setActionMenu(null)}>
      <PageHeader title="Videos" subtitle="Upload and manage training videos">
        <Button onClick={() => setShowUpload(true)}><Plus className="h-4 w-4" /> Upload Video</Button>
      </PageHeader>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-muted border-0"
          />
        </div>
        <select
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {CONTENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{categoryLabel(c)}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="PROCESSING">Processing</option>
          <option value="ERROR">Error</option>
        </select>
        <select
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
          value={isFreeFilter}
          onChange={e => { setIsFreeFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Access</option>
          <option value="true">Free</option>
          <option value="false">Paid</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="bg-table-header">
              <th className="text-table-header text-left px-4 py-3">Video</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">Category</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">Duration</th>
              <th className="text-table-header text-left px-4 py-3">Status</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">Transcode</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">Preview</th>
              <th className="text-table-header text-left px-4 py-3 hidden md:table-cell">Access</th>
              <th className="text-table-header text-left px-4 py-3 hidden lg:table-cell">Uploaded</th>
              <th className="text-table-header text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={9} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
              ))
              : videos.map(v => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-table-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {v.thumbnail_url
                          ? <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                          : v.preview_url
                          ? <video src={v.preview_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                          : <Upload className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{v.title}</p>
                        <p className="text-caption truncate max-w-[200px]">{v.description ?? ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell"><StatusBadge variant={categoryBadgeVariant(v.category)}>{categoryLabel(v.category)}</StatusBadge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono hidden md:table-cell">{formatDuration(v.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    {/* Retry + error details live in the Transcode column. */}
                    <StatusBadge variant={videoStatusVariant(v.status)}>{v.status.charAt(0) + v.status.slice(1).toLowerCase()}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <TranscodeCell video={v} onRetry={() => retryMut.mutate(v.id)} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <button
                      className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${v.is_preview ? "bg-primary" : "bg-muted"}`}
                      onClick={() => handleTogglePreview(v)}
                      title={v.is_preview ? "Disable preview" : "Enable preview"}
                    >
                      <div className={`w-4 h-4 rounded-full bg-card transition-transform ${v.is_preview ? "translate-x-4" : ""}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StatusBadge variant={v.is_free ? "success" : "info"}>
                      {v.is_free ? "Free" : "Paid"}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                    {new Date(v.uploaded_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View engagement"
                        onClick={e => { e.stopPropagation(); setEngVideo(v); setActionMenu(null); }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setActionMenu(actionMenu === v.id ? null : v.id)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      {actionMenu === v.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted"
                            onClick={() => { setEditVideo(v); setActionMenu(null); }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit Video
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted"
                            onClick={() => { setPlayVideo(v); setActionMenu(null); }}
                          >
                            <Play className="h-3.5 w-3.5" /> Play Video
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted"
                            onClick={() => handleTogglePreview(v)}
                          >
                            <Eye className="h-3.5 w-3.5" /> Toggle Preview
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted"
                            onClick={() => handleToggleFree(v)}
                          >
                            <Lock className="h-3.5 w-3.5" />
                            {v.is_free ? "Mark as Paid" : "Mark as Free"}
                          </button>
                          <button
                            className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted ${v.is_intro ? "text-amber-400" : "text-foreground"}`}
                            onClick={() => handleToggleIntro(v)}
                          >
                            <Star className={`h-3.5 w-3.5 ${v.is_intro ? "fill-amber-400" : ""}`} />
                            {v.is_intro ? "Unset Intro Video" : "Set as Intro Video"}
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted"
                            onClick={() => handleTogglePublish(v)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            {v.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-muted"
                            onClick={() => handleDelete(v)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                    </div>
                  </td>
                </tr>
              ))
            }
            {!isLoading && videos.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">No videos found.</td></tr>
            )}
          </tbody>
        </table>
        {meta && meta.pages > 1 && (
          <div className="bg-table-header px-4 py-3 flex items-center justify-between">
            <span className="text-caption">Page {page} of {meta.pages} · {meta.total} total</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page === meta.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <VideoPreviewDialog video={playVideo} onClose={() => setPlayVideo(null)} />

      <VideoEngagementDialog video={engVideo} onClose={() => setEngVideo(null)} />

      <VideoEditDialog video={editVideo} onClose={() => setEditVideo(null)} />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <Trash2 className="h-5 w-5 text-danger" />
            </div>
            <h2 className="text-section-title text-center">Delete Video?</h2>
            <p className="text-sm text-muted-foreground text-center mt-1 mb-1">
              <span className="font-medium text-foreground">"{deleteTarget.title}"</span>
            </p>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Are you sure you want to delete this video? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-danger hover:bg-danger/90 text-white"
                disabled={deleteMut.isPending}
                onClick={() => {
                  deleteMut.mutate(deleteTarget.id, {
                    onSettled: () => setDeleteTarget(null),
                  });
                }}
              >
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <VideoUploadDialog open={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  );
}
