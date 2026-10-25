"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Odświeża dane strony co `sekundy` - ranking i wyzwania „na żywo” bez subskrypcji. */
export function Odswiezaj({ sekundy = 15 }: { sekundy?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), sekundy * 1000);
    return () => clearInterval(t);
  }, [router, sekundy]);
  return null;
}
