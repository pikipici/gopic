import { CardGridSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-5">
          <div className="h-10 w-44 animate-pulse rounded-full bg-lime-300/20" />
          <div className="h-24 max-w-2xl animate-pulse rounded-[2rem] bg-white/10" />
          <div className="h-5 max-w-xl animate-pulse rounded-full bg-white/5" />
        </div>
        <CardGridSkeleton count={2} />
      </div>
    </main>
  );
}
