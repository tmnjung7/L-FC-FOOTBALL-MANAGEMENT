"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MatchFormat } from "@/types/database";

export type SettingsInput = {
  team_name: string;
  default_format: MatchFormat;
  default_quarter_min: number;
  late_threshold_min: number;
  rating_enabled: boolean;
  rating_deadline_hours: number;
};

/** 팀 설정 저장 (admin) */
export async function updateTeamSettings(input: SettingsInput): Promise<{ ok: true } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) return { error: "설정 변경은 관리자(lfc1·lfc2)만 할 수 있습니다." };
  const name = input.team_name.trim();
  if (!name || name.length > 30) return { error: "팀 이름은 1~30자여야 합니다." };
  if (input.default_quarter_min < 1 || input.default_quarter_min > 60) return { error: "쿼터 시간은 1~60분이어야 합니다." };
  if (input.late_threshold_min < 0 || input.late_threshold_min > 120) return { error: "지각 기준은 0~120분이어야 합니다." };
  if (input.rating_deadline_hours < 1 || input.rating_deadline_hours > 240) return { error: "평점 마감은 1~240시간이어야 합니다." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_settings")
    .update({ team_name: name, default_format: input.default_format, default_quarter_min: input.default_quarter_min, late_threshold_min: input.late_threshold_min, rating_enabled: input.rating_enabled, rating_deadline_hours: input.rating_deadline_hours })
    .eq("id", 1);
  if (error) return { error: error.message.includes("row-level security") ? "권한이 없습니다." : error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
