import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const LABEL_SLOTS = [1, 2, 3, 4, 5, 6] as const;

// 色の名前(顔料の名前)。ラベルに名前をつけていないときの、仮の名前にもなる
export const PIGMENTS = ['Carmine', 'Ultramarine', 'Verdigris', 'Ochre', 'Violet', 'Graphite'];

export function labelColor(slot: number): string {
  return `var(--label-${slot})`;
}

export function defaultLabelName(slot: number): string {
  return PIGMENTS[slot - 1] ?? '';
}

// ラベルの名前を読み込む(名前が空なら、色の名前を返す)
export function useLabels() {
  const [supabase] = useState(() => createClient());
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('labels').select('slot,name');
    const map: Record<number, string> = {};
    (data ?? []).forEach((r: { slot: number; name: string }) => {
      map[r.slot] = r.name;
    });
    setSaved(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useCallback(
    (slot: number) => (saved[slot] ?? '').trim() || defaultLabelName(slot),
    [saved]
  );

  return { loading, saved, nameOf, reload: load };
}