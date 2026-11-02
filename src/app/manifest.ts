import type { MetadataRoute } from "next";

/** PWA 설치 정보. /manifest.webmanifest 로 서빙된다. 5단계에서 PNG 아이콘(192/512) 추가 예정. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "풋살 매니저",
    short_name: "풋살",
    description: "우리 팀 풋살 모임 기록·통계·전술판",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#16a34a",
    lang: "ko",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
