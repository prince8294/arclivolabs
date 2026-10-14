'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Send, Lock, Loader2 } from 'lucide-react';

import Button from '@/components/ui/button';
import { addTaskComment } from '@/lib/actions/task-comments';
import { formatDate } from '@/lib/utils/format';

export interface TaskCommentItem {
  _id: string;
  content: string;
  visibility: string;
  isEdited: boolean;
  editedAt?: string | null;
  createdAt: string;
  author: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface TaskCommentListProps {
  taskId: string;
  comments: TaskCommentItem[];
}

export default function TaskCommentList({ taskId, comments }: TaskCommentListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setError(null);
    startTransition(async () => {
      const res = await addTaskComment(taskId, { content });
      if (res.success) {
        setContent('');
        router.refresh();
      } else {
        setError(res.message || 'Failed to post comment.');
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
          Comments ({comments.length})
        </h3>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Internal only
        </span>
      </div>

      {/* Comment List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No internal comments on this task yet. Start a discussion below.
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment._id}
              className="rounded-lg border border-border bg-card p-4 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {comment.author.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground capitalize">
                    ({comment.author.role.toLowerCase()})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {comment.isEdited && <span>(edited)</span>}
                  <span>{formatDate(comment.createdAt)}</span>
                </div>
              </div>
              <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <textarea
          rows={3}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write an internal comment or question about this task..."
          className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-sans"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isPending || !content.trim()}>
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Posting...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Add Comment
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
