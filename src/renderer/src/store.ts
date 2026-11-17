import { create } from "zustand";
import { DEFAULT_PRESET_ID } from "../../shared/presets";
import type { Appearance, Catalog, CompressEvent, FileInfo, JobStatus, Preset, Settings } from "../../shared/types";
import { getDesktop } from "./desktop";

export type QueueItem = {
  id: string;
  path: string;
  name: string;
  bytesIn: number;
  presetId: string;
  status: JobStatus;
  submitted: boolean;
  bytesOut?: number;
  outputPath?: string;
  flattened?: boolean;
  error?: string;
};

export type View = "queue" | "presets" | "settings";
export type Phase = "idle" | "running" | "paused";

type State = {
  ready: boolean;
  bootError: string;
  version: string;
  view: View;
  phase: Phase;
  notice: string;
  settings: Settings;
  appearance: Appearance;
  presets: Preset[];
  items: QueueItem[];
  selectedId: string | null;
  selectedIds: string[];
  anchorId: string | null;
  bootstrap: () => Promise<void>;
  setView: (view: View) => void;
  addFromDialog: (kind: "files" | "folder") => Promise<void>;
  importPaths: (paths: string[]) => Promise<void>;
  start: () => Promise<void>;
  togglePause: () => Promise<void>;
  removeSelected: () => Promise<void>;
  clearFinished: () => void;
  setItemPreset: (id: string, presetId: string) => void;
  applyPresetToQueued: (presetId: string) => void;
  moveSelection: (delta: number, extend?: boolean) => void;
  select: (id: string, mode?: "replace" | "toggle" | "range") => void;
  selectAll: () => void;
  notify: (text: string) => void;
  applyEvent: (event: CompressEvent) => void;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  savePreset: (preset: Preset) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  submit: (ids: string[]) => Promise<void>;
};

const QUEUE_LIMIT = 2000;

