import { Badge } from "@/components/ui/badge";

export function ContractStatusBadge({ status }: { status: string }) {
  if (status === "signed") return <Badge variant="success">Signed</Badge>;
  if (status === "sent") return <Badge variant="warning">Awaiting tenant</Badge>;
  if (status === "void") return <Badge variant="secondary">Voided</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}
