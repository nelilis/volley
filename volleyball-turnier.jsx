import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Users,
  CalendarDays,
  Trophy,
  BarChart3,
  Check,
  X,
  Shuffle,
  Loader2,
  Pencil,
  RotateCcw,
} from "lucide-react";

const PALETTE = [
  "#FFB800",
  "#34D9C4",
  "#FF6B6B",
  "#8B7CFF",
  "#4ADE80",
  "#FF9F5A",
  "#5EC8FF",
  "#FF7CD1",
];

const STORAGE_KEY = "volleyball-tournament-data";

const DEFAULT_DATA = {
  name: "Sommer-Cup 2026",
  teams: [],
  matches: [],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function generateRoundRobin(teamIds) {
  let ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push(null);
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  let arr = [...ids];
  const schedule = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) {
        schedule.push({
          id: uid(),
          round: r + 1,
          teamAId: r % 2 === 0 ? a : b,
          teamBId: r % 2 === 0 ? b : a,
          sets: [
            { a: "", b: "" },
            { a: "", b: "" },
            { a: "", b: "" },
          ],
          status: "upcoming",
        });
      }
    }
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }
  return schedule;
}

function countSetWins(sets) {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a === "" || s.b === "") continue;
    const na = Number(s.a);
    const nb = Number(s.b);
    if (Number.isNaN(na) || Number.isNaN(nb) || na === nb) continue;
    if (na > nb) a++;
    else b++;
  }
  return { a, b };
}

function isDecided(sets) {
  const { a, b } = countSetWins(sets);
  return a >= 2 || b >= 2;
}

