import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const body = await request.json();
    if (body.action !== "complete") return NextResponse.json({ message: "不支援的訂單操作。" }, { status: 400 });

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", id)
      .single();
    if (orderError) throw orderError;
    if (order.status === "已出貨") return NextResponse.json({ message: "此訂單已完成扣庫存。" }, { status: 409 });
    if (order.status === "已取消") return NextResponse.json({ message: "已取消的訂單無法扣除庫存。" }, { status: 400 });

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_id, product_name, quantity")
      .eq("order_id", id);
    if (itemsError) throw itemsError;

    const productQuantities = new Map<string, { name: string; quantity: number }>();
    for (const item of items ?? []) {
      if (!item.product_id) continue;
      const existing = productQuantities.get(item.product_id);
      productQuantities.set(item.product_id, {
        name: item.product_name,
        quantity: (existing?.quantity ?? 0) + item.quantity,
      });
    }
    const productIds = [...productQuantities.keys()];
    const { data: products, error: productsError } = productIds.length
      ? await supabase.from("products").select("id, available_stock").in("id", productIds)
      : { data: [], error: null };
    if (productsError) throw productsError;
    const stocks = new Map((products ?? []).map((product) => [product.id, product.available_stock]));
    for (const [productId, item] of productQuantities) {
      const available = stocks.get(productId);
      if (available === undefined || available < item.quantity) {
        return NextResponse.json({ message: `${item.name} 的可售庫存不足，無法完成訂單。` }, { status: 400 });
      }
    }

    for (const [productId, item] of productQuantities) {
      const available = stocks.get(productId) ?? 0;
      const { error: stockError } = await supabase
        .from("products")
        .update({ available_stock: available - item.quantity })
        .eq("id", productId);
      if (stockError) throw stockError;
    }
    if (productIds.length) {
      const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert(productIds.map((productId) => ({
        product_id: productId,
        quantity_change: -(productQuantities.get(productId)?.quantity ?? 0),
        reason: "訂單完成扣庫存",
        note: `訂單 ${id}`,
      })));
      if (adjustmentError) throw adjustmentError;
    }

    const { data: completed, error: completeError } = await supabase
      .from("orders")
      .update({ status: "已出貨" })
      .eq("id", id)
      .select("id, order_number, status")
      .single();
    if (completeError) throw completeError;
    return withRefreshedSession(NextResponse.json({ order: completed }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法完成訂單並扣除庫存。" }, { status: 500 });
  }
}
