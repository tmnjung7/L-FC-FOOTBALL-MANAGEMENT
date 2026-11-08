"use client";

import { useState, useTransition, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import { ArrowRight, Download, Eraser, FolderOpen, Grid3X3, LayoutGrid, Magnet, MousePointer2, MoveRight, Pencil, Redo2, Save, Share2, Square, StickyNote, Trash2, Undo2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { TacticThumbnail } from "@/components/tactics/tactic-thumbnail";
import { createTactic, deleteTactic, updateTactic } from "@/app/actions/tactics";
import { formationsFor, suggestAssignment } from "@/lib/formations";
import { parseBoard, uid } from "@/lib/tactics/board-types";
import { useBoardStore, type Tool } from "@/store/board-store";
import type { TacticWithUsage } from "@/lib/queries/tactics";
import { POSITION_LABEL, TACTIC_CATEGORY_LABEL, type MatchFormat, type PlayerRow, type TacticCategory } from "@/types/database";
import { cn } from "@/lib/utils";

type Props = { players: PlayerRow[]; tactics: TacticWithUsage[]; isAdmin: boolean; stageRef: RefObject<Konva.Stage | null> };

const TOOLS: { key: Tool; label: string; icon: React.ReactNode }[] = [
  { key: "select", label: "이동", icon: <MousePointer2 /> },
  { key: "arrow-move", label: "이동 화살표", icon: <MoveRight /> },
  { key: "arrow-pass", label: "패스 화살표", icon: <ArrowRight /> },
  { key: "zone", label: "영역", icon: <Square /> },
  { key: "note", label: "메모", icon: <StickyNote /> },
];

function ToolBtn({ active, onClick, label, children, disabled }: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-1.5 text-[10px] transition-colors disabled:opacity-40 [&_svg]:size-5",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-accent",
      )}
    >
      {children}
      <span className="leading-none">{label}</span>
    </button>
  );
}

