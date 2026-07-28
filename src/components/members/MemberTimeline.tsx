import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, ArrowRightLeft } from "lucide-react";

type EventItem = {
  id: string;
  type: "call" | "transfer";
  date: Date;
  title: string;
  description: string;
};

interface MemberTimelineProps {
  events: EventItem[];
}

export default function MemberTimeline({ events }: MemberTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Timeline</CardTitle>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            No activity found.
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((event, index) => (
              <div key={event.id} className="relative flex gap-4">
                {index !== events.length - 1 && (
                  <div className="absolute top-8 left-[15px] h-[calc(100%-1rem)] w-[2px] bg-slate-200" />
                )}

                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border text-slate-600">
                  {event.type === "call" ? <Phone size={14} /> : <ArrowRightLeft size={14} />}
                </div>

                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-slate-900">{event.title}</p>
                    <time className="text-xs text-slate-500">
                      {event.date.toLocaleDateString()} {event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}