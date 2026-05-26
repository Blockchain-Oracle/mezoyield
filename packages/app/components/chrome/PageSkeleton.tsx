import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Variant = "dashboard" | "grid" | "table";

interface PageSkeletonProps {
  variant?: Variant;
  children?: ReactNode;
}

export function PageSkeleton({ variant = "table", children }: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
      </div>
      {children ?? <DefaultBody variant={variant} />}
    </div>
  );
}

function DefaultBody({ variant }: { variant: Variant }) {
  if (variant === "dashboard") {
    return (
      <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </>
    );
  }
  if (variant === "grid") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full" />
        ))}
      </div>
    );
  }
  return <Skeleton className="h-72 w-full" />;
}
