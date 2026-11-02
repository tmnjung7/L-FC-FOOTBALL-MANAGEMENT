import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Serwist가 빌드 시 주입하는 프리캐시 목록 타입 선언
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * 서비스워커(백그라운드에서 네트워크 요청을 가로채 캐시하는 스크립트).
 * - 빌드된 정적 파일은 설치 시 미리 캐시(precache)
 * - 나머지는 Next.js 권장 런타임 캐시 규칙(defaultCache) 적용
 * - 개발 모드(pnpm dev)에서는 비활성화(next.config.ts 참고)
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
