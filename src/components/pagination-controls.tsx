
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  isLoading?: boolean;
  className?: string;
  showSummary?: boolean;
  showControls?: boolean;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  totalRecords,
  limit,
  onPageChange,
  onLimitChange,
  isLoading,
  className,
  showSummary = true,
  showControls = true,
}: PaginationControlsProps) {
  if (totalRecords === 0 || (!showSummary && !showControls)) {
    return null;
  }

  const safeTotalPages = Math.max(totalPages, 1);
  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endRecord = Math.min(currentPage * limit, totalRecords);

  return (
    <div
      className={cn(
        "space-y-3 px-3 py-4 sm:px-4",
        showControls ? "border-t" : "rounded-lg border bg-muted/20",
        className
      )}
    >
      {showSummary ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{startRecord}</span> to{" "}
            <span className="font-medium text-foreground">{endRecord}</span> of{" "}
            <span className="font-medium text-foreground">{totalRecords}</span> records
            <span className="mx-2 hidden text-border sm:inline">|</span>
            <span className="block sm:inline">
              Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
              <span className="font-medium text-foreground">{safeTotalPages}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="limit-select" className="text-sm text-muted-foreground">
              Show
            </Label>
            <Select
              value={String(limit)}
              onValueChange={(value) => onLimitChange(Number(value))}
              disabled={isLoading}
            >
              <SelectTrigger id="limit-select" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">per page</span>
          </div>
        </div>
      ) : null}

      {showControls ? (
        <div className="flex justify-end">
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg bg-muted/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {safeTotalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        </div>
      ) : null}
    </div>
  );
}
