"use client";

import Link from "next/link";
import {
  lineOfficialUrl,
  ProductCatalog,
  roundedFontFamily,
} from "../home-client";

export default function ProductsPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[#FAF7F0] text-[#605B51]" style={{ fontFamily: roundedFontFamily }}>
      <header className="sticky top-0 z-30 border-b border-[#D9D6D0]/90 bg-[#FAF7F0]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="group leading-none" aria-label="回到信男代購首頁">
            <span className="block text-base font-semibold tracking-[0.13em] sm:text-lg">信男代購</span>
            <span className="mt-1 block text-[9px] font-medium tracking-[0.22em] text-[#605B51]/70 transition-colors group-hover:text-[#605B51]">
              WOBUY174_
            </span>
          </Link>
          <a
            className="rounded-full bg-[#605B51] px-3.5 py-2.5 text-[11px] font-medium tracking-[0.06em] text-[#F5F5F5] transition-colors hover:bg-[#766F63] sm:px-4"
            href={lineOfficialUrl}
            target="_blank"
            rel="noreferrer"
          >
            LINE@ 詢價
          </a>
        </div>
      </header>
      <ProductCatalog />
    </main>
  );
}
