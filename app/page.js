"use client";

import { Fragment, useEffect, useRef, useState } from "react";

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
const GAME_TYPES = ["Fourball", "Gruesomes", "Foursomes", "Texas Scramble", "Singles", "Stroke Play"];
// Player/team rules per game type
const GAME_RULES = {
  "Singles": { mode: "players", min: 1, max: 2 },
  "Stroke Play": { mode: "players", min: 1, max: 4 },
  "Texas Scramble": { mode: "teams", minTeams: 1, maxTeams: 2, minPerTeam: 1 },
  "Foursomes": { mode: "teams", minTeams: 2, maxTeams: 2, minPerTeam: 2 },
  "Fourball": { mode: "teams", minTeams: 2, maxTeams: 2, minPerTeam: 2 },
  "Gruesomes": { mode: "teams", minTeams: 2, maxTeams: 2, minPerTeam: 2 },
};
const emptyRoundForm = { courseName: "", courseId: null, teeSetId: "", gameType: "", teams: [], players: [] };

function ScorecardPreview({ tee }) {
  const holes = [...tee.holes].sort((a, b) => a.hole_number - b.hole_number);
  const blocks = [];
  for (let i = 0; i < holes.length; i += 9) blocks.push(holes.slice(i, i + 9));
  const sum = (hs) => hs.reduce((n, h) => n + (h.par || 0), 0);
  const cell = { padding: "4px 6px", textAlign: "center", border: "1px solid rgba(0,0,0,0.18)", fontSize: 12 };
  const head = { ...cell, fontWeight: 600 };
  const totLabel = (bi) => (blocks.length > 1 ? (bi === 0 ? "Out" : "In") : "Tot");
  return (
    <div style={{ margin: "8px 0 12px" }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        {tee.name} · par {sum(holes)}
        {tee.slope_rating ? ` · slope ${tee.slope_rating}` : ""}
        {tee.course_rating ? ` · rating ${tee.course_rating}` : ""}
      </div>
      {blocks.map((hs, bi) => (
        <div key={bi} style={{ overflowX: "auto", marginBottom: 8 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              <tr>
                <td style={head}>Hole</td>
                {hs.map((h) => <td key={h.hole_number} style={head}>{h.hole_number}</td>)}
                <td style={head}>{totLabel(bi)}</td>
              </tr>
              <tr>
                <td style={head}>Par</td>
                {hs.map((h) => <td key={h.hole_number} style={cell}>{h.par}</td>)}
                <td style={head}>{sum(hs)}</td>
              </tr>
              <tr>
                <td style={head}>SI</td>
                {hs.map((h) => <td key={h.hole_number} style={cell}>{h.stroke_index ?? "–"}</td>)}
                <td style={cell}></td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      {blocks.length > 1 && (
        <div style={{ fontSize: 12 }}>Total par {sum(holes)}</div>
      )}
    </div>
  );
}

const GREEN = "#1f472e";
const ECRU = "#f3edd9";

function LiveRound({ roundId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [scores, setScores] = useState({}); // "playerId-hole" -> string
  const [saveError, setSaveError] = useState("");
  const [ending, setEnding] = useState(false);
  const pending = useRef(new Set());
  const savedRef = useRef({});

  useEffect(() => {
    window.scrollTo(0, 0);
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/rounds/${roundId}`, { cache: "no-store" });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Could not load round");
        if (!alive) return;
        const map = {};
        for (const sc of d.scores) map[`${sc.player_id}-${sc.hole_number}`] = String(sc.strokes);
        savedRef.current = { ...map };
        setScores(map);
        setData(d);
      } catch (err) {
        if (alive) setError(err.message || "Could not load round");
      }
    })();
    return () => { alive = false; };
  }, [roundId]);

  const saveScore = (playerId, hole) => {
    const key = `${playerId}-${hole}`;
    const raw = (scores[key] ?? "").trim();
    const n = raw === "" ? null : Number(raw);
    const next = n && n > 0 ? String(n) : "";
    const prev = savedRef.current[key] ?? "";
    if (next !== raw) setScores((sc) => ({ ...sc, [key]: next }));
    if (next === prev) return;
    savedRef.current[key] = next;
    const p = fetch(`/api/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "score", playerId, hole, strokes: next === "" ? null : Number(next) }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Could not save score");
        }
        setSaveError("");
      })
      .catch((err) => {
        savedRef.current[key] = prev;
        setSaveError(err.message || "Could not save score — check your connection");
      })
      .finally(() => pending.current.delete(p));
    pending.current.add(p);
  };

  const endRound = async () => {
    if (!window.confirm("End this round? It will be marked as complete.")) return;
    setEnding(true);
    setSaveError("");
    try {
      await Promise.all([...pending.current]);
      const res = await fetch(`/api/rounds/${roundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not end round");
      onClose();
    } catch (err) {
      setSaveError(err.message || "Could not end round");
      setEnding(false);
    }
  };

  const wrap = { padding: "16px 12px 48px", maxWidth: 960, margin: "0 auto" };
  const backBtn = { background: "transparent", border: "none", color: GREEN, font: "inherit", cursor: "pointer", padding: 0 };

  if (error) {
    return (
      <div style={wrap}>
        <button type="button" onClick={onClose} style={backBtn}>← Home</button>
        <p className="error" style={{ marginTop: 16 }}>{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={wrap}>
        <button type="button" onClick={onClose} style={backBtn}>← Home</button>
        <p style={{ marginTop: 16 }}>Loading round…</p>
      </div>
    );
  }

  const { round, tee } = data;
  const live = round.status === "in_progress";
  const players = data.teams.flatMap((t) => t.players.map((p) => ({ ...p, team: t.team_number })));
  const teamGroups = data.teams
    .filter((t) => t.players.length)
    .map((t) => ({ team: t.team_number, count: t.players.length }));
  const holes = data.holes.length
    ? data.holes
    : Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: null, stroke_index: null }));

  const strokesAt = (pid, n) => {
    const v = Number(scores[`${pid}-${n}`]);
    return v > 0 ? v : 0;
  };
  const sumFor = (pid, hs) => hs.reduce((t, h) => t + strokesAt(pid, h.hole_number), 0);
  const parOf = (hs) => hs.reduce((t, h) => t + (h.par || 0), 0);
  const toParFor = (pid) => {
    let diff = 0;
    let any = false;
    for (const h of holes) {
      const st = strokesAt(pid, h.hole_number);
      if (st && h.par) { diff += st - h.par; any = true; }
    }
    return any ? diff : null;
  };

  const cell = { padding: "4px 6px", textAlign: "center", border: "1px solid rgba(0,0,0,0.18)", fontSize: 13 };
  const head = { ...cell, fontWeight: 600, background: GREEN, color: ECRU };
  const stickyCell = { ...cell, fontWeight: 600, position: "sticky", left: 0, background: ECRU };
  const subCell = { ...cell, fontWeight: 600, background: "rgba(31,71,46,0.12)" };
  const subSticky = { ...subCell, position: "sticky", left: 0, background: "#dfe6d6" };
  const colCount = 3 + players.length;

  const subtotalRow = (label, hs, key) => (
    <tr key={key}>
      <td style={subSticky}>{label}</td>
      <td style={subCell}>{hs.some((h) => h.par) ? parOf(hs) : ""}</td>
      <td style={subCell}></td>
      {players.map((p) => (
        <td key={p.id} style={subCell}>{sumFor(p.id, hs) || ""}</td>
      ))}
    </tr>
  );

  return (
    <div style={wrap}>
      <button type="button" onClick={onClose} style={backBtn}>← Home</button>
      <h1 style={{ fontSize: 22, margin: "8px 0 4px", color: GREEN }}>{round.title}</h1>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
        {tee
          ? `${tee.name}${tee.gender ? ` (${tee.gender})` : ""} tees · par ${parOf(holes)}${tee.slope_rating ? ` · slope ${tee.slope_rating}` : ""}`
          : "No scorecard for this course — scores only"}
      </div>
      {!live && (
        <p style={{ fontWeight: 600, color: GREEN }}>This round has ended.</p>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
          <thead>
            <tr>
              <th colSpan={3} style={{ ...head, background: "transparent", border: "none" }}></th>
              {teamGroups.map((g) => (
                <th key={g.team} colSpan={g.count} style={head}>Team {g.team}</th>
              ))}
            </tr>
            <tr>
              <th style={head}>Hole</th>
              <th style={head}>Par</th>
              <th style={head}>SI</th>
              {players.map((p) => (
                <th key={p.id} style={head}>{p.first_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holes.map((h, i) => {
              const blockIdx = Math.floor(i / 9);
              const blockEnd = (i + 1) % 9 === 0 || i === holes.length - 1;
              const block = holes.slice(blockIdx * 9, blockIdx * 9 + 9);
              const label = holes.length > 9 ? (blockIdx === 0 ? "Out" : "In") : "Tot";
              return (
                <Fragment key={h.hole_number}>
                  <tr>
                    <td style={stickyCell}>{h.hole_number}</td>
                    <td style={cell}>{h.par ?? "–"}</td>
                    <td style={cell}>{h.stroke_index ?? "–"}</td>
                    {players.map((p) => {
                      const key = `${p.id}-${h.hole_number}`;
                      return (
                        <td key={p.id} style={cell}>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={2}
                            aria-label={`${p.first_name}, hole ${h.hole_number}`}
                            value={scores[key] ?? ""}
                            readOnly={!live}
                            onChange={(e) =>
                              setScores((sc) => ({ ...sc, [key]: e.target.value.replace(/\D/g, "").slice(0, 2) }))
                            }
                            onBlur={() => saveScore(p.id, h.hole_number)}
                            style={{
                              width: 44, textAlign: "center", font: "inherit", padding: "6px 0",
                              border: "1px solid rgba(0,0,0,0.25)", borderRadius: 6, background: "#fffdf5",
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  {blockEnd && subtotalRow(label, block, `sub-${blockIdx}`)}
                </Fragment>
              );
            })}
            {holes.length > 9 && subtotalRow("Total", holes, "total")}
            <tr>
              <td style={stickyCell}>To par</td>
              <td style={cell}></td>
              <td style={cell}></td>
              {players.map((p) => {
                const d = toParFor(p.id);
                return <td key={p.id} style={{ ...cell, fontWeight: 600 }}>{d === null ? "" : fmtScore(d)}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {saveError && <p className="error" style={{ marginTop: 12 }}>{saveError}</p>}

      {live && (
        <button
          type="button"
          onClick={endRound}
          disabled={ending}
          style={{
            marginTop: 20, width: "100%", padding: "14px 18px", border: "none", borderRadius: 10,
            background: GREEN, color: ECRU, font: "inherit", fontWeight: 600, cursor: "pointer",
          }}
        >
          {ending ? "Ending…" : "End round"}
        </button>
      )}
    </div>
  );
}

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
  const [remoteResults, setRemoteResults] = useState(null); // null = UK search not used yet
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [teeSets, setTeeSets] = useState([]);
  const [liveRoundId, setLiveRoundId] = useState(null);
  const [activeRounds, setActiveRounds] = useState([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeError, setActiveError] = useState("");
  const loadActiveRounds = async () => {
    setActiveLoading(true);
    setActiveError("");
    try {
      const res = await fetch(`/api/rounds/active?t=${Date.now()}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load rounds");
      setActiveRounds(d);
    } catch (err) {
      setActiveError(err.message || "Could not load rounds");
    } finally {
      setActiveLoading(false);
    }
  };
  const openRound = (id) => {
    setModal(null);
    setLiveRoundId(id);
  };
  const resetRemote = () => {
    setRemoteResults(null);
    setRemoteBusy(false);
    setRemoteError("");
    setTeeSets([]);
  };

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
    if (name === "currentRounds") loadActiveRounds();
    if (name === "logScore") {
      setScoreForm(emptyScoreForm);
      setScoreErrors({});
      setScoreSaveError("");
      setCourseSuggestions([]);
      setCourseOpen(false);
      resetRemote();
      loadPlayers();
    }
    if (name === "startRound") {
      setRoundForm(emptyRoundForm);
      setRoundErrors({});
      setRoundSaveError("");
      setCourseSuggestions([]);
      setCourseOpen(false);
      resetRemote();
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
    setRemoteResults(null);
    setRemoteError("");
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
    setRoundForm((f) => ({ ...f, courseName: value, courseId: null, teeSetId: "" }));
    setTeeSets([]);
    setCourseOpen(true);
    setRemoteResults(null);
    setRemoteError("");
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

  const pickRoundCourse = async (course) => {
    setRoundForm((f) => ({ ...f, courseName: course.name, courseId: course.id, teeSetId: "" }));
    setCourseSuggestions([]);
    setCourseOpen(false);
    setRemoteResults(null);
    setTeeSets([]);
    try {
      const res = await fetch(`/api/courses/${course.id}`);
      const data = await res.json();
      const tees = res.ok ? data.tee_sets || [] : [];
      setTeeSets(tees);
      if (tees.length === 1) {
        setRoundForm((f) => ({ ...f, teeSetId: String(tees[0].id) }));
      }
    } catch {
      // no tees is fine — the round can still be started without them
    }
  };

  // --- UK course lookup (spends API requests, so only runs on a tap) ---
  const remoteSearch = async (q) => {
    setRemoteBusy(true);
    setRemoteError("");
    try {
      const res = await fetch(`/api/courses/remote-search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not search UK courses");
      setRemoteResults(data);
    } catch (err) {
      setRemoteError(err.message || "Could not search UK courses");
    } finally {
      setRemoteBusy(false);
    }
  };

  const importClub = async (club) => {
    setRemoteBusy(true);
    setRemoteError("");
    try {
      const res = await fetch("/api/courses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_club_id: club.api_club_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not import course");
      const saved = data.courses || [];
      setRemoteResults(null);
      if (saved.length === 0) {
        setRemoteError("No scorecard data available for that club");
      } else if (saved.length === 1) {
        if (modal === "startRound") pickRoundCourse(saved[0]);
        else pickCourse(saved[0].name);
      } else {
        // several courses at one club — let the user choose which
        setCourseSuggestions(saved);
        setCourseOpen(true);
      }
    } catch (err) {
      setRemoteError(err.message || "Could not import course");
    } finally {
      setRemoteBusy(false);
    }
  };

  const renderCourseDropdown = (value, onPick) => {
    const q = value.trim();
    if (!courseOpen || q.length < 3) return null;
    const note = { fontStyle: "italic", cursor: "default" };
    return (
      <ul className="suggestions">
        {remoteResults === null &&
          courseSuggestions.map((c) => (
            <li key={c.id} onClick={() => onPick(c)}>{c.name}</li>
          ))}
        {remoteResults !== null &&
          remoteResults.map((c) => (
            <li key={c.api_club_id} onClick={() => importClub(c)}>
              {c.name}{c.county ? ` — ${c.county}` : ""}
            </li>
          ))}
        {remoteResults !== null && remoteResults.length === 0 && (
          <li style={note}>No UK clubs found</li>
        )}
        {remoteBusy && <li style={note}>Working…</li>}
        {remoteError && <li style={{ ...note, color: "#b00020" }}>{remoteError}</li>}
        {remoteResults === null && !remoteBusy && (
          <li style={{ fontStyle: "italic" }} onClick={() => remoteSearch(q)}>
            🔎 Search UK courses for “{q}”
          </li>
        )}
      </ul>
    );
  };

  // Changing game type wipes any players/teams already chosen
  const onGameTypeChange = (e) => {
    const gameType = e.target.value;
    const rules = GAME_RULES[gameType];
    setRoundErrors({});
    setRoundForm((f) => ({
      ...f,
      gameType,
      players: [],
      teams: rules && rules.mode === "teams" ? Array.from({ length: rules.minTeams }, () => []) : [],
    }));
  };

  const addTeam = () =>
    setRoundForm((f) => ({ ...f, teams: [...f.teams, []] }));

  const removeTeam = () =>
    setRoundForm((f) => ({ ...f, teams: f.teams.slice(0, -1) }));

  const togglePlayer = (playerId) => {
    setRoundForm((f) => {
      const max = GAME_RULES[f.gameType]?.max ?? 4;
      if (f.players.includes(playerId)) return { ...f, players: f.players.filter((id) => id !== playerId) };
      if (f.players.length >= max) return f;
      return { ...f, players: [...f.players, playerId] };
    });
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
    const rules = GAME_RULES[roundForm.gameType];
    let teamsPayload = [];
    if (rules?.mode === "players") {
      const n = roundForm.players.length;
      if (n < rules.min || n > rules.max) {
        nextErrors.teams = rules.max === 2
          ? "Select 1 or 2 players"
          : `Select between ${rules.min} and ${rules.max} players`;
      }
      // each player is their own entry in the round
      teamsPayload = roundForm.players.map((id) => [id]);
    } else if (rules?.mode === "teams") {
      const short = roundForm.teams
        .map((t, i) => (t.length < rules.minPerTeam ? i + 1 : null))
        .filter(Boolean);
      if (short.length) {
        nextErrors.teams = rules.minPerTeam > 1
          ? `Team ${short.join(", Team ")} needs at least ${rules.minPerTeam} players`
          : `Add at least one player to Team ${short.join(", Team ")}`;
      }
      teamsPayload = roundForm.teams;
    }
    if (Object.keys(nextErrors).length) {
      setRoundErrors(nextErrors);
      return;
    }

    setRoundErrors({});
    setRoundSaveError("");
    setRoundSaving(true);
    try {
      const res = await fetch("/api/rounds/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: roundForm.courseName.trim(),
          courseId: roundForm.courseId,
          gameType: roundForm.gameType,
          teeSetId: roundForm.teeSetId ? Number(roundForm.teeSetId) : null,
          teams: teamsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start round");
      closeModal();
      setLiveRoundId(data.id);
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

  if (liveRoundId) {
    return <LiveRound roundId={liveRoundId} onClose={() => setLiveRoundId(null)} />;
  }

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
            <button type="button" className="secondary" onClick={() => openModal("currentRounds")}>View a current round</button>
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

      {modal === "currentRounds" && (
        <div className="overlay" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Current rounds"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Current Rounds</h2>

            {activeLoading && <p className="muted">Loading rounds…</p>}
            {activeError && <span className="error">{activeError}</span>}

            {!activeLoading && !activeError && (
              activeRounds.length === 0 ? (
                <p className="muted">No rounds in progress.</p>
              ) : (
                <div>
                  {activeRounds.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => openRound(r.id)}
                      style={{
                        display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                        marginBottom: 8, border: "1px solid rgba(0,0,0,0.18)", borderRadius: 8,
                        background: "transparent", cursor: "pointer", font: "inherit", color: "inherit",
                      }}
                    >
                      {r.title} <span style={{ opacity: 0.5, fontSize: 12 }}>· id {r.id}</span>
                    </button>
                  ))}
                </div>
              )
            )}

            <div className="modalactions">
              <button type="button" className="cancel" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

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
                {renderCourseDropdown(scoreForm.courseName, (c) => pickCourse(c.name))}
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
                {renderCourseDropdown(roundForm.courseName, (c) => pickRoundCourse(c))}
              </label>
              {roundErrors.courseName && <span className="error">{roundErrors.courseName}</span>}

              {teeSets.length > 0 && (
                <label>
                  Tees
                  <select
                    value={roundForm.teeSetId}
                    onChange={(e) => setRoundForm((f) => ({ ...f, teeSetId: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {teeSets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.gender ? ` (${t.gender})` : ""} – par {t.par}
                        {t.slope_rating ? `, slope ${t.slope_rating}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(() => {
                const tee = teeSets.find((t) => String(t.id) === String(roundForm.teeSetId));
                return tee && tee.holes?.length ? <ScorecardPreview tee={tee} /> : null;
              })()}

              <label>
                Game Type *
                <select
                  value={roundForm.gameType}
                  onChange={onGameTypeChange}
                >
                  <option value="">Select…</option>
                  {GAME_TYPES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
              {roundErrors.gameType && <span className="error">{roundErrors.gameType}</span>}

              {(() => {
                const rules = GAME_RULES[roundForm.gameType];
                if (!rules) return null;
                const nameOf = (p) => `${p.first_name}${p.surname ? ` ${p.surname}` : ""}`;
                const playersState = listLoading
                  ? <p className="muted">Loading players…</p>
                  : playerList.length === 0
                  ? <p className="muted">No players yet — add one from the menu first.</p>
                  : null;

                if (rules.mode === "players") {
                  const full = roundForm.players.length >= rules.max;
                  return (
                    <div className="teamblock">
                      <p className="fieldlabel">
                        Select Players * ({roundForm.players.length} of {rules.max} max)
                      </p>
                      {playersState}
                      {!playersState && (
                        <div className="playerchecks">
                          {playerList.map((p) => {
                            const checked = roundForm.players.includes(p.id);
                            const disabled = !checked && full;
                            return (
                              <label key={p.id} className={"checkrow" + (disabled ? " disabled" : "")}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => togglePlayer(p.id)}
                                />
                                {nameOf(p)}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <>
                    {roundForm.teams.map((team, teamIdx) => (
                      <div key={teamIdx} className="teamblock">
                        <p className="fieldlabel">
                          Team {teamIdx + 1} * ({team.length} selected{rules.minPerTeam > 1 ? `, min ${rules.minPerTeam}` : ""})
                        </p>
                        {playersState}
                        {!playersState && (
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
                                  {nameOf(p)}
                                  {disabled ? ` (Team ${otherTeam + 1})` : ""}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                    {rules.maxTeams > rules.minTeams && (
                      <div className="modalactions">
                        {roundForm.teams.length < rules.maxTeams && (
                          <button type="button" className="cancel" onClick={addTeam}>+ Add team</button>
                        )}
                        {roundForm.teams.length > rules.minTeams && (
                          <button type="button" className="cancel" onClick={removeTeam}>Remove team {roundForm.teams.length}</button>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
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