export default function VolleyballTournament() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("teams");
  const [newTeamName, setNewTeamName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(DEFAULT_DATA.name);
  const [openScoreFor, setOpenScoreFor] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setData(parsed);
          setNameDraft(parsed.name ?? DEFAULT_DATA.name);
        }
      } catch (e) {
        // no saved data yet, keep defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
    } catch (e) {
      console.error("Speichern fehlgeschlagen", e);
    }
  }, []);

  const updateData = useCallback(
    (updater) => {
      setData((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const teamsById = useMemo(() => {
    const map = {};
    data.teams.forEach((t) => (map[t.id] = t));
    return map;
  }, [data.teams]);

  const standings = useMemo(() => {
    const rows = data.teams.map((team) => {
      let played = 0,
        wins = 0,
        losses = 0,
        setsWon = 0,
        setsLost = 0;
      data.matches.forEach((m) => {
        if (m.status !== "completed") return;
        if (m.teamAId !== team.id && m.teamBId !== team.id) return;
        const { a, b } = countSetWins(m.sets);
        const isA = m.teamAId === team.id;
        const mySets = isA ? a : b;
        const oppSets = isA ? b : a;
        played++;
        setsWon += mySets;
        setsLost += oppSets;
        if (mySets > oppSets) wins++;
        else losses++;
      });
      return {
        team,
        played,
        wins,
        losses,
        setsWon,
        setsLost,
        diff: setsWon - setsLost,
        points: wins * 3,
      };
    });
    return rows.sort((r1, r2) => {
      if (r2.points !== r1.points) return r2.points - r1.points;
      if (r2.diff !== r1.diff) return r2.diff - r1.diff;
      if (r2.setsWon !== r1.setsWon) return r2.setsWon - r1.setsWon;
      return r1.team.name.localeCompare(r2.team.name);
    });
  }, [data.teams, data.matches]);

  const upcoming = useMemo(
    () => data.matches.filter((m) => m.status === "upcoming").sort((a, b) => a.round - b.round),
    [data.matches]
  );
  const completed = useMemo(
    () =>
      data.matches
        .filter((m) => m.status === "completed")
        .sort((a, b) => b.round - a.round),
    [data.matches]
  );

  function addTeam(e) {
    e.preventDefault();
    const name = newTeamName.trim();
    if (!name) return;
    const color = PALETTE[data.teams.length % PALETTE.length];
    updateData((prev) => ({
      ...prev,
      teams: [...prev.teams, { id: uid(), name, color }],
    }));
    setNewTeamName("");
  }

  function removeTeam(id) {
    updateData((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== id),
      matches: prev.matches.filter((m) => m.teamAId !== id && m.teamBId !== id),
    }));
  }

  function generateSchedule() {
    if (data.teams.length < 2) return;
    if (
      data.matches.length > 0 &&
      !window.confirm(
        "Es gibt bereits einen Spielplan. Soll er durch einen neuen ersetzt werden? Alle Ergebnisse gehen dabei verloren."
      )
    ) {
      return;
    }
    const schedule = generateRoundRobin(data.teams.map((t) => t.id));
    updateData((prev) => ({ ...prev, matches: schedule }));
    setTab("schedule");
  }

  function updateSet(matchId, index, side, value) {
    if (value !== "" && !/^\d{0,2}$/.test(value)) return;
    updateData((prev) => ({
      ...prev,
      matches: prev.matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              sets: m.sets.map((s, i) => (i === index ? { ...s, [side]: value } : s)),
            }
          : m
      ),
    }));
  }

  function saveResult(matchId) {
    updateData((prev) => ({
      ...prev,
      matches: prev.matches.map((m) =>
        m.id === matchId ? { ...m, status: "completed" } : m
      ),
    }));
    setOpenScoreFor(null);
  }

  function resetResult(matchId) {
    updateData((prev) => ({
      ...prev,
      matches: prev.matches.map((m) =>
        m.id === matchId ? { ...m, status: "upcoming" } : m
      ),
    }));
  }

  function removeMatch(matchId) {
    updateData((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.id !== matchId),
    }));
  }

  function saveName() {
    const trimmed = nameDraft.trim() || DEFAULT_DATA.name;
    updateData((prev) => ({ ...prev, name: trimmed }));
    setEditingName(false);
  }

  const totalMatches = data.matches.length;
  const playedCount = completed.length;

  const TABS = [
    { id: "teams", label: "Teams", icon: Users },
    { id: "schedule", label: "Spielplan", icon: CalendarDays },
    { id: "results", label: "Ergebnisse", icon: Trophy },
    { id: "standings", label: "Tabelle", icon: BarChart3 },
  ];

  if (!loaded) {
    return (
      <div className="vt-root vt-loading">
        <style>{CSS}</style>
        <Loader2 className="vt-spin" size={28} />
        <span>Turnier wird geladen…</span>
      </div>
    );
  }

  return (
    <div className="vt-root">
      <style>{CSS}</style>

      <header className="vt-hero">
        <div className="vt-hero-lines" aria-hidden="true">
          <svg viewBox="0 0 800 200" preserveAspectRatio="none">
            <line x1="0" y1="20" x2="800" y2="20" />
            <line x1="0" y1="180" x2="800" y2="180" />
            <line x1="400" y1="0" x2="400" y2="200" />
            <circle cx="400" cy="100" r="60" />
          </svg>
        </div>
        <div className="vt-hero-inner">
          <span className="vt-eyebrow">Turnierleitung</span>
          {editingName ? (
            <form
              className="vt-name-edit"
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={60}
              />
              <button type="submit" className="vt-icon-btn vt-icon-btn-gold" aria-label="Speichern">
                <Check size={18} />
              </button>
              <button
                type="button"
                className="vt-icon-btn"
                aria-label="Abbrechen"
                onClick={() => {
                  setNameDraft(data.name);
                  setEditingName(false);
                }}
              >
                <X size={18} />
              </button>
            </form>
          ) : (
            <h1 onClick={() => setEditingName(true)} title="Namen bearbeiten">
              {data.name}
              <Pencil size={18} className="vt-pencil" />
            </h1>
          )}
          <div className="vt-stats">
            <div className="vt-stat">
              <strong>{data.teams.length}</strong>
              <span>Teams</span>
            </div>
            <div className="vt-stat-divider" />
            <div className="vt-stat">
              <strong>
                {playedCount}/{totalMatches}
              </strong>
              <span>Spiele gespielt</span>
            </div>
            <div className="vt-stat-divider" />
            <div className="vt-stat">
              <strong>{upcoming.length}</strong>
              <span>Ausstehend</span>
            </div>
          </div>
        </div>
      </header>

      <nav className="vt-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={"vt-tab" + (tab === id ? " vt-tab-active" : "")}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      <main className="vt-main">
        {tab === "teams" && (
          <section>
            <form className="vt-add-team" onSubmit={addTeam}>
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Teamname eingeben…"
                maxLength={40}
              />
              <button type="submit" className="vt-btn vt-btn-gold">
                <Plus size={16} />
                Team hinzufügen
              </button>
            </form>

            {data.teams.length === 0 ? (
              <EmptyState
                title="Noch keine Teams"
                text="Füge dein erstes Team hinzu, um mit der Turnierplanung zu beginnen."
              />
            ) : (
              <div className="vt-team-grid">
                {data.teams.map((team) => {
                  const row = standings.find((s) => s.team.id === team.id);
                  return (
                    <div key={team.id} className="vt-team-card">
                      <span className="vt-dot" style={{ background: team.color }} />
                      <div className="vt-team-info">
                        <span className="vt-team-name">{team.name}</span>
                        <span className="vt-team-sub">
                          {row ? `${row.wins}S · ${row.losses}N` : "0S · 0N"}
                        </span>
                      </div>
                      <button
                        className="vt-icon-btn vt-icon-btn-danger"
                        aria-label={`${team.name} entfernen`}
                        onClick={() => removeTeam(team.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="vt-generate-row">
              <button
                className="vt-btn vt-btn-outline"
                onClick={generateSchedule}
                disabled={data.teams.length < 2}
              >
                <Shuffle size={16} />
                Spielplan erstellen
              </button>
              {data.teams.length < 2 && (
                <span className="vt-hint">Mindestens 2 Teams nötig</span>
              )}
            </div>
          </section>
        )}

        {tab === "schedule" && (
          <section>
            {upcoming.length === 0 ? (
              <EmptyState
                title="Noch keine Spiele geplant"
                text="Erstelle unter „Teams“ einen Spielplan, sobald alle Mannschaften eingetragen sind."
              />
            ) : (
              groupByRound(upcoming).map(([round, matches]) => (
                <div key={round} className="vt-round-group">
                  <div className="vt-round-label">
                    <span>Spieltag {round}</span>
                    <div className="vt-net-line" />
                  </div>
                  <div className="vt-match-list">
                    {matches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        teamA={teamsById[m.teamAId]}
                        teamB={teamsById[m.teamBId]}
                        open={openScoreFor === m.id}
                        onToggle={() =>
                          setOpenScoreFor(openScoreFor === m.id ? null : m.id)
                        }
                        onSetChange={updateSet}
                        onSave={() => saveResult(m.id)}
                        onRemove={() => removeMatch(m.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {tab === "results" && (
          <section>
            {completed.length === 0 ? (
              <EmptyState
                title="Noch keine Ergebnisse"
                text="Trage im Spielplan die Satzergebnisse ein, sobald ein Spiel entschieden ist."
              />
            ) : (
              <div className="vt-result-list">
                {completed.map((m) => {
                  const teamA = teamsById[m.teamAId];
                  const teamB = teamsById[m.teamBId];
                  const { a, b } = countSetWins(m.sets);
                  const aWon = a > b;
                  return (
                    <div key={m.id} className="vt-result-card">
                      <div className="vt-result-top">
                        <span className="vt-round-chip">Spieltag {m.round}</span>
                        <button
                          className="vt-icon-btn"
                          aria-label="Ergebnis zurücksetzen"
                          title="Ergebnis zurücksetzen"
                          onClick={() => resetResult(m.id)}
                        >
                          <RotateCcw size={15} />
                        </button>
                      </div>
                      <div className="vt-result-teams">
                        <div className={"vt-result-team" + (aWon ? " vt-result-winner" : "")}>
                          <span className="vt-dot" style={{ background: teamA?.color }} />
                          {teamA?.name ?? "—"}
                        </div>
                        <div className="vt-result-score">
                          {a} : {b}
                        </div>
                        <div className={"vt-result-team" + (!aWon ? " vt-result-winner" : "")}>
                          <span className="vt-dot" style={{ background: teamB?.color }} />
                          {teamB?.name ?? "—"}
                        </div>
                      </div>
                      <div className="vt-set-breakdown">
                        {m.sets
                          .filter((s) => s.a !== "" && s.b !== "")
                          .map((s, i) => (
                            <span key={i}>
                              {s.a}:{s.b}
                            </span>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "standings" && (
          <section>
            {data.teams.length === 0 ? (
              <EmptyState
                title="Noch keine Tabelle"
                text="Sobald Teams und Ergebnisse vorliegen, erscheint hier die Rangliste."
              />
            ) : (
              <div className="vt-table-wrap">
                <table className="vt-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>Sp</th>
                      <th>S</th>
                      <th>N</th>
                      <th>Sätze</th>
                      <th>Diff</th>
                      <th>Pkt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, i) => (
                      <tr key={row.team.id} className={i === 0 ? "vt-row-leader" : ""}>
                        <td>{i + 1}</td>
                        <td>
                          <span className="vt-dot" style={{ background: row.team.color }} />
                          {row.team.name}
                        </td>
                        <td>{row.played}</td>
                        <td>{row.wins}</td>
                        <td>{row.losses}</td>
                        <td>
                          {row.setsWon}:{row.setsLost}
                        </td>
                        <td>{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                        <td className="vt-points">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="vt-footer">
        <button
          className="vt-link-danger"
          onClick={() => {
            if (window.confirm("Das gesamte Turnier wirklich zurücksetzen? Das kann nicht rückgängig gemacht werden.")) {
              updateData(DEFAULT_DATA);
              setNameDraft(DEFAULT_DATA.name);
            }
          }}
        >
          Turnier zurücksetzen
        </button>
      </footer>
    </div>
  );
}

function groupByRound(matches) {
  const map = new Map();
  matches.forEach((m) => {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round).push(m);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function EmptyState({ title, text }) {
  return (
    <div className="vt-empty">
      <div className="vt-empty-ball" />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function MatchCard({ match, teamA, teamB, open, onToggle, onSetChange, onSave, onRemove }) {
  const decided = isDecided(match.sets);
  return (
    <div className="vt-match-card">
      <div className="vt-match-top" onClick={onToggle}>
        <div className="vt-match-team">
          <span className="vt-dot" style={{ background: teamA?.color }} />
          {teamA?.name ?? "—"}
        </div>
        <div className="vt-match-vs">vs</div>
        <div className="vt-match-team vt-match-team-right">
          {teamB?.name ?? "—"}
          <span className="vt-dot" style={{ background: teamB?.color }} />
        </div>
        <button
          className="vt-icon-btn vt-icon-btn-danger vt-match-remove"
          aria-label="Spiel entfernen"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="vt-score-entry">
          {match.sets.map((s, i) => (
            <div className="vt-set-row" key={i}>
              <span className="vt-set-label">Satz {i + 1}</span>
              <input
                type="text"
                inputMode="numeric"
                value={s.a}
                onChange={(e) => onSetChange(match.id, i, "a", e.target.value)}
                placeholder="0"
              />
              <span className="vt-set-sep">:</span>
              <input
                type="text"
                inputMode="numeric"
                value={s.b}
                onChange={(e) => onSetChange(match.id, i, "b", e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
          <button className="vt-btn vt-btn-gold vt-save-btn" disabled={!decided} onClick={onSave}>
            <Check size={16} />
            Ergebnis speichern
          </button>
          {!decided && <p className="vt-hint">Ein Team braucht 2 Satzgewinne.</p>}
        </div>
      )}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

.vt-root {
  --bg: #0B1220;
  --surface: #141D30;
  --surface-2: #1B2540;
  --surface-3: #232F4F;
  --border: rgba(244,246,251,0.08);
  --gold: #FFB800;
  --gold-soft: rgba(255,184,0,0.14);
  --text: #F4F6FB;
  --muted: #8A96AE;
  --success: #2FD680;
  --danger: #FF5470;
  --net: rgba(244,246,251,0.22);

  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  min-height: 100%;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-sizing: border-box;
}
.vt-root * { box-sizing: border-box; }

.vt-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 320px;
  color: var(--muted);
  font-size: 14px;
}
.vt-spin { animation: vt-spin 1s linear infinite; color: var(--gold); }
@keyframes vt-spin { to { transform: rotate(360deg); } }

.vt-hero {
  position: relative;
  padding: 34px 24px 26px;
  background: linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.vt-hero-lines {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  pointer-events: none;
}
.vt-hero-lines svg { width: 100%; height: 100%; }
.vt-hero-lines line, .vt-hero-lines circle {
  stroke: rgba(244,246,251,0.08);
  stroke-width: 1.5;
  fill: none;
}
.vt-hero-inner { position: relative; max-width: 760px; margin: 0 auto; }
.vt-eyebrow {
  font-family: 'Oswald', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 11px;
  color: var(--gold);
  font-weight: 600;
}
.vt-hero h1 {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  font-size: clamp(26px, 5vw, 40px);
  margin: 6px 0 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.vt-pencil { color: var(--muted); opacity: 0.6; }
.vt-name-edit {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 20px;
}
.vt-name-edit input {
  font-family: 'Oswald', sans-serif;
  font-size: 24px;
  font-weight: 700;
  text-transform: uppercase;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 6px;
  width: min(100%, 420px);
}
.vt-stats { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.vt-stat { display: flex; flex-direction: column; }
.vt-stat strong {
  font-family: 'Space Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  color: var(--gold);
}
.vt-stat span { font-size: 12px; color: var(--muted); }
.vt-stat-divider { width: 1px; height: 28px; background: var(--border); }

.vt-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 16px;
  overflow-x: auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.vt-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.vt-tab:hover { background: var(--surface-2); color: var(--text); }
.vt-tab-active { background: var(--gold-soft); color: var(--gold); }

.vt-main { padding: 22px 20px 8px; max-width: 760px; margin: 0 auto; }

.vt-add-team {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.vt-add-team input {
  flex: 1;
  min-width: 180px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
}
.vt-add-team input:focus, .vt-name-edit input:focus { outline: 2px solid var(--gold); outline-offset: 1px; }

.vt-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.vt-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.vt-btn-gold { background: var(--gold); color: #1A1400; }
.vt-btn-gold:hover:not(:disabled) { filter: brightness(1.08); }
.vt-btn-outline { background: transparent; border-color: var(--border); color: var(--text); }
.vt-btn-outline:hover:not(:disabled) { border-color: var(--gold); color: var(--gold); }

.vt-generate-row { display: flex; align-items: center; gap: 10px; margin: 20px 0 8px; flex-wrap: wrap; }
.vt-hint { font-size: 12px; color: var(--muted); }

.vt-team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.vt-team-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 12px;
}
.vt-team-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.vt-team-name { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vt-team-sub { font-size: 11px; color: var(--muted); font-family: 'Space Mono', monospace; }

.vt-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

.vt-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
}
.vt-icon-btn:hover { color: var(--text); border-color: var(--gold); }
.vt-icon-btn-gold { color: var(--gold); border-color: var(--gold); }
.vt-icon-btn-danger:hover { color: var(--danger); border-color: var(--danger); }

.vt-empty {
  text-align: center;
  padding: 46px 20px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--muted);
}
.vt-empty-ball {
  width: 34px;
  height: 34px;
  margin: 0 auto 14px;
  border-radius: 50%;
  border: 2px solid var(--gold);
  background:
    radial-gradient(circle at 35% 35%, transparent 40%, var(--gold) 41%, var(--gold) 44%, transparent 45%),
    transparent;
  opacity: 0.8;
}
.vt-empty h3 { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 16px; color: var(--text); margin: 0 0 6px; }
.vt-empty p { font-size: 13px; margin: 0; max-width: 360px; margin-inline: auto; }

.vt-round-group { margin-bottom: 22px; }
.vt-round-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.vt-round-label span {
  font-family: 'Oswald', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.vt-net-line {
  flex: 1;
  height: 6px;
  background-image: repeating-linear-gradient(90deg, var(--net) 0 2px, transparent 2px 8px);
}

.vt-match-list { display: flex; flex-direction: column; gap: 10px; }
.vt-match-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.vt-match-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 14px;
  cursor: pointer;
}
.vt-match-team { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; min-width: 0; }
.vt-match-team-right { justify-content: flex-end; text-align: right; }
.vt-match-vs {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
}
.vt-match-remove { width: 26px; height: 26px; }

.vt-score-entry {
  padding: 6px 14px 16px;
  border-top: 1px dashed var(--border);
}
.vt-set-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.vt-set-label { font-size: 12px; color: var(--muted); width: 56px; flex-shrink: 0; }
.vt-set-row input {
  width: 46px;
  text-align: center;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 4px;
  font-family: 'Space Mono', monospace;
  font-size: 14px;
}
.vt-set-row input:focus { outline: 2px solid var(--gold); outline-offset: 1px; }
.vt-set-sep { color: var(--muted); }
.vt-save-btn { margin-top: 8px; width: 100%; justify-content: center; }

.vt-result-list { display: flex; flex-direction: column; gap: 10px; }
.vt-result-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--gold);
  border-radius: 10px;
  padding: 14px;
}
.vt-result-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.vt-round-chip {
  font-size: 11px;
  color: var(--muted);
  font-family: 'Space Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.vt-result-teams {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}
.vt-result-team { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--muted); min-width: 0; }
.vt-result-teams .vt-result-team:last-child { justify-content: flex-end; text-align: right; }
.vt-result-winner { color: var(--text); }
.vt-result-score {
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 22px;
  color: var(--gold);
  padding: 0 6px;
}
.vt-set-breakdown {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  color: var(--muted);
}

.vt-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
.vt-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 480px; }
.vt-table thead th {
  text-align: left;
  font-family: 'Oswald', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 11px;
  color: var(--muted);
  background: var(--surface-2);
  padding: 10px 12px;
  white-space: nowrap;
}
.vt-table tbody td {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  font-family: 'Space Mono', monospace;
  white-space: nowrap;
}
.vt-table tbody td:nth-child(2) {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: normal;
}
.vt-row-leader { background: var(--gold-soft); }
.vt-points { color: var(--gold); font-weight: 700; }

.vt-footer { text-align: center; padding: 24px 20px 32px; }
.vt-link-danger {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}
.vt-link-danger:hover { color: var(--danger); }

@media (max-width: 480px) {
  .vt-match-top { grid-template-columns: 1fr auto 1fr; }
  .vt-match-remove { grid-column: 1 / -1; justify-self: end; margin-top: 4px; }
  .vt-hero { padding: 26px 16px 20px; }
  .vt-main { padding: 18px 14px 8px; }
}
`;
