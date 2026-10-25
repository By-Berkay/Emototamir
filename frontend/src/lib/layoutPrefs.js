import { useCallback, useEffect, useState } from "react";

// Bölüm sırası ve görünürlüğü cihaz başına localStorage'da tutulur.
// Depolama erişilemezse (gizli sekme, engellenmiş site verisi) varsayılan düzen kullanılır.
function readStored(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Depolama kullanılamıyorsa tercih kaydedilmez; düzen yine de çalışır.
  }
}

/** Kayıtlı düzeni okur. Bilinmeyen bölümleri atar, yeni bölümleri sona ekler. */
export function loadLayout(key, defaultIds) {
  const saved = readStored(key);
  const known = new Set(defaultIds);
  const pick = (list) => (Array.isArray(list) ? list.filter((id) => known.has(id)) : []);
  return {
    order: [...new Set([...pick(saved?.order), ...defaultIds])],
    hidden: [...new Set(pick(saved?.hidden))],
  };
}

export function saveLayout(key, layout) {
  writeStored(key, { order: layout.order, hidden: layout.hidden });
}

/** Bir öğeyi, hedef öğenin konumuna taşır. */
export function moveItem(list, fromId, toId) {
  const from = list.indexOf(fromId);
  const to = list.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

/**
 * Sayfa düzeni: sıra, gizlilik, sürükle-bırak durumu ve sıfırlama.
 * `defaultIds` sabit bir dizi olmalıdır (modül düzeyinde tanımlanır).
 */
export function useLayout(key, defaultIds) {
  const [layout, setLayout] = useState(() => loadLayout(key, defaultIds));
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  useEffect(() => {
    saveLayout(key, layout);
  }, [key, layout]);

  const toggle = useCallback((id) => {
    setLayout((l) => ({
      ...l,
      hidden: l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id],
    }));
  }, []);

  const reset = useCallback(() => {
    setLayout({ order: [...defaultIds], hidden: [] });
  }, [defaultIds]);

  const dnd = {
    dragId,
    overId,
    start: setDragId,
    enter: setOverId,
    end: () => {
      setDragId(null);
      setOverId(null);
    },
    drop: (targetId) => {
      if (dragId && dragId !== targetId) {
        setLayout((l) => ({ ...l, order: moveItem(l.order, dragId, targetId) }));
      }
      setDragId(null);
      setOverId(null);
    },
  };

  return {
    order: layout.order,
    visible: layout.order.filter((id) => !layout.hidden.includes(id)),
    hidden: layout.hidden,
    toggle,
    reset,
    dnd,
  };
}
