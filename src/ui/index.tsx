import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfigProvider,
  Descriptions,
  Empty,
  Input,
  Layout,
  List,
  Modal,
  Pagination,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography
} from 'antd';
import {
  DeleteOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import 'antd/dist/reset.css';
import './styles.css';
import type { JobId, JobState, SerializedJob } from '../types/job';
import type { QueueName, QueueStats, QueueSummary } from '../types/queue';
import { fetchJobs, getJob, getQueue, listQueues, promoteJob, removeJob, rerunJob } from './api';

const { Content, Sider } = Layout;
const { Text, Title } = Typography;

const jobStates: JobState[] = ['active', 'wait', 'delayed', 'completed', 'failed'];
const pageSize = 15;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    return value;
  }
}

function normalizeJob(job: SerializedJob): SerializedJob {
  return {
    ...job,
    data: parseJson(job.data),
    opts: parseJson(job.opts)
  };
}

function statusColor(state: JobState): string {
  switch (state) {
    case 'active':
      return 'processing';
    case 'wait':
      return 'default';
    case 'delayed':
      return 'warning';
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
}

function chooseState(stats?: QueueStats): JobState {
  if (!stats) {
    return 'active';
  }
  return jobStates.find((state) => Number(stats[state]) > 0) || 'active';
}

interface JobCardProps {
  job: SerializedJob;
  readonly: boolean;
  queue: QueueName;
  onChanged: () => void;
}

function JobCard({ job, readonly, queue, onChanged }: JobCardProps): React.ReactElement {
  const displayJob = useMemo(() => normalizeJob(job), [job]);
  const createdAt = displayJob.timestamp ? new Date(displayJob.timestamp).toLocaleString() : 'Unknown';
  const delayedUntil = displayJob.timestamp && displayJob.delay
    ? new Date(displayJob.timestamp + displayJob.delay).toLocaleString()
    : undefined;

  function confirmAction(title: string, action: () => Promise<unknown>): void {
    Modal.confirm({
      title,
      okText: 'Confirm',
      onOk: async () => {
        await action();
        onChanged();
      }
    });
  }

  return (
    <Card className="job-card" size="small">
      <div className="job-card__header">
        <Space wrap>
          <Text strong>Job {String(displayJob.id)}</Text>
          <Tag color={statusColor(displayJob.state)}>{titleCase(displayJob.state)}</Tag>
        </Space>
        <Space wrap>
          {displayJob.state === 'delayed' && !readonly ? (
            <Button
              icon={<ThunderboltOutlined />}
              size="small"
              onClick={() => confirmAction('Promote this delayed job?', () => promoteJob(queue, displayJob.id))}
            >
              Promote
            </Button>
          ) : null}
          {(displayJob.state === 'completed' || displayJob.state === 'failed') && !readonly ? (
            <Button
              icon={<PlayCircleOutlined />}
              size="small"
              onClick={() => confirmAction('Rerun this job?', () => rerunJob(queue, displayJob.id))}
            >
              Rerun
            </Button>
          ) : null}
          {!readonly ? (
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => confirmAction('Remove this job? This cannot be undone.', () => removeJob(queue, displayJob.id))}
            >
              Remove
            </Button>
          ) : null}
        </Space>
      </div>
      <Descriptions className="job-card__meta" column={{ xs: 1, sm: 2, lg: 3 }} size="small">
        <Descriptions.Item label="Created">{createdAt}</Descriptions.Item>
        {delayedUntil ? <Descriptions.Item label="Delayed Until">{delayedUntil}</Descriptions.Item> : null}
      </Descriptions>
      <pre className="job-json"><code>{JSON.stringify(displayJob, null, 2)}</code></pre>
    </Card>
  );
}

