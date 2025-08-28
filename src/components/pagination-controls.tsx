
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  isLoading?: boolean;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  totalRecords,
  limit,
  onPageChange,
  onLimitChange,
  isLoading,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <CardFooter className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({totalRecords} records)
            </div>
            <div className="flex items-center gap-2">
                <Label htmlFor="limit-select" className="text-sm text-muted-foreground">Show:</Label>
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
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
            >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
            >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
        </div>
    </CardFooter>
  );
}

    