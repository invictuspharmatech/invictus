"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DASHBOARD_TILE_COLOR_LABELS,
  DASHBOARD_TILE_COLOR_MODES,
  catalogGroupedForSelect,
  defaultColorForNewTile,
  isDashboardTileColorMode,
  tileSupportsDynamicColor,
  type DashboardTileCatalogEntry,
  type DashboardTileColSpan,
  type DashboardTileLayoutItem,
  type DashboardTilesLayout,
} from "@/lib/dashboard/tiles";

function sortTiles(a: DashboardTileLayoutItem, b: DashboardTileLayoutItem) {
  return a.row - b.row || a.sort - b.sort;
}

export function DashboardTilesEditor() {
  const [layout, setLayout] = useState<DashboardTilesLayout | null>(null);
  const [catalog, setCatalog] = useState<DashboardTileCatalogEntry[]>([]);
  const [defaultLayout, setDefaultLayout] = useState<DashboardTilesLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addTileId, setAddTileId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/dashboard/tiles");
      const data = (await response.json()) as {
        layout: DashboardTilesLayout;
        catalog: DashboardTileCatalogEntry[];
        defaultLayout: DashboardTilesLayout;
        error?: string;
      };
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Failed to load dashboard tile settings." });
        return;
      }
      setLayout(data.layout);
      setCatalog(data.catalog);
      setDefaultLayout(data.defaultLayout);
    } catch {
      setMessage({ type: "error", text: "Failed to load dashboard tile settings." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const catalogById = useMemo(() => {
    const map = new Map<string, DashboardTileCatalogEntry>();
    for (const entry of catalog) map.set(entry.id, entry);
    return map;
  }, [catalog]);

  const usedIds = useMemo(() => new Set((layout?.tiles ?? []).map((tile) => tile.id)), [layout]);
  const catalogGroups = useMemo(() => catalogGroupedForSelect(catalog), [catalog]);
  const tilesSorted = useMemo(() => (layout ? [...layout.tiles].sort(sortTiles) : []), [layout]);

  const updateTile = (id: string, patch: Partial<DashboardTileLayoutItem>) => {
    setLayout((prev) => {
      if (!prev) return prev;
      return { tiles: prev.tiles.map((tile) => (tile.id === id ? { ...tile, ...patch } : tile)) };
    });
  };

  const moveTile = (id: string, direction: "up" | "down") => {
    setLayout((prev) => {
      if (!prev) return prev;
      const sorted = [...prev.tiles].sort(sortTiles);
      const idx = sorted.findIndex((tile) => tile.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      return {
        tiles: prev.tiles.map((tile) => {
          if (tile.id === a.id) return { ...tile, row: b.row, sort: b.sort };
          if (tile.id === b.id) return { ...tile, row: a.row, sort: a.sort };
          return tile;
        }),
      };
    });
  };

  const handleAddTile = () => {
    if (!addTileId || !layout || usedIds.has(addTileId)) return;
    const entry = catalogById.get(addTileId);
    if (!entry) return;
    const maxRow = layout.tiles.reduce((max, tile) => Math.max(max, tile.row), 0) || 1;
    const rowTiles = layout.tiles.filter((tile) => tile.row === maxRow);
    const nextSort = rowTiles.length > 0 ? Math.max(...rowTiles.map((tile) => tile.sort)) + 1 : 0;
    setLayout({
      tiles: [
        ...layout.tiles,
        {
          id: addTileId,
          row: maxRow,
          sort: nextSort,
          color: defaultColorForNewTile(addTileId, entry),
          enabled: true,
          colSpan: 1,
        },
      ],
    });
    setAddTileId("");
  };

  const handleSave = async () => {
    if (!layout) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/dashboard/tiles", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(layout),
      });
      const data = (await response.json()) as DashboardTilesLayout & { error?: string };
      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Could not save tile layout." });
        return;
      }
      setLayout(data);
      setMessage({ type: "success", text: "Dashboard tiles saved." });
    } catch {
      setMessage({ type: "error", text: "Could not save tile layout." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading tile settings…</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href="/admin" className="ghost-btn">
          View dashboard
        </Link>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            if (!defaultLayout) return;
            if (!window.confirm("Reset all dashboard tiles to the default layout?")) return;
            setLayout(defaultLayout);
            setMessage({ type: "success", text: "Defaults restored — click Save to apply." });
          }}
        >
          Reset defaults
        </button>
        <button type="button" className="gold-btn" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save layout"}
        </button>
      </div>
      {message ? (
        <p className={`text-sm ${message.type === "error" ? "text-brand-red" : "text-muted-foreground"}`}>
          {message.text}
        </p>
      ) : null}

      <section className="tile">
        <h2 className="text-lg">Add tile</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-sm">
            Metric
            <select
              className="field mt-1"
              value={addTileId}
              onChange={(event) => setAddTileId(event.target.value)}
            >
              <option value="">Select a metric…</option>
              {catalogGroups.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((entry) => (
                    <option key={entry.id} value={entry.id} disabled={usedIds.has(entry.id)}>
                      {entry.label}
                      {usedIds.has(entry.id) ? " (on dashboard)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="gold-btn"
            onClick={handleAddTile}
            disabled={!addTileId || usedIds.has(addTileId)}
          >
            Add
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {catalog.length} metrics available. Layout applies to all staff dashboards.
        </p>
      </section>

      <section className="tile overflow-x-auto">
        <h2 className="text-lg">Configured tiles ({tilesSorted.length})</h2>
        {tilesSorted.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No tiles configured. Add one above or reset defaults.
          </p>
        ) : (
          <table className="mt-4 w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="pb-2 pr-3">Metric</th>
                <th className="pb-2 pr-3">Custom title</th>
                <th className="pb-2 pr-3">Row</th>
                <th className="pb-2 pr-3">Order</th>
                <th className="pb-2 pr-3">Width</th>
                <th className="pb-2 pr-3">Color</th>
                <th className="pb-2 pr-3">On</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {tilesSorted.map((tile) => {
                const entry = catalogById.get(tile.id);
                const metricLabel = entry?.label ?? tile.id;
                const colorOptions = DASHBOARD_TILE_COLOR_MODES.filter((mode) => {
                  if (mode.startsWith("threshold_") && !tileSupportsDynamicColor(entry)) return false;
                  return true;
                });
                return (
                  <tr key={tile.id} className="border-t border-border/40">
                    <td className="py-3 pr-3">
                      <div>{metricLabel}</div>
                      <div className="text-xs text-muted-foreground">{entry?.group ?? "—"}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        className="field"
                        placeholder={metricLabel}
                        value={tile.label ?? ""}
                        onChange={(event) =>
                          updateTile(tile.id, { label: event.target.value || null })
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        className="field w-16"
                        type="number"
                        min={1}
                        max={10}
                        value={tile.row}
                        onChange={(event) =>
                          updateTile(tile.id, {
                            row: Math.max(1, parseInt(event.target.value, 10) || 1),
                          })
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        className="field w-16"
                        type="number"
                        min={0}
                        max={100}
                        value={tile.sort}
                        onChange={(event) =>
                          updateTile(tile.id, {
                            sort: Math.max(0, parseInt(event.target.value, 10) || 0),
                          })
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        className="field"
                        value={tile.colSpan ?? 1}
                        onChange={(event) =>
                          updateTile(tile.id, {
                            colSpan: Number(event.target.value) as DashboardTileColSpan,
                          })
                        }
                      >
                        <option value={1}>1 column</option>
                        <option value={2}>2 columns</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        className="field"
                        value={tile.color}
                        onChange={(event) =>
                          updateTile(tile.id, {
                            color: isDashboardTileColorMode(event.target.value)
                              ? event.target.value
                              : "brand-orange",
                          })
                        }
                      >
                        {colorOptions.map((mode) => (
                          <option key={mode} value={mode}>
                            {DASHBOARD_TILE_COLOR_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={tile.enabled}
                        onChange={(event) => updateTile(tile.id, { enabled: event.target.checked })}
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button type="button" className="ghost-btn" onClick={() => moveTile(tile.id, "up")}>
                          Up
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => moveTile(tile.id, "down")}>
                          Down
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => {
                            if (!window.confirm(`Remove "${metricLabel}" from the dashboard?`)) return;
                            setLayout((prev) =>
                              prev ? { tiles: prev.tiles.filter((row) => row.id !== tile.id) } : prev,
                            );
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-sm text-muted-foreground">
        Row groups tiles horizontally — up to 4 tiles per row at 1-column width, or 2 at 2-column
        width. Lower order values appear first within a row.
      </p>
    </div>
  );
}
