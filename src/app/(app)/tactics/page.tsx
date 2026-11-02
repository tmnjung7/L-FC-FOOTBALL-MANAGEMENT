import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "전술판" };

export default function TacticsPage() {
  return (
    <>
      <PageHeader title="전술판" description="포메이션 · 세트피스 · 압박" />
      <Placeholder
        planned={[
          "전술 목록 (카테고리 필터·썸네일·즐겨찾기)",
          "풋살 코트 40x20 위 드래그 가능한 선수 마커",
          "포메이션 프리셋 (5v5: 1-2-1 등 / 6v6: 2-1-2 등)",
          "화살표·영역·메모 도구, 실행취소",
          "전술 PNG 내보내기 → 카카오톡 공유",
        ]}
      />
    </>
  );
}
