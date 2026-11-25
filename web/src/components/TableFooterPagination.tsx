import { Button } from "@/components/ui/button";
import type { PaginatedMeta } from "@/lib/api";

/**
 * The pager that sits inside a table's footer bar, showing the position in the
 * result set and Previous/Next.
 *
 * Renders nothing when everything fits on one page, so callers can drop it in
 * unconditionally.
 *
 * Note this is not the only pager in the admin panel: a few pages use a
 * chevron-based one below the table instead. They are left as they are —
 * folding them in here would change how those pages look, which is a design
 * decision rather than a refactor.
 */
export function TableFooterPagination({
  page,
  meta,
  onPageChange,
}: {
  page: number;
  meta: PaginatedMeta | undefined;
  /** Receives the page number to move to. */
  onPageChange: (page: number) => void;
}) {
  if (!meta || meta.pages <= 1) return null;

  return (
    <div className="bg-table-header px-4 py-3 flex items-center justify-between">
      <span className="text-caption">
        Page {page} of {meta.pages} · {meta.total} total
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page === meta.pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
