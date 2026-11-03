import { useState } from "react";
import { GripHorizontal, LayoutGrid } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Switch } from "./ui/switch";

// Bölüm genişliği: büyük ekranda 3 sütunlu ızgarada kaç sütun kaplayacağı. Telefonda hepsi tek sütun.
const SPAN = {
  full: "lg:col-span-3",
  wide: "lg:col-span-2",
  narrow: "lg:col-span-1",
};

/** "Bölümler" düğmesi: her bölüm için görünürlük anahtarı ve varsayılana dönüş. */
export function SectionsPanel({ sections, hidden, onToggle, onReset }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" data-testid="sections-panel-trigger">
          <LayoutGrid />
          Bölümler
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Görünen bölümler</p>
        <ul className="space-y-3">
          {sections.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <Label htmlFor={`section-toggle-${s.id}`} className="cursor-pointer text-sm font-normal text-slate-700">
                {s.label}
              </Label>
              <Switch
                id={`section-toggle-${s.id}`}
                checked={!hidden.includes(s.id)}
                onCheckedChange={() => onToggle(s.id)}
              />
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={onReset}>
          Varsayılana dön
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Sürüklenebilir bölüm sarmalayıcısı. Tutamaç (grip) basılıyken bölüm sürüklenebilir olur;
 * bırakıldığında hedef bölümün yerine taşınır. Native HTML5 sürükle-bırak kullanır.
 */
export function DashboardSection({ id, label, span, dnd, children }) {
  const [armed, setArmed] = useState(false);
  const isDragging = dnd.dragId === id;
  const isOver = dnd.overId === id && dnd.dragId !== null && !isDragging;

  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl transition-shadow ${SPAN[span] || SPAN.wide} ${isDragging ? "opacity-50" : ""} ${isOver ? "ring-2 ring-brand-400" : ""}`}
      draggable={armed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        dnd.start(id);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dnd.enter(id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        dnd.drop(id);
      }}
      onDragEnd={() => {
        setArmed(false);
        dnd.end();
      }}
      data-testid={`section-${id}`}
      aria-label={label}
    >
      <div className="mb-2 flex justify-center">
        <button
          type="button"
          title="Sürükleyerek taşı"
          aria-label={`${label} bölümünü taşı`}
          className="cursor-grab rounded px-8 py-0.5 text-slate-300 transition-colors duration-150 hover:text-slate-500 active:cursor-grabbing"
          onMouseDown={() => setArmed(true)}
          onMouseUp={() => setArmed(false)}
        >
          <GripHorizontal className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}
