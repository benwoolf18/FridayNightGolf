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

const emptyForm = { firstName: "", surname: "", handicap: "", photo: "" };

export default function Home() {
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [openId, setOpenId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null); // "addPlayer" | "editPlayer" | "viewPlayers" | null
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [playerList, setPlayerList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest(".players")) setOpenId(null);
      if (!e.target.closest(".menu") && !e.target.closest(".burger")) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const openModal = (name) => {
    setModal(name);
    setMenuOpen(false);
    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
    setSaveError("");
    if (name === "viewPlayers") loadPlayers();
  };
  const closeModal = () => setModal(null);

  const loadPlayers = async () => {
    setListLoading(true);
    setListError("");
    try {
      const res = await fetch("/api/players");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load players");
      setPlayerList(data);
    } catch (err) {
      setListError(err.message || "Something went wrong — try again.");
    } finally {
      setListLoading(false);
    }
  };

  const openEditPlayer = (row) => {
    setEditingId(row.id);
    setForm({
      firstName: row.first_name || "",
      surname: row.surname || "",
      handicap: row.handicap != null ? String(row.handicap) : "",
      photo: row.photo_url || "",
    });
    setErrors({});
    setSaveError("");
    setModal("editPlayer");
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const savePlayer = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = "First name is required";
    if (!form.handicap.trim()) nextErrors.handicap = "Handicap is required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaveError("");
    setSaving(true);
    try {
      const url = editingId ? `/api/players/${editingId}` : "/api/players";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save player");
      closeModal();
    } catch (err) {
      setSaveError(err.message || "Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
        <button
          type="button"
          className="burger"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label="Menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span></span><span></span><span></span>
        </button>
        {menuOpen && (
          <nav className="menu">
            <button type="button" onClick={() => openModal("addPlayer")}>Add New Player</button>
            <button type="button" onClick={() => openModal("viewPlayers")}>View Existing Players</button>
          </nav>
        )}
        <div className="flag">⛳</div>
        <h1>Friday Night Golf</h1>
        <p>Scores, rivalries and bragging rights.</p>
      </header>

      <main>
        <section className="card">
          <div className="icon">📝</div>
          <h2>Single Round</h2>
          <p>Log a round: who played, what they shot and where.</p>
          <ul>
            <li>Pick the course and date</li>
            <li>Add the players and their scores</li>
            <li>Browse results by course or player</li>
          </ul>
          <div className="actions">
            <button type="button">Start a new round</button>
            <button type="button" className="secondary">View a current round</button>
          </div>
        </section>

        <section className="card match">
          <div className="icon">🏆</div>
          <h2>Tournament</h2>
          <p>Set up a live Ryder Cup-style scoreboard for tonight's round.</p>
          <ul>
            <li>Choose a game format</li>
            <li>Split players into teams</li>
            <li>Follow the score hole by hole</li>
          </ul>
          <div className="actions">
            <button type="button">Start a new tournament</button>
            <button type="button" className="secondary">View existing tournaments</button>
          </div>
        </section>
      </main>

      <section className="results">
        <div className="resultshead">
          <h2>Results</h2>
          <button type="button" className="logscore">📝 Log a score</button>
        </div>
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

      {modal === "viewPlayers" && (
        <div className="overlay" onClick={closeModal}>
          <div
            className="modal wide"
            role="dialog"
            aria-modal="true"
            aria-label="Existing players"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Existing Players</h2>

            {listLoading && <p className="muted">Loading players…</p>}
            {listError && <span className="error">{listError}</span>}

            {!listLoading && !listError && (
              playerList.length === 0 ? (
                <p className="muted">No players yet — add one from the menu.</p>
              ) : (
                <div className="playertablewrap">
                  <table className="playertable">
                    <thead>
                      <tr><th>First Name</th><th>Surname</th><th>Handicap</th></tr>
                    </thead>
                    <tbody>
                      {playerList.map((p) => (
                        <tr key={p.id} onClick={() => openEditPlayer(p)}>
                          <td>{p.first_name}</td>
                          <td>{p.surname || "—"}</td>
                          <td>{p.handicap}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            <div className="modalactions">
              <button type="button" className="cancel" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {(modal === "addPlayer" || modal === "editPlayer") && (
        <div className="overlay" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "editPlayer" ? "Edit player" : "Add new player"}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{modal === "editPlayer" ? "Edit Player" : "Add New Player"}</h2>
            <form onSubmit={savePlayer} noValidate>
              <label>
                First Name *
                <input type="text" value={form.firstName} onChange={setField("firstName")} />
              </label>
              {errors.firstName && <span className="error">{errors.firstName}</span>}

              <label>
                Surname
                <input type="text" value={form.surname} onChange={setField("surname")} />
              </label>

              <label>
                Handicap *
                <input type="text" inputMode="decimal" value={form.handicap} onChange={setField("handicap")} />
              </label>
              {errors.handicap && <span className="error">{errors.handicap}</span>}

              <label>
                Add Photo
                <input type="file" accept="image/*" onChange={onPhoto} />
              </label>
              {form.photo && <img className="preview" src={form.photo} alt="" />}

              {saveError && <span className="error">{saveError}</span>}

              <div className="modalactions">
                <button type="button" className="cancel" onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" className="save" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
