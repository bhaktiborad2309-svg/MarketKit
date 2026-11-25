import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, CloudUpload, Upload, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { videosService, type Video } from "@/services/videos";
import { playlistsService } from "@/services/playlists";
import { CONTENT_CATEGORIES, categoryLabel, DEFAULT_CATEGORY } from "@/lib/featureCatalog";

/**
 * Streams a file straight to R2 through a presigned URL, reporting progress.
 *
 * Uses XMLHttpRequest rather than fetch because fetch still cannot report
 * upload progress, and a video upload with no progress bar looks hung.
 */
function uploadToR2(url: string, file: File, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`R2 upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

/**
 * The "Upload Video" modal: pick a file and a thumbnail, fill in metadata,
 * optionally attach bonus photos, and upload.
 *
 * It owns all of its own form state — fourteen fields that mean nothing to the
 * page behind it — and resets on close. The page only needs to say whether it
 * is open.
 */
export function VideoUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();

  // The file inputs are hidden; the visible drop zones click them.
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCat, setUploadCat] = useState<string>(DEFAULT_CATEGORY);
  const [uploadIsFree, setUploadIsFree] = useState(true);
  const [uploadPlaylistId, setUploadPlaylistId] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadThumb, setUploadThumb] = useState<File | null>(null);
  const [uploadThumbPreview, setUploadThumbPreview] = useState<string | null>(null);
  const [uploadPhotos, setUploadPhotos] = useState<File[]>([]);
  const [uploadPhotosPreviews, setUploadPhotosPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isAttachingPhotos, setIsAttachingPhotos] = useState(false);

  const { data: playlistsData = [] } = useQuery({
    queryKey: ["admin-playlists"],
    queryFn: () => playlistsService.list(),
  });

  const createPlaylistMut = useMutation({
    // A quick-created playlist inherits the upload's category — playlists
    // only accept videos of their own category.
    mutationFn: (name: string) => playlistsService.create({ name, description: "", thumbnail_url: "", category: uploadCat }),
    onSuccess: (newPl) => {
      qc.invalidateQueries({ queryKey: ["admin-playlists"] });
      setUploadPlaylistId(newPl.id);
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

  /** Clears every field. Called on cancel and after a successful upload. */
  const resetForm = () => {
    setUploadTitle(""); setUploadDesc(""); setUploadCat(DEFAULT_CATEGORY);
    setUploadIsFree(true); setUploadPlaylistId(""); setNewPlaylistName(""); setUploadFile(null);
    setUploadThumb(null); setUploadThumbPreview(null);
    uploadPhotosPreviews.forEach(url => URL.revokeObjectURL(url));
    setUploadPhotos([]); setUploadPhotosPreviews([]);
  };

  const closeUpload = () => {
    // Closing mid-upload would leave the request running with no way to see it.
    if (isUploading) return;
    onClose();
    resetForm();
  };

  const handleThumbChange = (file: File | null) => {
    setUploadThumb(file);
    setUploadThumbPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleAddPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setUploadPhotos(prev => [...prev, ...newFiles]);
    setUploadPhotosPreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
  };

  const removeUploadPhoto = (index: number) => {
    setUploadPhotosPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setUploadPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { toast.error("Please enter a video title."); return; }
    if (!uploadFile) { toast.error("Please select a video file."); return; }

    setIsUploading(true);
    setUploadProgress(0);
    let video: Video | null = null;
    try {
      const presign = await videosService.presignUpload(uploadFile.name, uploadFile.type);

      if (presign.direct && presign.upload_url && presign.file_key) {
        // Direct upload: browser → R2 (0-90%), then metadata → server (90-100%)
        await uploadToR2(presign.upload_url, uploadFile, (ratio) =>
          setUploadProgress(Math.round(ratio * 90))
        );
        setUploadProgress(90);
        const fd = new FormData();
        fd.append("file_key", presign.file_key);
        fd.append("title", uploadTitle);
        fd.append("description", uploadDesc);
        fd.append("category", uploadCat);
        fd.append("is_free", String(uploadIsFree));
        if (uploadPlaylistId) fd.append("playlist_id", uploadPlaylistId);
        if (uploadThumb) fd.append("thumbnail", uploadThumb);
        video = await videosService.finalize(fd, (pct) => setUploadProgress(90 + Math.round(pct * 0.1)));
      } else {
        // Fallback: local storage — regular multipart through server
        const fd = new FormData();
        fd.append("title", uploadTitle);
        fd.append("description", uploadDesc);
        fd.append("category", uploadCat);
        fd.append("is_free", String(uploadIsFree));
        if (uploadPlaylistId) fd.append("playlist_id", uploadPlaylistId);
        fd.append("file", uploadFile);
        if (uploadThumb) fd.append("thumbnail", uploadThumb);
        video = await videosService.create(fd, setUploadProgress);
      }

      qc.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Video uploaded and is processing.");

      if (video && uploadPhotos.length > 0) {
        setIsAttachingPhotos(true);
        try {
          const photosFd = new FormData();
          photosFd.append("title", uploadTitle);
          uploadPhotos.forEach(f => photosFd.append("photos", f));
          await videosService.uploadPhotos(video.id, photosFd);
          qc.invalidateQueries({ queryKey: ["photos"] });
        } catch {
          toast.error("Video uploaded, but attaching photos failed — add them from the Photos page.");
        } finally {
          setIsAttachingPhotos(false);
        }
      }

      onClose();
      resetForm();
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!open) return null;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-semibold text-foreground">Upload Video</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Fill in the details and choose a file to upload</p>
            </div>
            <Button variant="ghost" size="icon" onClick={closeUpload} disabled={isUploading}>
              <Plus className="h-4 w-4 rotate-45" />
            </Button>
          </div>

          {/* Body — two columns */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] divide-y md:divide-y-0 md:divide-x divide-border">

              {/* Left — file + thumbnail */}
              <div className="p-5 space-y-4">
                {/* Video drop zone */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Video File *</p>
                  <div
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors h-44 text-center px-4
                      ${uploadFile ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-muted/40"}`}
                    onClick={() => !isUploading && fileRef.current?.click()}
                  >
                    {uploadFile ? (
                      <>
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <CloudUpload className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium text-foreground leading-snug break-all line-clamp-2">{uploadFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        {!isUploading && (
                          <button
                            className="text-xs text-danger hover:underline mt-0.5"
                            onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                          >
                            Remove
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                          <CloudUpload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Drop video here</p>
                          <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
                        </div>
                        <p className="text-xs text-muted-foreground/70">MP4 · MOV · AVI · Max 4 GB</p>
                      </>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>

                {/* Thumbnail */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Thumbnail <span className="normal-case font-normal">(optional)</span>
                  </p>
                  <div
                    className="relative rounded-xl border border-dashed border-border overflow-hidden cursor-pointer hover:border-primary transition-colors group"
                    style={{ aspectRatio: "16/9" }}
                    onClick={() => !isUploading && thumbRef.current?.click()}
                  >
                    {uploadThumbPreview ? (
                      <>
                        <img src={uploadThumbPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <p className="text-xs text-white font-medium">Click to change</p>
                        </div>
                        {!isUploading && (
                          <button
                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-danger"
                            onClick={e => { e.stopPropagation(); handleThumbChange(null); }}
                          >
                            <Plus className="h-3 w-3 rotate-45" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                        <Upload className="h-5 w-5" />
                        <p className="text-xs font-medium">Upload thumbnail</p>
                        <p className="text-[11px] opacity-60">JPG · PNG · WebP · 16:9</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={thumbRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => handleThumbChange(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {/* Right — metadata */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Title *</label>
                  <Input
                    placeholder="Enter video title"
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Description</label>
                  <textarea
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Video description…"
                    value={uploadDesc}
                    onChange={e => setUploadDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Category *</label>
                    <select
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                      value={uploadCat}
                      onChange={e => {
                        const cat = e.target.value;
                        setUploadCat(cat);
                        setUploadIsFree(false);
                        // A playlist of another category is no longer valid.
                        setUploadPlaylistId("");
                      }}
                    >
                      {CONTENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{categoryLabel(c)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Playlist</label>
                    <select
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                      value={uploadPlaylistId}
                      onChange={e => setUploadPlaylistId(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {playlistsData.filter(p => p.category === uploadCat).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">Only playlists matching the category are shown.</p>
                  </div>
                </div>

                {/* Inline create playlist */}
                <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 flex items-center gap-2">
                  <Input
                    className="h-8 text-sm bg-card"
                    placeholder="New playlist name…"
                    value={newPlaylistName}
                    onChange={e => setNewPlaylistName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddPlaylist(); } }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 shrink-0"
                    disabled={!newPlaylistName.trim() || createPlaylistMut.isPending}
                    onClick={handleAddPlaylist}
                  >
                    + Create
                  </Button>
                </div>

                {/* Free access toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Free Access</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {"Videos default to paid — tick the box to make this one free."}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${uploadIsFree ? "bg-primary" : "bg-muted"}`}
                    onClick={() => setUploadIsFree(f => !f)}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${uploadIsFree ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Attach photos (optional) */}
            <div className="px-5 pb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Attach Photos <span className="normal-case font-normal">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-3">
                {uploadPhotosPreviews.map((preview, i) => (
                  <div key={preview} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group shrink-0">
                    <img src={preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    {!isUploading && (
                      <button
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-danger"
                        onClick={() => removeUploadPhoto(i)}
                      >
                        <Plus className="h-3 w-3 rotate-45" />
                      </button>
                    )}
                  </div>
                ))}
                <div
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-muted/40 cursor-pointer flex flex-col items-center justify-center gap-1 text-muted-foreground shrink-0 transition-colors"
                  onClick={() => !isUploading && photosRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  <p className="text-[10px] font-medium">Add</p>
                </div>
                <input
                  ref={photosRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => { handleAddPhotos(e.target.files); e.target.value = ""; }}
                />
              </div>
              <p className="text-xs text-muted-foreground/70 mt-2">
                Shown alongside this video's description and filed in the Photos gallery under the same category.
              </p>
            </div>
          </div>

          {/* Footer — progress + actions */}
          <div className="border-t border-border px-6 py-4 shrink-0 space-y-3">
            {isUploading && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{isAttachingPhotos ? "Attaching photos… do not close this window" : "Uploading… do not close this window"}</span>
                  <span className="font-medium text-foreground">{isAttachingPhotos ? "" : `${uploadProgress}%`}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: isAttachingPhotos ? "100%" : `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeUpload} disabled={isUploading}>Cancel</Button>
              <Button onClick={handleUpload} disabled={isUploading || !uploadFile}>
                {isAttachingPhotos ? "Attaching photos…" : isUploading ? `Uploading ${uploadProgress}%…` : "Upload & Publish"}
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}
