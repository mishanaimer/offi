import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-page py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-9 flex-1 max-w-md rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <div className="card-surface overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
          >
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-2/3 hidden md:block" />
              <Skeleton className="h-3.5 w-1/2 hidden md:block" />
              <Skeleton className="h-3.5 w-1/3 hidden md:block" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
