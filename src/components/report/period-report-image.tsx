import { METRICS, type Metric } from "@/components/stats/ranking";
import type { PeriodReportData } from "@/lib/report/period-text";

const MEDAL = ["🥇", "🥈", "🥉"];
const SHOW: Metric[] = ["goals", "assists", "rating", "attendance", "gk", "late"];

/** 결산 공유 이미지 (1080px, 인라인 스타일) */
export function PeriodReportImage({ d }: { d: PeriodReportData }) {
  const { stats: s, tops } = d;
  const ext = s.totals.externalWins + s.totals.externalDraws + s.totals.externalLosses;
  const S = {
    wrap: { position: "fixed" as const, left: -20000, top: 0, width: 1080, padding: 64, background: "#fff", color: "#111827", fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", lineHeight: 1.4 },
    h1: { fontSize: 56, fontWeight: 900, margin: 0 },
    sub: { fontSize: 32, color: "#6b7280", margin: "8px 0 0" },
    big: { fontSize: 64, fontWeight: 900, margin: 0 },
    section: { marginTop: 36, borderTop: "3px solid #e5e7eb", paddingTop: 24 },
    h2: { fontSize: 36, fontWeight: 800, margin: "0 0 12px" },
    small: { fontSize: 30, color: "#374151", margin: "4px 0" },
  };
  return (
    <div id="period-report-image" style={S.wrap} aria-hidden="true">
      <p style={{ fontSize: 34, fontWeight: 700, color: "#16a34a", margin: 0 }}>📊 {d.teamName} 결산</p>
      <h1 style={S.h1}>{d.ai?.headline ?? `${d.period.label} 결산`}</h1>
      <p style={S.sub}>{d.period.label} · 모임 {s.matchCount}회 · {s.totals.games}쿼터 · 평균 참석 {s.totals.avgAttendees}명</p>
      {ext > 0 && <p style={{ ...S.big, marginTop: 24 }}>{s.totals.externalWins}승 {s.totals.externalDraws}무 {s.totals.externalLosses}패 <span style={{ fontSize: 34, color: "#6b7280", fontWeight: 500 }}>({s.totals.goalsFor}:{s.totals.goalsAgainst})</span></p>}
      <div style={S.section}>
        <h2 style={S.h2}>기간 랭킹</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {SHOW.map((m) => {
            const meta = METRICS.find((x) => x.key === m)!;
            return (
              <div key={m}>
                <p style={{ fontSize: 30, color: "#6b7280", margin: "0 0 6px", fontWeight: 700 }}>{meta.label}</p>
                {tops[m].length === 0 ? <p style={{ ...S.small, color: "#9ca3af" }}>—</p> : tops[m].map((r) => (
                  <p key={r.name} style={S.small}>{MEDAL[r.rank - 1] ?? r.rank} {r.name} <b>{m === "rating" ? r.value.toFixed(2) : m === "attendance" ? r.value.toFixed(0) : r.value}{meta.unit}</b></p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {s.opponents.length > 0 && (
        <div style={S.section}>
          <h2 style={S.h2}>상대팀별 전적</h2>
          {s.opponents.slice(0, 8).map((o) => <p key={o.opponent} style={{ ...S.small, display: "flex", justifyContent: "space-between" }}><span>{o.opponent}</span><b>{o.wins}승 {o.draws}무 {o.losses}패 ({o.gf}:{o.ga})</b></p>)}
        </div>
      )}
      <div style={S.section}>
        <p style={{ fontSize: 32, lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{d.ai?.summary ?? d.narrative.join(" ")}</p>
        {d.ai?.highlights?.length ? d.ai.highlights.map((h, i) => <p key={i} style={{ ...S.small, margin: "10px 0 0" }}>• {h}</p>) : null}
        {d.ai?.nextFocus && <p style={{ fontSize: 30, margin: "16px 0 0", color: "#166534" }}>▶ 다음 목표: {d.ai.nextFocus}</p>}
      </div>
      <p style={{ marginTop: 44, fontSize: 28, color: "#9ca3af", textAlign: "center" }}>{d.teamName} 풋살 매니저 · 자동 생성 결산</p>
    </div>
  );
}
