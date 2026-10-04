import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  apiErrorMessage,
  createShareGroup,
  getDevices,
  getShareGroups,
  updateShareGroup,
} from '../services/api';
import { colorAt } from '../components/shareColors';

// Create (/share/new) or edit (/share/:groupId/edit) a power share group:
// name, on/off, member devices and their ratios. Same rules as the app:
// a device already in another ENABLED group is not offered.

const MAX_RATIO = 99;

export function ShareGroupEditor() {
  const { groupId } = useParams<{ groupId: string }>();
  const isNew = !groupId;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: getDevices });
  const groupsQuery = useQuery({ queryKey: ['share-groups'], queryFn: getShareGroups });

  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [ratios, setRatios] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [initialised, setInitialised] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = groupsQuery.data?.find((g) => g._id === groupId);

  // Fill the form once the group is known (edit mode).
  useEffect(() => {
    if (initialised || isNew || !editing) return;
    setName(editing.name ?? '');
    setEnabled(editing.enabled);
    setSelected(editing.members.map((m) => m.deviceId));
    setRatios(Object.fromEntries(editing.members.map((m) => [m.deviceId, String(m.ratio)])));
    setInitialised(true);
  }, [editing, initialised, isNew]);

  // Devices of an enabled group other than this one cannot be picked.
  const taken = useMemo(() => {
    const out = new Map<string, string>();
    for (const g of groupsQuery.data ?? []) {
      if (!g.enabled || g._id === groupId) continue;
      for (const m of g.members) out.set(m.deviceId, g.name || 'nhóm khác');
    }
    return out;
  }, [groupsQuery.data, groupId]);

  const devices = devicesQuery.data?.devices ?? [];
  const ratioOf = (id: string) => {
    const v = parseFloat((ratios[id] ?? '1').replace(',', '.'));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const total = selected.reduce((s, id) => s + ratioOf(id), 0);
  const nameOf = (id: string) => devices.find((d) => d.deviceId === id)?.deviceName || id;

  const toggleDevice = (id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setRatios((r) => (r[id] === undefined ? { ...r, [id]: '1' } : r));
  };
  const step = (id: string, d: number) => {
    const next = Math.min(MAX_RATIO, Math.max(0, Math.round(ratioOf(id) + d)));
    setRatios((r) => ({ ...r, [id]: String(next) }));
  };

  const save = async () => {
    setError(null);
    if (selected.length === 0) {
      setError('Vui lòng chọn ít nhất một thiết bị.');
      return;
    }
    if (total <= 0) {
      setError('Tổng tỉ lệ đang bằng 0 — hãy đặt ít nhất một máy > 0.');
      return;
    }
    const input = {
      name: name.trim() || undefined,
      enabled,
      members: selected.map((deviceId) => ({ deviceId, ratio: ratioOf(deviceId) })),
    };
    setSaving(true);
    try {
      const saved = isNew ? await createShareGroup(input) : await updateShareGroup(groupId!, input);
      await qc.invalidateQueries({ queryKey: ['share-groups'] });
      navigate(`/share/${saved?._id ?? groupId}`, { replace: true });
    } catch (e) {
      setError(apiErrorMessage(e, 'Không lưu được nhóm.'));
    } finally {
      setSaving(false);
    }
  };

  const loading = devicesQuery.isLoading || groupsQuery.isLoading;
  const notFound = !isNew && !loading && !editing;

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <Link
            to={isNew ? '/share' : `/share/${groupId}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Link>
          <h1 className="mt-2 text-xl sm:text-2xl font-bold text-gray-900">
            {isNew ? 'Tạo nhóm chia sẻ' : 'Sửa nhóm chia sẻ'}
          </h1>
          <p className="text-sm text-gray-500">
            Server gộp tải của các máy trong nhóm rồi chia lại công suất xả theo tỉ lệ bạn đặt.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : notFound ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">Không tìm thấy nhóm.</div>
        ) : (
          <>
            <section className="rounded-xl bg-white border border-gray-200 p-4 sm:p-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Tên nhóm</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nhà chính"
                  maxLength={60}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium text-gray-700">Bật chia sẻ</span>
                  <span className="block text-xs text-gray-500">Tắt để tạm dừng, các máy chạy theo cài đặt / lịch riêng.</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      enabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
            </section>

            <section className="rounded-xl bg-white border border-gray-200 p-4 sm:p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Thiết bị và tỉ lệ</h2>
                <span className="text-xs text-gray-400">{selected.length} đã chọn</span>
              </div>
              {devices.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">Bạn chưa có thiết bị hoà lưới nào.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {devices.map((d) => {
                    const id = d.deviceId;
                    const on = selected.includes(id);
                    const busy = taken.get(id);
                    const idx = selected.indexOf(id);
                    return (
                      <li key={id} className="flex items-center gap-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!!busy && !on}
                          onChange={() => toggleDevice(id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                          aria-label={`Chọn ${d.deviceName || id}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${busy && !on ? 'text-gray-400' : 'text-gray-900'}`}>
                            {on && (
                              <span
                                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                                style={{ background: colorAt(idx) }}
                              />
                            )}
                            {d.deviceName || id}
                          </p>
                          <p className="truncate text-xs text-gray-400">
                            {busy && !on ? `Đang ở nhóm "${busy}"` : id}
                          </p>
                        </div>
                        {on && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => step(id, -1)}
                              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                              aria-label="Giảm tỉ lệ"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              inputMode="decimal"
                              value={ratios[id] ?? '1'}
                              onChange={(e) => setRatios((r) => ({ ...r, [id]: e.target.value }))}
                              className="w-14 rounded-md border border-gray-300 px-2 py-1 text-center text-sm tabular-nums focus:border-blue-500 focus:outline-none"
                              aria-label="Tỉ lệ"
                            />
                            <button
                              type="button"
                              onClick={() => step(id, 1)}
                              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                              aria-label="Tăng tỉ lệ"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {selected.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-medium text-gray-600">Phần công suất mỗi máy nhận</p>
                  <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-gray-100">
                    {total > 0 &&
                      selected.map((id, i) =>
                        ratioOf(id) > 0 ? (
                          <span
                            key={id}
                            style={{ width: `${(ratioOf(id) / total) * 100}%`, background: colorAt(i) }}
                            className="h-full border-r-2 border-white last:border-r-0"
                          />
                        ) : null,
                      )}
                  </div>
                  {total > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {selected.map((id, i) => (
                        <span key={id} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorAt(i) }} />
                          {nameOf(id)} · {Math.round((ratioOf(id) / total) * 100)}%
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-red-600">Tổng tỉ lệ đang bằng 0 — hãy đặt ít nhất một máy &gt; 0</p>
                  )}
                </div>
              )}
            </section>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <Link
                to={isNew ? '/share' : `/share/${groupId}`}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Huỷ
              </Link>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : isNew ? 'Tạo nhóm' : 'Lưu'}
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
