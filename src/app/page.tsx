import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export default function HomePage() {
  return (
    <>
      <PageHeader title="홈" description="다음 모임과 최근 결과" />
      <Placeholder
        planned={[
          "다음 모임 카드 (날짜·장소·참석 인원, 참석/불참 버튼)",
          "최근 모임 결과 요약 3개",
          "이번 달 득점왕·어시왕·평점왕 미니 카드",
          "모임 종료 후 평점·피드백 입력 알림 카드",
        ]}
      />
    </>
  );
}
