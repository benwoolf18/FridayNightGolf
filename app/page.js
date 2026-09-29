"use client";

import { useEffect, useRef, useState } from "react";

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
const emptyScoreForm = { date: "", courseName: "", strokes: "", scoreToPar: "", numPlayers: "", playerIds: [] };
const GAME_TYPES = ["Fourball", "Gruesomes", "Foursomes", "Texas Scramble", "Singles"];
const emptyRoundForm = { courseName: "", gameType: "", numTeams: "", teams: [] };

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
  const [scoreForm, setScoreForm] = useState(emptyScoreForm);
  const [scoreErrors, setScoreErrors] = useState({});
  const [scoreSaving, setScoreSaving] = useState(false);
  const [scoreSaveError, setScoreSaveError] = useState("");
  const [courseSuggestions, setCourseSuggestions] = useState([]);
  const [courseOpen, setCourseOpen] = useState(false);
  const courseTimer = useRef(null);
  const [roundForm, setRoundForm] = useState(emptyRoundForm);
  const [roundErrors, setRoundErrors] = useState({});
  const [roundSaving, setRoundSaving] = useState(false);
  const [roundSaveError, setRoundSaveError] = useState("");

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest(".players")) setOpenId(null);
      if (!e.target.closest(".menu") && !e.target.closest(".burger")) setMenuOpen(false);
      if (!e.target.closest(".autocomplete")) setCourseOpen(false);
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
    if (name === "logScore") {
      setScoreForm(emptyScoreForm);
      setScoreErrors({});
      setScoreSaveError("");
      setCourseSuggestions([]);
      setCourseOpen(false);
      loadPlayers();
    }
    if (name === "startRound") {
      setRoundForm(emptyRoundForm);
      setRoundErrors({});
      setRoundSaveError("");
      setCourseSuggestions([]);
      setCourseOpen(false);
      loadPlayers();
    }
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

  const setScoreField = (key) => (e) => setScoreForm((f) => ({ ...f, [key]: e.target.value }));

  const onCourseChange = (e) => {
    const value = e.target.value;
    setScoreForm((f) => ({ ...f, courseName: value }));
    setCourseOpen(true);
    if (courseTimer.current) clearTimeout(courseTimer.current);
    if (value.trim().length < 3) {
      setCourseSuggestions([]);
      return;
    }
    courseTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/courses/search?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        if (res.ok) setCourseSuggestions(data);
      } catch {
        // silently ignore — worst case, no suggestions show
      }
    }, 300);
  };

  const pickCourse = (name) => {
    setScoreForm((f) => ({ ...f, courseName: name }));
    setCourseSuggestions([]);
    setCourseOpen(false);
  };

  const onNumPlayersChange = (e) => {
    const val = e.target.value;
    const cap = Number(val) || 0;
    setScoreForm((f) => ({ ...f, numPlayers: val, playerIds: cap ? f.playerIds.slice(0, cap) : f.playerIds }));
  };

  const toggleScorePlayer = (id) => {
    setScoreForm((f) => {
      const already = f.playerIds.includes(id);
      if (already) return { ...f, playerIds: f.playerIds.filter((p) => p !== id) };
      const cap = Number(f.numPlayers) || 0;
      if (cap && f.playerIds.length >= cap) return f;
      return { ...f, playerIds: [...f.playerIds, id] };
    });
  };

  const saveScore = async (e) => {
    e.preventDefault();
    const cap = Number(scoreForm.numPlayers) || 0;
    const nextErrors = {};
    if (!scoreForm.date) nextErrors.date = "Date is required";
    if (!scoreForm.courseName.trim()) nextErrors.courseName = "Course is required";
    if (!scoreForm.numPlayers) nextErrors.numPlayers = "Number of players is required";
    if (!scoreForm.strokes.trim() && !scoreForm.scoreToPar.trim()) {
      nextErrors.score = "Enter either Number of Strokes or Score";
    }
    if (cap && scoreForm.playerIds.length !== cap) {
      nextErrors.players = `Select exactly ${cap} player${cap === 1 ? "" : "s"}`;
    }
    if (Object.keys(nextErrors).length) {
      setScoreErrors(nextErrors);
      return;
    }

    setScoreSaveError("");
    setScoreSaving(true);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: scoreForm.date,
          courseName: scoreForm.courseName.trim(),
          strokes: scoreForm.strokes.trim() || null,
          scoreToPar: scoreForm.scoreToPar.trim() || null,
          numPlayers: cap,
          playerIds: scoreForm.playerIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save score");
      closeModal();
    } catch (err) {
      setScoreSaveError(err.message || "Something went wrong — try again.");
    } finally {
      setScoreSaving(false);
    }
  };

  const onRoundCourseChange = (e) => {
    const value = e.target.value;
    setRoundForm((f) => ({ ...f, courseName: value }));
    setCourseOpen(true);
    if (courseTimer.current) clearTimeout(courseTimer.current);
    if (value.trim().length < 3) {
      setCourseSuggestions([]);
      return;
    }
    courseTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/courses/search?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        if (res.ok) setCourseSuggestions(data);
      } catch {
        // silently ignore — worst case, no suggestions show
      }
    }, 300);
  };

  const pickRoundCourse = (name) => {
    setRoundForm((f) => ({ ...f, courseName: name }));
    setCourseSuggestions([]);
    setCourseOpen(false);
  };

  const onNumTeamsChange = (e) => {
    const n = Number(e.target.value) || 0;
    setRoundForm((f) => ({
      ...f,
      numTeams: e.target.value,
      teams: Array.from({ length: n }, (_, i) => f.teams[i] || []),
    }));
  };

  const toggleTeamPlayer = (teamIdx, playerId) => {
    setRoundForm((f) => ({
      ...f,
      teams: f.teams.map((team, i) =>
        i !== teamIdx
          ? team
          : team.includes(playerId)
          ? team.filter((id) => id !== playerId)
          : [...team, playerId]
      ),
    }));
  };

  const saveRound = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!roundForm.courseName.trim()) nextErrors.courseName = "Course is required";
    if (!roundForm.gameType) nextErrors.gameType = "Game type is required";
    if (!roundForm.numTeams) nextErrors.numTeams = "Number of teams is required";
    const emptyTeams = roundForm.teams
      .map((t, i) => (t.length === 0 ? i + 1 : null))
      .filter(Boolean);
    if (roundForm.numTeams && emptyTeams.length) {
      nextErrors.teams = `Add at least one player to Team ${emptyTeams.join(", Team ")}`;
    }
    if (Object.keys(nextErrors).length) {
      setRoundErrors(nextErrors);
      return;
    }

    setRoundErrors({});
    setRoundSaveError("");
    setRoundSaving(true);
    try {
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: roundForm.courseName.trim(),
          gameType: roundForm.gameType,
          teams: roundForm.teams,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start round");
      closeModal();
    } catch (err) {
      setRoundSaveError(err.message || "Something went wrong — try again.");
    } finally {
      setRoundSaving(false);
    }
  };

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
            <button type="button" onClick={() => openModal("startRound")}>Start a new round</button>
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
          <button type="button" className="logscore" onClick={() => openModal("logScore")}>📝 Log a score</button>
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
      {modal === "logScore" && (
        <div className="overlay" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Log a score"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Log a Score</h2>
            <form onSubmit={saveScore} noValidate>
              <label>
                Date *
                <input type="date" value={scoreForm.date} onChange={setScoreField("date")} />
              </label>
              {scoreErrors.date && <span className="error">{scoreErrors.date}</span>}

              <label className="autocomplete">
                Course *
                <input
                  type="text"
                  value={scoreForm.courseName}
                  onChange={onCourseChange}
                  onFocus={() => setCourseOpen(true)}
                  autoComplete="off"
                  placeholder="Start typing…"
                />
                {courseOpen && courseSuggestions.length > 0 && (
                  <ul className="suggestions">
                    {courseSuggestions.map((c) => (
                      <li key={c.id} onClick={() => pickCourse(c.name)}>{c.name}</li>
                    ))}
                  </ul>
                )}
              </label>
              {scoreErrors.courseName && <span className="error">{scoreErrors.courseName}</span>}

              <div className="scoreinputs">
                <label>
                  Number of Strokes
                  <input type="text" inputMode="numeric" value={scoreForm.strokes} onChange={setScoreField("strokes")} />
                </label>
                <label>
                  Score (+/- par)
                  <input type="text" value={scoreForm.scoreToPar} onChange={setScoreField("scoreToPar")} placeholder="e.g. -2, E, +3" />
                </label>
              </div>
              {scoreErrors.score && <span className="error">{scoreErrors.score}</span>}

              <label>
                Number of Players *
                <select value={scoreForm.numPlayers} onChange={onNumPlayersChange}>
                  <option value="">Select…</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </label>
              {scoreErrors.numPlayers && <span className="error">{scoreErrors.numPlayers}</span>}

              <div>
                <p className="fieldlabel">
                  Who Played *{scoreForm.numPlayers ? ` (${scoreForm.playerIds.length}/${scoreForm.numPlayers})` : ""}
                </p>
                {listLoading && <p className="muted">Loading players…</p>}
                {!listLoading && playerList.length === 0 && (
                  <p className="muted">No players yet — add one from the menu first.</p>
                )}
                {!listLoading && playerList.length > 0 && (
                  <div className="playerchecks">
                    {playerList.map((p) => {
                      const checked = scoreForm.playerIds.includes(p.id);
                      const cap = Number(scoreForm.numPlayers) || 0;
                      const disabled = !checked && cap > 0 && scoreForm.playerIds.length >= cap;
                      return (
                        <label key={p.id} className={"checkrow" + (disabled ? " disabled" : "")}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleScorePlayer(p.id)}
                          />
                          {p.first_name}{p.surname ? ` ${p.surname}` : ""}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {scoreErrors.players && <span className="error">{scoreErrors.players}</span>}

              {scoreSaveError && <span className="error">{scoreSaveError}</span>}

              <div className="modalactions">
                <button type="button" className="cancel" onClick={closeModal} disabled={scoreSaving}>Cancel</button>
                <button type="submit" className="save" disabled={scoreSaving}>{scoreSaving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modal === "startRound" && (
        <div className="overlay" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Start a round"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Start a Round</h2>
            <form onSubmit={saveRound} noValidate>
              <label className="autocomplete">
                Course *
                <input
                  type="text"
                  value={roundForm.courseName}
                  onChange={onRoundCourseChange}
                  onFocus={() => setCourseOpen(true)}
                  autoComplete="off"
                  placeholder="Start typing…"
                />
                {courseOpen && courseSuggestions.length > 0 && (
                  <ul className="suggestions">
                    {courseSuggestions.map((c) => (
                      <li key={c.id} onClick={() => pickRoundCourse(c.name)}>{c.name}</li>
                    ))}
                  </ul>
                )}
              </label>
              {roundErrors.courseName && <span className="error">{roundErrors.courseName}</span>}

              <label>
                Game Type *
                <select
                  value={roundForm.gameType}
                  onChange={(e) => setRoundForm((f) => ({ ...f, gameType: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {GAME_TYPES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
              {roundErrors.gameType && <span className="error">{roundErrors.gameType}</span>}

              <label>
                Number of Teams *
                <select value={roundForm.numTeams} onChange={onNumTeamsChange}>
                  <option value="">Select…</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </label>
              {roundErrors.numTeams && <span className="error">{roundErrors.numTeams}</span>}

              {roundForm.teams.map((team, teamIdx) => (
                <div key={teamIdx} className="teamblock">
                  <p className="fieldlabel">Team {teamIdx + 1} * ({team.length} selected)</p>
                  {listLoading && <p className="muted">Loading players…</p>}
                  {!listLoading && playerList.length === 0 && (
                    <p className="muted">No players yet — add one from the menu first.</p>
                  )}
                  {!listLoading && playerList.length > 0 && (
                    <div className="playerchecks">
                      {playerList.map((p) => {
                        const checked = team.includes(p.id);
                        const otherTeam = roundForm.teams.findIndex((t, i) => i !== teamIdx && t.includes(p.id));
                        const disabled = !checked && otherTeam !== -1;
                        return (
                          <label key={p.id} className={"checkrow" + (disabled ? " disabled" : "")}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleTeamPlayer(teamIdx, p.id)}
                            />
                            {p.first_name}{p.surname ? ` ${p.surname}` : ""}
                            {disabled ? ` (Team ${otherTeam + 1})` : ""}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {roundErrors.teams && <span className="error">{roundErrors.teams}</span>}

              <div>
                <p className="fieldlabel">Matchups</p>
                <p className="muted">
                  {roundForm.gameType
                    ? `Matchups for ${roundForm.gameType} will be set up here once game types are built.`
                    : "Pick a game type first — matchups depend on it."}
                </p>
              </div>

              {roundSaveError && <span className="error">{roundSaveError}</span>}

              <div className="modalactions">
                <button type="button" className="cancel" onClick={closeModal} disabled={roundSaving}>Cancel</button>
                <button type="submit" className="save" disabled={roundSaving}>{roundSaving ? "Starting…" : "Start round"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
