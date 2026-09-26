import { useInfiniteQuery } from '@tanstack/react-query';
import { History, Settings, Clock, Power, Smartphone, Monitor, Shield, Server, RefreshCw } from 'lucide-react';
import { getDeviceActivity } from '../services/api';
import type { ActivityEntry } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

// "Lịch sử" tab: who changed the settings / schedule / grid-tie, when and
// from where (GET /devices/:id/activity or /chargers/:id/activity).

const ACTION = {
  settings: { label: 'Cài đặt', icon: Settings, cls: 'bg-blue-50 text-blue-600' },
  schedule: { label: 'Lịch trình', icon: Clock, cls: 'bg-violet-50 text-violet-600' },
  'grid-tie': { label: 'Hoà lưới', icon: Power, cls: 'bg-orange-50 text-orange-600' },
} as const;

const SOURCE: Record<ActivityEntry['source'], { label: string; icon: typeof Smartphone }> = {
  app: { label: 'Ứng dụng', icon: Smartphone },
  web: { label: 'Trang web', icon: Monitor },
  cms: { label: 'Quản trị viên', icon: Shield },
  api: { label: 'Hệ thống khác', icon: Server },
  system: { label: 'Hệ thống', icon: Server },
};

const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export function ActivityLog({
  deviceId,
  kind = 'inverter',
}: {
  deviceId: string;
  kind?: 'inverter' | 'charger';
}) {
  const q = useInfiniteQuery({
    queryKey: ['device-activity', kind, deviceId],
    queryFn: ({ pageParam }) => getDeviceActivity(deviceId, pageParam, kind),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });

  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];
  const groups: { day: string; items: ActivityEntry[] }[] = [];
  for (const r of rows) {
    const d = dayKey(r.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.day === d) g.items.push(r);
    else groups.push({ day: d, items: [r] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">Lịch sử thay đổi</h3>
          <p className="text-sm text-gray-500">Các lần đổi cài đặt, lịch trình và bật/tắt hoà lưới</p>
        </div>
        <button
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          className="shrink-0 p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-50"
          aria-label="Tải lại"
        >
          <RefreshCw className={`w-4 h-4 ${q.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : q.error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center text-sm text-red-700">
          Không tải được lịch sử.{' '}
          <button onClick={() => q.refetch()} className="underline font-medium">
            Thử lại
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 py-12 px-4 text-center">
          <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chưa có thay đổi nào được ghi lại.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.day}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 first-letter:uppercase">
                {g.day}
              </h4>
              <ol className="space-y-2">
                {g.items.map((r) => {
                  const a = ACTION[r.action] ?? ACTION.settings;
                  const src = SOURCE[r.source] ?? SOURCE.system;
                  const SrcIcon = src.icon;
                  return (
                    <li key={r._id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
                      <div className={`shrink-0 h-9 w-9 rounded-lg grid place-items-center ${a.cls}`}>
                        <a.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                          <time className="text-xs text-gray-500 tabular-nums" dateTime={r.createdAt}>
                            {time(r.createdAt)}
                          </time>
                        </div>
                        <p className="mt-0.5 text-sm text-gray-700 break-words">{r.summary}</p>
                        <p className="mt-1 flex items-center gap-1 min-w-0 text-xs text-gray-500">
                          <SrcIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">{src.label}</span>
                          {r.actorLabel ? <span className="truncate min-w-0">· {r.actorLabel}</span> : null}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {q.hasNextPage && (
            <button
              onClick={() => q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
              className="w-full py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {q.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
