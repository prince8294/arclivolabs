import { History } from 'lucide-react';
import { formatDate } from '@/lib/utils/format';

export interface TaskActivityItem {
  _id: string;
  type: string;
  summary: string;
  createdAt: string;
  actor: {
    _id: string;
    name: string;
    role: string;
  };
}

interface TaskActivityTimelineProps {
  activities: TaskActivityItem[];
}

export default function TaskActivityTimeline({ activities }: TaskActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No recorded activity events for this task yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <History className="h-4 w-4 text-primary" aria-hidden="true" />
        Activity Timeline
      </h3>

      <div className="relative border-l border-border ml-3.5 space-y-6 py-2">
        {activities.map((act) => (
          <div key={act._id} className="relative pl-6">
            {/* Timeline bullet node */}
            <span
              className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-foreground">
                {act.summary}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>By {act.actor.name}</span>
                <span>•</span>
                <span>{formatDate(act.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
