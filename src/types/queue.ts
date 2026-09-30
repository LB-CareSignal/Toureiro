import type { JobState } from './job';

export type QueueName = string;

export type QueueStats = Record<JobState, number> & {
  total: number;
};

export interface QueueSummary {
  name: QueueName;
  stats: QueueStats;
}