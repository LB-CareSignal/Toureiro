import type { JobPage, SerializedJob } from './job';
import type { QueueName, QueueSummary } from './queue';

export interface ApiSuccess<T> {
  status: 'OK';
}

export interface ApiFailure {
  status: 'FAIL';
  message: string;
}

export type ApiResponse<T> = (ApiSuccess<T> & T) | ApiFailure;

export type QueueListResponse = ApiResponse<{
  queues: QueueName[];
}>;

export type QueueResponse = ApiResponse<{
  queue: QueueSummary;
}>;

export type JobResponse = ApiResponse<{
  job: SerializedJob;
}>;

export type JobPageResponse = ApiResponse<JobPage>;

export type MutationResponse = ApiResponse<{
  job?: SerializedJob;
}>;