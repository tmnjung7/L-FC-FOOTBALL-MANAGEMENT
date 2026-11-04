"use client";

/** 루트 레이아웃까지 깨졌을 때의 최후 화면 (스타일 없이도 동작해야 하므로 인라인) */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 18 }}>앱을 여는 중 오류가 났습니다</h1>
        <pre style={{ background: "#f3f4f6", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", textAlign: "left", fontSize: 12 }}>
          {error.message}{error.digest ? `\n[digest: ${error.digest}]` : ""}
        </pre>
        <button onClick={() => reset()} style={{ height: 44, padding: "0 16px", marginRight: 8 }}>다시 시도</button>
        <button
          onClick={async () => {
            try {
              const regs = await navigator.serviceWorker?.getRegistrations();
              await Promise.all((regs ?? []).map((r) => r.unregister()));
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            } catch {}
            location.reload();
          }}
          style={{ height: 44, padding: "0 16px" }}
        >
          캐시 비우고 새로 열기
        </button>
      </body>
    </html>
  );
}