function ToureiroApp(): React.ReactElement {
  const [queues, setQueues] = useState<QueueName[]>([]);
  const [queue, setQueue] = useState<QueueName>();
  const [queueSummary, setQueueSummary] = useState<QueueSummary>();
  const [state, setState] = useState<JobState>('active');
  const [jobs, setJobs] = useState<SerializedJob[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [readonly, setReadonly] = useState(true);
  const [loadingQueues, setLoadingQueues] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [error, setError] = useState<string>();
  const [searchId, setSearchId] = useState('');
  const [searchedJob, setSearchedJob] = useState<SerializedJob | null>();
  const [searching, setSearching] = useState(false);

  async function refreshQueues(): Promise<void> {
    const queueNames = await listQueues();
    setQueues(queueNames);
    if (!queue && queueNames.length > 0) {
      setQueue(queueNames[0]);
    }
  }

  async function refreshQueueSummary(selectedQueue: QueueName): Promise<void> {
    const summary = await getQueue(selectedQueue);
    setQueueSummary(summary);
    setState((current) => current || chooseState(summary.stats));
  }

  async function refreshJobs(): Promise<void> {
    if (!queue) {
      setJobs([]);
      setTotal(0);
      return;
    }
    setLoadingJobs(true);
    try {
      const result = await fetchJobs(queue, state, page, pageSize);
      setJobs(result.jobs);
      setTotal(result.total);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch jobs.');
    } finally {
      setLoadingJobs(false);
    }
  }

  async function refreshAll(): Promise<void> {
    setLoadingQueues(true);
    try {
      await refreshQueues();
      if (queue) {
        await refreshQueueSummary(queue);
      }
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh queues.');
    } finally {
      setLoadingQueues(false);
    }
  }

  useEffect(() => {
    refreshAll();
    const timer = window.setInterval(refreshAll, 2000);
    return () => window.clearInterval(timer);
  }, [queue]);

  useEffect(() => {
    setPage(0);
    setSearchedJob(undefined);
  }, [queue, state]);

  useEffect(() => {
    refreshJobs();
  }, [queue, state, page]);

  async function searchJob(): Promise<void> {
    if (!queue || !searchId.trim()) {
      setSearchedJob(undefined);
      return;
    }
    setSearching(true);
    try {
      const result = await getJob(queue, searchId.trim());
      setSearchedJob(result);
      setError(undefined);
    } catch (err) {
      setSearchedJob(null);
      setError(err instanceof Error ? err.message : 'Unable to find job.');
    } finally {
      setSearching(false);
    }
  }

  const stateOptions = jobStates.map((jobState) => ({
    label: (
      <Space size={6}>
        {titleCase(jobState)}
        <Badge count={Number(queueSummary?.stats[jobState] || 0)} overflowCount={999999} />
      </Space>
    ),
    value: jobState
  }));

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 6,
          fontFamily: 'Aptos, "IBM Plex Sans", "Segoe UI", sans-serif'
        }
      }}
    >
      <Layout className="app-shell">
        <Sider className="app-sidebar" breakpoint="lg" collapsedWidth="0" width={320}>
          <div className="brand-block">
            <Title level={3}>Toureiro</Title>
            <Text type="secondary">Bull queue operations</Text>
          </div>
          <Space className="sidebar-stack" direction="vertical" size="large">
            <div>
              <Text className="field-label">Queue</Text>
              <Select
                className="full-width"
                loading={loadingQueues}
                onChange={(value) => setQueue(value)}
                options={queues.map((name) => ({ label: name, value: name }))}
                placeholder="Select queue"
                value={queue}
              />
            </div>
            <div>
              <Text className="field-label">Mode</Text>
              <div className="readonly-row">
                <Switch checked={readonly} onChange={setReadonly} />
                <Text>{readonly ? 'Readonly' : 'Mutations enabled'}</Text>
              </div>
            </div>
            <Card className="stats-card" size="small">
              <Space direction="vertical" className="full-width">
                <Text type="secondary">Total Jobs</Text>
                <Title level={2}>{Number(queueSummary?.stats.total || 0)}</Title>
                {jobStates.map((jobState) => (
                  <div className="stat-row" key={jobState}>
                    <Text>{titleCase(jobState)}</Text>
                    <Badge count={Number(queueSummary?.stats[jobState] || 0)} overflowCount={999999} />
                  </div>
                ))}
              </Space>
            </Card>
          </Space>
        </Sider>
        <Content className="app-content">
          <div className="toolbar">
            <div>
              <Title level={2}>{queue || 'No queue selected'}</Title>
              <Text type="secondary">Live queue state refreshes every 2 seconds.</Text>
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => { refreshAll(); refreshJobs(); }}>
              Refresh
            </Button>
          </div>
          {error ? <Alert className="error-alert" message={error} showIcon type="error" /> : null}
          <Card className="control-panel">
            <Space direction="vertical" size="middle" className="full-width">
              <Segmented block options={stateOptions} onChange={(value) => setState(value as JobState)} value={state} />
              <Input.Search
                enterButton={<SearchOutlined />}
                loading={searching}
                onChange={(event) => setSearchId(event.target.value)}
                onSearch={searchJob}
                placeholder="Find job by ID"
                value={searchId}
              />
            </Space>
          </Card>
          {searchedJob === null ? <Alert className="error-alert" message="Job was not found." showIcon type="warning" /> : null}
          {searchedJob ? (
            <div className="job-section">
              <Title level={4}>Job Details</Title>
              <JobCard job={searchedJob} onChanged={() => { searchJob(); refreshJobs(); refreshAll(); }} queue={queue as QueueName} readonly={readonly} />
            </div>
          ) : null}
          <div className="job-section">
            <div className="section-heading">
              <Title level={4}>{titleCase(state)} Jobs</Title>
              <Text type="secondary">{total} total</Text>
            </div>
            <Spin spinning={loadingJobs}>
              {jobs.length > 0 && queue ? (
                <List
                  dataSource={jobs}
                  renderItem={(job) => (
                    <List.Item>
                      <JobCard job={job} onChanged={() => { refreshJobs(); refreshAll(); }} queue={queue} readonly={readonly} />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No jobs in this state" />
              )}
            </Spin>
            <Pagination
              className="jobs-pagination"
              current={page + 1}
              onChange={(nextPage) => setPage(nextPage - 1)}
              pageSize={pageSize}
              showSizeChanger={false}
              total={total}
            />
          </div>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

const mountNode = document.getElementById('toureiro-wrapper');

if (mountNode) {
  createRoot(mountNode).render(<ToureiroApp />);
}