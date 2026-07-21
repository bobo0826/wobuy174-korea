"use client";

const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;

const items = [
  { category: "居家寢具", name: "雲朵感純棉四季被", specification: "奶油白／單人", price: 1680, quantity: 1 },
  { category: "韓國選品", name: "刺繡小熊收納化妝包", specification: "燕麥／小尺寸", price: 420, quantity: 2 },
];

export default function ShippingSlipPage() {
  return <main className="shipping-slip-page min-h-screen bg-[#F8F7F4] px-5 py-8 text-[#292824] sm:px-8 sm:py-12 print:bg-white print:p-0">
    <div className="shipping-slip-shell mx-auto w-full max-w-[560px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div><p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">SHIPPING SLIP</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.05em]">出貨單列印</h1><p className="mt-2 text-sm text-[#7B766E]">確認收件與商品內容後，即可列印出貨單。</p></div>
        <div className="flex gap-2"><a href="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E1DB] bg-white px-4 text-sm font-semibold text-[#58544D]">返回系統</a><button onClick={() => window.print()} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white">列印出貨單</button></div>
      </div>

      <section className="shipping-slip-sheet overflow-hidden rounded-2xl border border-[#DDD8D0] bg-white print:rounded-none print:border-0">
        <header className="flex items-start justify-between gap-4 border-b border-[#E8E4DE] p-5">
          <div><p className="text-[11px] font-bold tracking-[.2em] text-[#81796F]">wobuy174＿</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">商品出貨單</h2><p className="mt-2 text-sm text-[#746E65]">請隨包裹附上，並依商品明細完成檢貨。</p></div>
          <div className="rounded-xl bg-[#F8F6F2] px-4 py-3 text-sm"><p className="text-xs text-[#938D84]">訂單編號</p><b className="mt-1 block">#WB-260721-019</b><p className="mt-2 text-xs text-[#938D84]">訂單日期</p><b className="mt-1 block">2026 / 07 / 21</b></div>
        </header>

        <div className="grid grid-cols-2 gap-5 p-5">
          <section><p className="text-[10px] font-bold tracking-[.16em] text-[#A09A90]">RECIPIENT</p><h3 className="mt-1 text-sm font-semibold">收件資訊</h3><div className="mt-3 space-y-2.5 text-xs"><p><span className="block text-[10px] text-[#938D84]">客戶姓名</span><b className="mt-1 block">王思妤</b></p><p><span className="block text-[10px] text-[#938D84]">LINE@名稱</span><b className="mt-1 block">@szu.yi</b></p><p><span className="block text-[10px] text-[#938D84]">電話</span><b className="mt-1 block">0912-456-789</b></p><p><span className="block text-[10px] text-[#938D84]">配送地址</span><b className="mt-1 block leading-5">台南市中西區府前路一段 120 號</b></p></div></section>
          <section><p className="text-[10px] font-bold tracking-[.16em] text-[#A09A90]">DELIVERY</p><h3 className="mt-1 text-sm font-semibold">配送資訊</h3><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><p><span className="block text-[10px] text-[#938D84]">配送方式</span><b className="mt-1 block">賣貨便</b></p><p><span className="block text-[10px] text-[#938D84]">付款狀態</span><b className="mt-1 block leading-5">銀行轉帳 · 已查帳</b></p><p className="col-span-2"><span className="block text-[10px] text-[#938D84]">出貨備註</span><b className="mt-1 block leading-5">請於平日白天配送；如不在家，請先聯繫客戶。</b></p></div></section>
        </div>

        <section className="border-t border-[#E8E4DE] px-5 py-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.16em] text-[#A09A90]">ITEMS</p><h3 className="mt-1 text-sm font-semibold">商品明細</h3></div><span className="rounded-full bg-[#EEF5EF] px-3 py-1 text-[11px] font-semibold text-[#477154]">共 3 件</span></div><div className="overflow-hidden rounded-xl border border-[#E8E4DE]"><div className="grid grid-cols-[62px_minmax(0,1fr)_64px_36px_68px] gap-2 bg-[#FBFAF8] px-3 py-2.5 text-[10px] font-semibold text-[#938D84]"><span>分類</span><span>商品名稱</span><span className="text-right">售價</span><span className="text-right">數量</span><span className="text-right">總計</span></div>{items.map((item) => <div key={item.name} className="grid grid-cols-[62px_minmax(0,1fr)_64px_36px_68px] gap-2 border-t border-[#F0EDE8] px-3 py-3 text-xs"><span className="text-[#6D675F]">{item.category}</span><span><b className="block text-xs">{item.name}</b><small className="mt-1 block text-[10px] text-[#938D84]">{item.specification}</small></span><b className="text-right text-[10px]">{currency(item.price)}</b><b className="text-right text-xs">× {item.quantity}</b><b className="text-right text-[10px]">{currency(item.price * item.quantity)}</b></div>)}</div></section>

        <footer className="flex items-center justify-end gap-5 border-t border-[#E8E4DE] bg-[#FCFBF9] px-5 py-4 text-xs"><p className="text-[#70695F]">運費：免運</p><p className="font-semibold">訂單總額：{currency(2520)}</p></footer>
      </section>
    </div>
  </main>;
}
