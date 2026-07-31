// Class color metadata — mirrors the class_color enum in
// supabase/migrations/20260802000000_class_colors_and_roles.sql.
export const CLASS_COLORS = [
  'orange',
  'crimson',
  'magenta',
  'yellow',
  'red',
  'purple',
  'blue',
  'lavender',
  'green',
  'cyan',
  'violet',
  'maroon',
] as const;

export type ClassColor = (typeof CLASS_COLORS)[number];

export const COLOR_META: Record<ClassColor, { label: string; dot: string; chip: string }> = {
  orange: { label: 'Orange', dot: 'bg-orange-500', chip: 'border-orange-300 bg-orange-50 text-orange-700' },
  crimson: { label: 'Crimson', dot: 'bg-rose-600', chip: 'border-rose-300 bg-rose-50 text-rose-700' },
  magenta: { label: 'Magenta', dot: 'bg-fuchsia-600', chip: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700' },
  yellow: { label: 'Yellow', dot: 'bg-yellow-400', chip: 'border-yellow-300 bg-yellow-50 text-yellow-800' },
  red: { label: 'Red', dot: 'bg-red-500', chip: 'border-red-300 bg-red-50 text-red-700' },
  purple: { label: 'Purple', dot: 'bg-purple-500', chip: 'border-purple-300 bg-purple-50 text-purple-700' },
  blue: { label: 'Blue', dot: 'bg-blue-500', chip: 'border-blue-300 bg-blue-50 text-blue-700' },
  lavender: { label: 'Lavender', dot: 'bg-purple-300', chip: 'border-purple-200 bg-purple-50 text-purple-500' },
  green: { label: 'Green', dot: 'bg-green-500', chip: 'border-green-300 bg-green-50 text-green-700' },
  cyan: { label: 'Cyan', dot: 'bg-cyan-500', chip: 'border-cyan-300 bg-cyan-50 text-cyan-700' },
  violet: { label: 'Violet', dot: 'bg-violet-500', chip: 'border-violet-300 bg-violet-50 text-violet-700' },
  maroon: { label: 'Maroon', dot: 'bg-red-900', chip: 'border-red-900/30 bg-red-50 text-red-900' },
};

export function colorLabel(color: string | null | undefined): string {
  return (color && COLOR_META[color as ClassColor]?.label) || 'Blue';
}

export function colorDot(color: string | null | undefined): string {
  return (color && COLOR_META[color as ClassColor]?.dot) || 'bg-blue-500';
}

export function colorChip(color: string | null | undefined): string {
  return (color && COLOR_META[color as ClassColor]?.chip) || 'border-blue-300 bg-blue-50 text-blue-700';
}
