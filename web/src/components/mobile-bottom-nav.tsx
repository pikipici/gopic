"use client";

import { usePathname } from "next/navigation";

export function MobileBottomNav() {
  const pathname = usePathname();
  const isReaderRoute = /^\/series\/[^/]+\/[^/]+$/.test(pathname);

  if (isReaderRoute) {
    return null;
  }

  return null;
}
