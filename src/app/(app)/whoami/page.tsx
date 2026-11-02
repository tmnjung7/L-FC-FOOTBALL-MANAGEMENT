import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { selectPlayer, clearPlayer } from "@/app/actions/identity";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { POSITION_LABEL } from "@/types/database";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "내 이름 선택" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

/** 공용 계정 로그인 후 "나는 누구?" 를 고르는 화면. 참석 응답·평점이 이 이름으로 기록된다. */
export default async function WhoAmIPage({ searchParams }: Props) {
  const { next = "/", error } = await searchParams;
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data: players } = await supabase
    .from("players")
    .select("id, name, nickname, preferred_position, jersey_number")
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <PageHeader title="내 이름 선택" description="참석 응답과 평점이 이 이름으로 기록됩니다" />
      <div className="flex flex-col gap-4 py-4">
        {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">선택할 수 없는 선수입니다. 다시 골라 주세요.</p>}
        {viewer.playerSource === "linked" ? (
          <Card>
            <CardContent className="text-sm">
              이 계정은 <b>{viewer.player?.name}</b> 선수와 직접 연결되어 있어 이름을 바꿀 수 없습니다.
            </CardContent>
          </Card>
        ) : (
          <>
            {!players?.length ? (
              <Card>
                <CardContent className="text-muted-foreground text-sm">등록된 선수가 없습니다. 관리자가 선수 탭에서 먼저 등록해야 합니다.</CardContent>
              </Card>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {players.map((p) => {
                  const selected = viewer.player?.id === p.id;
                  return (
                    <li key={p.id}>
                      <form action={selectPlayer.bind(null, p.id, next)}>
                        <button
                          type="submit"
                          aria-pressed={selected}
                          className={cn(
                            "bg-card flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left shadow-sm transition-colors active:scale-[0.98]",
                            selected ? "border-primary bg-primary/10" : "hover:bg-accent",
                          )}
                        >
                          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                            {p.jersey_number ?? <UserRound className="size-5" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{p.name}</span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {p.nickname ? `${p.nickname} · ` : ""}{POSITION_LABEL[p.preferred_position]}
                            </span>
                          </span>
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            {viewer.player && (
              <form action={clearPlayer} className="self-center">
                <Button type="submit" variant="ghost" size="sm">선택 해제</Button>
              </form>
            )}
          </>
        )}
      </div>
    </>
  );
}
