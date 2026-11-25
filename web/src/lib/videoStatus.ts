/**
 * Maps a video's status to the badge colour that represents it, so the admin
 * table and the playlist editor cannot drift into showing different colours for
 * the same state.
 *
 * The four statuses come from the API (models.VideoStatus): a video is
 * PROCESSING while the transcoder works, then PUBLISHED or ERROR, and DRAFT
 * anywhere in between.
 */
export function videoStatusVariant(status: string) {
  if (status === "PUBLISHED") return "success" as const;
  if (status === "PROCESSING") return "warning" as const;
  if (status === "ERROR") return "danger" as const;
  return "neutral" as const;
}
