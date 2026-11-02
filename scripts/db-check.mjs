/**
 * 스키마 검증 스크립트 (pnpm db:check)
 *
 * Supabase 에 올리기 전에, 내 컴퓨터 안에서 PostgreSQL(PGlite, 설치 불필요)을 띄워
 *   1) supabase/migrations/*.sql 을 순서대로 실행
 *   2) supabase/seed.sql 실행
 *   3) 집계 뷰 결과·정합성 규칙·RLS 권한을 확인
 * 한다. 실패하면 종료 코드 1.
 * Supabase 의 auth 스키마(auth.users, auth.uid(), auth.jwt())와 역할은 최소한으로 흉내낸다.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const migDir = join(root, "supabase", "migrations");
const migration = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(join(migDir, f), "utf8")).join("\n");
const seed = readFileSync(join(root, "supabase", "seed.sql"), "utf8");
const db = new PGlite();
let failed = false;

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create role authenticated; create role service_role; create role anon; grant usage on schema auth to authenticated, anon, service_role; grant execute on all functions in schema auth to authenticated, anon, service_role;
`);

console.log("== migration");
await db.exec(migration);
console.log("migration OK");

console.log("== seed");
const res = await db.exec(seed);
console.log(res.at(-1).rows[0]);

const q = async (sql) => (await db.query(sql)).rows;

console.log("== v_player_season_stats");
console.table(await q(`select name, matches_played, quarters_played, rest_quarters, goals, assists, own_goals, avg_rating, attendance_rate, late_count, absent_count, wins, draws, losses from v_player_season_stats order by goals desc, assists desc`));

console.log("== 포지션별 출전");
console.table(await q(`select name, main_position, positions_played::text from v_player_season_stats order by name`));
console.log("== v_match_summary");
console.table(await q(`select match_date, format, status, attendee_count, late_count, game_count, total_goals, team_a_wins, draws, team_b_wins from v_match_summary order by match_date`));

console.log("== 기간 필터 (10월만)");
console.table(await q(`select name, matches_played, goals, assists from fn_player_season_stats('2026-10-01','2026-10-31') order by goals desc limit 5`));

console.log("== 정합성 검증");
const checks = await q(`
  select 'goals=events(scorer, not own)' as rule, count(*) filter (where ok) as ok, count(*) filter (where not ok) as bad from (
    select s.player_id, s.goals = (select count(*) from events e join games g on g.id=e.game_id join matches m on m.id=g.match_id where e.scorer_id=s.player_id and not e.is_own_goal and m.status='done') as ok
    from v_player_season_stats s) x
  union all
  select 'score = events per team', count(*) filter (where ok), count(*) filter (where not ok) from (
    select g.id, g.team_a_score = (select count(*) from events e where e.game_id=g.id and e.team='A') and g.team_b_score = (select count(*) from events e where e.game_id=g.id and e.team='B') as ok from games g) x
  union all
  select 'quarters_played sum = game_players rows', (case when (select sum(quarters_played) from v_player_season_stats) = (select count(*) from game_players) then 1 else 0 end)::bigint, (case when (select sum(quarters_played) from v_player_season_stats) = (select count(*) from game_players) then 0 else 1 end)::bigint
  union all
  select 'rest+played = attended quarters', count(*) filter (where ok), count(*) filter (where not ok) from (
    select s.player_id, s.rest_quarters + s.quarters_played = (select coalesce(sum((select count(*) from games g where g.match_id=a.match_id)),0) from attendance a join matches m on m.id=a.match_id where a.player_id=s.player_id and a.status in ('present','late') and m.status='done') as ok
    from v_player_season_stats s) x
`);
console.table(checks);
if (checks.some((c) => Number(c.bad) > 0)) { console.error("정합성 불일치 있음"); failed = true; }

console.log("== RLS 동작 확인 (authenticated 역할로 전환)");
await db.exec(`set role authenticated;`);
console.log("member read players:", (await q(`select count(*)::int as n from players`))[0]);
try { await db.exec(`insert into players (name) values ('침입자')`); console.log("BAD: member insert allowed"); failed = true; }
catch (e) { console.log("member insert blocked ✔", e.message.split("\n")[0]); }
await db.exec(`select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin"}}', false);`);
console.log("is_admin():", (await q(`select is_admin()`))[0]);
await db.exec(`insert into players (name) values ('테스트선수')`);
console.log("admin insert OK ✔");
// 본인 평점: auth.users 생성 → 선수와 연결 → sub 클레임으로 로그인한 척
await db.exec(`reset role;`);
await db.exec(`insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'me@example.com');
  update players set user_id = '11111111-1111-1111-1111-111111111111' where name = '김민준';`);
const [me, other, target, match] = await Promise.all([
  q(`select id from players where name='김민준'`), q(`select id from players where name='이서준'`),
  q(`select id from players where name='박도윤'`), q(`select id from matches where status='done' order by match_date desc limit 1`)]);
await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{}}', false); select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);`);
console.log("current_player_id:", (await q(`select current_player_id()`))[0]);
await db.exec(`delete from ratings where match_id='${match[0].id}' and rater_id='${me[0].id}' and player_id='${target[0].id}'`);
await db.exec(`insert into ratings (match_id, player_id, rater_id, score) values ('${match[0].id}','${target[0].id}','${me[0].id}', 8.5)`);
console.log("self rating insert OK ✔");
try { await db.exec(`insert into ratings (match_id, player_id, rater_id, score) values ('${match[0].id}','${target[0].id}','${other[0].id}', 8.5)`); console.log("BAD: rating as someone else allowed"); failed = true; }
catch (e) { console.log("rating as someone else blocked ✔", e.message.split("\n")[0]); }
try { await db.exec(`insert into ratings (match_id, player_id, rater_id, score) values ('${match[0].id}','${me[0].id}','${me[0].id}', 9)`); console.log("BAD: self-rating allowed"); failed = true; }
catch (e) { console.log("self-rating blocked ✔", e.message.split("\n")[0]); }
try { await db.exec(`insert into ratings (match_id, player_id, rater_id, score) values ('${match[0].id}','${other[0].id}','${me[0].id}', 7.3)`); console.log("BAD: 0.3 step allowed"); failed = true; }
catch (e) { console.log("non-0.5 step blocked ✔", e.message.split("\n")[0]); }
await db.exec(`reset role;`);
await db.close();
console.log(failed ? "\n❌ 검증 실패" : "\n✅ 스키마·시드·집계·RLS 검증 통과");
process.exit(failed ? 1 : 0);
