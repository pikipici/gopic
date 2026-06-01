import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/series", label: "Series" },
  { href: "/library", label: "Library" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08080a]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-lime-300 text-xs font-black text-black">
            G
          </span>
          <span className="text-base font-black tracking-tight text-white">Gomic</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-bold text-zinc-300 sm:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/series" className="hidden rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-zinc-300 transition hover:border-lime-300/40 hover:text-lime-100 sm:block">
          Browse
        </Link>
      </div>
    </header>
  );
}
