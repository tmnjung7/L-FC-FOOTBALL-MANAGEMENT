import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "통계" };

export default function StatsPage() {
  return (
    <>
      <PageHeader title="통계" description="랭킹 · 표 · 차트" />
      <Placeholder
        planned={[
          "기간 필터 (올해 / 최근 3개월 / 전체 / 직접 선택)",
          "랭킹: 득점·어시스트·공격포인트·평균평점·출석률·지각",
          "전 선수 × 모든 지표 표 (정렬 가능)",
          "차트: 월별 모임 수, 득점 추이, 출전 vs 휴식 쿼터",
          "랭킹 이미지 저장 → 카카오톡 공유",
        ]}
      />
    </>
  );
}
