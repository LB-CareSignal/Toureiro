import type { JobId, JobPage, JobState, SerializedJob } from '../types/job';
import type { QueueName, QueueStats, QueueSummary } from '../types/queue';

export interface FetchJobsRequest {
  queueName: QueueName;
  state: JobState;
  page: number;
  limit: number;
}

export interface AddJobRequest {
  queueName: QueueName;
  data: unknown;
  opts?: unknown;
}

export interface JobMutationRequest {
  queueName: QueueName;
  id: JobId;
}

export interface QueueAdapter {
  listQueues(): Promise<QueueName[]>;
  queueExists(queueName: QueueName): Promise<boolean>;
  getQueue(queueName: QueueName): Promise<QueueSummary>;
  getQueueStats(queueName: QueueName): Promise<QueueStats>;
  getJob(queueName: QueueName, id: JobId): Promise<SerializedJob | null>;
  addJob(request: AddJobRequest): Promise<SerializedJob>;
  fetchJobs(request: FetchJobsRequest): Promise<JobPage>;
  removeJob(request: JobMutationRequest): Promise<void>;
  promoteJob(request: JobMutationRequest): Promise<void>;
  rerunJob(request: JobMutationRequest): Promise<SerializedJob>;
}