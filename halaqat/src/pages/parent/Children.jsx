import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as parentService from '../../services/parentService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Table,
  Badge,
  Button,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

/** قائمة الأبناء في جدول مختصر. */
export default function ParentChildren() {
  const t = useT();
  const { user } = useAuth();

  const fetcher = useCallback(() => parentService.getChildren(user.userId), [user.userId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.userId]);

  const columns = [
    { key: 'name', header: t('teacher.tableStudent') },
    { key: 'circleName', header: t('parent.circleLabel') },
    { key: 'teacherName', header: t('parent.teacherLabel') },
    {
      key: 'memorizedPages',
      header: t('reports.pagesMemorized'),
      render: (row) => formatNumber(row.memorizedPages),
    },
    {
      key: 'masteryAvg',
      header: t('reports.averageMastery'),
      render: (row) => (
        <Badge variant={row.masteryAvg >= 85 ? 'success' : row.masteryAvg >= 70 ? 'info' : 'warning'}>
          {formatPercent(row.masteryAvg)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <Button size="sm" variant="secondary" to={`/app/parent/children/${row.id}`}>
          {t('common.details')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('parent.childrenTitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/parent' }, { label: t('nav.children') }]}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={data?.length === 0}
        emptyTitle={t('parent.childrenTitle')}
        emptyText={t('parent.noChildren')}
        loadingFallback={<Skeleton variant="card" count={2} height={64} />}
      >
        <Table
          columns={columns}
          rows={data ?? []}
          getRowKey={(row) => row.id}
          caption={t('parent.childrenTitle')}
        />
      </DataState>
    </>
  );
}
