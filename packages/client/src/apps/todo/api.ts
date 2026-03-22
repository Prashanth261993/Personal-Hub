import axios from 'axios';
import type {
  TodoGroup,
  CreateGroupRequest,
  UpdateGroupRequest,
  TodoSummary,
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  MoveTodoRequest,
  BatchReorderRequest,
  TodoStats,
  CalendarTodo,
} from '@networth/shared';

const api = axios.create({ baseURL: '/api/todo' });

// ── Groups ──
export const fetchGroups = () => api.get<TodoGroup[]>('/groups').then(r => r.data);
export const createGroup = (data: CreateGroupRequest) => api.post<TodoGroup>('/groups', data).then(r => r.data);
export const updateGroup = (id: string, data: UpdateGroupRequest) => api.put<TodoGroup>(`/groups/${id}`, data).then(r => r.data);
export const deleteGroup = (id: string) => api.delete(`/groups/${id}`).then(r => r.data);
export const reorderGroups = (groups: { id: string; sortOrder: number }[]) =>
  api.put<TodoGroup[]>('/groups/reorder', { groups }).then(r => r.data);

// ── Todos ──
export const fetchTodos = (params?: { groupId?: string; status?: string; priority?: string; dueBefore?: string; dueAfter?: string }) =>
  api.get<TodoSummary[]>('/todos', { params }).then(r => r.data);
export const fetchTodo = (id: string) => api.get<Todo & { subtasks: Todo[] }>(`/todos/${id}`).then(r => r.data);
export const createTodo = (data: CreateTodoRequest) => api.post<Todo>('/todos', data).then(r => r.data);
export const updateTodo = (id: string, data: UpdateTodoRequest) => api.put<Todo>(`/todos/${id}`, data).then(r => r.data);
export const deleteTodo = (id: string) => api.delete(`/todos/${id}`).then(r => r.data);
export const moveTodo = (id: string, data: MoveTodoRequest) => api.put<Todo>(`/todos/${id}/move`, data).then(r => r.data);
export const completeTodo = (id: string, date?: string) => api.put<Todo>(`/todos/${id}/complete`, { date }).then(r => r.data);
export const reopenTodo = (id: string) => api.put<Todo>(`/todos/${id}/reopen`).then(r => r.data);
export const reorderTodos = (data: BatchReorderRequest) => api.put('/todos/reorder', data).then(r => r.data);
export const detachRecurringInstance = (id: string, originalDate: string, newDate: string) =>
  api.post<Todo>(`/todos/${id}/detach`, { originalDate, newDate }).then(r => r.data);

// ── Stats ──
export const fetchStats = () => api.get<TodoStats>('/stats').then(r => r.data);
export const fetchCalendarTodos = (month: string) => api.get<CalendarTodo[]>('/stats/calendar', { params: { month } }).then(r => r.data);
