export const categories = ['FG%', 'FT%', '3PM', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV'];
export const statKeys = ['pts', 'reb', 'ast', 'stl', 'blk', 'three', 'fgm', 'fga', 'ftm', 'fta', 'tov'];
export const defaultTeam = "Josiah’s Tip Chop Team";
export const emptyStats = () => Object.fromEntries(statKeys.map(k => [k, null]));
export function validateStats(stats, context = 'Player') {
  for (const key of statKeys) {
    const n = stats[key];
    if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0)) throw new Error(context + ': stats must be nonnegative numbers or left blank.');
  }
  for (const [made, attempts] of [['fgm', 'fga'], ['ftm', 'fta']]) {
    if (stats[made] !== null && stats[attempts] !== null && stats[made] > stats[attempts]) throw new Error(context + ': makes cannot exceed attempts.');
  }
  if (stats.three !== null && stats.fgm !== null && stats.three > stats.fgm) throw new Error(context + ': 3PM cannot exceed FGM.');
  return stats;
}
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(s => s.trim());
  if (!lines.length) throw new Error('Add at least one player first.');
  if (lines.length > 100) throw new Error('Import at most 100 players at a time.');
  const rows = lines.map(line => {
    const parts = []; let current = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (quoted && line[i + 1] === '"') { current += '"'; i++; } else quoted = !quoted; }
      else if (line[i] === ',' && !quoted) { parts.push(current.trim()); current = ''; }
      else current += line[i];
    }
    if (quoted) throw new Error('Close the quotation marks around each player name.');
    parts.push(current.trim()); return parts;
  });
  if (rows[0][0].toLowerCase() === 'name') rows.shift();
  if (!rows.length) throw new Error('Add player rows below the header.');
  return rows.map((parts, i) => {
    if (!parts[0] || parts[0].length > 100 || (parts.length !== 1 && parts.length !== 12)) throw new Error('Row ' + (i + 1) + ': use a name alone or a name and all 11 stat columns.');
    const stats = emptyStats();
    if (parts.length === 12) statKeys.forEach((key, j) => {
      const value = parts[j + 1];
      if (value !== '' && !/^\d+(?:\.\d+)?$/.test(value)) throw new Error('Row ' + (i + 1) + ': use nonnegative numbers; leave unknown stats blank.');
      stats[key] = value === '' ? null : Number(value);
    });
    validateStats(stats, parts[0]);
    return { id: crypto.randomUUID(), name: parts[0], position: '', status: 'Active', games: 3, stats, source: 'manual' };
  });
}
export function totals(players, { weekly = false, activeOnly = false } = {}) {
  const selected = players.filter(p => !activeOnly || !['IL', 'IL+', 'O', 'INJ', 'IR'].includes(p.status));
  const t = Object.fromEntries(statKeys.map(k => [k, 0]));
  const missing = Object.fromEntries(statKeys.map(k => [k, false]));
  for (const p of selected) {
    const weight = weekly ? Number(p.games ?? 0) : 1;
    if (weight === 0) continue;
    for (const key of statKeys) {
      if (p.stats[key] === null || p.stats[key] === undefined) missing[key] = true;
      else t[key] += p.stats[key] * weight;
    }
  }
  const val = k => selected.length && !missing[k] ? t[k] : null;
  const ratio = (m, a) => val(m) !== null && val(a) > 0 ? t[m] / t[a] : null;
  return { 'FG%': ratio('fgm', 'fga'), 'FT%': ratio('ftm', 'fta'), '3PM': val('three'), PTS: val('pts'), REB: val('reb'), AST: val('ast'), STL: val('stl'), BLK: val('blk'), TOV: val('tov') };
}
export function compareCategory(a, b, cat) {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return 'unknown';
  if (Math.abs(a - b) < 1e-9) return 'tie';
  return (cat === 'TOV' ? a < b : a > b) ? 'win' : 'loss';
}
export function scoreMatchup(mine, theirs, punts = []) {
  const rows = categories.map(cat => ({ cat, mine: mine[cat], theirs: theirs[cat], result: compareCategory(mine[cat], theirs[cat], cat), punted: punts.includes(cat) }));
  const score = { wins: 0, losses: 0, ties: 0, unknown: 0 };
  for (const r of rows) score[{win:'wins', loss:'losses', tie:'ties', unknown:'unknown'}[r.result]]++;
  return { ...score, rows };
}
export function tradeImpact(roster, outgoingIds, incoming) {
  const outgoing = roster.filter(p => outgoingIds.includes(p.id));
  const before = totals(roster), after = totals([...roster.filter(p => !outgoingIds.includes(p.id)), ...incoming]);
  return { before, after, outgoing, incoming, slotChange: incoming.length - outgoing.length, rows: categories.map(cat => ({ cat, before: before[cat], after: after[cat], delta: before[cat] === null || after[cat] === null ? null : after[cat] - before[cat], result: compareCategory(after[cat], before[cat], cat) })) };
}
export function formatStat(n, cat, signed = false) {
  if (n === null || !Number.isFinite(n)) return '—';
  const sign = signed && n > 0 ? '+' : '';
  if (cat.endsWith('%')) return sign + (n * 100).toFixed(1) + (signed ? ' pp' : '%');
  return sign + n.toLocaleString('en-US', {maximumFractionDigits: 2});
}
export function validateWorkspace(data) {
  if (!data || data.version !== 2 || !Array.isArray(data.players) || data.players.length > 100) throw new Error('Choose a Fantasy GM AI version 2 backup.');
  if (typeof data.team !== 'string' || !data.team.trim() || data.team.length > 100) throw new Error('The backup needs a valid team name.');
  const seen = new Set();
  const players = data.players.map(p => {
    if (!p || typeof p.id !== 'string' || p.id.length > 100 || !p.id || seen.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100 || !p.stats) throw new Error('The backup contains an invalid or duplicate player.');
    seen.add(p.id);
    const stats = Object.fromEntries(statKeys.map(k => [k, p.stats[k] ?? null])); validateStats(stats, p.name);
    if (p.games !== undefined && (!Number.isInteger(p.games) || p.games < 0 || p.games > 7)) throw new Error('Games must be between 0 and 7.');
    const status = ['Active','Q','DTD','O','IL','IL+','INJ','IR'].includes(p.status) ? p.status : 'Active';
    return {id:p.id, name:p.name.trim(), position:typeof p.position === 'string' ? p.position.slice(0,30) : '', status, games:p.games ?? 3, stats, source:['manual','yahoo','demo'].includes(p.source) ? p.source : 'manual'};
  });
  const matchup = {mine:{},theirs:{},opponent:typeof data.matchup?.opponent === 'string' ? data.matchup.opponent.slice(0,100) : 'Opponent',basis: ['projection','current'].includes(data.matchup?.basis) ? data.matchup.basis : 'projection'};
  for (const side of ['mine','theirs']) for (const cat of categories) {
    const v = data.matchup?.[side]?.[cat] ?? null;
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || (cat.endsWith('%') && v > 1))) throw new Error('The backup has invalid matchup totals.');
    matchup[side][cat] = v;
  }
  return {version:2,team:data.team.trim(),players,punts:categories.filter(c=>data.punts?.includes(c)),matchup,updatedAt:typeof data.updatedAt==='string'?data.updatedAt:null};
}
export function newWorkspace() {
  return {version:2, team:defaultTeam, players:[], punts:[], matchup:{mine:Object.fromEntries(categories.map(c=>[c,null])),theirs:Object.fromEntries(categories.map(c=>[c,null])),opponent:'Opponent',basis:'projection'},updatedAt:null};
}
export function demoWorkspace() {
  const d = newWorkspace(); d.team = 'The Demo Front Office';
  d.players = parseCSV('Alex Carter,24,5,7,1.4,0.4,3,8,17,5,6,2.8\nJordan Brooks,16,10,3,0.8,1.8,0.5,6.5,12,2.5,4,1.8\nMiles Reed,20,4,6,1.5,0.3,2.5,7,16,3.5,4,2.3\nDevin Ellis,18,7,3,1.2,0.9,2,6.5,13,3,3.5,1.6\nNoah Hayes,13,11,2,0.7,2.2,0,5.5,9,2,3.5,1.5');
  d.players.forEach((p,i)=>{p.position=['PG','C','SG','SF / PF','C'][i];p.source='demo';p.games=[4,3,4,3,4][i]});
  d.matchup.mine = {'FG%':.479,'FT%':.778,'3PM':46,PTS:392,REB:149,AST:103,STL:22,BLK:18,TOV:39};
  d.matchup.theirs = {'FG%':.468,'FT%':.812,'3PM':51,PTS:387,REB:138,AST:112,STL:19,BLK:15,TOV:42};
  d.matchup.opponent = 'Demo Rival'; d.updatedAt = null; return d;
}
