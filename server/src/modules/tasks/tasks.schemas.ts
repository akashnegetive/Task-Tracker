import { z } from 'zod';

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const;

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .nullable();

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim().optional().default(''),
  priority: z.enum(PRIORITIES).optional().default('MEDIUM'),
  dueDate: isoDate.optional(),
  assigneeIds: z.array(z.string().uuid()).optional().default([]),
  dependencyIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(5000).trim().optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueDate: isoDate.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const transitionSchema = z.object({
  status: z.enum(STATUSES),
});

export const assignSchema = z.object({
  userId: z.string().uuid(),
});

export const addDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid(),
});

export const commentSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
});

// Accept comma-separated or repeated query params → string[].
const csv = <T extends string>(values: readonly T[]) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const arr = Array.isArray(v) ? v : v.split(',');
      return arr.map((s) => s.trim()).filter(Boolean) as T[];
    })
    .refine((arr) => arr === undefined || arr.every((s) => (values as readonly string[]).includes(s)), {
      message: `Allowed values: ${values.join(', ')}`,
    });

const boolish = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const SORT_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title', 'status'] as const;

export const listTasksQuery = z.object({
  search: z.string().trim().max(200).optional(),
  status: csv(STATUSES),
  priority: csv(PRIORITIES),
  assigneeId: z.string().uuid().optional(),
  dueBefore: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  dueAfter: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  overdue: boolish,
  blocked: boolish,
  sort: z.enum(SORT_FIELDS).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListTasksQuery = z.infer<typeof listTasksQuery>;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
