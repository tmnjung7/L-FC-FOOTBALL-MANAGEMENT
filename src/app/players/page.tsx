import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "선수" };

export default function PlayersPage() {
  return (
    <>
      <PageHeader title="선수" description="팀원 명단과 개인 기록" />
      <Placeholder
        planned={[
          "선수 목록 (이름·포지션·활동 여부)",
          "선수 상세: 시즌 요약·최근 5경기 폼·게임별 기록",
          "admin: 선수 추가·수정·비활성화",
        ]}
      />
    </>
  );
}
