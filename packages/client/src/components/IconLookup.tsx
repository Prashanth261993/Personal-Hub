import { useState, useMemo, createElement } from 'react';
import { icons, ChevronDown, ChevronUp, Search, Check, Copy } from 'lucide-react';

/** Convert PascalCase to kebab-case: "TrendingUp" → "trending-up" */
function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

const MAX_VISIBLE = 200;

const allIcons = Object.keys(icons).map((pascal) => ({
  pascal,
  kebab: toKebab(pascal),
}));

export default function IconLookup() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return allIcons;
    const q = search.toLowerCase().replace(/\s+/g, '-');
    return allIcons.filter(
      (i) => i.kebab.includes(q) || i.pascal.toLowerCase().includes(q.replace(/-/g, ''))
    );
  }, [search]);

  const visible = filtered.slice(0, MAX_VISIBLE);
  const hasMore = filtered.length > MAX_VISIBLE;

  const copyName = (kebab: string) => {
    navigator.clipboard.writeText(kebab);
    setCopied(kebab);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200">
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Icon Lookup</h3>
          <span className="text-xs text-gray-400 ml-1">({allIcons.length} icons)</span>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Collapsible Body */}
      {open && (
        <div className="px-6 pb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons… e.g. wallet, home, chart"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <p className="text-xs text-gray-500">
            Click an icon to copy its name. Use that name in the category icon field above.
          </p>

          {/* Icons Grid */}
          {visible.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No icons match "<span className="font-medium">{search}</span>"
            </p>
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-[420px] overflow-y-auto pr-1">
                {visible.map(({ pascal, kebab }) => {
                  const isCopied = copied === kebab;
                  return (
                    <button
                      key={pascal}
                      onClick={() => copyName(kebab)}
                      title={kebab}
                      className={`group relative flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all ${
                        isCopied
                          ? 'border-success-500 bg-success-50'
                          : 'border-gray-100 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      {isCopied ? (
                        <Check className="w-5 h-5 text-success-600" />
                      ) : (
                        createElement(icons[pascal as keyof typeof icons], {
                          className: 'w-5 h-5 text-gray-600 group-hover:text-primary-600',
                        })
                      )}
                      <span className="text-[10px] leading-tight text-gray-500 truncate w-full">
                        {kebab}
                      </span>

                      {/* Copy tooltip on hover */}
                      {!isCopied && (
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-gray-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none flex items-center gap-0.5">
                          <Copy className="w-2.5 h-2.5" /> copy
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Overflow message */}
              {hasMore && (
                <p className="text-xs text-gray-400 text-center">
                  Showing {MAX_VISIBLE} of {filtered.length} results — refine your search to see more.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
