"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { useBoardStore } from "@/store/board-store";
import { COURT, GRID_M, clamp01, snapToGrid, uid, type Marker } from "@/lib/tactics/board-types";

type Props = {
  /** 내보내기용 Stage 참조 */
  stageRef: RefObject<Konva.Stage | null>;
};

const COLORS = {
  turf: "#2e8b4e",
  line: "#eef7ef",
  us: "#1e88e5",
  them: "#e53935",
  ball: "#ffffff",
  grid: "rgba(255,255,255,0.22)",
  zone: "rgba(255,235,59,0.35)",
  zoneStroke: "#ffeb3b",
  select: "#ffd54f",
  note: "#fff8e1",
};

/** 드래그 중 손가락에 가려지지 않게 띄우는 거리(px) */
const LIFT = 36;
const MARGIN = 28;

/**
 * 풋살 코트 캔버스 (react-konva).
 * 내부 좌표계는 항상 "가로 코트"(x: 길이 40m, y: 폭 20m). 휴대폰 세로 모드에서는 Group 을 -90° 회전해 세운다.
 * 저장 좌표는 0~1 비율. 픽셀 변환은 여기서만.
 */
export function BoardCanvas({ stageRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const courtRef = useRef<Konva.Group>(null);
  const [size, setSize] = useState({ w: 360, h: 640 });

  const board = useBoardStore((s) => s.board);
  const tool = useBoardStore((s) => s.tool);
  const selectedId = useBoardStore((s) => s.selectedId);
  const pendingPoint = useBoardStore((s) => s.pendingPoint);
  const showGrid = useBoardStore((s) => s.showGrid);
  const snap = useBoardStore((s) => s.snap);
  const { select, setPendingPoint, commit, patchMarker } = useBoardStore.getState();

  // 컨테이너 크기 → 코트 크기 (세로/가로 자동)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const cw = Math.floor(entry.contentRect.width);
      const maxH = Math.max(420, Math.floor(window.innerHeight * 0.68));
      const vertical = cw < 640;
      if (vertical) {
        // 폭 기준 2:1 이지만 화면 높이를 넘지 않게
        const h = Math.min(cw * 2, maxH);
        setSize({ w: Math.floor(h / 2), h });
      } else {
        setSize({ w: cw, h: Math.floor(cw / 2) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vertical = size.w < size.h;
  const lengthPx = (vertical ? size.h : size.w) - MARGIN * 2;
  const widthPx = lengthPx / 2;
  const stageW = vertical ? widthPx + MARGIN * 2 : lengthPx + MARGIN * 2;
  const stageH = vertical ? lengthPx + MARGIN * 2 : widthPx + MARGIN * 2;
  const m = (meters: number) => (meters / COURT.length) * lengthPx; // m → px
  const px = (x: number, y: number): [number, number] => [x * lengthPx, y * widthPx];
  const norm = (lx: number, ly: number): [number, number] => [clamp01(lx / lengthPx), clamp01(ly / widthPx)];
  const markerR = Math.max(15, widthPx * 0.05);

  // 코트 Group 위치/회전: 세로면 -90° 회전 (우리 골이 아래)
  const groupProps = vertical
    ? { x: MARGIN, y: MARGIN + lengthPx, rotation: -90 }
    : { x: MARGIN, y: MARGIN, rotation: 0 };
  /** 회전된 그룹 안에서 글자를 바로 세우기 위한 보정 */
  const upright = vertical ? 90 : 0;

  function localPointer(): [number, number] | null {
    const g = courtRef.current;
    if (!g) return null;
    const p = g.getRelativePointerPosition();
    if (!p) return null;
    return [p.x, p.y];
  }

  function applySnap(x: number, y: number): [number, number] {
    return snap ? snapToGrid(x, y) : [x, y];
  }

  /** 빈 코트 탭: 도구에 따라 점 찍기 */
  function onStageTap(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target !== e.target.getStage() && e.target.name() !== "court-bg") return; // 마커 등 위 탭은 각자 처리
    const p = localPointer();
    if (!p) return;
    const [nx, ny] = applySnap(...norm(p[0], p[1]));
    if (tool === "select") {
      select(null);
      return;
    }
    if (tool === "note") {
      const text = window.prompt("메모 내용 (짧게)");
      if (text?.trim()) commit((b) => { b.notes.push({ id: uid("n"), x: nx, y: ny, text: text.trim().slice(0, 30) }); });
      return;
    }
    if (!pendingPoint) {
      setPendingPoint([nx, ny]);
      return;
    }
    const [sx, sy] = pendingPoint;
    if (tool === "arrow-move" || tool === "arrow-pass") {
      commit((b) => { b.arrows.push({ id: uid("a"), from: [sx, sy], to: [nx, ny], style: tool === "arrow-move" ? "move" : "pass" }); });
    } else if (tool === "zone") {
      const x = Math.min(sx, nx), y = Math.min(sy, ny);
      const w = Math.abs(nx - sx), h = Math.abs(ny - sy);
      if (w > 0.02 && h > 0.02) commit((b) => { b.zones.push({ id: uid("z"), shape: "rect", x, y, w, h }); });
    }
    setPendingPoint(null);
  }

  function onMarkerDragMove(e: Konva.KonvaEventObject<DragEvent>, mk: Marker) {
    const node = e.target;
    // 손가락 위로 띄우기: 세로 모드에서는 화면 위 = 로컬 +x, 가로 모드에서는 로컬 -y
    let lx = node.x(), ly = node.y();
    if (vertical) lx += LIFT; else ly -= LIFT;
    lx = Math.max(0, Math.min(lengthPx, lx));
    ly = Math.max(0, Math.min(widthPx, ly));
    node.position({ x: lx, y: ly });
    const [nx, ny] = norm(lx, ly);
    patchMarker(mk.id, nx, ny);
  }

  function onMarkerDragEnd(e: Konva.KonvaEventObject<DragEvent>, mk: Marker) {
    const node = e.target;
    const [nx0, ny0] = norm(node.x(), node.y());
    const [nx, ny] = applySnap(nx0, ny0);
    const [lx, ly] = px(nx, ny);
    node.position({ x: lx, y: ly });
    commit((b) => {
      const t = b.markers.find((x) => x.id === mk.id);
      if (t) { t.x = nx; t.y = ny; }
    });
  }

  // ---- 코트 라인 좌표
  const yc = widthPx / 2;
  const goalHalf = m(1.5);
  const penR = m(6);
  const arcPts = (cx: number, cy: number, from: number, to: number) => {
    const pts: number[] = [];
    for (let a = from; a <= to; a += 5) {
      const r = (a * Math.PI) / 180;
      pts.push(cx + penR * Math.cos(r), cy + penR * Math.sin(r));
    }
    return pts;
  };
  const leftArea = [...arcPts(0, yc - goalHalf, -90, 0), ...arcPts(0, yc + goalHalf, 0, 90)];
  // 반대편은 좌우 대칭
  const rightAreaFixed = leftArea.map((v, i) => (i % 2 === 0 ? lengthPx - v : v));

  const gridLines: number[][] = [];
  if (showGrid) {
    for (let gx = GRID_M; gx < COURT.length; gx += GRID_M) gridLines.push([m(gx), 0, m(gx), widthPx]);
    for (let gy = GRID_M; gy < COURT.width; gy += GRID_M) gridLines.push([0, m(gy), lengthPx, m(gy)]);
  }

  return (
    <div ref={containerRef} className="w-full" style={{ touchAction: "none" }}>
      <Stage ref={stageRef} width={stageW} height={stageH} onClick={onStageTap} onTap={onStageTap} className="mx-auto overflow-hidden rounded-xl" style={{ width: stageW, margin: "0 auto" }}>
        <Layer>
          <Rect x={0} y={0} width={stageW} height={stageH} fill={COLORS.turf} cornerRadius={12} name="court-bg" />
          <Group ref={courtRef} {...groupProps}>
            {/* 골대 */}
            <Rect x={-m(1)} y={yc - goalHalf} width={m(1)} height={goalHalf * 2} stroke={COLORS.line} strokeWidth={2} fill="rgba(255,255,255,0.15)" />
            <Rect x={lengthPx} y={yc - goalHalf} width={m(1)} height={goalHalf * 2} stroke={COLORS.line} strokeWidth={2} fill="rgba(255,255,255,0.15)" />
            {/* 격자 */}
            {gridLines.map((pts, i) => (
              <Line key={`g${i}`} points={pts} stroke={COLORS.grid} strokeWidth={1} listening={false} />
            ))}
            {/* 외곽선·하프라인·센터서클 */}
            <Rect x={0} y={0} width={lengthPx} height={widthPx} stroke={COLORS.line} strokeWidth={2} name="court-bg" />
            <Line points={[lengthPx / 2, 0, lengthPx / 2, widthPx]} stroke={COLORS.line} strokeWidth={2} listening={false} />
            <Circle x={lengthPx / 2} y={yc} radius={m(3)} stroke={COLORS.line} strokeWidth={2} listening={false} />
            <Circle x={lengthPx / 2} y={yc} radius={3} fill={COLORS.line} listening={false} />
            {/* 페널티 에어리어 + 마크 */}
            <Line points={leftArea} stroke={COLORS.line} strokeWidth={2} listening={false} />
            <Line points={rightAreaFixed} stroke={COLORS.line} strokeWidth={2} listening={false} />
            <Circle x={m(6)} y={yc} radius={3} fill={COLORS.line} listening={false} />
            <Circle x={lengthPx - m(6)} y={yc} radius={3} fill={COLORS.line} listening={false} />
            <Circle x={m(10)} y={yc} radius={3} fill={COLORS.line} listening={false} />
            <Circle x={lengthPx - m(10)} y={yc} radius={3} fill={COLORS.line} listening={false} />

            {/* 영역 */}
            {board.zones.map((z) => {
              const [x, y] = px(z.x, z.y);
              return (
                <Rect
                  key={z.id}
                  x={x}
                  y={y}
                  width={z.w * lengthPx}
                  height={z.h * widthPx}
                  fill={COLORS.zone}
                  stroke={selectedId === z.id ? COLORS.select : COLORS.zoneStroke}
                  strokeWidth={selectedId === z.id ? 3 : 1}
                  dash={[6, 4]}
                  onTap={(e) => { e.cancelBubble = true; select(z.id); }}
                  onClick={(e) => { e.cancelBubble = true; select(z.id); }}
                />
              );
            })}
            {/* 화살표 */}
            {board.arrows.map((a) => {
              const [x1, y1] = px(a.from[0], a.from[1]);
              const [x2, y2] = px(a.to[0], a.to[1]);
              const sel = selectedId === a.id;
              return (
                <Arrow
                  key={a.id}
                  points={[x1, y1, x2, y2]}
                  stroke={sel ? COLORS.select : "#ffffff"}
                  fill={sel ? COLORS.select : "#ffffff"}
                  strokeWidth={sel ? 4 : 3}
                  pointerLength={10}
                  pointerWidth={10}
                  dash={a.style === "pass" ? [8, 6] : undefined}
                  hitStrokeWidth={24}
                  onTap={(e) => { e.cancelBubble = true; select(a.id); }}
                  onClick={(e) => { e.cancelBubble = true; select(a.id); }}
                />
              );
            })}
            {/* 첫 점 표시 */}
            {pendingPoint && (
              <Circle x={px(pendingPoint[0], pendingPoint[1])[0]} y={px(pendingPoint[0], pendingPoint[1])[1]} radius={6} fill={COLORS.select} listening={false} />
            )}
            {/* 메모 */}
            {board.notes.map((n) => {
              const [x, y] = px(n.x, n.y);
              const w = Math.max(40, n.text.length * 11 + 12);
              return (
                <Group key={n.id} x={x} y={y} rotation={upright} onTap={(e) => { e.cancelBubble = true; select(n.id); }} onClick={(e) => { e.cancelBubble = true; select(n.id); }}>
                  <Rect x={-w / 2} y={-11} width={w} height={22} fill={COLORS.note} cornerRadius={4} stroke={selectedId === n.id ? COLORS.select : undefined} strokeWidth={2} />
                  <Text x={-w / 2} y={-11} width={w} height={22} text={n.text} fontSize={12} fill="#333" align="center" verticalAlign="middle" />
                </Group>
              );
            })}
            {/* 마커 */}
            {board.markers.map((mk) => {
              const [x, y] = px(mk.x, mk.y);
              const sel = selectedId === mk.id;
              const r = mk.kind === "ball" ? markerR * 0.55 : markerR;
              const fill = mk.kind === "us" ? COLORS.us : mk.kind === "them" ? COLORS.them : COLORS.ball;
              const label = mk.label.length > 3 ? mk.label.slice(0, 3) : mk.label;
              return (
                <Group
                  key={mk.id}
                  x={x}
                  y={y}
                  rotation={upright}
                  draggable
                  onDragStart={() => select(mk.id)}
                  onDragMove={(e) => onMarkerDragMove(e, mk)}
                  onDragEnd={(e) => onMarkerDragEnd(e, mk)}
                  onTap={(e) => { e.cancelBubble = true; select(mk.id); }}
                  onClick={(e) => { e.cancelBubble = true; select(mk.id); }}
                >
                  {/* 터치 영역 확장 */}
                  <Circle radius={r + 8} fill="transparent" />
                  <Circle radius={r} fill={fill} stroke={sel ? COLORS.select : "#ffffff"} strokeWidth={sel ? 4 : 2} shadowBlur={sel ? 10 : 4} shadowColor="rgba(0,0,0,0.4)" />
                  {mk.kind === "ball" ? (
                    <Circle radius={r * 0.45} fill="#222" />
                  ) : (
                    <Text x={-r} y={-r} width={r * 2} height={r * 2} text={label} fontSize={label.length >= 3 ? r * 0.62 : r * 0.85} fontStyle="bold" fill="#fff" align="center" verticalAlign="middle" listening={false} />
                  )}
                </Group>
              );
            })}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