/** 전술판 하단 도구 모음 + 프리셋/선수/저장/불러오기 바텀시트 */
export function BoardToolbar({ players, tactics, isAdmin, stageRef }: Props) {
  const router = useRouter();
  const s = useBoardStore();
  const [pending, startTransition] = useTransition();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState(s.editingTacticName ?? "");
  const [category, setCategory] = useState<TacticCategory>("formation");
  const [desc, setDesc] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const usCount = s.board.markers.filter((m) => m.kind === "us").length;
  const themCount = s.board.markers.filter((m) => m.kind === "them").length;

  // ---- 프리셋 적용 (선택한 선수가 있으면 포지션에 맞춰 자동 배정)
  function applyFormation(key: string, side: "us" | "them") {
    const f = formationsFor(s.board.format).find((x) => x.key === key);
    if (!f) return;
    const pool = players.filter((p) => chosen.has(p.id));
    const assigned = side === "us" && pool.length > 0 ? suggestAssignment(f.slots, pool) : f.slots.map(() => null);
    s.commit((b) => {
      b.markers = b.markers.filter((m) => m.kind !== side);
      f.slots.forEach((slot, i) => {
        const p = assigned[i];
        const x = side === "us" ? slot.x : 1 - slot.x;
        b.markers.push({ id: uid(side === "us" ? "p" : "o"), kind: side, x, y: slot.y, label: p ? (p.jersey_number != null ? String(p.jersey_number) : p.name.slice(-2)) : side === "us" ? slot.label : String(i + 1), playerId: p?.id ?? null });
      });
    });
    toast.success(`${f.name} 배치 (${side === "us" ? "우리 팀" : "상대 팀"})`);
  }

  function addPlayer(p: PlayerRow) {
    if (s.board.markers.some((m) => m.playerId === p.id)) { toast.info(`${p.name} 은(는) 이미 코트에 있습니다`); return; }
    s.addMarker("us", p.jersey_number != null ? String(p.jersey_number) : p.name.slice(-2), p.id);
  }

  function renameSelected() {
    const id = s.selectedId;
    const mk = s.board.markers.find((m) => m.id === id);
    const note = s.board.notes.find((n) => n.id === id);
    if (mk && mk.kind !== "ball") {
      const v = window.prompt("마커 표시 이름 (3자 이내 권장)", mk.label);
      if (v != null) s.commit((b) => { const t = b.markers.find((m) => m.id === id); if (t) t.label = v.trim().slice(0, 6); });
    } else if (note) {
      const v = window.prompt("메모 내용", note.text);
      if (v != null) s.commit((b) => { const t = b.notes.find((n) => n.id === id); if (t) t.text = v.trim().slice(0, 30); });
    }
  }

  // ---- 저장 / 불러오기
  function save(asNew: boolean) {
    const input = { name, format: s.board.format, category, description: desc || null, board: s.board };
    startTransition(async () => {
      const r = !asNew && s.editingTacticId ? await updateTactic(s.editingTacticId, input) : await createTactic(input);
      if ("error" in r) { toast.error(r.error); return; }
      s.markSaved(r.id!, name);
      toast.success(asNew || !s.editingTacticId ? "새 전술로 저장했습니다" : "전술을 덮어썼습니다");
      setSaveOpen(false);
      router.refresh();
    });
  }
  function load(t: TacticWithUsage) {
    s.load(parseBoard(t.board_json), t.id, t.name);
    setName(t.name);
    setCategory(t.category);
    setDesc(t.description ?? "");
    toast.success(`"${t.name}" 불러옴`);
  }
  function remove(t: TacticWithUsage) {
    if (!confirm(`"${t.name}" 전술을 삭제할까요?`)) return;
    startTransition(async () => {
      const r = await deleteTactic(t.id);
      if ("error" in r) toast.error(r.error);
      else { if (s.editingTacticId === t.id) s.markSaved("", ""); router.refresh(); }
    });
  }

  // ---- 내보내기 / 공유
  async function exportPng(share: boolean) {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const fileName = `${s.editingTacticName || "전술판"}.png`;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: "image/png" });
    if (share && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: fileName }); return; } catch { /* 취소 */ return; }
    }
    const a = document.createElement("a");
    a.href = dataUrl; a.download = fileName; a.click();
  }

  const selected = s.selectedId;
  const selMarker = s.board.markers.find((m) => m.id === selected);

  return (
    <div className="flex flex-col gap-2">
      {/* 1줄: 도구 */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TOOLS.map((t) => (
          <ToolBtn key={t.key} active={s.tool === t.key} onClick={() => s.setTool(t.key)} label={t.label}>{t.icon}</ToolBtn>
        ))}
        <span className="bg-border mx-0.5 w-px shrink-0" />
        <ToolBtn onClick={s.undo} label="되돌리기" disabled={s.past.length === 0}><Undo2 /></ToolBtn>
        <ToolBtn onClick={s.redo} label="다시" disabled={s.future.length === 0}><Redo2 /></ToolBtn>
        <ToolBtn onClick={s.removeSelected} label="삭제" disabled={!selected || selMarker?.kind === "ball"}><Trash2 /></ToolBtn>
        <ToolBtn onClick={renameSelected} label="이름" disabled={!selected || selMarker?.kind === "ball"}><Pencil /></ToolBtn>
        {/* 지우기: 낙서(화살표·영역·메모)만 / 전부 */}
        <Drawer>
          <DrawerTrigger asChild>
            <button type="button" aria-label="지우기" title="지우기" className="bg-muted text-foreground hover:bg-accent flex h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-1.5 text-[10px] [&_svg]:size-5">
              <Eraser />
              <span className="leading-none">지우기</span>
            </button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>지우기</DrawerTitle>
              <DrawerDescription>되돌리기로 복구할 수 있습니다.</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-2 px-4 pb-2">
              <DrawerClose asChild>
                <Button size="lg" variant="outline" onClick={() => { s.commit((b) => { b.arrows = []; b.zones = []; b.notes = []; }); toast.success("화살표·영역·메모를 지웠습니다"); }}>
                  화살표·영역·메모만 지우기 (선수는 유지)
                </Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button size="lg" variant="outline" onClick={() => { s.commit((b) => { b.markers = b.markers.filter((m) => m.kind !== "them"); }); toast.success("상대 선수를 지웠습니다"); }}>
                  상대 선수만 지우기
                </Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button size="lg" variant="destructive" onClick={() => { s.reset(); toast.success("코트를 비웠습니다"); }}>
                  전부 지우기 (코트 비우기)
                </Button>
              </DrawerClose>
            </div>
            <DrawerFooter><DrawerClose asChild><Button variant="ghost">닫기</Button></DrawerClose></DrawerFooter>
          </DrawerContent>
        </Drawer>
        <span className="bg-border mx-0.5 w-px shrink-0" />
        <ToolBtn active={s.showGrid} onClick={s.toggleGrid} label="격자"><Grid3X3 /></ToolBtn>
        <ToolBtn active={s.snap} onClick={s.toggleSnap} label="칸맞춤"><Magnet /></ToolBtn>
      </div>

      {/* 2줄: 배치·선수·저장 */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {/* 프리셋 */}
        <Drawer>
          <DrawerTrigger asChild><button type="button" className="bg-muted hover:bg-accent flex h-11 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-medium"><LayoutGrid className="size-4" /> 포메이션</button></DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>포메이션 프리셋</DrawerTitle>
              <DrawerDescription>버튼 한 번에 배치. 아래 &lsquo;선수&rsquo;에서 고른 선수가 있으면 선호 포지션에 맞춰 자동 배정됩니다.</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-2">
              <div className="grid grid-cols-2 gap-2">
                {(["5v5", "6v6"] as MatchFormat[]).map((f) => (
                  <Button key={f} type="button" variant={s.board.format === f ? "default" : "outline"} onClick={() => s.setFormat(f)}>{f}</Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {formationsFor(s.board.format).map((f) => (
                  <DrawerClose asChild key={f.key}>
                    <Button type="button" variant="outline" size="lg" className="h-14 flex-col gap-0" onClick={() => applyFormation(f.key, "us")}>
                      <span className="font-bold">{f.name.split(" ")[0]}</span>
                      <span className="text-muted-foreground text-[10px]">{f.name.replace(/^\S+\s?/, "") || "우리 팀"}</span>
                    </Button>
                  </DrawerClose>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">상대 팀 배치</p>
              <div className="grid grid-cols-4 gap-2">
                {formationsFor(s.board.format).map((f) => (
                  <DrawerClose asChild key={`t${f.key}`}>
                    <Button type="button" variant="secondary" size="sm" onClick={() => applyFormation(f.key, "them")}>{f.name.split(" ")[0]}</Button>
                  </DrawerClose>
                ))}
              </div>
              <DrawerClose asChild>
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => { s.reset(); toast.success("보드를 비웠습니다"); }}>코트 비우기</Button>
              </DrawerClose>
            </div>
            <DrawerFooter><DrawerClose asChild><Button variant="ghost">닫기</Button></DrawerClose></DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* 선수 */}
        <Drawer>
          <DrawerTrigger asChild><button type="button" className="bg-muted hover:bg-accent flex h-11 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-medium"><Users className="size-4" /> 선수 {usCount > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">{usCount}</span>}</button></DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>선수 올리기</DrawerTitle>
              <DrawerDescription>이름을 탭하면 코트에 마커가 생깁니다. 체크한 선수는 포메이션 자동 배정에 쓰입니다.</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-2">
              {players.length === 0 ? <p className="text-muted-foreground text-sm">등록된 선수가 없습니다.</p> : (
                <ul className="grid grid-cols-2 gap-2">
                  {players.map((p) => {
                    const onBoard = s.board.markers.some((m) => m.playerId === p.id);
                    const picked = chosen.has(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-1">
                        <button type="button" onClick={() => setChosen((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} aria-pressed={picked} aria-label={`${p.name} 자동 배정 후보`} className={cn("flex size-11 shrink-0 items-center justify-center rounded-md border text-xs font-bold", picked ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground")}>{picked ? "✓" : ""}</button>
                        <button type="button" onClick={() => addPlayer(p)} className={cn("bg-card hover:bg-accent flex h-11 min-w-0 flex-1 items-center justify-between rounded-md border px-2 text-sm", onBoard && "opacity-50")}>
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="text-muted-foreground shrink-0 text-[10px]">{p.jersey_number != null ? `#${p.jersey_number}` : POSITION_LABEL[p.preferred_position].split("(")[0]}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => s.addMarker("them", String(themCount + 1))}><UserPlus /> 상대 선수 추가</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => s.commit((b) => { b.markers = b.markers.filter((m) => m.kind === "ball"); })}>마커 전부 제거</Button>
              </div>
            </div>
            <DrawerFooter><DrawerClose asChild><Button variant="ghost">닫기</Button></DrawerClose></DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* 불러오기 */}
        <Drawer>
          <DrawerTrigger asChild><button type="button" className="bg-muted hover:bg-accent flex h-11 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-medium"><FolderOpen className="size-4" /> 저장됨 {tactics.length > 0 && <span className="text-muted-foreground">{tactics.length}</span>}</button></DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>저장된 전술</DrawerTitle>
              <DrawerDescription>탭하면 보드에 불러옵니다. 현재 보드 내용은 덮어써집니다.</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-2">
              {tactics.length === 0 ? <p className="text-muted-foreground text-sm">저장된 전술이 없습니다. 관리자가 &lsquo;저장&rsquo;으로 추가할 수 있습니다.</p> : (
                <ul className="flex flex-col gap-2">
                  {tactics.map((t) => (
                    <li key={t.id} className="bg-card flex items-center gap-3 rounded-xl border p-2">
                      <DrawerClose asChild>
                        <button type="button" onClick={() => load(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <TacticThumbnail board={t.board_json} className="h-12 w-24 shrink-0 rounded-md" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{t.is_favorite ? "★ " : ""}{t.name}</span>
                            <span className="text-muted-foreground block text-xs">{TACTIC_CATEGORY_LABEL[t.category]} · {t.format}{t.used_games ? ` · ${t.used_games}쿼터 사용` : ""} · {t.updated_at.slice(0, 10)}</span>
                          </span>
                        </button>
                      </DrawerClose>
                      {isAdmin && <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" aria-label="삭제" disabled={pending} onClick={() => remove(t)}><Trash2 className="size-4" /></Button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DrawerFooter><DrawerClose asChild><Button variant="ghost">닫기</Button></DrawerClose></DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* 저장 (admin) */}
        {isAdmin && (
          <Drawer open={saveOpen} onOpenChange={setSaveOpen}>
            <DrawerTrigger asChild><button type="button" className="bg-primary text-primary-foreground flex h-11 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-medium"><Save className="size-4" /> 저장{s.dirty && s.editingTacticId ? "*" : ""}</button></DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>전술 저장</DrawerTitle>
                <DrawerDescription>{s.editingTacticId ? `"${s.editingTacticName}" 을(를) 덮어쓰거나 새 전술로 저장합니다.` : "이름을 붙여 팀 전술로 저장합니다."}</DrawerDescription>
              </DrawerHeader>
              <div className="flex flex-col gap-3 px-4 pb-2">
                <div className="flex flex-col gap-2"><Label htmlFor="t-name">이름</Label><Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 기본 2-1-2, 코너킥 니어" maxLength={40} /></div>
                <div className="flex flex-col gap-2"><Label htmlFor="t-cat">분류</Label>
                  <NativeSelect id="t-cat" value={category} onChange={(e) => setCategory(e.target.value as TacticCategory)}>
                    {(Object.keys(TACTIC_CATEGORY_LABEL) as TacticCategory[]).map((c) => <option key={c} value={c}>{TACTIC_CATEGORY_LABEL[c]}</option>)}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-2"><Label htmlFor="t-desc">설명 (누가 언제 뭘 하는지)</Label><Textarea id="t-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} placeholder="선택" /></div>
              </div>
              <DrawerFooter>
                {s.editingTacticId && <Button size="lg" onClick={() => save(false)} disabled={pending || !name.trim()}>덮어쓰기</Button>}
                <Button size="lg" variant={s.editingTacticId ? "outline" : "default"} onClick={() => save(true)} disabled={pending || !name.trim()}>새 전술로 저장</Button>
                <DrawerClose asChild><Button variant="ghost">취소</Button></DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}

        <button type="button" onClick={() => exportPng(true)} className="bg-muted hover:bg-accent flex h-11 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-medium" aria-label="이미지로 공유"><Share2 className="size-4" /> 공유</button>
        <button type="button" onClick={() => exportPng(false)} className="bg-muted hover:bg-accent flex h-11 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-medium" aria-label="PNG 저장"><Download className="size-4" /> PNG</button>
      </div>

      {/* 상태 줄 */}
      <p className="text-muted-foreground text-xs">
        {s.tool === "select" && "마커를 끌어서 이동 · 탭하면 선택"}
        {(s.tool === "arrow-move" || s.tool === "arrow-pass") && (s.pendingPoint ? "끝점을 탭하세요" : "시작점을 탭하세요")}
        {s.tool === "zone" && (s.pendingPoint ? "반대쪽 모서리를 탭하세요" : "영역의 한 모서리를 탭하세요")}
        {s.tool === "note" && "메모를 놓을 자리를 탭하세요"}
        {s.editingTacticName && <span className="ml-2">· 편집 중: <b>{s.editingTacticName}</b>{s.dirty ? " (수정됨)" : ""}</span>}
      </p>
    </div>
  );
}
