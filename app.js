const STORAGE_KEY = 'volleyball-turnier-v1';
const TEAM_COUNT = 10;

const defaultState = () => ({
  teams: Array.from({ length: TEAM_COUNT }, (_, i) => `Team ${i + 1}`),
  gamesPerTeam: 3,
  matches: [],
});

let state = loadState();

const teamGrid = document.getElementById('teamGrid');
const gamesPerTeam = document.getElementById('gamesPerTeam');
const modeBadge = document.getElementById('modeBadge');
const scheduleRounds = document.getElementById('scheduleRounds');
const scheduleEmpty = document.getElementById('scheduleEmpty');
const standingsBody = document.getElementById('standingsBody');
const progressText = document.getElementById('progressText');
const topFour = document.getElementById('topFour');
const bottomTwo = document.getElementById('bottomTwo');
const toast = document.getElementById('toast');

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.teams) || saved.teams.length !== TEAM_COUNT) return defaultState();
    return {
      teams: saved.teams,
      gamesPerTeam: Number(saved.gamesPerTeam) || 3,
      matches: Array.isArray(saved.matches) ? saved.matches : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cleanTeamName(name, i) {
  return String(name || '').trim() || `Team ${i + 1}`;
}

function renderTeamInputs() {
  teamGrid.innerHTML = '';
  state.teams.forEach((team, i) => {
    const wrap = document.createElement('label');
    wrap.className = 'team-input-wrap';
    wrap.innerHTML = `
      <span class="team-number">${i + 1}</span>
      <input class="team-input" maxlength="40" value="${escapeHtml(team)}" aria-label="Team ${i + 1}" data-team-index="${i}" />
    `;
    teamGrid.appendChild(wrap);
  });

  teamGrid.querySelectorAll('.team-input').forEach(input => {
    input.addEventListener('input', e => {
      const i = Number(e.target.dataset.teamIndex);
      state.teams[i] = e.target.value;
      saveState();
      renderStandings();
      renderSchedule();
    });
    input.addEventListener('blur', e => {
      const i = Number(e.target.dataset.teamIndex);
      state.teams[i] = cleanTeamName(e.target.value, i);
      e.target.value = state.teams[i];
      saveState();
      renderSchedule();
      renderStandings();
    });
  });
}

function generateRoundRobinRounds(teamCount) {
  const ids = Array.from({ length: teamCount }, (_, i) => i);
  const rounds = [];
  let rotation = [...ids];

  for (let round = 0; round < teamCount - 1; round++) {
    const pairings = [];
    for (let i = 0; i < teamCount / 2; i++) {
      let home = rotation[i];
      let away = rotation[teamCount - 1 - i];
      if (round % 2 === 1 && i === 0) [home, away] = [away, home];
      pairings.push({ home, away });
    }
    rounds.push(pairings);
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }
  return rounds;
}

function createSchedule() {
  state.teams = state.teams.map(cleanTeamName);
  const rounds = generateRoundRobinRounds(TEAM_COUNT).slice(0, state.gamesPerTeam);
  state.matches = rounds.flatMap((pairings, roundIndex) =>
    pairings.map((pair, gameIndex) => ({
      id: `r${roundIndex + 1}g${gameIndex + 1}`,
      round: roundIndex + 1,
      home: pair.home,
      away: pair.away,
      homeScore: '',
      awayScore: '',
    }))
  );
  saveState();
  renderAll();
  switchTab('schedule');
  showToast(`Spielplan erstellt: ${state.matches.length} Spiele`);
}

function validScore(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function matchStatus(match) {
  const h = validScore(match.homeScore);
  const a = validScore(match.awayScore);
  if (h === null || a === null) return 'open';
  if (h === a) return 'invalid';
  return 'complete';
}

function renderSchedule() {
  const hasMatches = state.matches.length > 0;
  scheduleEmpty.style.display = hasMatches ? 'none' : 'block';
  scheduleRounds.innerHTML = '';

  if (!hasMatches) {
    progressText.textContent = `0 / ${state.gamesPerTeam * 5} gespielt`;
    return;
  }

  const byRound = new Map();
  state.matches.forEach(match => {
    if (!byRound.has(match.round)) byRound.set(match.round, []);
    byRound.get(match.round).push(match);
  });

  for (const [round, matches] of byRound.entries()) {
    const section = document.createElement('section');
    section.className = 'round';
    section.innerHTML = `<h3 class="round-title">Runde ${round}</h3><div class="match-list"></div>`;
    const list = section.querySelector('.match-list');

    matches.forEach((match, index) => {
      const status = matchStatus(match);
      const card = document.createElement('div');
      card.className = `match-card ${status === 'invalid' ? 'invalid' : ''} ${status === 'complete' ? 'complete' : ''}`;
      card.innerHTML = `
        <span class="match-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="team-home">${escapeHtml(cleanTeamName(state.teams[match.home], match.home))}</span>
        <input class="score-input" type="number" min="0" step="1" inputmode="numeric" aria-label="Punkte Heimteam" value="${match.homeScore}" data-match="${match.id}" data-side="home" />
        <span class="score-separator">:</span>
        <input class="score-input" type="number" min="0" step="1" inputmode="numeric" aria-label="Punkte Auswärtsteam" value="${match.awayScore}" data-match="${match.id}" data-side="away" />
        <span class="team-away">${escapeHtml(cleanTeamName(state.teams[match.away], match.away))}</span>
        <span class="match-state">${status === 'complete' ? 'gewertet' : status === 'invalid' ? 'kein Remis' : 'offen'}</span>
      `;
      list.appendChild(card);
    });
    scheduleRounds.appendChild(section);
  }

  scheduleRounds.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', e => {
      const match = state.matches.find(m => m.id === e.target.dataset.match);
      if (!match) return;
      const value = e.target.value;
      if (e.target.dataset.side === 'home') match.homeScore = value;
      else match.awayScore = value;
      saveState();
      renderSchedule();
      renderStandings();
    });
  });

  const completed = state.matches.filter(m => matchStatus(m) === 'complete').length;
  progressText.textContent = `${completed} / ${state.matches.length} gespielt`;
}

