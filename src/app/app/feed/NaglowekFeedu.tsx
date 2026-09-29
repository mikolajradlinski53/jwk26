/** Nagłówek feedu: logo JWK i pod nim małe „feed” (spec porządku, „Feed”). */
export function NaglowekFeedu() {
  return (
    <div className="grid justify-items-center gap-1.5">
      <h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- mały statyczny plik, bez optymalizacji */}
        <img src="/logo/logo-male.webp" alt="JWK26" width={121} height={45} className="h-[45px] w-auto" />
      </h1>
      <p className="text-[0.65rem] uppercase tracking-[0.3em] text-dym">feed</p>
    </div>
  );
}
