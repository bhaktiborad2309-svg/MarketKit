import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";
import { videosService, type Video } from "@/services/videos";
import { playlistsService } from "@/services/playlists";
import { CONTENT_CATEGORIES, categoryLabel } from "@/lib/featureCatalog";

/**
 * The "Edit Video" modal: title, description, category, thumbnail and playlist.
 *
 * Its form state is seeded from the video each time a different one is opened,
 * so it lives here rather than on the page — the page only decides which video
 * is being edited.
 */
export function VideoEditDialog({ video, onClose }: { video: Video | null; onClose: () => void }) {
  const qc = useQueryClient();

  // Hidden file input behind the thumbnail picker.
  const editThumbRef = useRef<HTMLInputElement>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editThumb, setEditThumb] = useState<File | null>(null);
  const [editThumbPreview, setEditThumbPreview] = useState<string | null>(null);
  const [editPlaylistId, setEditPlaylistId] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const { data: playlistsData = [] } = useQuery({
    queryKey: ["admin-playlists"],
    queryFn: () => playlistsService.list(),
  });

  // Seed the form from whichever video was opened.
  useEffect(() => {
    if (!video) return;
    setEditTitle(video.title);
    setEditDesc(video.description ?? "");
    setEditCategory(video.category);
    setEditThumb(null);
    setEditThumbPreview(video.thumbnail_url ?? null);
    setEditPlaylistId("");
    setNewPlaylistName("");
  }, [video?.id]);

  const createPlaylistMut = useMutation({
    // A quick-created playlist inherits the video's category — playlists only
    // accept videos of their own category.
    mutationFn: (name: string) => playlistsService.create({ name, description: "", thumbnail_url: "", category: editCategory }),
    onSuccess: (newPl) => {
      qc.invalidateQueries({ queryKey: ["admin-playlists"] });
      setEditPlaylistId(newPl.id);
      setNewPlaylistName("");
      toast.success(`Playlist "${newPl.name}" created.`);
    },
    onError: () => toast.error("Failed to create playlist."),
  });

  const handleAddPlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    createPlaylistMut.mutate(name);
  };

  const editMut = useMutation({
    mutationFn: ({ id, fd }: { id: string; fd: FormData }) => videosService.edit(id, fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videos"] });
      onClose();
      toast.success("Video updated.");
    },
    onError: () => toast.error("Failed to update video."),
  });

  const handleEditSave = () => {
    if (!video || !editTitle.trim()) { toast.error("Title is required."); return; }
    const fd = new FormData();
    fd.append("title", editTitle.trim());
    fd.append("description", editDesc);
    fd.append("category", editCategory);
    if (editThumb) fd.append("thumbnail", editThumb);
    // An empty selection means "remove from its playlist", which the API
    // spells as clear_playlist rather than an empty playlist_id.
    if (editPlaylistId) fd.append("playlist_id", editPlaylistId);
    else fd.append("clear_playlist", "1");
    editMut.mutate({ id: video.id, fd });
  };

  const handleEditThumbChange = (file: File | null) => {
    setEditThumb(file);
    setEditThumbPreview(file ? URL.createObjectURL(file) : (video?.thumbnail_url ?? null));
  };

  if (!video) return null;

  return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40"
        onClick={() => onClose()}
      >
        <div
          className="bg-card rounded-2xl shadow-xl w-full max-w-lg p-6"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-section-title">Edit Video</h2>
            <Button variant="ghost" size="icon" onClick={() => onClose()}>
              <Plus className="h-4 w-4 rotate-45" />
            </Button>
          </div>

          {/* Thumbnail picker */}
          <div className="mb-5">
            <label className="text-sm font-medium text-foreground">Thumbnail</label>
            <div
              className="mt-1 border border-dashed border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary transition-colors"
              onClick={() => editThumbRef.current?.click()}
            >
              {editThumbPreview
                ? <img src={editThumbPreview} alt="Thumbnail" className="w-24 h-14 object-cover rounded-lg shrink-0" />
                : <div className="w-24 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
              }
              <div className="min-w-0">
                <p className="text-sm text-foreground font-medium truncate">
                  {editThumb ? editThumb.name : "Click to replace thumbnail"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG or WebP · 16:9 recommended</p>
              </div>
              {editThumb && (
                <button
                  className="ml-auto text-xs text-danger hover:underline shrink-0"
                  onClick={e => { e.stopPropagation(); handleEditThumbChange(null); }}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={editThumbRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => handleEditThumbChange(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Title *</label>
              <input
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter video title"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Video description..."
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Category</label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={editCategory}
                onChange={e => {
                  setEditCategory(e.target.value);
                  // A playlist of another category is no longer valid.
                  setEditPlaylistId("");
                }}
              >
                {CONTENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{categoryLabel(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Playlist</label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={editPlaylistId}
                onChange={e => setEditPlaylistId(e.target.value)}
              >
                <option value="">— No playlist —</option>
                {playlistsData.filter(p => p.category === editCategory).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">Only playlists of the selected category are shown.</p>
              <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Create new playlist</p>
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    placeholder="Playlist name..."
                    value={newPlaylistName}
                    onChange={e => setNewPlaylistName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddPlaylist(); } }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 shrink-0"
                    disabled={!newPlaylistName.trim() || createPlaylistMut.isPending}
                    onClick={() => {
                      const name = newPlaylistName.trim();
                      if (!name) return;
                      playlistsService.create({ name, description: "", thumbnail_url: "", category: editCategory }).then(newPl => {
                        qc.invalidateQueries({ queryKey: ["admin-playlists"] });
                        setEditPlaylistId(newPl.id);
                        setNewPlaylistName("");
                        toast.success(`Playlist "${newPl.name}" created.`);
                      }).catch(() => toast.error("Failed to create playlist."));
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => onClose()}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editMut.isPending}>
              {editMut.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
  );
}
