import { z } from 'zod';
import type { AuthUser } from '../../types/express';
import { AppError } from '../../lib/errors';
import { PRIORITIES, STATUSES } from './tasks.schemas';
import * as service from './tasks.service';

/** Discriminated union of supported bulk operations. */
export const bulkSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(200),
  operation: z.discriminatedUnion('type', [
    z.object({ type: z.literal('transition'), status: z.enum(STATUSES) }),
    z.object({ type: z.literal('setPriority'), priority: z.enum(PRIORITIES) }),
    z.object({ type: z.literal('setDueDate'), dueDate: z.string().nullable() }),
    z.object({ type: z.literal('assign'), userId: z.string().uuid() }),
    z.object({ type: z.literal('unassign'), userId: z.string().uuid() }),
  ]),
});

export type BulkInput = z.infer<typeof bulkSchema>;

export interface BulkResult {
  taskId: string;
  success: boolean;
  error?: { code: string; message: string };
}

async function applyOne(user: AuthUser, taskId: string, op: BulkInput['operation']): Promise<void> {
  switch (op.type) {
    case 'transition':
      await service.transitionTask(user, taskId, op.status);
      return;
    case 'setPriority':
      await service.updateTask(user, taskId, { priority: op.priority });
      return;
    case 'setDueDate':
      await service.updateTask(user, taskId, { dueDate: op.dueDate });
      return;
    case 'assign':
      await service.assignUser(user, taskId, op.userId);
      return;
    case 'unassign':
      await service.unassignUser(user, taskId, op.userId);
      return;
  }
}

/**
 * Applies one operation to many tasks, independently. Each task's outcome is
 * captured; a failure on one (authorization, lifecycle, blocked dependency,
 * already-assigned, …) does not abort the others.
 */
export async function bulkApply(user: AuthUser, input: BulkInput): Promise<{ results: BulkResult[]; summary: { total: number; succeeded: number; failed: number } }> {
  const results: BulkResult[] = [];
  for (const taskId of input.taskIds) {
    try {
      await applyOne(user, taskId, input.operation);
      results.push({ taskId, success: true });
    } catch (err) {
      const e = err instanceof AppError ? { code: err.code, message: err.message } : { code: 'INTERNAL', message: 'Unexpected error' };
      results.push({ taskId, success: false, error: e });
    }
  }
  const succeeded = results.filter((r) => r.success).length;
  return { results, summary: { total: results.length, succeeded, failed: results.length - succeeded } };
}
