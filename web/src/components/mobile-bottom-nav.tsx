"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: "H" },
  { href: "/series", label: "Series", icon: "S" },
  { href: "/library", label: "Library", icon: "L" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-white/10 bg-black/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-3 gap-1">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center gap-2 rounded-[1.1rem] px-3 py-3 text-xs font-black transition ${
                active ? "bg-lime-300 text-black" : "text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="grid size-5 place-items-center rounded-full border border-current text-[10px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
