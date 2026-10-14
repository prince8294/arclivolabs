'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Filter, Plus } from 'lucide-react';

import TaskCard from './task-card';
import ButtonLink from '@/components/ui/button-link';
import type { PopulatedTaskItem } from '@/lib/queries/tasks';
import { TASK_STATUSES, type TaskStatus } from '@/lib/constants/enums';

interface TaskBoardProps {
  board: Record<TaskStatus, PopulatedTaskItem[]>;
  portal?: 'admin' | 'employee';
  projects?: Array<{ _id: string; title: string }>;
}

interface ColumnConfig {
  key: TaskStatus;
  title: string;
  color: string;
  badgeBg: string;
}

const COLUMNS: ColumnConfig[] = [
  { key: TASK_STATUSES.TODO, title: 'To Do', color: 'border-slate-300 dark:border-slate-700', badgeBg: 'bg-muted text-muted-foreground' },
  { key: TASK_STATUSES.IN_PROGRESS, title: 'In Progress', color: 'border-blue-400 dark:border-blue-600', badgeBg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { key: TASK_STATUSES.BLOCKED, title: 'Blocked', color: 'border-red-400 dark:border-red-600', badgeBg: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { key: TASK_STATUSES.IN_REVIEW, title: 'In Review', color: 'border-amber-400 dark:border-amber-600', badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { key: TASK_STATUSES.CHANGES_REQUESTED, title: 'Changes Requested', color: 'border-orange-400 dark:border-orange-600', badgeBg: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { key: TASK_STATUSES.COMPLETED, title: 'Completed', color: 'border-emerald-400 dark:border-emerald-600', badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
];

export default function TaskBoard({ board, portal = 'admin', projects = [] }: TaskBoardProps) {
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');

  const filterTasks = (tasks: PopulatedTaskItem[]) => {
    return tasks.filter((t) => {
      const matchesSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.taskCode.toLowerCase().includes(search.toLowerCase()) ||
        t.project.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.assignee && t.assignee.name.toLowerCase().includes(search.toLowerCase()));

      const matchesProject =
        selectedProject === 'ALL' || t.project._id === selectedProject;

      return matchesSearch && matchesProject;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Board Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1 sm:max-w-xs">
            <Search
              className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Filter board by code, title, assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {projects.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Projects</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {portal === 'admin' && (
          <ButtonLink href="/admin/tasks/new" size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Task
          </ButtonLink>
        )}
      </div>

      {/* Columns Container */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-start overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const rawColTasks = board[col.key] || [];
          const tasks = filterTasks(rawColTasks);

          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-lg border bg-muted/30 p-3 min-w-[280px] xl:min-w-0 ${col.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                <span className="text-xs font-semibold text-foreground tracking-tight">
                  {col.title}
                </span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${col.badgeBg}`}
                >
                  {tasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="flex flex-col gap-3 min-h-[150px]">
                {tasks.length === 0 ? (
                  <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                    No tasks
                  </div>
                ) : (
                  tasks.map((task) => (
                    <TaskCard key={task._id} task={task} portal={portal} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
