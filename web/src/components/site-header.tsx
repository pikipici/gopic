import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 h-16 bg-[#22282a] text-[#cdd5d6]">
      <div className="mx-auto grid h-16 max-w-[1400px] grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-6 px-5 sm:px-7 lg:px-12">
        <Link href="/" aria-label="Gomic home" className="relative block h-8 w-28 text-[#cdd5d6]">
          <span className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-[7px] border border-[#3a4447] bg-[#2a3134] text-sm font-black text-cyan-300">
            G
          </span>
          <span className="absolute left-9 top-0 flex h-8 items-center text-[22px] font-black uppercase tracking-[-0.08em] text-[#cdd5d6]">
            Gomic
          </span>
        </Link>

        <form action="/series" className="relative hidden h-10 w-full max-w-[500px] items-center justify-self-center rounded-md bg-[#2a3134] pl-[38px] pr-2 md:flex">
          <svg className="absolute left-3 top-3 text-[#6f7778]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input name="q" placeholder="Search any title..." className="min-w-0 flex-1 bg-transparent text-sm text-[#cdd5d6] outline-none placeholder:text-[#6f7778]" />
          <Link href="/series" className="rounded bg-[#22282a]/60 px-2.5 py-1 text-[11px] font-bold text-[#9da4a5] transition hover:text-white">
            Browse
          </Link>
        </form>

        <nav className="flex h-10 items-center justify-end gap-2">
          <Link href="/series" aria-label="Open search" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[#9da4a5] transition hover:bg-[#2a3134] hover:text-white md:hidden">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
          <Link href="/library" aria-label="Open library" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[#9da4a5] transition hover:bg-[#2a3134] hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
            </svg>
          </Link>
          <Link href="/series" aria-label="Browse menu" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[#9da4a5] transition hover:bg-[#2a3134] hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </Link>
          <Link href="/admin" className="hidden h-10 items-center rounded-md bg-[#cdd5d6] px-[18px] text-[13px] font-bold text-[#22282a] transition hover:bg-white sm:inline-flex">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
