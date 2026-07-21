"use client";

import { useState } from "react";

type OrderItem = {
  name: string;
  specification: string;
  unitPrice: number;
  quantity: number;
};

type Order = {
  id: string;
  createdAt: string;
  customer: string;
  lineName: string;
  phone: string;
  address: string;
  payment: string;
  paymentStatus: string;
  status: string;
  statusTone: "green" | "orange" | "blue";
  stockStatus: string;
  items: OrderItem[];
  shipping: number;
  note: string;
};

const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;

const tones = {
  green: "bg-[#E7F0E8] text-[#477154]",
  orange: "bg-[#FAECDD] text-[#A66932]",
  blue: "bg-[#E5EEF2] text-[#4B6D79]",
};

const orders: Order[] = [
  {
    id: "#WB-260721-018",
    createdAt: "2026.07.21 10:42",
    customer: "林小安",
    lineName: "@xiaolin_daily",
    phone: "0912-408-626",
    address: "嘉義市西區新榮路 214 號",
    payment: "銀行轉帳",
    paymentStatus: "已付款",
    status: "已確認",
    statusTone: "green",
    stockStatus: "庫存已保留",
    items: [
      { name: "雲朵感純棉四季被", specification: "奶油白／單人", unitPrice: 1680, quantity: 1 },
      { name: "霧面日常隨行杯", specification: "淺灰／500ml", unitPrice: 590, quantity: 1 },
      { name: "韓國蝴蝶結棉襪組", specification: "粉霧／兩雙入", unitPrice: 330, quantity: 1 },
    ],
    shipping: 80,
    note: "請於平日白天配送；如不在家，請先聯繫客戶。",
  },
  {
    id: "#WB-260721-017",
    createdAt: "2026.07.21 10:18",
    customer: "陳語彤",
    lineName: "@yutong.chen",
    phone: "0987-652-941",
    address: "台南市中西區府前路一段 88 號",
    payment: "信用卡",
    paymentStatus: "已付款",
    status: "待確認",
    statusTone: "orange",
    stockStatus: "尚未扣除",
    items: [
      { name: "刺繡小熊收納化妝包", specification: "燕麥／小尺寸", unitPrice: 420, quantity: 2 },
      { name: "透明桌面收納盒", specification: "中尺寸", unitPrice: 560, quantity: 1 },
    ],
    shipping: 80,
    note: "請確認轉帳資訊後再完成訂單確認。",
  },
  {
    id: "#WB-260721-016",
    createdAt: "2026.07.21 09:56",
    customer: "許惠晴",
    lineName: "@hui__hsu",
    phone: "0928-186-334",
    address: "高雄市左營區文自路 501 號",
    payment: "銀行轉帳",
    paymentStatus: "已付款",
    status: "備貨中",
    statusTone: "blue",
    stockStatus: "庫存已保留",
    items: [{ name: "雲朵感純棉四季被", specification: "奶油白／單人", unitPrice: 1680, quantity: 2 }],
    shipping: 0,
    note: "客戶指定門市自取。",
  },
];

