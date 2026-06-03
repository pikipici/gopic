"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

export function SiteHeaderShell() {
  const pathname = usePathname();
  const isReaderRoute = /^\/series\/[^/]+\/[^/]+$/.test(pathname);

  if (isReaderRoute) {
    return null;
  }

  return <SiteHeader />;
}
