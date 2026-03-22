import { useState, useMemo } from 'react';
import { icons } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Keyword → icon name map for smart suggestions
const ICON_KEYWORDS: Record<string, string> = {
  work: 'briefcase',
  job: 'briefcase',
  office: 'building-2',
  business: 'briefcase',
  personal: 'user',
  fitness: 'dumbbell',
  gym: 'dumbbell',
  exercise: 'dumbbell',
  health: 'heart-pulse',
  medical: 'stethoscope',
  shopping: 'shopping-cart',
  buy: 'shopping-bag',
  home: 'house',
  household: 'house',
  finance: 'banknote',
  money: 'wallet',
  travel: 'plane',
  trip: 'map-pin',
  vacation: 'palm-tree',
  study: 'book-open',
  learn: 'graduation-cap',
  education: 'graduation-cap',
  school: 'graduation-cap',
  code: 'code',
  dev: 'code',
  programming: 'terminal',
  family: 'users',
  social: 'message-circle',
  creative: 'palette',
  art: 'palette',
  design: 'pen-tool',
  music: 'music',
  food: 'utensils',
  cooking: 'chef-hat',
  reading: 'book-open',
  writing: 'pen-line',
  garden: 'flower-2',
  pet: 'paw-print',
  car: 'car',
  clean: 'sparkles',
  organize: 'layout-grid',
  plan: 'calendar',
  meeting: 'video',
  call: 'phone',
  email: 'mail',
  urgent: 'alert-triangle',
  project: 'folder',
  goal: 'target',
  habit: 'repeat',
  morning: 'sunrise',
  evening: 'sunset',
  sport: 'trophy',
};

// Convert kebab-case to PascalCase
function kebabToPascal(str: string): string {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// Get suggested icons based on a group name
export function suggestIcons(name: string): string[] {
  const lower = name.toLowerCase();
  const suggestions: string[] = [];

  for (const [keyword, icon] of Object.entries(ICON_KEYWORDS)) {
    if (lower.includes(keyword)) {
      if (!suggestions.includes(icon)) suggestions.push(icon);
    }
  }

  // Always add some popular defaults
  const defaults = ['list-todo', 'circle-check', 'star', 'bookmark', 'tag', 'zap', 'rocket', 'sparkles'];
  for (const d of defaults) {
    if (!suggestions.includes(d)) suggestions.push(d);
    if (suggestions.length >= 12) break;
  }

  return suggestions;
}

// Resolve a kebab-case icon name to a Lucide component
export function getIcon(name: string): LucideIcon | null {
  const pascal = kebabToPascal(name);
  return (icons as Record<string, LucideIcon>)[pascal] || null;
}

interface IconSuggestProps {
  name: string;          // group name for auto-suggestion
  value: string;         // currently selected icon (kebab-case)
  onChange: (icon: string) => void;
}

export default function IconSuggest({ name, value, onChange }: IconSuggestProps) {
  const [search, setSearch] = useState('');

  const suggested = useMemo(() => suggestIcons(name), [name]);

  const allIcons = useMemo(() => {
    if (!search) return suggested;
    const lower = search.toLowerCase();
    const iconNames = Object.keys(icons).map(k =>
      k.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
    );
    return iconNames.filter(n => n.includes(lower)).slice(0, 24);
  }, [search, suggested]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search icons..."
        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
      />
      <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto">
        {allIcons.map(iconName => {
          const Icon = getIcon(iconName);
          if (!Icon) return null;
          const isSelected = value === iconName;
          return (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              className={`p-2 rounded-lg transition-all ${
                isSelected
                  ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300'
                  : 'hover:bg-gray-100 text-gray-500'
              }`}
              title={iconName}
            >
              <Icon className="w-4 h-4 mx-auto" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
