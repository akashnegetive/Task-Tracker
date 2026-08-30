import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from './client';
import type {
  ProjectSummary,
  ProjectDetail,
  TaskDetail,
  TaskListItem,
  TimelineItem,
  Paginated,
  OverdueAlert,
  Dashboard,
  User,
  BulkResult,
} from './types';

// ---------- Users ----------
export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: () => api.get<{ users: User[] }>('/users').then((r) => r.users) });

// ---------- Projects ----------
export const useProjects = (status: string) =>
  useQuery({
    queryKey: ['projects', status],
    queryFn: () => api.get<{ projects: ProjectSummary[] }>(`/projects${qs({ status })}`).then((r) => r.projects),
  });

export const useProject = (id: string | undefined) =>
  useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<{ project: ProjectDetail }>(`/projects/${id}`).then((r) => r.project),
    enabled: !!id,
  });

export function useProjectMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['projects'] });
  return {
    create: useMutation({
      mutationFn: (body: { name: string; description?: string; memberIds?: string[] }) =>
        api.post<{ project: ProjectDetail }>('/projects', body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string }) =>
        api.patch<{ project: ProjectDetail }>(`/projects/${id}`, body),
      onSuccess: (_d, v) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ['project', v.id] });
      },
    }),
    archive: useMutation({
      mutationFn: (id: string) => api.post(`/projects/${id}/archive`),
      onSuccess: (_d, id) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ['project', id] });
      },
    }),
    restore: useMutation({
      mutationFn: (id: string) => api.post(`/projects/${id}/restore`),
      onSuccess: (_d, id) => {
        invalidate();
        qc.invalidateQueries({ queryKey: ['project', id] });
      },
    }),
    addMember: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) => api.post(`/projects/${id}/members`, { userId }),
      onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['project', v.id] }),
    }),
    removeMember: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) => api.del(`/projects/${id}/members/${userId}`),
      onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['project', v.id] }),
    }),
  };
}

// ---------- Tasks: list ----------
export interface TaskFilters {
  search?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  overdue?: boolean;
  blocked?: boolean;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

export const useProjectTasks = (projectId: string | undefined, filters: TaskFilters) =>
  useQuery({
    queryKey: ['tasks', 'project', projectId, filters],
    queryFn: () => api.get<Paginated<TaskListItem>>(`/projects/${projectId}/tasks${qs(filters as Record<string, unknown>)}`),
    enabled: !!projectId,
  });

export const useMyTasks = (filters: TaskFilters) =>
  useQuery({
    queryKey: ['tasks', 'mine', filters],
    queryFn: () => api.get<Paginated<TaskListItem>>(`/tasks/mine${qs(filters as Record<string, unknown>)}`),
  });

// ---------- Task detail + timeline ----------
export const useTask = (id: string | undefined) =>
  useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get<{ task: TaskDetail }>(`/tasks/${id}`).then((r) => r.task),
    enabled: !!id,
  });

export const useTimeline = (id: string | undefined) =>
  useQuery({
    queryKey: ['timeline', id],
    queryFn: () => api.get<{ timeline: TimelineItem[] }>(`/tasks/${id}/timeline`).then((r) => r.timeline),
    enabled: !!id,
  });

export function useTaskMutations(taskId?: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['alerts'] });
    if (taskId) {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['timeline', taskId] });
    }
  };
  return {
    create: useMutation({
      mutationFn: ({ projectId, ...body }: { projectId: string; title: string; description?: string; priority?: string; dueDate?: string | null; assigneeIds?: string[]; dependencyIds?: string[] }) =>
        api.post<{ task: TaskDetail }>(`/projects/${projectId}/tasks`, body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string; title?: string; description?: string; priority?: string; dueDate?: string | null }) =>
        api.patch<{ task: TaskDetail }>(`/tasks/${id}`, body),
      onSuccess: refresh,
    }),
    transition: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) => api.post<{ task: TaskDetail }>(`/tasks/${id}/transition`, { status }),
      onSuccess: refresh,
    }),
    assign: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) => api.post(`/tasks/${id}/assignees`, { userId }),
      onSuccess: refresh,
    }),
    unassign: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) => api.del(`/tasks/${id}/assignees/${userId}`),
      onSuccess: refresh,
    }),
    addDependency: useMutation({
      mutationFn: ({ id, dependsOnTaskId }: { id: string; dependsOnTaskId: string }) => api.post(`/tasks/${id}/dependencies`, { dependsOnTaskId }),
      onSuccess: refresh,
    }),
    removeDependency: useMutation({
      mutationFn: ({ id, depId }: { id: string; depId: string }) => api.del(`/tasks/${id}/dependencies/${depId}`),
      onSuccess: refresh,
    }),
    comment: useMutation({
      mutationFn: ({ id, body }: { id: string; body: string }) => api.post(`/tasks/${id}/comments`, { body }),
      onSuccess: refresh,
    }),
    bulk: useMutation({
      mutationFn: (body: { taskIds: string[]; operation: Record<string, unknown> }) => api.post<BulkResult>('/tasks/bulk', body),
      onSuccess: refresh,
    }),
  };
}

// ---------- Dashboard & alerts ----------
export const useDashboard = (projectId?: string) =>
  useQuery({
    queryKey: ['dashboard', projectId ?? 'all'],
    queryFn: () => api.get<{ dashboard: Dashboard }>(`/dashboard${qs({ projectId })}`).then((r) => r.dashboard),
  });

export const useOverdueAlerts = () =>
  useQuery({
    queryKey: ['alerts', 'overdue'],
    queryFn: () => api.get<{ alerts: OverdueAlert[] }>('/alerts/overdue').then((r) => r.alerts),
  });

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.post(`/alerts/overdue/${taskId}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
