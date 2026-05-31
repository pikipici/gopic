import Link from "next/link";

const navItems = [
  { href: "/series", label: "Series" },
  { href: "/library", label: "Library" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07070a]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-lime-400 text-sm font-black text-black">
            G
          </span>
          <span className="text-lg font-bold tracking-tight text-white">Gomic</span>
        </Link>
        <nav className="hidden items-center gap-2 text-sm font-medium text-zinc-300 sm:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
