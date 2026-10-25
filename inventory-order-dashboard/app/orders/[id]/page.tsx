import { DirectOrderPage } from "../../direct-order-page";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DirectOrderPage orderId={id} />;
}
