import { Headphones, Wrench } from 'lucide-react';

const CONTACTS = [
  { label: 'phần mềm', short: 'Phần mềm', name: 'Ngô Huy Thao', zalo: '0375336663', icon: Headphones },
  { label: 'phần cứng', short: 'Phần cứng', name: 'Ngô Văn Bảo', zalo: '0346905569', icon: Wrench },
];

const formatPhone = (p: string) => p.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');

/** Blue support strip shown on top of the login page and every logged-in page. */
export function SupportBanner({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-blue-600 text-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-x-6 gap-y-1 py-2 text-xs min-[380px]:text-[13px] sm:text-sm font-medium">
          {CONTACTS.map(({ label, short, name, zalo, icon: Icon }) => (
            <span key={zalo} className="inline-flex items-center gap-1.5 text-center sm:whitespace-nowrap">
              <Icon className="w-4 h-4 shrink-0" />
              <span>
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">Hỗ trợ {label}</span>: {name} · Zalo{' '}
                <a
                  href={`https://zalo.me/${zalo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 whitespace-nowrap hover:text-blue-100"
                >
                  {formatPhone(zalo)}
                </a>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
