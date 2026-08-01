import Procurement from './Procurement';

export default function ProcurementManagement({
  onOpenReceiptRequest,
}: {
  onOpenReceiptRequest: (requestId: string) => void;
}) {
  return <Procurement mode="management" onOpenReceiptRequest={onOpenReceiptRequest} />;
}