function calculateStandings() {
  const rows = state.teams.map((name, id) => ({
    id,
    name: cleanTeamName(name, id),
    played: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0,
  }));

  state.matches.forEach(match => {
    if (matchStatus(match) !== 'complete') return;
    const h = Number(match.homeScore);
    const a = Number(match.awayScore);
    const home = rows[match.home];
    const away = rows[match.away];

    home.played += 1;
    away.played += 1;
    home.pointsFor += h;
    home.pointsAgainst += a;
    away.pointsFor += a;
    away.pointsAgainst += h;

    if (h > a) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
  });

  rows.forEach(r => { r.diff = r.pointsFor - r.pointsAgainst; });

  return rows.sort((a, b) =>
    b.wins - a.wins ||
    b.diff - a.diff ||
    b.pointsFor - a.pointsFor ||
    a.name.localeCompare(b.name, 'de')
  );
}

function renderStandings() {
  const rows = calculateStandings();
  standingsBody.innerHTML = '';

  rows.forEach((row, index) => {
    const rank = index + 1;
    const isTop = rank <= 4;
    const isBottom = rank > TEAM_COUNT - 2;
    const tr = document.createElement('tr');
    tr.className = isTop ? 'rank-top' : isBottom ? 'rank-bottom' : '';
    tr.innerHTML = `
      <td class="rank">${rank}</td>
      <td class="team-cell">${escapeHtml(row.name)}</td>
      <td>${row.played}</td>
      <td>${row.wins}</td>
      <td>${row.losses}</td>
      <td>${row.pointsFor}</td>
      <td>${row.pointsAgainst}</td>
      <td>${row.diff > 0 ? '+' : ''}${row.diff}</td>
      <td><span class="status-pill ${isTop ? 'status-top' : isBottom ? 'status-bottom' : 'status-middle'}">${isTop ? 'Top 4' : isBottom ? 'Bottom 2' : 'Mittelfeld'}</span></td>
    `;
    standingsBody.appendChild(tr);
  });

  topFour.innerHTML = rows.slice(0, 4).map((r, i) => `<span class="qual-team">${i + 1}. ${escapeHtml(r.name)}</span>`).join('');
  bottomTwo.innerHTML = rows.slice(-2).map((r, i) => `<span class="qual-team">${TEAM_COUNT - 1 + i}. ${escapeHtml(r.name)}</span>`).join('');
}

function renderModeInfo() {
  gamesPerTeam.value = String(state.gamesPerTeam);
  modeBadge.textContent = `${state.gamesPerTeam} ${state.gamesPerTeam === 1 ? 'Spiel' : 'Spiele'} / Team`;
  const helper = document.querySelector('.helper');
  helper.textContent = `Es entstehen ${state.gamesPerTeam} ${state.gamesPerTeam === 1 ? 'Runde' : 'Runden'} mit je 5 Spielen, also ${state.gamesPerTeam * 5} Vorrundenspiele insgesamt.`;
}

function renderAll() {
  renderTeamInputs();
  renderModeInfo();
  renderSchedule();
  renderStandings();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tabName}`));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.go)));

gamesPerTeam.addEventListener('change', e => {
  const nextValue = Number(e.target.value);
  if (state.matches.length && nextValue !== state.gamesPerTeam) {
    const ok = window.confirm('Beim Ändern des Modus wird der bestehende Spielplan inklusive Ergebnisse gelöscht. Fortfahren?');
    if (!ok) {
      gamesPerTeam.value = String(state.gamesPerTeam);
      return;
    }
    state.matches = [];
  }
  state.gamesPerTeam = nextValue;
  saveState();
  renderAll();
});

document.getElementById('createScheduleBtn').addEventListener('click', () => {
  if (state.matches.length) {
    const ok = window.confirm('Der Spielplan wird neu erstellt. Vorhandene Ergebnisse werden gelöscht. Fortfahren?');
    if (!ok) return;
  }
  createSchedule();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  const ok = window.confirm('Das gesamte Turnier inklusive Teamnamen und Ergebnissen zurücksetzen?');
  if (!ok) return;
  state = defaultState();
  saveState();
  renderAll();
  switchTab('teams');
  showToast('Turnier zurückgesetzt');
});

renderAll();
