"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { emptyBoard, parseBoard, uid, type BoardJson, type Marker, type MarkerKind } from "@/lib/tactics/board-types";
import type { MatchFormat } from "@/types/database";

export type Tool = "select" | "arrow-move" | "arrow-pass" | "zone" | "note";

type BoardState = {
  board: BoardJson;
  past: BoardJson[];
  future: BoardJson[];
  tool: Tool;
  selectedId: string | null;
  /** 두 점 입력 도구(화살표·영역)의 첫 점 */
  pendingPoint: [number, number] | null;
  showGrid: boolean;
  snap: boolean;
  /** 불러온 저장 전술 id (수정 저장용). 자유 보드는 null */
  editingTacticId: string | null;
  editingTacticName: string | null;
  dirty: boolean;

  setTool: (t: Tool) => void;
  select: (id: string | null) => void;
  setPendingPoint: (p: [number, number] | null) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  /** 되돌리기 기록을 남기며 보드 변경 */
  commit: (mutate: (b: BoardJson) => void) => void;
  /** 드래그 중처럼 기록 없이 변경 */
  patchMarker: (id: string, x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  addMarker: (kind: MarkerKind, label: string, playerId?: string | null, at?: [number, number]) => void;
  removeSelected: () => void;
  load: (board: BoardJson, tacticId: string | null, name: string | null) => void;
  reset: (format?: MatchFormat) => void;
  setFormat: (f: MatchFormat) => void;
  markSaved: (tacticId: string, name: string) => void;
};

const HISTORY = 20;
const clone = (b: BoardJson): BoardJson => JSON.parse(JSON.stringify(b));

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      board: emptyBoard(),
      past: [],
      future: [],
      tool: "select",
      selectedId: null,
      pendingPoint: null,
      showGrid: true,
      snap: true,
      editingTacticId: null,
      editingTacticName: null,
      dirty: false,

      setTool: (tool) => set({ tool, pendingPoint: null, selectedId: null }),
      select: (selectedId) => set({ selectedId }),
      setPendingPoint: (pendingPoint) => set({ pendingPoint }),
      toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
      toggleSnap: () => set((s) => ({ snap: !s.snap })),

      commit: (mutate) => {
        const { board, past } = get();
        const next = clone(board);
        mutate(next);
        set({ board: next, past: [...past.slice(-(HISTORY - 1)), clone(board)], future: [], dirty: true });
      },
      patchMarker: (id, x, y) =>
        set((s) => ({ board: { ...s.board, markers: s.board.markers.map((m) => (m.id === id ? { ...m, x, y } : m)) } })),
      undo: () => {
        const { past, board, future } = get();
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        set({ board: prev, past: past.slice(0, -1), future: [clone(board), ...future].slice(0, HISTORY), selectedId: null, dirty: true });
      },
      redo: () => {
        const { past, board, future } = get();
        if (future.length === 0) return;
        const next = future[0];
        set({ board: next, future: future.slice(1), past: [...past, clone(board)].slice(-HISTORY), selectedId: null, dirty: true });
      },
      addMarker: (kind, label, playerId = null, at) => {
        const id = uid(kind === "us" ? "p" : kind === "them" ? "o" : "b");
        // 벤치 자리: 우리는 아래쪽(우리 골 근처) 사이드, 상대는 위쪽
        const n = get().board.markers.filter((m) => m.kind === kind).length;
        const fallback: [number, number] = kind === "them" ? [0.9 - (n % 6) * 0.06, 0.1 + Math.floor(n / 6) * 0.12] : [0.1 + (n % 6) * 0.06, 0.9 - Math.floor(n / 6) * 0.12];
        const [x, y] = at ?? fallback;
        const marker: Marker = { id, kind, x, y, label, playerId };
        get().commit((b) => { b.markers.push(marker); });
        set({ selectedId: id });
      },
      removeSelected: () => {
        const id = get().selectedId;
        if (!id) return;
        get().commit((b) => {
          b.markers = b.markers.filter((m) => m.id !== id || m.kind === "ball" && false);
          b.arrows = b.arrows.filter((a) => a.id !== id);
          b.zones = b.zones.filter((z) => z.id !== id);
          b.notes = b.notes.filter((n) => n.id !== id);
        });
        set({ selectedId: null });
      },
      load: (board, tacticId, name) => set({ board: parseBoard(board), past: [], future: [], selectedId: null, pendingPoint: null, editingTacticId: tacticId, editingTacticName: name, dirty: false }),
      reset: (format) => set((s) => ({ board: emptyBoard(format ?? s.board.format), past: [...s.past, clone(s.board)].slice(-HISTORY), future: [], selectedId: null, pendingPoint: null, dirty: true })),
      setFormat: (format) => get().commit((b) => { b.format = format; }),
      markSaved: (tacticId, name) => set({ editingTacticId: tacticId, editingTacticName: name, dirty: false }),
    }),
    {
      name: "fm:board",
      // 보드 내용과 설정만 저장 (되돌리기 기록은 제외)
      partialize: (s) => ({ board: s.board, showGrid: s.showGrid, snap: s.snap, editingTacticId: s.editingTacticId, editingTacticName: s.editingTacticName, dirty: s.dirty }),
    },
  ),
);
