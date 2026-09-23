"use client";

import { useEffect, useState } from "react";

// Demo data - will be replaced by real records later
const GAMES = [
  { id: 1, date: "2026-08-26", course: "Shrivenham Park", score: -2, players: ["Dave", "Nigel", "Darren", "Ben"] },
  { id: 2, date: "2026-08-19", course: "Marlborough Downs", score: 3, players: ["Ben", "Lee", "Carl"] },
  { id: 3, date: "2026-08-12", course: "Broome Manor", score: 0, players: ["Dave", "Ben", "Mike", "Nigel", "Lee"] },
  { id: 4, date: "2026-08-05", course: "Shrivenham Park", score: -5, players: ["Darren", "Ben", "Carl", "Mike"] },
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DEFAULT_DIR = { date: "desc", course: "asc", score: "asc" };

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const fmtDate = (iso) => {
  const [, m, d] = iso.split("-");
  return `${ordinal(+d)} ${MONTHS[+m - 1]}`;
};
const fmtScore = (n) => (n > 0 ? `+${n}` : n === 0 ? "E" : String(n));

export default function Home() {
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest(".players")) setOpenId(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const rows = [...GAMES].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    const r = typeof x === "string" ? x.localeCompare(y) : x - y;
    return sort.dir === "asc" ? r : -r;
  });

  const onSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: DEFAULT_DIR[key] }
    );

  const Th = ({ k, label }) => {
    const on = sort.key === k;
    return (
      <th aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => onSort(k)}>
          {label} <span className="arrow">{on && sort.dir === "desc" ? "▼" : "▲"}</span>
        </button>
      </th>
    );
  };

  return (
    <>
      <header>
        <div className="flag">⛳</div>
        <h1>Friday Night Golf</h1>
        <p>Scores, rivalries and bragging rights.</p>
      </header>

      <main>
        <section className="card">
          <div className="icon">📝</div>
          <h2>Record a score</h2>
          <p>Log a round: who played, what they shot and where.</p>
          <ul>
            <li>Pick the course and date</li>
            <li>Add the players and their scores</li>
            <li>Browse results by course or player</li>
          </ul>
          <button type="button">Record a score</button>
        </section>

        <section className="card match">
          <div className="icon">🏆</div>
          <h2>Create a match</h2>
          <p>Set up a live Ryder Cup-style scoreboard for tonight's round.</p>
          <ul>
            <li>Choose a game format</li>
            <li>Split players into teams</li>
            <li>Follow the score hole by hole</li>
          </ul>
          <button type="button">Create a match</button>
        </section>
      </main>

      <section className="results">
        <h2>Results</h2>
        <div className="tablewrap">
          <table>
            <colgroup><col className="d" /><col className="c" /><col className="s" /><col className="p" /></colgroup>
            <thead>
              <tr>
                <Th k="date" label="Date" />
                <Th k="course" label="Course" />
                <Th k="score" label="Score" />
                <th>Players</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td>{fmtDate(g.date)}</td>
                  <td>{g.course}</td>
                  <td className="score">{fmtScore(g.score)}</td>
                  <td>
                    <span
                      className={"players" + (openId === g.id ? " open" : "")}
                      onClick={() => setOpenId(openId === g.id ? null : g.id)}
                    >
                      {g.players.length}
                      <span className="tip">{g.players.join(", ")}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer>Demo data</footer>
    </>
  );
}
