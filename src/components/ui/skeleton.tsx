import { cn } from "@/lib/utils";

// shadcn/ui Skeleton — 로딩 중 자리 표시
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("bg-muted animate-pulse rounded-md", className)} {...props} />;
}

export { Skeleton };
