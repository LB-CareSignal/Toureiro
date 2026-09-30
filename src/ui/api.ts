import type { JobId, JobPage, JobState, SerializedJob } from '../types/job';
import type { QueueName, QueueSummary } from '../types/queue';
import type { ApiResponse, MutationResponse } from '../types/api';

type ApiSuccessPayload<T> = Extract<ApiResponse<T>, { status: 'OK' }>;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== undefined) {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiSuccessPayload<T>> {
  const response = await fetch(path, options);
  const payload = await response.json() as ApiResponse<T>;

  if (payload.status === 'FAIL') {
    throw new Error(payload.message);
  }

  return payload;
}

export async function listQueues(): Promise<QueueName[]> {
  const payload = await request<{ queues: QueueName[] }>('queue/list/');
  return payload.queues;
}

export async function getQueue(name: QueueName): Promise<QueueSummary> {
  const query = buildQuery({ name });
  const payload = await request<{ queue: QueueSummary }>(`queue/?${query}`);
  return payload.queue;
}

export async function fetchJobs(queue: QueueName, state: JobState, page: number, limit: number): Promise<JobPage> {
  const query = buildQuery({ queue, page, limit });
  const payload = await request<JobPage>(`job/fetch/${state}?${query}`);
  return {
    jobs: payload.jobs,
    total: Number(payload.total),
    page: Number(payload.page),
    limit: Number(payload.limit)
  };
}

export async function getJob(queue: QueueName, id: JobId): Promise<SerializedJob> {
  const query = buildQuery({ queue, id });
  const payload = await request<{ job: SerializedJob }>(`job/?${query}`);
  return payload.job;
}

async function postMutation(path: string, queue: QueueName, id: JobId): Promise<MutationResponse> {
  return request<MutationResponse>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ queue, id })
  });
}

export function removeJob(queue: QueueName, id: JobId): Promise<MutationResponse> {
  return postMutation('job/remove/', queue, id);
}

export function promoteJob(queue: QueueName, id: JobId): Promise<MutationResponse> {
  return postMutation('job/promote/', queue, id);
}

export function rerunJob(queue: QueueName, id: JobId): Promise<MutationResponse> {
  return postMutation('job/rerun/', queue, id);
}