export const useApp = create<State>((set, get) => {
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  const showNotice = (text: string) => {
    if (noticeTimer) clearTimeout(noticeTimer);
    set({ notice: text });
    noticeTimer = setTimeout(() => {
      if (get().notice === text) set({ notice: "" });
    }, 4200);
  };

  const settle = () => {
    const { items, phase } = get();
    const inflight = items.some((item) => item.status === "running" || (item.status === "queued" && item.submitted));
    if (inflight) return;
    const waiting = items.some((item) => item.status === "queued");
    if (!waiting || phase !== "paused") set({ phase: "idle" });
  };

  const applyCatalog = (catalog: Catalog) => {
    const ids = new Set(catalog.presets.map((preset) => preset.id));
    const fallback = ids.has(catalog.settings.defaultPresetId) ? catalog.settings.defaultPresetId : (catalog.presets[0]?.id ?? DEFAULT_PRESET_ID);
    set({
      presets: catalog.presets,
      settings: { ...catalog.settings, defaultPresetId: fallback },
      items: get().items.map((item) => {
        if (item.submitted || item.status !== "queued" || ids.has(item.presetId)) return item;
        return { ...item, presetId: fallback };
      }),
    });
  };

  return {
    ready: false,
    bootError: "",
    version: "0.1.0",
    view: "queue",
    phase: "idle",
    notice: "",
    settings: { defaultPresetId: DEFAULT_PRESET_ID, concurrency: 2, theme: "system" },
    appearance: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    presets: [],
    items: [],
    selectedId: null,
    selectedIds: [],
    anchorId: null,

    bootstrap: async () => {
      try {
        const data = await getDesktop().getBootstrap();
        set({
          ready: true,
          bootError: "",
          version: data.version,
          settings: data.settings,
          appearance: data.appearance,
          presets: data.presets,
        });
      } catch (error) {
        set({ ready: false, bootError: messageOf(error) });
      }
    },

    setView: (view) => set({ view }),

    addFromDialog: async (kind) => {
      try {
        const desktop = getDesktop();
        const paths = kind === "files" ? await desktop.pickFiles() : await desktop.pickFolder();
        if (paths.length === 0) return;
        await get().importPaths(paths);
      } catch (error) {
        showNotice(messageOf(error));
      }
    },

    importPaths: async (paths) => {
      if (!get().ready || paths.length === 0) return;
      try {
        const result = await getDesktop().importPaths(paths);
        const existing = new Set(get().items.map((item) => item.path));
        const room = Math.max(0, QUEUE_LIMIT - get().items.length);
        const unseen = result.files.filter((file) => !existing.has(file.path));
        const fresh = unseen.slice(0, room);
        const presetId = get().settings.defaultPresetId;
        const added = fresh.map((file) => toItem(file, presetId));
        const previousId = get().selectedId;
        const firstAdded = added[0]?.id ?? null;
        set({
          items: [...get().items, ...added],
          selectedId: previousId ?? firstAdded,
          selectedIds: previousId ? get().selectedIds : firstAdded ? [firstAdded] : [],
          anchorId: get().anchorId ?? previousId ?? firstAdded,
        });
        const notes: string[] = [];
        if (fresh.length) notes.push(`已添加 ${fresh.length} 张`);
        if (result.skipped) notes.push(`跳过 ${result.skipped} 个不支持的文件`);
        const duplicate = result.files.length - unseen.length;
        if (duplicate > 0) notes.push(`${duplicate} 张已经在队列里`);
        if (result.truncated || unseen.length > fresh.length) notes.push("队列最多放入 2000 张");
        if (notes.length === 0) notes.push("没有可以添加的图片");
        showNotice(notes.join("，"));
        if (get().phase === "running" && added.length > 0) await get().submit(added.map((item) => item.id));
      } catch (error) {
        showNotice(messageOf(error));
      }
    },

    submit: async (ids) => {
      const wanted = new Set(ids);
      const presets = get().presets;
      const fallback = get().settings.defaultPresetId;
      const jobs = get()
        .items.filter((item) => wanted.has(item.id) && item.status === "queued" && !item.submitted)
        .map((item) => ({
          id: item.id,
          inputPath: item.path,
          preset: resolvePreset(item.presetId, presets, fallback),
        }));
      if (jobs.length === 0) return;
      try {
        await getDesktop().startCompress(jobs);
        const sent = new Set(jobs.map((job) => job.id));
        set({
          items: get().items.map((item) => (sent.has(item.id) ? { ...item, submitted: true } : item)),
        });
      } catch (error) {
        showNotice(messageOf(error));
        settle();
      }
    },

    start: async () => {
      try {
        if (get().phase === "paused") {
          await getDesktop().resumeCompress();
          set({ phase: "running" });
          const ids = queuedIds(get().items);
          if (ids.length) await get().submit(ids);
          return;
        }
        if (get().phase === "running") {
          const ids = queuedIds(get().items);
          if (ids.length) await get().submit(ids);
          else showNotice("正在压缩");
          return;
        }
        const ids = queuedIds(get().items);
        if (ids.length === 0) {
          showNotice("没有等待中的图片");
          return;
        }
        set({ phase: "running" });
        await get().submit(ids);
      } catch (error) {
        showNotice(messageOf(error));
        settle();
      }
    },

    togglePause: async () => {
      try {
        if (get().phase === "running") {
          await getDesktop().pauseCompress();
          set({ phase: "paused" });
          return;
        }
        await get().start();
      } catch (error) {
        showNotice(messageOf(error));
      }
    },

    removeSelected: async () => {
      const { selectedId, selectedIds, items } = get();
      const picked = new Set(selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : []);
      const targets = items.filter((item) => picked.has(item.id));
      if (targets.length === 0) return;
      const inflight = targets.filter(isInflight);
      const removable = targets.filter((item) => !isInflight(item));
      if (inflight.length > 0) {
        try {
          await getDesktop().cancelCompress(inflight.map((item) => item.id));
        } catch (error) {
          showNotice(messageOf(error));
        }
      }
      if (removable.length === 0) return;
      const drop = new Set(removable.map((item) => item.id));
      const firstRemoved = items.findIndex((item) => drop.has(item.id));
      const next = items.filter((item) => !drop.has(item.id));
      const staying = inflight.map((item) => item.id).filter((id) => next.some((item) => item.id === id));
      if (staying.length > 0) {
        set({ items: next, selectedId: staying[0], selectedIds: staying, anchorId: staying[0] });
        return;
      }
      const neighbor = next[Math.min(firstRemoved, Math.max(0, next.length - 1))]?.id ?? null;
      set({ items: next, selectedId: neighbor, selectedIds: neighbor ? [neighbor] : [], anchorId: neighbor });
    },

    clearFinished: () => {
      const finished = new Set<JobStatus>(["done", "failed", "cancelled"]);
      const items = get().items.filter((item) => !finished.has(item.status));
      const keep = new Set(items.map((item) => item.id));
      const selectedIds = get().selectedIds.filter((id) => keep.has(id));
      const currentId = get().selectedId
      const currentAnchor = get().anchorId
      const selectedId = currentId && selectedIds.includes(currentId) ? currentId : (selectedIds[0] ?? null)
      const anchorId = currentAnchor && keep.has(currentAnchor) ? currentAnchor : selectedId
      set({ items, selectedId, selectedIds, anchorId });
    },

    setItemPreset: (id, presetId) => {
      set({
        items: get().items.map((item) => (item.id === id && item.status === "queued" && !item.submitted ? { ...item, presetId } : item)),
      });
    },

    applyPresetToQueued: (presetId) => {
      set({
        items: get().items.map((item) => (item.status === "queued" && !item.submitted ? { ...item, presetId } : item)),
      });
    },

    moveSelection: (delta, extend = false) => {
      const { items, selectedId, anchorId, view } = get();
      if (view !== "queue" || items.length === 0) return;
      const current = items.findIndex((item) => item.id === selectedId);
      const index = current < 0 ? (delta > 0 ? -1 : 0) : current;
      const nextIndex = Math.min(items.length - 1, Math.max(0, index + delta));
      const next = items[nextIndex];
      if (!next) return;
      if (!extend) {
        set({ selectedId: next.id, selectedIds: [next.id], anchorId: next.id });
        return;
      }
      const anchor = anchorId && items.some((item) => item.id === anchorId) ? anchorId : (selectedId ?? next.id);
      set({ selectedId: next.id, anchorId: anchor, selectedIds: idsInRange(items, anchor, next.id) });
    },

    select: (id, mode = "replace") => {
      const items = get().items;
      if (!items.some((item) => item.id === id)) return;
      if (mode === "toggle") {
        const current = new Set(get().selectedIds.length > 0 ? get().selectedIds : get().selectedId ? [get().selectedId] : []);
        if (current.has(id)) current.delete(id);
        else current.add(id);
        const selectedIds = items.map((item) => item.id).filter((itemId) => current.has(itemId));
        set({
          selectedIds,
          selectedId: selectedIds.includes(id) ? id : (selectedIds[0] ?? null),
          anchorId: id,
        });
        return;
      }
      if (mode === "range") {
        const anchor = get().anchorId && items.some((item) => item.id === get().anchorId) ? get().anchorId! : (get().selectedId ?? id);
        set({ selectedId: id, anchorId: anchor, selectedIds: idsInRange(items, anchor, id) });
        return;
      }
      set({ selectedId: id, selectedIds: [id], anchorId: id });
    },

    selectAll: () => {
      const { items, view, selectedId, anchorId } = get();
      if (view !== "queue" || items.length === 0) return;
      const focus = selectedId && items.some((item) => item.id === selectedId) ? selectedId : items[0].id;
      set({
        selectedIds: items.map((item) => item.id),
        selectedId: focus,
        anchorId: anchorId && items.some((item) => item.id === anchorId) ? anchorId : focus,
      });
    },

    notify: (text) => showNotice(text),

    applyEvent: (event) => {
      if (event.type === "engine-error") {
        set({
          phase: "idle",
          items: get().items.map((item) => (item.status === "running" || (item.status === "queued" && item.submitted) ? { ...item, status: "failed", submitted: false, error: event.message } : item)),
        });
        showNotice(event.message);
        return;
      }
      set({
        items: get().items.map((item) => {
          if (item.id !== event.id) return item;
          if (event.type === "started") return { ...item, status: "running", submitted: true };
          if (event.type === "done") {
            return {
              ...item,
              status: "done",
              submitted: false,
              bytesIn: event.bytesIn,
              bytesOut: event.bytesOut,
              outputPath: event.outputPath,
              flattened: event.flattened,
              error: undefined,
            };
          }
          if (event.type === "failed") return { ...item, status: "failed", submitted: false, error: event.message };
          return { ...item, status: "cancelled", submitted: false };
        }),
      });
      settle();
    },

    updateSettings: async (patch) => {
      try {
        const result = await getDesktop().setSettings(patch);
        set({ settings: result.settings, appearance: result.appearance });
      } catch (error) {
        showNotice(messageOf(error));
      }
    },

    savePreset: async (preset) => {
      const catalog = await getDesktop().savePreset(preset);
      applyCatalog(catalog);
    },

    deletePreset: async (id) => {
      const catalog = await getDesktop().deletePreset(id);
      applyCatalog(catalog);
    },
  };
});

function isInflight(item: QueueItem): boolean {
  return item.status === "running" || (item.status === "queued" && item.submitted);
}

function idsInRange(items: QueueItem[], fromId: string, toId: string): string[] {
  const start = items.findIndex((item) => item.id === fromId);
  const end = items.findIndex((item) => item.id === toId);
  if (start < 0 || end < 0) return [];
  const [from, to] = start < end ? [start, end] : [end, start];
  return items.slice(from, to + 1).map((item) => item.id);
}

function queuedIds(items: QueueItem[]): string[] {
  return items.filter((item) => item.status === "queued" && !item.submitted).map((item) => item.id);
}

function toItem(file: FileInfo, presetId: string): QueueItem {
  return {
    id: crypto.randomUUID(),
    path: file.path,
    name: file.name,
    bytesIn: file.bytes,
    presetId,
    status: "queued",
    submitted: false,
  };
}

function resolvePreset(id: string, presets: Preset[], fallbackId: string): Preset {
  const preset = presets.find((item) => item.id === id) ?? presets.find((item) => item.id === fallbackId) ?? presets[0];
  if (!preset) throw new Error("没有可用的预设");
  return preset;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "操作没有完成";
}