function Pill({ children, tone }: { children: React.ReactNode; tone: "green" | "orange" | "blue" }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function OrderDetail({ order, back }: { order: Order; back: () => void }) {
  const subtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = subtotal + order.shipping;
  const fields = [
    ["客戶姓名", order.customer],
    ["LINE@名稱", order.lineName],
    ["電話", order.phone],
    ["地址", order.address],
  ];

  return <>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回訂單管理</button>
        <p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">ORDER DETAIL</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em] text-[#292824] sm:text-[33px]">訂單 {order.id}</h1>
        <p className="mt-2 text-sm text-[#7B766E]">建立於 {order.createdAt}</p>
      </div>
      <div className="flex gap-2"><Pill tone={order.statusTone}>{order.status}</Pill><Pill tone="green">{order.paymentStatus}</Pill></div>
    </div>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
          <div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6"><h2 className="text-lg font-semibold">訂購商品</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]">
                <tr><th className="px-6 py-3">商品</th><th className="px-3 py-3">單價</th><th className="px-3 py-3">數量</th><th className="px-6 py-3 text-right">小計</th></tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE8] text-sm">
                {order.items.map((item) => <tr key={`${item.name}-${item.specification}`}>
                  <td className="px-6 py-4"><b className="block text-[#4A4640]">{item.name}</b><small className="mt-1 block text-xs text-[#938D84]">{item.specification}</small></td>
                  <td className="px-3 py-4 text-[#625D55]">{currency(item.unitPrice)}</td>
                  <td className="px-3 py-4 text-[#625D55]">{item.quantity}</td>
                  <td className="px-6 py-4 text-right font-semibold text-[#4A4640]">{currency(item.unitPrice * item.quantity)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">INTERNAL NOTE</p>
          <h2 className="mt-1 text-lg font-semibold">訂單備註</h2>
          <p className="mt-4 rounded-xl bg-[#F8F6F2] p-4 text-sm leading-6 text-[#706A61]">{order.note}</p>
        </section>

        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ORDER ACTIVITY</p>
          <h2 className="mt-1 text-lg font-semibold">訂單活動</h2>
          <div className="mt-5 space-y-5">
            {[
              [order.createdAt, "建立訂單", "客戶與商品資訊已儲存"],
              ["今天 10:43", "確認訂單並保留庫存", "可售庫存已更新，避免重複販售"],
              ["今天 10:44", "付款完成", `${order.payment} 已完成付款確認`],
            ].map(([time, action, note]) => <div key={time} className="border-l border-[#D7E4D9] pl-3">
              <p className="text-xs text-[#938D84]">{time}</p>
              <p className="mt-1 text-sm font-semibold text-[#4A4640]">{action}</p>
              <p className="mt-1 text-xs text-[#6C776D]">{note}</p>
            </div>)}
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ORDER SUMMARY</p>
          <h2 className="mt-1 text-lg font-semibold">訂單摘要</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between text-[#777168]"><span>商品小計</span><span>{currency(subtotal)}</span></div>
            <div className="flex justify-between text-[#777168]"><span>運費</span><span>{currency(order.shipping)}</span></div>
            <div className="flex justify-between border-t border-[#F0EDE8] pt-4 text-base font-semibold text-[#292824]"><span>訂單總額</span><span>{currency(total)}</span></div>
          </div>
          <div className="mt-5 rounded-xl bg-[#EEF5EF] p-4"><p className="text-xs font-semibold text-[#41634A]">{order.stockStatus}</p><p className="mt-1 text-xs leading-5 text-[#6F806F]">此訂單的商品庫存已依狀態完成同步。</p></div>
        </section>

        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CUSTOMER</p>
          <h2 className="mt-1 text-lg font-semibold">客戶資料</h2>
          <div className="mt-5 grid gap-4 text-sm">
            {fields.map(([label, value]) => <div key={label}>
              <p className="text-xs text-[#938D84]">{label}</p>
              <p className="mt-1 break-words font-semibold leading-6 text-[#48433C]">{value}</p>
            </div>)}
          </div>
          <div className="mt-5 border-t border-[#F0EDE8] pt-4">
            <p className="text-xs text-[#938D84]">付款方式</p>
            <p className="mt-1 text-sm font-semibold text-[#48433C]">{order.payment}</p>
          </div>
        </section>
      </aside>
    </div>
  </>;
}

export function Orders({ created, go }: { created: boolean; go: (view: "create") => void }) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const createdOrder: Order = {
    id: "#WB-260721-019",
    createdAt: "剛剛",
    customer: "王思妤",
    lineName: "@szu.yi",
    phone: "0912-456-789",
    address: "台南市中西區府前路一段 120 號",
    payment: "銀行轉帳",
    paymentStatus: "已付款",
    status: "已確認",
    statusTone: "green",
    stockStatus: "庫存已保留",
    items: [
      { name: "雲朵感純棉四季被", specification: "奶油白／單人", unitPrice: 1680, quantity: 1 },
      { name: "刺繡小熊收納化妝包", specification: "燕麥／小尺寸", unitPrice: 420, quantity: 2 },
    ],
    shipping: 80,
    note: "訂單已由後台建立。",
  };
  const displayedOrders = created ? [createdOrder, ...orders] : orders;

  if (selectedOrder) return <OrderDetail order={selectedOrder} back={() => setSelectedOrder(null)} />;

  return <>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">ORDERS</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em] text-[#292824] sm:text-[33px]">訂單管理</h1>
        <p className="mt-2 text-sm text-[#7B766E]">點選訂單可查看完整的客戶、商品、付款與庫存紀錄。</p>
      </div>
      <button onClick={() => go("create")} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white hover:bg-[#46423D]">＋ 建立訂單</button>
    </div>

    <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#F0EDE8] p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex h-11 max-w-md flex-1 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#928C84]"><span>⌕</span><input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#AAA39A]" placeholder="搜尋訂單編號、客戶姓名或商品" /></label>
          <span className="text-xs text-[#807A71]">共 {displayedOrders.length + 24} 筆訂單</span>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {["全部狀態", "草稿", "待確認", "已確認", "備貨中", "已出庫", "已取消"].map((status, index) => <button key={status} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${index === 0 ? "bg-[#292824] text-white" : "bg-[#F4F1ED] text-[#706A61]"}`}>{status}</button>)}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[910px] text-left">
          <thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">訂單編號</th><th className="px-3 py-3">建立日期</th><th className="px-3 py-3">客戶</th><th className="px-3 py-3">商品</th><th className="px-3 py-3">金額</th><th className="px-3 py-3">付款</th><th className="px-3 py-3">訂單狀態</th><th className="px-3 py-3">庫存狀態</th><th className="px-6 py-3 text-right">操作</th></tr></thead>
          <tbody className="divide-y divide-[#F0EDE8] text-sm">
            {displayedOrders.map((order) => {
              const total = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) + order.shipping;
              const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
              return <tr key={order.id} onClick={() => setSelectedOrder(order)} className="cursor-pointer hover:bg-[#FCFBF9]">
                <td className="px-6 py-4 font-semibold text-[#4A4640]">{order.id}</td><td className="px-3 py-4 text-[#777168]">{order.createdAt}</td><td className="px-3 py-4 text-[#5C574F]">{order.customer}</td><td className="px-3 py-4">{count} 項</td><td className="px-3 py-4 font-medium">{currency(total)}</td><td className="px-3 py-4"><Pill tone="green">{order.paymentStatus}</Pill></td><td className="px-3 py-4"><Pill tone={order.statusTone}>{order.status}</Pill></td><td className="px-3 py-4"><Pill tone={order.status === "待確認" ? "orange" : "green"}>{order.stockStatus}</Pill></td>
                <td className="px-6 py-4 text-right"><button onClick={(event) => { event.stopPropagation(); setSelectedOrder(order); }} className="text-sm font-semibold text-[#5E7665]">查看詳情 →</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
