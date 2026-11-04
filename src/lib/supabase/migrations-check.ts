import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type MigrationStatus = { file: string; label: string; applied: boolean };

/**
 * Supabase 에 어떤 마이그레이션(SQL)이 아직 적용되지 않았는지 점검.
 * 각 파일이 만드는 대표 객체(컬럼·함수)가 있는지로 판단한다. 새 마이그레이션을 추가하면 여기에도 한 줄 추가.
 */
export const getMissingMigrations = cache(async (): Promise<MigrationStatus[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const checks: { file: string; label: string; test: () => Promise<boolean> }[] = [
    {
      file: "0001_init.sql",
      label: "기본 테이블",
      test: async () => !(await supabase.from("team_settings").select("id").limit(1)).error,
    },
    {
      file: "0002_open_access.sql",
      label: "오픈형 접근 · 역할",
      test: async () => {
        const { error } = await supabase.rpc("is_scorer");
        return !error || !/could not find|does not exist|404/i.test(error.message);
      },
    },
    {
      file: "0003_auto_roles.sql",
      label: "대표 계정 자동 역할",
      test: async () => {
        const { error } = await supabase.rpc("default_role_for_email", { p_email: "x@x" });
        return !error || !/could not find|does not exist|404/i.test(error.message);
      },
    },
    {
      file: "0004_rsvp.sql",
      label: "사전 투표 · 노쇼",
      test: async () => {
        const { error } = await supabase.from("attendance").select("rsvp").limit(1);
        return !error || !/rsvp/i.test(error.message);
      },
    },
    {
      file: "0005_opponent.sql",
      label: "상대팀 경기 모드",
      test: async () => {
        const { error } = await supabase.from("matches").select("opponent").limit(1);
        return !error || !/opponent/i.test(error.message);
      },
    },
  ];
  const results = await Promise.all(checks.map(async (c) => ({ file: c.file, label: c.label, applied: await c.test().catch(() => true) })));
  return results.filter((r) => !r.applied);
});
