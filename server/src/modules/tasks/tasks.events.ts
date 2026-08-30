import type { Kysely } from 'kysely';
import type { Database, TaskEventType } from '../../db/types';

export interface LogEventInput {
  taskId: string;
  actorId: string | null;
  type: TaskEventType;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Appends a row to the immutable task_events log. Accepts a Kysely instance or
 * a transaction so it participates in the same transaction as the change it
 * records — the mutation and its history row commit or roll back together.
 */
export async function logEvent(
  exec: Kysely<Database>,
  input: LogEventInput | LogEventInput[],
): Promise<void> {
  const rows = (Array.isArray(input) ? input : [input]).map((e) => ({
    task_id: e.taskId,
    actor_id: e.actorId,
    type: e.type,
    field: e.field ?? null,
    old_value: e.oldValue ?? null,
    new_value: e.newValue ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: (e.metadata ?? null) as any,
  }));
  if (rows.length === 0) return;
  await exec.insertInto('task_events').values(rows).execute();
}
