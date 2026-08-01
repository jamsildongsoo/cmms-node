import Procurement from './Procurement';

export default function ProcurementRequest({
  onOpenReceiptRequest,
}: {
  onOpenReceiptRequest: (requestId: string) => void;
}) {
  return <Procurement mode="request" onOpenReceiptRequest={onOpenReceiptRequest} />;
}
