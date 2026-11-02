import { Skeleton } from "@/components/ui/skeleton";

/** 화면 전환 중 즉시 보이는 뼈대 (서버 응답을 기다리는 동안 빈 화면 방지) */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-4" aria-busy="true" aria-label="불러오는 중">
      <div className="flex items-center justify-between px-0 pt-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}
