import { Badge } from "@/components/ui/badge";

interface Props {
  status: string;
}

export default function StatusBadge({
  status,
}: Props) {
  if (status === "healthy") {
    return (
      <Badge className="bg-green-500">
        Healthy
      </Badge>
    );
  }

  if (status === "warning") {
    return (
      <Badge className="bg-amber-500">
        Warning
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      Delayed
    </Badge>
  );
}