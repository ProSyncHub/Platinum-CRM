import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
}

export default function KpiCard({
  title,
  value,
  icon: Icon,
}: Props) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-slate-500">
            {title}
          </p>

          <h3 className="mt-2 text-3xl font-bold">
            {value}
          </h3>
        </div>

        <div className="rounded-xl bg-slate-100 p-3">
          <Icon size={22} />
        </div>
      </CardContent>
    </Card>
  );
}