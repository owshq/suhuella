"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  getPageIdFromPathname,
  getPageTitle,
} from "@/lib/i18n/page-title";

export function DocumentTitle() {
  const { locale } = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    const page = getPageIdFromPathname(pathname);
    document.title = getPageTitle(locale, page);
  }, [locale, pathname]);

  return null;
}
