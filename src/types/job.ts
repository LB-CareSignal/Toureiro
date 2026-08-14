export type JobState = 'active' | 'wait' | 'delayed' | 'completed' | 'failed';

export type JobId = string | number;

export interface SerializedJob {
  id: JobId;
  state: JobState;
  data: unknown;
  opts: unknown;
  timestamp?: number;
  delay?: number;
  attemptsMade?: number;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: unknown;
}

export interface JobPage {
  jobs: SerializedJob[];
  total: number;
  page: number;
  limit: number;
}