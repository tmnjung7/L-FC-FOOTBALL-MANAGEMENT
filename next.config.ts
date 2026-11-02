import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // 개발 중에는 서비스워커 캐시 때문에 변경이 안 보이는 혼란을 막기 위해 끈다
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // react-konva 는 브라우저 canvas 전용이라 서버 번들에서 제외
  serverExternalPackages: ["konva", "react-konva"],
};

export default withSerwist(nextConfig);
