import Procurement from './Procurement';

export default function ProcurementManagement({
  onOpenReceiptRequest,
  onOpenReceiptOrder,
}: {
  onOpenReceiptRequest: (requestId: string) => void;
  onOpenReceiptOrder?: (orderId: string) => void;
}) {
  return <Procurement mode="management" onOpenReceiptRequest={onOpenReceiptRequest} onOpenReceiptOrder={onOpenReceiptOrder} />;
}
