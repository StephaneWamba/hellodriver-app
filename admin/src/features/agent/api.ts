import { api } from '@/lib/api';
import type { AdminAgentStatus } from './types';

export function fetchAgentStatus(): Promise<AdminAgentStatus> {
  return api.get('/admin/agent/status');
}
