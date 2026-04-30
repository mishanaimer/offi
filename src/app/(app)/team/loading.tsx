import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full animate-fade-in">
      <aside className="hidden md:flex w-72 shrink-0 border-r border-border/60 flex-col p-3 gap-2">
        <Skeleton className="h-9 w-full rounded-full" />
        <div className="space-y-2 mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        <div className="h-14 border-b border-border/60 px-4 flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`flex gap-2 ${i % 2 ? "justify-end" : ""}`}
            >
              {!(i % 2) && <Skeleton className="w-8 h-8 rounded-full shrink-0" />}
              <div className="space-y-1.5 max-w-[60%]">
                <Skeleton
                  className={`h-${4 + (i % 3)} ${i % 2 ? "w-48" : "w-64"} rounded-2xl`}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
