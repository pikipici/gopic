export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <div className="aspect-[3/4] animate-pulse bg-white/[0.06]" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 rounded-full bg-white/[0.08]" />
            <div className="h-3 w-full rounded-full bg-white/[0.06]" />
            <div className="h-3 w-4/5 rounded-full bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}
