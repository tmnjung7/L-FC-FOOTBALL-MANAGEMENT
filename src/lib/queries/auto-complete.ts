import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";

/**
 * 날짜가 지난 "예정" 모임 중 기록(쿼터·출석)이 있는 것을 자동으로 '완료' 처리한다.
 * 경기 목록·홈·모임 상세·통계를 읽기 전에 호출 (요청당 1회만 실행, 실패해도 화면은 그대로 보여 준다).
 * DB 함수(0008)가 아직 없으면, 대표가 보고 있을 때만 쿼터가 있는 모임을 직접 완료 처리한다(RLS 상 scorer 이상).
 */
export const autoCompleteMatches = cache(async (): Promise<void> => {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_auto_complete_matches");
    if (!error) return;
    const { data } = await supabase.from("matches").select("id, games(id)").eq("status", "scheduled").lt("match_date", todayISO());
    const ids = (data ?? []).filter((m) => (m.games?.length ?? 0) > 0).map((m) => m.id);
    if (ids.length === 0) return;
    await supabase.from("matches").update({ status: "done" }).in("id", ids);
  } catch {
    // 자동 완료는 보조 기능: 실패해도 화면 조회를 막지 않는다
  }
});
