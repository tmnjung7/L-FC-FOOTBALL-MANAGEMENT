"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MatchFormat, MatchStatus } from "@/types/database";

export type MatchInput = {
  match_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  venue: string | null;
  format: MatchFormat;
  notes: string | null;
  /** 상대팀 이름 (null = 자체전) */
  opponent: string | null;
};

export type ActionResult = { ok: true; id?: string; count?: number } | { error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function validate(input: Omit<MatchInput, "match_date">): string | null {
  if (input.start_time && !TIME_RE.test(input.start_time)) return "시간 형식이 올바르지 않습니다.";
  if (input.format !== "5v5" && input.format !== "6v6") return "형식은 5v5 또는 6v6 이어야 합니다.";
  if (input.venue && input.venue.length > 60) return "장소는 60자 이내로 입력해 주세요.";
  if (input.opponent && input.opponent.trim().length > 40) return "상대팀 이름은 40자 이내로 입력해 주세요.";
  return null;
}

function friendly(message: string): string {
  if (message.includes("row-level security")) return "모임 생성·수정은 대표 계정(lfc1·lfc2·lfc3) 로그인 후 가능합니다.";
  return message;
}

function revalidateMatch(id?: string) {
  revalidatePath("/");
  revalidatePath("/matches");
  if (id) revalidatePath(`/matches/${id}`);
}

/** 여러 날짜를 한 번에 등록 (한 달치 예약용). scorer 이상 */
export async function createMatches(dates: string[], input: Omit<MatchInput, "match_date">): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "모임 등록은 대표 계정 로그인 후 가능합니다." };
  const unique = [...new Set(dates)].filter((d) => DATE_RE.test(d)).sort();
  if (unique.length === 0) return { error: "날짜를 하나 이상 선택해 주세요." };
  if (unique.length > 31) return { error: "한 번에 31개까지만 등록할 수 있습니다." };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const rows = unique.map((match_date) => ({
    match_date,
    start_time: input.start_time ? `${input.start_time}:00` : null,
    venue: input.venue?.trim() || null,
    format: input.format,
    notes: input.notes?.trim() || null,
    opponent: input.opponent?.trim() || null,
    status: "scheduled" as MatchStatus,
    created_by: viewer.user?.id ?? null,
  }));
  const { data, error } = await supabase.from("matches").insert(rows).select("id");
  if (error) return { error: friendly(error.message) };
  revalidateMatch();
  return { ok: true, count: data.length, id: data.length === 1 ? data[0].id : undefined };
}

/** 모임 정보 수정. scorer 이상 */
export async function updateMatch(id: string, input: MatchInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "모임 수정은 대표 계정 로그인 후 가능합니다." };
  if (!DATE_RE.test(input.match_date)) return { error: "날짜 형식이 올바르지 않습니다." };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("matches")
    .update({
      match_date: input.match_date,
      start_time: input.start_time ? `${input.start_time}:00` : null,
      venue: input.venue?.trim() || null,
      format: input.format,
      notes: input.notes?.trim() || null,
      opponent: input.opponent?.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidateMatch(id);
  return { ok: true, id };
}

/** 상태 변경: 예정 ↔ 완료 ↔ 취소. scorer 이상 */
export async function setMatchStatus(id: string, status: MatchStatus): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "상태 변경은 대표 계정 로그인 후 가능합니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("matches").update({ status }).eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidateMatch(id);
  return { ok: true, id };
}

/**
 * 모임 삭제 (쿼터·편성·득점·출석·평점·보고서가 함께 지워짐). scorer 이상.
 * 화면에서 "정말 삭제" 확인을 거친 뒤 호출한다. redirect 여부는 호출한 화면이 정한다.
 */
export async function deleteMatch(id: string, opts: { redirectTo?: string | null } = {}): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "삭제는 대표 계정 로그인 후 가능합니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidateMatch();
  if (opts.redirectTo !== null) redirect(opts.redirectTo ?? "/matches");
  return { ok: true };
}

/** 경기 유형 전환: 상대팀 이름을 넣으면 상대팀 경기, null 이면 자체전. scorer 이상 */
export async function setMatchOpponent(id: string, opponent: string | null): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.canScore) return { error: "경기 유형 변경은 대표 계정 로그인 후 가능합니다." };
  const name = opponent?.trim() || null;
  if (name && name.length > 40) return { error: "상대팀 이름은 40자 이내로 입력해 주세요." };
  const supabase = await createClient();
  if (name === null) {
    // 자체전으로 되돌릴 때 득점자 없는 실점 기록이 있으면 막는다 (자체전은 득점자 필수)
    const { data: games } = await supabase.from("games").select("id").eq("match_id", id);
    const ids = (games ?? []).map((g) => g.id);
    if (ids.length) {
      const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).in("game_id", ids).is("scorer_id", null);
      if (count && count > 0) return { error: "득점자 없는 실점 기록이 있어 자체전으로 바꿀 수 없습니다." };
    }
  }
  const { error } = await supabase.from("matches").update({ opponent: name }).eq("id", id);
  if (error) return { error: friendly(error.message) };
  revalidateMatch(id);
  return { ok: true, id };
}
