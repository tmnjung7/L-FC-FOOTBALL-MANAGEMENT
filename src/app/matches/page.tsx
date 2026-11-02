import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "경기" };

export default function MatchesPage() {
  return (
    <>
      <PageHeader title="경기" description="매주 일요일 모임 기록" />
      <Placeholder
        planned={[
          "모임 목록 (날짜·장소·5v5/6v6·참석 인원·상태)",
          "모임 상세: [출석] [쿼터] [기록] 탭",
          "쿼터별 팀 편성 + 직전 쿼터 편성 복사",
          "경기 중 빠른 입력 모드 (스코어보드·타이머·골 버튼)",
          "경기 보고서 탭 + 카카오톡 공유",
        ]}
      />
    </>
  );
}
