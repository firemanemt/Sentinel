import { Monitor, Smartphone, RectangleVertical } from "lucide-react";
import type { LayoutMode } from "@/hooks/useLayout";

interface LayoutSwitcherProps {
  layout: LayoutMode;
  onCycle: () => void;
  onSelect: (mode: LayoutMode) => void;
}

const LAYOUTS: { mode: LayoutMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { mode: "standard", label: "STANDARD", icon: <Monitor size={12} />, hint: "Landscape desktop" },
  { mode: "portrait", label: "PORTRAIT", icon: <RectangleVertical size={12} />, hint: "Vertical monitor" },
  { mode: "compact", label: "COMPACT", icon: <Smartphone size={12} />, hint: "Mobile / minimal" },
];

export default function LayoutSwitcher({ layout, onCycle, onSelect }: LayoutSwitcherProps) {
  const [open, setOpen] = useState(false);
  const current = LAYOUTS.find((l) => l.mode === layout) ?? LAYOUTS[0]!;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-mono tracking-wider transition-all duration-200 hover:opacity-100"
        style={{
          background: "oklch(0.09 0.015 220)",
          border: "1px solid oklch(0.35 0.1 200 / 0.4)",
          color: "#00ccee88",
        }}
        title="Switch layout"
      >
        {current.icon}
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 rounded-sm overflow-hidden"
            style={{
              background: "oklch(0.09 0.015 220 / 0.97)",
              border: "1px solid oklch(0.35 0.1 200 / 0.5)",
              boxShadow: "0 0 20px oklch(0.72 0.18 200 / 0.15)",
              minWidth: 180,
            }}
          >
            <div
              className="px-3 py-2 text-xs font-mono tracking-widest border-b"
              style={{ color: "#00ccee55", borderColor: "oklch(0.22 0.05 210 / 0.4)" }}
            >
              DISPLAY LAYOUT
            </div>
            {LAYOUTS.map(({ mode, label, icon, hint }) => (
              <button
                key={mode}
                type="button"
                onClick={() => { onSelect(mode); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150 hover:opacity-100"
                style={{
                  background: layout === mode ? "oklch(0.72 0.18 200 / 0.1)" : "transparent",
                  borderLeft: layout === mode ? "2px solid #00ccee" : "2px solid transparent",
                  color: layout === mode ? "#00ccee" : "#00ccee66",
                }}
              >
                <span style={{ color: layout === mode ? "#00ccee" : "#00ccee44" }}>{icon}</span>
                <div>
                  <div className="text-xs font-mono tracking-wider">{label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#00ccee44", fontFamily: "'Exo 2', sans-serif" }}>{hint}</div>
                </div>
                {layout === mode && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#00ccee", boxShadow: "0 0 4px #00ccee" }} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Need useState import
import { useState } from "react";
