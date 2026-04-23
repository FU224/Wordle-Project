import { useEffect, useRef, useState } from "react";
import "./style.css";
import { handleInputLogic } from "./utils/handleInput";
import { getColor } from "./utils/getColor";
import { getEmptyBoard } from "./utils/getEmptyBoard";
import { keyboardRows } from "./utils/keyboard";
import { getTranslation } from "./utils/translations";
import React from "react";
import ReactDOM from "react-dom/client";

const MAX_TRIES = 6;
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [lang, setLang] = useState(localStorage.getItem("language") || "en");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [word, setWord] = useState("");
  const [board, setBoard] = useState(getEmptyBoard(MAX_TRIES, 5));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [submittedRows, setSubmittedRows] = useState([]);
  const savedGameResultRef = useRef(false);

  // Short helper for translated UI text. It keeps JSX cleaner by hiding translation lookup details.
  const t = (key, params) => getTranslation(lang, key, params);

  // Updates the current language and saves it in localStorage so refreshes keep the same choice.
  const handleLanguageChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem("language", newLang);
  };

  // Central reset helper so initial load and "play again" use the same setup logic.
  // It replaces the word and clears all board progress for a fresh round.
  const startNewGame = (nextWord) => {
    setWord(nextWord);
    setBoard(getEmptyBoard(MAX_TRIES, nextWord.length));
    setCurrentRow(0);
    setCurrentCol(0);
    setGameOver(false);
    setWon(false);
    setSubmittedRows([]);
    savedGameResultRef.current = false;
  };

  // Requests a random word from the backend, which now reads words from PostgreSQL.
  const fetchRandomWord = async () => {
    const response = await fetch(`${API_BASE_URL}/words/random`);
    const data = await response.json();

    if (!response.ok || !data.word) {
      throw new Error(data.error || "Failed to load word");
    }

    return data.word;
  };

  // Calculates the visual state of each on-screen keyboard key from already submitted rows.
  const getKeyColor = (letter) => {
    // Keyboard colors keep the "best" result seen so far: green > yellow > gray.
    let bestColor = null;
    
    for (let rowIdx of submittedRows) {
      for (let colIdx = 0; colIdx < board[rowIdx].length; colIdx++) {
        if (board[rowIdx][colIdx] === letter) {
          const color = getColor(letter, colIdx, word, board[rowIdx]);
          

          if (color === "green") {
            return "green";
          } else if (color === "yellow" && bestColor !== "green") {
            bestColor = "yellow";
          } else if (color === "gray" && bestColor === null) {
            bestColor = "gray";
          }
        }
      }
    }
    
    return bestColor;
  };

  // Reloads the user profile from the server whenever we have a token, including after refresh.
  useEffect(() => {
    // If a token exists, fetch the real profile from the server instead of trusting local state.
    const loadProfile = async () => {
      if (!token) {
        setUser(null);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const profile = await response.json();
        setUser(profile);
      } catch {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
    };

    loadProfile();
  }, [token]);

  // Handles both login and registration form submits and stores the successful auth response.
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = authMode === "login" ? "/login" : "/register";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser({
          id: data.id,
          username: data.username,
          stats: data.stats,
        });
        setUsername("");
        setPassword("");
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
    setLoading(false);
  };

  // Clears the local session and resets the game state when the user logs out.
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setWord("");
    setBoard(getEmptyBoard(MAX_TRIES, 5));
  };

  // Starts another round by asking the backend for a new random word and resetting the board.
  const resetGame = () => {
    fetchRandomWord()
      .then((nextWord) => {
        startNewGame(nextWord);
      })
      .catch((error) => {
        alert("Error: " + error.message);
      });
  };

  // Sends one keyboard action into the shared input utility that updates board and game state.
  const handleInput = (key) => {
    // The actual board-editing rules live in a utility so App stays focused on state wiring.
    handleInputLogic({
      key,
      board,
      setBoard,
      currentRow,
      setCurrentRow,
      currentCol,
      setCurrentCol,
      WORD: word,
      MAX_TRIES,
      setGameOver,
      gameOver,
      setSubmittedRows,
      setWon
    });
  };

  // Subscribes to the real keyboard so physical key presses work the same as on-screen buttons.
  useEffect(() => {
    // Listen to physical keyboard input and translate it into the same actions as on-screen keys.
    const handleKey = (e) => {
      if (!word) {
        return;
      }

      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }
      
      if (e.key === "Backspace") return handleInput("BACK");
      if (e.key === "Enter") return handleInput("ENTER");
      if (/^[a-zA-Z]$/.test(e.key)) return handleInput(e.key.toUpperCase());
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  // After a game ends, sends the win/loss result once and refreshes the stats shown in the UI.
  useEffect(() => {
    // Persist the finished game's result exactly once, even though React may re-render.
    const saveGameResult = async () => {
      if (!gameOver || !token || savedGameResultRef.current) {
        return;
      }

      savedGameResultRef.current = true;

      try {
        const response = await fetch(`${API_BASE_URL}/stats`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ won }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to save stats");
        }

        setUser(data);
      } catch (error) {
        savedGameResultRef.current = false;
        alert("Error: " + error.message);
      }
    };

    saveGameResult();
  }, [gameOver, token, won]);

  // Loads the first playable word after the user profile exists and no current word is active yet.
  useEffect(() => {
    // After login/profile load, fetch the first playable word for the session.
    if (!user || word) {
      return;
    }

    fetchRandomWord()
      .then((nextWord) => {
        startNewGame(nextWord);
      })
      .catch((error) => {
        alert("Error: " + error.message);
      });
  }, [user, word]);

  const stats = user?.stats || {
    plays: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
  const statsLabels = {
    plays: "Plays",
    wins: "Wins",
    losses: "Losses",
    winRate: "Win Rate",
    currentStreak: "Current Streak",
    bestStreak: "Best Streak",
  };

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="title">🎮 WORDLE</h1>
            <select value={lang} onChange={(e) => handleLanguageChange(e.target.value)} className="lang-select">
              <option value="en">English</option>
              <option value="lv">Latviešu</option>
              <option value="ru">Русский</option>
            </select>
          </div>
          <form onSubmit={handleAuth}>
            <h2>{authMode === "login" ? t("signin") : t("createAccount")}</h2>
            <input
              type="text"
              placeholder={t("username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="input"
            />
            <input
              type="password"
              placeholder={t("password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
            />
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? t("loading") : authMode === "login" ? t("signin") : t("signup")}
            </button>
          </form>
          <button
            onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
            className="btn-secondary"
          >
            {authMode === "login" ? t("needAccount") : t("haveAccount")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">{t("wordle")}</h1>
        <div className="header-right">
          <select value={lang} onChange={(e) => handleLanguageChange(e.target.value)} className="lang-select">
            <option value="en">English</option>
            <option value="lv">Latviešu</option>
            <option value="ru">Русский</option>
          </select>
          <div className="user-info">
            <span className="username">👤 {user.username}</span>
            <button onClick={handleLogout} className="btn-logout">{t("logout")}</button>
          </div>
        </div>
      </header>

      <main className="game-container">
        <section className="stats-card">
          <div className="stat-item">
            <span className="stat-label">{statsLabels.plays}</span>
            <strong>{stats.plays}</strong>
          </div>
          <div className="stat-item">
            <span className="stat-label">{statsLabels.wins}</span>
            <strong>{stats.wins}</strong>
          </div>
          <div className="stat-item">
            <span className="stat-label">{statsLabels.losses}</span>
            <strong>{stats.losses}</strong>
          </div>
          <div className="stat-item">
            <span className="stat-label">{statsLabels.winRate}</span>
            <strong>{stats.winRate}%</strong>
          </div>
          <div className="stat-item">
            <span className="stat-label">{statsLabels.currentStreak}</span>
            <strong>{stats.currentStreak}</strong>
          </div>
          <div className="stat-item">
            <span className="stat-label">{statsLabels.bestStreak}</span>
            <strong>{stats.bestStreak}</strong>
          </div>
        </section>

        <div className="game-info">
          <p>{t("guessWord", { max: MAX_TRIES })}</p>
          <p className="word-length">{t("wordLength", { length: word.length })}</p>
        </div>

        <div className="board">
          {board.map((row, rIdx) => (
            <div key={rIdx} className="row">
              {row.map((letter, cIdx) => {
                const isSubmitted = submittedRows.includes(rIdx);
                const colorClass = isSubmitted ? getColor(letter, cIdx, word, board[rIdx]) : "";

                return (
                  <div
                    key={cIdx}
                    className={`tile ${colorClass} ${isSubmitted ? "flip" : ""}`}
                    style={{ animationDelay: `${cIdx * 0.1}s` }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="keyboard">
          {keyboardRows.map((row, i) => (
            <div key={i} className="key-row">
              {row.map((key) => {
                const keyColor = (key !== "BACK" && key !== "ENTER") ? getKeyColor(key) : null;
                
                return (
                  <button
                    key={key}
                    onClick={() => handleInput(key)}
                    disabled={!word}
                    className={`key-btn ${keyColor ? keyColor : ''}`}
                  >
                    {key === "BACK" ? "⌫" : key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {gameOver && (
          <div className={`modal ${won ? "won" : "lost"}`}>
            <div className="modal-content">
              <h2>{won ? t("youWon") : t("gameOver")}</h2>
              <p>{t("wordWas", { word })}</p>
              <button onClick={resetGame} className="btn-primary">{t("playAgain")}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
export default App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);