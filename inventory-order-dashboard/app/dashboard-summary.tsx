"use client";

type DashboardView = "stock" | "create" | "orders" | "purchases" | "reports";

export function Dashboard({ go }: { go: (view: DashboardView) => void }) {
  const items: { count: string; title: string; note: string; action: string; target: DashboardView }[] = [
    { count: "03", title: "筆訂單待確認", note: "確認後將立即扣除可售庫存", action: "前往確認", target: "orders" },
    { count: "04", title: "項商品庫存不足", note: "已低於安全庫存，建議建立補貨單", action: "查看庫存", target: "stock" },
    { count: "02", title: "張採購單待收貨", note: "預計今天到貨", action: "處理收貨", target: "purchases" },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => go("stock")} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E1DB] bg-white px-4 text-sm font-semibold text-[#58544D] hover:bg-[#FCFBF9]">查看庫存總覽</button>
        <button onClick={() => go("create")} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white hover:bg-[#46423D]">＋ 建立訂單</button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6">
          <h1 className="text-lg font-semibold text-[#292824]">今日營運</h1>
        </div>
        <div className="divide-y divide-[#F0EDE8]">
          {items.map((item) => (
            <article key={item.title} className="flex items-center gap-3 px-5 py-4 sm:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F4EF] text-xs font-bold text-[#58715E]">{item.count}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-[#48443E]">{item.title}</h2>
                <p className="mt-1 truncate text-xs text-[#898379]">{item.note}</p>
              </div>
              <button onClick={() => go(item.target)} className="shrink-0 whitespace-nowrap text-sm font-semibold text-[#5E7665]">{item.action} →</button>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="flex items-center justify-between border-b border-[#F0EDE8] px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold text-[#292824]">報表中心大綱</h2>
          <button onClick={() => go("reports")} className="text-sm font-semibold text-[#5E7665]">查看完整報表 →</button>
        </div>
        <div className="grid divide-y divide-[#F0EDE8] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5 sm:p-6"><p className="text-xs font-semibold text-[#807A72]">本月銷售額</p><p className="mt-3 text-2xl font-semibold tracking-[-.05em] text-[#292824]">NT$ 284,600</p><p className="mt-2 text-xs text-[#4B7154]">較上月 +16.8%</p></div>
          <div className="p-5 sm:p-6"><p className="text-xs font-semibold text-[#807A72]">已確認訂單</p><p className="mt-3 text-2xl font-semibold tracking-[-.05em] text-[#292824]">148 筆</p><p className="mt-2 text-xs text-[#8B847A]">平均訂單 NT$ 1,923</p></div>
          <div className="p-5 sm:p-6"><p className="text-xs font-semibold text-[#807A72]">商品售罄率</p><p className="mt-3 text-2xl font-semibold tracking-[-.05em] text-[#292824]">72.4%</p><p className="mt-2 text-xs text-[#8B847A]">低庫存商品 4 項</p></div>
        </div>
      </section>
    </>
  );
}
