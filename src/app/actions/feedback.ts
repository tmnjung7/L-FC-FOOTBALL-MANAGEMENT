"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { daysBetween, todayISO } from "@/lib/date";

export type FeedbackInput = {
  ratings: { player_id: string; score: number }[]; // 비운 선수는 포함하지 않음 → 기존 평점 삭제
  comment: string | null;
  mvp_vote_id: string | null;
};

export type ActionResult = { ok: true } | { error: string };

function friendly(message: string) {
  if (message.includes("ratings_check1") || message.includes("player_id <> rater_id")) return "자기 자신은 평가할 수 없습니다.";
  if (message.includes("ratings_score_check")) return "평점은 1.0~10.0, 0.5 단위여야 합니다.";
  if (message.includes("row-level security")) return "저장 권한이 없습니다. 홈에서 내 이름을 다시 골라 주세요.";
  return message;
}

/** 평점·한 줄 피드백·MVP 한 번에 저장 (홈에서 고른 "내 이름" 기준, 로그인 불필요) */
export async function submitFeedback(matchId: string, input: FeedbackInput): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer.player) return { error: "먼저 홈에서 내 이름을 골라 주세요." };
  const me = viewer.player.id;
  const supabase = await createClient();

  const [{ data: match }, { data: settings }] = await Promise.all([
    supabase.from("matches").select("match_date, status").eq("id", matchId).maybeSingle(),
    supabase.from("team_settings").select("rating_enabled, rating_deadline_hours, feedback_edit_hours").eq("id", 1).maybeSingle(),
  ]);
  if (!match) return { error: "모임을 찾을 수 없습니다." };
  if (match.status !== "done") return { error: "모임이 '완료' 상태일 때만 입력할 수 있습니다. 대표에게 모임 종료 처리를 요청해 주세요." };
  const elapsedHours = daysBetween(match.match_date, todayISO()) * 24;
  const deadline = Math.max(settings?.rating_deadline_hours ?? 48, settings?.feedback_edit_hours ?? 48);
  if (!viewer.canScore && elapsedHours > deadline + 24) return { error: `입력 기한(경기 후 ${deadline}시간)이 지났습니다.` };

  if (input.mvp_vote_id === me) return { error: "MVP 는 자기 자신에게 투표할 수 없습니다." };
  for (const r of input.ratings) {
    if (r.player_id === me) return { error: "자기 자신은 평가할 수 없습니다." };
    if (r.score < 1 || r.score > 10 || Math.round(r.score * 2) !== r.score * 2) return { error: "평점은 1.0~10.0, 0.5 단위여야 합니다." };
  }
  const comment = input.comment?.trim().slice(0, 200) || null;

  // 평점: 이번에 보낸 선수는 upsert, 보내지 않은 선수의 기존 평점은 삭제
  if (settings?.rating_enabled !== false) {
    const { data: existing } = await supabase.from("ratings").select("id, player_id").eq("match_id", matchId).eq("rater_id", me);
    const keep = new Set(input.ratings.map((r) => r.player_id));
    const toDelete = (existing ?? []).filter((e) => !keep.has(e.player_id)).map((e) => e.id);
    if (toDelete.length) {
      const { error } = await supabase.from("ratings").delete().in("id", toDelete);
      if (error) return { error: friendly(error.message) };
    }
    if (input.ratings.length) {
      const { error } = await supabase
        .from("ratings")
        .upsert(input.ratings.map((r) => ({ match_id: matchId, game_id: null, player_id: r.player_id, rater_id: me, score: r.score })), { onConflict: "match_id,game_id,player_id,rater_id" });
      if (error) return { error: friendly(error.message) };
    }
  }

  // 피드백 + MVP (둘 다 비면 행 삭제)
  if (!comment && !input.mvp_vote_id) {
    await supabase.from("match_feedback").delete().eq("match_id", matchId).eq("player_id", me);
  } else {
    const { error } = await supabase
      .from("match_feedback")
      .upsert({ match_id: matchId, player_id: me, comment, mvp_vote_id: input.mvp_vote_id }, { onConflict: "match_id,player_id" });
    if (error) return { error: friendly(error.message) };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/rate`);
  revalidatePath("/");
  return { ok: true };
}
