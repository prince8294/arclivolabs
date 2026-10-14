import {
  CircleDot,
  CheckCircle2,
  CircleSlash,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Users,
} from 'lucide-react';

import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import {
  PROJECT_ACTIVITY_TONES,
  PROJECT_ACTIVITY_TYPES,
  PROJECT_ACTIVITY_TYPE_LABELS,
  type ProjectActivityType,
} from '@/lib/constants/enums';
import { formatDateTime } from '@/lib/utils/format';
import type { ProjectActivityItem } from '@/lib/queries/projects';

const TONE_CLASSES: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-info/10 text-info border-info/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
};

function iconFor(type: ProjectActivityType) {
  switch (type) {
    case PROJECT_ACTIVITY_TYPES.PROJECT_CREATED:
      return Sparkles;
    case PROJECT_ACTIVITY_TYPES.PROJECT_STARTED:
      return PlayCircle;
    case PROJECT_ACTIVITY_TYPES.PROJECT_PAUSED:
      return PauseCircle;
    case PROJECT_ACTIVITY_TYPES.PROJECT_COMPLETED:
      return CheckCircle2;
    case PROJECT_ACTIVITY_TYPES.PROJECT_CANCELLED:
      return CircleSlash;
    case PROJECT_ACTIVITY_TYPES.MEMBER_ASSIGNED:
    case PROJECT_ACTIVITY_TYPES.MEMBER_REMOVED:
      return Users;
    case PROJECT_ACTIVITY_TYPES.HEALTH_CHANGED:
    case PROJECT_ACTIVITY_TYPES.DEADLINE_CHANGED:
      return ShieldAlert;
    case PROJECT_ACTIVITY_TYPES.NOTE_ADDED:
      return StickyNote;
    default:
      return CircleDot;
  }
}

export interface ProjectTimelineProps {
  activities: ProjectActivityItem[];
}

/** Project activity history, newest first (§43). */
export default function ProjectTimeline({ activities }: ProjectTimelineProps) {
  if (activities.length === 0) {
    return (
      <EmptyState
        title="No activity recorded yet"
        description="Status changes, assignments and milestone reviews will appear here."
        icon={<CircleDot className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
      />
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {activities.map((activity) => {
        const tone = PROJECT_ACTIVITY_TONES[activity.type as ProjectActivityType] ?? 'neutral';
        const Icon = iconFor(activity.type as ProjectActivityType) ?? CircleDot;

        return (
          <li key={activity._id} className="flex gap-3">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${TONE_CLASSES[tone]}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{activity.title}</span>
                  <Badge variant="secondary" className="font-normal">
                    {PROJECT_ACTIVITY_TYPE_LABELS[activity.type as ProjectActivityType] ??
                      activity.type}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(new Date(activity.createdAt))}
                </span>
              </div>

              {activity.summary ? (
                <p className="mt-1 text-sm text-muted-foreground">{activity.summary}</p>
              ) : null}

              <p className="mt-1 text-xs text-muted-foreground">by {activity.actor.name}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
