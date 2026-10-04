import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { OverviewTabs } from '../components/OverviewTabs';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  apiErrorMessage,
  deleteShareGroup,
  getDevices,
  getShareGroups,
  updateShareGroup,
} from '../services/api';
import type { ShareGroup } from '../types';
import { colorAt } from '../components/shareColors';

// "Chia sẻ" tab: the user's power share groups (same backend as the app,
// /api/user/share-groups). Tap a group -> live overview; edit / create in
// ShareGroupEditor.

const fmtRatio = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export function PowerShare() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShareGroup | null>(null);

  const groupsQuery = useQuery({ queryKey: ['share-groups'], queryFn: getShareGroups });
  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: getDevices });
  const names = new Map(
    (devicesQuery.data?.devices ?? []).map((d) => [d.deviceId, d.deviceName || d.deviceId]),
  );

  const toggle = useMutation({
    mutationFn: (g: ShareGroup) => updateShareGroup(g._id, { enabled: !g.enabled }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['share-groups'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Không đổi được trạng thái nhóm.')),
  });

  const remove = useMutation({
    mutationFn: (g: ShareGroup) => deleteShareGroup(g._id),
    onSuccess: () => {
      setConfirmDelete(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ['share-groups'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Không xoá được nhóm.')),
  });

  const groups = groupsQuery.data ?? [];

  return (
    <Layout>
      <div className="space-y-5">
        <OverviewTabs />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Chia sẻ công suất</h1>
            <p className="text-sm text-gray-500">Chia công suất xả giữa các máy hoà lưới theo tỉ lệ</p>
          </div>
          <Link
            to="/share/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Tạo nhóm
          </Link>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {groupsQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : groupsQuery.error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center text-sm text-red-700">
            Không tải được danh sách nhóm.{' '}
            <button onClick={() => groupsQuery.refetch()} className="underline font-medium">
              Thử lại
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl bg-white border border-gray-200 px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
              <Share2 className="w-7 h-7 text-blue-600" />
            </div>
            <p className="font-semibold text-gray-900">Chưa có nhóm chia sẻ nào</p>
            <p className="mt-1 text-sm text-gray-500">Gộp công suất xả của nhiều máy hoà lưới rồi chia lại theo tỉ lệ bạn đặt.</p>
            <Link
              to="/share/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Tạo nhóm
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {groups.map((g) => {
              const total = g.members.reduce((s, m) => s + (m.ratio || 0), 0);
              return (
                <li key={g._id} className="rounded-xl bg-white border border-gray-200 hover:border-blue-300 transition-colors">
                  <div className="flex items-start gap-3 p-4">
                    <button
                      onClick={() => navigate(`/share/${g._id}`)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-900">{g.name || 'Nhóm chia sẻ'}</span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                        <span className={`inline-block h-2 w-2 rounded-full ${g.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className={g.enabled ? 'font-medium text-green-700' : 'text-gray-500'}>
                          {g.enabled ? 'Đang chia sẻ' : 'Đã tắt'}
                        </span>
                        <span className="text-gray-500">· {g.members.length} thiết bị</span>
                      </p>
                      {/* Ratio split */}
                      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-100">
                        {total > 0 &&
                          g.members.map((m, i) =>
                            m.ratio > 0 ? (
                              <span
                                key={m.deviceId}
                                style={{ width: `${(m.ratio / total) * 100}%`, background: colorAt(i) }}
                                className="h-full border-r-2 border-white last:border-r-0"
                              />
                            ) : null,
                          )}
                      </div>
                      <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                        {g.members
                          .map((m) => `${names.get(m.deviceId) ?? m.deviceId} (${fmtRatio(m.ratio)})`)
                          .join(' · ')}
                      </p>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        role="switch"
                        aria-checked={g.enabled}
                        aria-label={g.enabled ? 'Tắt nhóm' : 'Bật nhóm'}
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate(g)}
                        className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                          g.enabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            g.enabled ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                      <div className="flex gap-1">
                        <Link
                          to={`/share/${g._id}/edit`}
                          aria-label="Sửa nhóm"
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          aria-label="Xoá nhóm"
                          onClick={() => setConfirmDelete(g)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold text-gray-900">Xoá nhóm chia sẻ</h2>
            <p className="mt-2 text-sm text-gray-600">
              Bạn có chắc muốn xoá "{confirmDelete.name || 'nhóm này'}"? Các máy sẽ quay về chạy theo cài đặt / lịch
              riêng. Thao tác này không thể hoàn tác.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Huỷ
              </button>
              <button
                onClick={() => remove.mutate(confirmDelete)}
                disabled={remove.isPending}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
