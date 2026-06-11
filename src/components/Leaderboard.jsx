import React from 'react';
import { playerStandings, teamStandings } from '../lib/scoring';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ session, title, highlightId }) {
  const teamMode = session.mode === 'team';
  const rows = teamMode
    ? teamStandings(session.players, session.teams)
    : playerStandings(session.players);

  return (
    <div className="card leaderboard">
      {title && <h2>{title}</h2>}
      <table>
        <thead>
          <tr><th>#</th><th>{teamMode ? 'Team' : 'Player'}</th><th className="num">Score</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.id === highlightId ? 'highlight' : ''}>
              <td>{MEDALS[row.rank] || row.rank}</td>
              <td>
                {teamMode && <span className="team-dot" style={{ background: row.color }} />}
                {row.name}
                {!teamMode && row.connected === false && <span className="muted"> (offline)</span>}
              </td>
              <td className="num">{row.score}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="muted">No {teamMode ? 'teams' : 'players'} yet</td></tr>
          )}
        </tbody>
      </table>
      {teamMode && (
        <details className="mt">
          <summary>Individual scores</summary>
          <table>
            <tbody>
              {playerStandings(session.players).map((p) => (
                <tr key={p.id}><td>{p.rank}</td><td>{p.name}</td><td className="num">{p.score}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
