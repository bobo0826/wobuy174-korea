"use client";

import { useEffect, useMemo, useState } from "react";

type StoredProduct = {
  id: string;
  sku: string;
  name: string;
  specification: string;
  category: string;
  cost: number;
  staff_price: number;
  retail_price: number;
  available_stock: number;
};

type Customer = { id: string; name: string; line_name: string; phone: string; address: string };
type StoredItem = { id: string; product_id: string; product_name: string; category: string; unit_price: number; unit_cost: number; quantity: number };
export type StoredOrder = {
  id: string;
  order_number: string;
  order_date: string;
  status: "預購中" | "未出貨" | "已出貨" | "已取消";
  order_method: string;
  payment_method: string;
  reconciliation_status: string;
  delivery_method: string;
  delivery_fee: number;
  note: string;
  customers: Customer | null;
  order_items: StoredItem[];
};

type EditableLine = { productId: string; unitPrice: number; quantity: number };

const button = "inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665] disabled:cursor-not-allowed disabled:opacity-45";

export function OrderEditor({ order, onClose, onSaved }: { order: StoredOrder; onClose: () => void; onSaved: (order: StoredOrder) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [customerId, setCustomerId] = useState(order.customers?.id ?? "");
  const [orderNumber, setOrderNumber] = useState(order.order_number);
  const [orderDate, setOrderDate] = useState(order.order_date);
  const [status, setStatus] = useState<StoredOrder["status"]>(order.status);
  const [orderMethod, setOrderMethod] = useState(order.order_method);
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method);
  const [paymentStatus, setPaymentStatus] = useState(order.reconciliation_status);
  const [deliveryMethod, setDeliveryMethod] = useState(order.delivery_method);
  const [note, setNote] = useState(order.note ?? "");
  const [lines, setLines] = useState<EditableLine[]>(order.order_items.map((item) => ({ productId: item.product_id, unitPrice: item.unit_price, quantity: item.quantity })));
  const [addProductId, setAddProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const shipped = order.status === "已出貨";
  const cancelled = order.status === "已取消";

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [customersResponse, productsResponse] = await Promise.all([fetch("/api/customers"), fetch("/api/products")]);
        const customerData = await customersResponse.json();
        const productData = await productsResponse.json();
        if (!customersResponse.ok || !productsResponse.ok) throw new Error("無法讀取修改訂單需要的資料。");
        if (!active) return;
        const loadedProducts = productData.products ?? [];
        setCustomers(customerData.customers ?? []);
        setProducts(loadedProducts);
        const first = loadedProducts.find((product: StoredProduct) => !lines.some((line) => line.productId === product.id));
        setAddProductId(first?.id ?? "");
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "無法讀取訂單資料。");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const unselected = products.filter((product) => !lines.some((line) => line.productId === product.id));
  const setLine = (index: number, change: Partial<EditableLine>) => setLines((previous) => previous.map((line, lineIndex) => lineIndex === index ? { ...line, ...change } : line));

  const addLine = () => {
    const product = productById.get(addProductId);
    if (!product || lines.some((line) => line.productId === product.id)) return;
    setLines((previous) => [...previous, { productId: product.id, unitPrice: orderMethod === "員工下單" ? product.staff_price : product.retail_price, quantity: 1 }]);
    setAddProductId(unselected.find((item) => item.id !== product.id)?.id ?? "");
  };

  const request = async (body: object) => {
    const response = await fetch(`/api/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "無法儲存訂單修改。");
    return result.order as StoredOrder;
  };

  const save = async () => {
    if (!shipped && (!customerId || !lines.length)) {
      setError(!customerId ? "請選擇客戶。" : "請至少保留一項商品。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await request(shipped
        ? { action: "updatePayment", paymentMethod, paymentStatus, note }
        : { action: "update", orderNumber, customerId, orderDate, status, orderMethod, paymentMethod, paymentStatus, deliveryMethod, note, items: lines });
      onSaved(updated);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法儲存訂單修改。");
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await request({ action: "restore" });
      onSaved(updated);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法復原訂單。");
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6">
    <div role="dialog" aria-modal="true" aria-label="修改訂單" className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">EDIT ORDER</p>
          <h2 className="mt-2 text-xl font-semibold">修改訂單</h2>
          <p className="mt-2 text-sm text-[#7D776E]">{shipped ? "已出貨訂單僅可修改付款方式、付款狀態與訂單備註；其餘內容已鎖定以維持庫存紀錄正確。" : cancelled ? "此訂單已取消。可按「復原訂單」恢復為預購中，不會扣除庫存。" : "可完整修改客戶、訂單資訊、商品、金額、付款與配送。"}</p>
        </div>
        <button aria-label="關閉修改訂單" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg">×</button>
      </div>

      {loading ? <p className="py-12 text-center text-sm text-[#8D877E]">載入修改資料中…</p> : <>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold">訂單編號<input value={orderNumber} disabled={shipped} onChange={(event) => setOrderNumber(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none disabled:bg-[#F4F1EC]" /></label>
          <label className="text-sm font-semibold">訂單日期<input type="date" value={orderDate} disabled={shipped} onChange={(event) => setOrderDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none disabled:bg-[#F4F1EC]" /></label>
          <label className="text-sm font-semibold">訂單狀態<select value={status} disabled={shipped} onChange={(event) => setStatus(event.target.value as StoredOrder["status"])} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none disabled:bg-[#F4F1EC]"><option>預購中</option><option>未出貨</option><option>已出貨</option><option>已取消</option></select></label>
          <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">客戶<select value={customerId} disabled={shipped} onChange={(event) => setCustomerId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none disabled:bg-[#F4F1EC]"><option value="">請選擇客戶</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.line_name ? ` · ${customer.line_name}` : ""}</option>)}</select></label>
          <label className="text-sm font-semibold">下單方式<select value={orderMethod} disabled={shipped} onChange={(event) => setOrderMethod(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none disabled:bg-[#F4F1EC]"><option>社群下單</option><option>員工下單</option></select></label>
          <label className="text-sm font-semibold">付款方式<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>銀行轉帳</option><option>信用卡</option><option>現金</option><option>貨到付款</option></select></label>
          <label className="text-sm font-semibold">付款狀態<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>未付款</option><option>已付款</option></select></label>
          <label className="text-sm font-semibold">配送方式<select value={deliveryMethod} disabled={shipped} onChange={(event) => setDeliveryMethod(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none disabled:bg-[#F4F1EC]"><option>門市自取</option><option>賣貨便</option></select></label>
          <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">訂單備註<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] p-3 text-sm font-normal outline-none" /></label>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#E9E5DF]">
          <div className="border-b border-[#F0EDE8] p-4"><b>訂購商品</b><div className="mt-3 flex gap-2"><select value={addProductId} disabled={shipped || !unselected.length} onChange={(event) => setAddProductId(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm outline-none">{unselected.map((product) => <option key={product.id} value={product.id}>{product.sku}｜{product.name} · 可售 {product.available_stock}</option>)}</select><button type="button" disabled={shipped || !unselected.length} onClick={addLine} className={button}>加入商品</button></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="px-4 py-3">貨號</th><th className="px-3 py-3">商品名稱</th><th className="px-3 py-3">單價</th><th className="px-3 py-3">數量</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{lines.map((line, index) => { const product = productById.get(line.productId); return <tr key={line.productId}><td className="px-4 py-3 font-mono text-xs">{product?.sku ?? "已刪除商品"}</td><td className="px-3 py-3"><b>{product?.name ?? "已刪除商品"}</b><small className="mt-1 block text-xs text-[#938D84]">{product?.specification ?? ""}</small></td><td className="px-3 py-3"><input disabled={shipped} type="number" min="0" value={line.unitPrice} onChange={(event) => setLine(index, { unitPrice: Math.max(0, Number(event.target.value) || 0) })} className="h-9 w-24 rounded-lg border border-[#E6E1DB] px-2 disabled:bg-[#F4F1EC]" /></td><td className="px-3 py-3"><input disabled={shipped} type="number" min="1" value={line.quantity} onChange={(event) => setLine(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} className="h-9 w-20 rounded-lg border border-[#E6E1DB] px-2 disabled:bg-[#F4F1EC]" /></td><td className="px-4 py-3 text-right"><button type="button" disabled={shipped} onClick={() => setLines((previous) => previous.filter((_, lineIndex) => lineIndex !== index))} className="text-sm font-semibold text-[#A35F37] disabled:opacity-40">移除</button></td></tr>; })}</tbody></table></div>
        </section>
        {error && <p role="alert" className="mt-4 text-sm font-semibold text-[#A35F37]">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className={button}>取消</button>
          {cancelled && <button type="button" onClick={() => { void restore(); }} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D8E5DA] bg-[#EDF5EE] px-4 text-sm font-semibold text-[#45634C] disabled:opacity-45">復原訂單</button>}
          <button type="button" onClick={() => { void save(); }} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white disabled:opacity-45">{saving ? "儲存中…" : shipped ? "儲存付款與備註" : "儲存訂單修改"}</button>
        </div>
      </>}
    </div>
  </div>;
}
