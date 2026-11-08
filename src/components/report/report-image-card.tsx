import type { ReportData } from "@/lib/report/build";

const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * 공유용 세로 이미지 (1080px 폭, 글자 32px 이상). 화면 밖에 그려 두고 html-to-image 로 PNG 로 만든다.
 * Tailwind 대신 인라인 스타일: 캡처 결과가 환경에 상관없이 같도록
 */
export function ReportImageCard({ d }: { d: ReportData }) {
  const result = d.opponent ? (d.totalA > d.totalB ? "승리" : d.totalA === d.totalB ? "무승부" : "패배") : `A팀 ${d.winsA}승 ${d.draws}무 ${d.lossesA}패`;
  const S = {
    wrap: { position: "fixed" as const, left: -20000, top: 0, width: 1080, padding: 64, background: "#ffffff", color: "#111827", fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", lineHeight: 1.4 },
    h1: { fontSize: 56, fontWeight: 900, margin: 0 },
    sub: { fontSize: 34, color: "#6b7280", margin: "8px 0 0" },
    score: { fontSize: 120, fontWeight: 900, margin: "36px 0 0", letterSpacing: -2 },
    pill: { display: "inline-block", fontSize: 34, fontWeight: 700, background: "#16a34a", color: "#fff", borderRadius: 999, padding: "6px 24px", marginLeft: 16, verticalAlign: "middle" as const },
    section: { marginTop: 40, borderTop: "3px solid #e5e7eb", paddingTop: 28 },
    h2: { fontSize: 36, fontWeight: 800, margin: "0 0 14px" },
    row: { display: "flex", justifyContent: "space-between", fontSize: 34, padding: "6px 0" },
    small: { fontSize: 30, color: "#374151" },
    q: { display: "inline-block", minWidth: 120, fontSize: 32, textAlign: "center" as const, background: "#f3f4f6", borderRadius: 12, padding: "10px 6px", margin: "0 8px 8px 0" },
    foot: { marginTop: 48, fontSize: 28, color: "#9ca3af", textAlign: "center" as const },
  };
  return (
    <div id="report-image-card" style={S.wrap} aria-hidden="true">
      <p style={{ fontSize: 34, fontWeight: 700, color: "#16a34a", margin: 0 }}>⚽ {d.teamName} 경기 결과</p>
      <h1 style={S.h1}>{d.dateLabel}</h1>
      <p style={S.sub}>{d.opponent ? `vs ${d.opponent}` : "자체전"} · {d.venue ?? "장소 미정"} · 참석 {d.attendeeCount}명{d.lateCount ? ` (지각 ${d.lateCount})` : ""}</p>
      {d.quarters.length > 0 && (
        <>
          <p style={S.score}>
            <span style={{ color: "#1e88e5" }}>{d.totalA}</span> : <span style={{ color: "#e53935" }}>{d.totalB}</span>
            <span style={S.pill}>{result}</span>
          </p>
          <div style={{ marginTop: 20 }}>
            {d.quarters.map((q) => <span key={q.n} style={S.q}>Q{q.n}<br /><b>{q.a}:{q.b}</b></span>)}
          </div>
        </>
      )}

      <div style={S.section}>
        <h2 style={S.h2}>오늘의 기록</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
          {[["득점", d.topScorers, "골"], ["도움", d.topAssists, "개"], ["평점", d.topRated, "점"]].map(([title, rows, unit]) => (
            <div key={title as string}>
              <p style={{ fontSize: 30, color: "#6b7280", margin: "0 0 8px", fontWeight: 700 }}>{title as string}</p>
              {(rows as ReportData["topScorers"]).length === 0 ? <p style={{ ...S.small, color: "#9ca3af" }}>—</p> : (rows as ReportData["topScorers"]).map((r, i) => (
                <p key={r.player_id} style={{ ...S.small, margin: "4px 0" }}>{MEDAL[i]} {r.name} <b>{title === "평점" ? r.value.toFixed(1) : r.value}{unit as string}</b></p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {d.mvp && (
        <div style={{ ...S.section, background: "#fffbeb", borderRadius: 20, border: "3px solid #fcd34d", padding: 28 }}>
          <p style={{ fontSize: 32, color: "#92400e", margin: 0, fontWeight: 700 }}>🏆 오늘의 MVP</p>
          <p style={{ fontSize: 60, fontWeight: 900, margin: "4px 0 0" }}>{d.mvp.name} <span style={{ fontSize: 32, fontWeight: 500, color: "#6b7280" }}>{d.mvp.byAdmin ? "대표 선정" : `${d.mvp.votes}표`}</span></p>
        </div>
      )}

      {d.playerLines.length > 0 && (
        <div style={S.section}>
          <h2 style={S.h2}>선수별 코멘트</h2>
          {d.playerLines.slice(0, 16).map((p) => (
            <p key={p.name} style={{ ...S.small, margin: "6px 0", display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span><b>{p.isMvp ? "🏆 " : ""}{p.name}</b>{p.note ? <span style={{ color: "#16a34a" }}> · {p.note}</span> : null}</span>
              <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{p.stats}</span>
            </p>
          ))}
        </div>
      )}
      {d.memo && (
        <div style={{ ...S.section, background: "#f0fdf4", borderRadius: 20, border: "3px solid #86efac", padding: 28 }}>
          <p style={{ fontSize: 30, color: "#166534", margin: "0 0 8px", fontWeight: 700 }}>총평</p>
          <p style={{ fontSize: 32, lineHeight: 1.55, margin: 0 }}>{d.memo}</p>
        </div>
      )}

      {d.comments.length > 0 && (
        <div style={S.section}>
          <h2 style={S.h2}>팀원 피드백</h2>
          {d.comments.slice(0, 8).map((c, i) => <p key={i} style={{ ...S.small, margin: "6px 0" }}>“{c.comment}” <span style={{ color: "#6b7280" }}>— {c.name}</span></p>)}
        </div>
      )}

      {d.narrative.length > 0 && (
        <div style={S.section}>
          <p style={{ fontSize: 32, lineHeight: 1.6, margin: 0 }}>{d.narrative.join(" ")}</p>
        </div>
      )}
      <p style={S.foot}>{d.teamName} 풋살 매니저 · 자동 생성 보고서</p>
    </div>
  );
}
