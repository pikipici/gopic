import Link from "next/link";

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center sm:p-10">
      <div className="absolute left-1/2 top-0 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-300/10 blur-3xl" />
      <div className="relative mx-auto grid size-14 place-items-center rounded-2xl bg-white/10 text-xl font-black text-lime-300">?</div>
      <h2 className="relative mt-5 text-2xl font-black text-white">{title}</h2>
      <p className="relative mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">{description}</p>
      {href && action ? (
        <Link href={href} className="relative mt-6 inline-flex rounded-full bg-lime-300 px-5 py-3 text-sm font-bold text-black transition hover:bg-lime-200">
          {action}
        </Link>
      ) : null}
    </div>
  );
}
