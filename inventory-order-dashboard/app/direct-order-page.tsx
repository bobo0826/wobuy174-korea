"use client";

import { useEffect, useState } from "react";
import { OrderDetail, type StoredOrder } from "./orders-page-v2";

function closeOrReturnToOrders() {
  window.close();
  window.setTimeout(() => {
    if (!window.closed) window.location.assign("/");
  }, 120);
}

export function DirectOrderPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        // 單筆頁面不需要先讀取訂單清單。使用專用端點可避免在每次跳轉時
        // 同時查詢一般訂單列表與連線喊單，訂單數量增加後也能維持開啟速度。
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message ?? "無法讀取一般訂單。");
        }
        if (!result.order) throw new Error("找不到這張一般訂單。");
        if (active) setOrder(result.order as StoredOrder);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "無法讀取一般訂單。",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] px-5 py-10 text-[#292824] sm:px-8">
        <section className="mx-auto max-w-6xl rounded-2xl border border-[#E9E5DF] bg-white p-8 text-center text-sm font-semibold text-[#7B766E]">
          正在開啟一般訂單…
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] px-5 py-10 text-[#292824] sm:px-8">
        <section className="mx-auto max-w-6xl rounded-2xl border border-[#F1D4C4] bg-[#FFF7F0] p-8 text-center">
          <p className="text-sm font-semibold text-[#9B562A]">
            {error || "找不到這張一般訂單。"}
          </p>
          <button
            onClick={closeOrReturnToOrders}
            className="mt-4 text-sm font-semibold text-[#5E7665]"
          >
            關閉此頁
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7F4] px-5 py-7 text-[#292824] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <OrderDetail
          order={order}
          back={closeOrReturnToOrders}
          backLabel="關閉一般訂單"
          onUpdated={setOrder}
          onDeleted={() => closeOrReturnToOrders()}
          onInventoryChanged={async () => undefined}
        />
      </div>
    </main>
  );
}
