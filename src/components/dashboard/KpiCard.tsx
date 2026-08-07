import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: Props) {
  return (
    <Card className="bg-white border-slate-200/90 text-slate-900 shadow-xs hover:shadow-md transition-shadow">
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </p>

          <h3 className="mt-1.5 text-3xl font-black text-slate-900 tracking-tight">
            {value}
          </h3>

          {subtitle && (
            <p className="mt-1.5 text-xs font-bold text-amber-700">
              {subtitle}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 p-3.5 shadow-xs">
          <Icon size={22} />
        </div>
      </CardContent>
    </Card>
  );
}