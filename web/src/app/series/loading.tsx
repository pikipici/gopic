import { CardGridSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-4">
        <div className="h-4 w-32 animate-pulse rounded-full bg-lime-300/20" />
        <div className="h-12 w-72 animate-pulse rounded-full bg-white/10" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded-full bg-white/5" />
      </div>
      <CardGridSkeleton />
    </main>
  );
}
