import { useState, useEffect } from "react";
import "./style.css";
import { handleInputLogic } from "./utils/handleInput";
import { getColor } from "./utils/getColor";
import { getEmptyBoard } from "./utils/getEmptyBoard";
import { keyboardRows } from "./utils/keyboard";
import { getTranslation } from "./utils/translations";

const WORDS = ["MUSIC", "GAMES", "REACT", "PLANT", "CHAIN", "STONE", "PHONE", "WORLD", "HEART", "EARTH"];
const MAX_TRIES = 6;

function App() {
  const [lang, setLang] = useState(localStorage.getItem("language") || "en");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [word, setWord] = useState(WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [board, setBoard] = useState(getEmptyBoard(MAX_TRIES, word.length));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [submittedRows, setSubmittedRows] = useState([]);

  const t = (key, params) => getTranslation(lang, key, params);

  const handleLanguageChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem("language", newLang);
  };

  const getKeyColor = (letter) => {
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

  useEffect(() => {
    if (token) {
      setUser({ token });
    }
  }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = authMode === "login" ? "/login" : "/register";
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser({ username: data.username });
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const resetGame = () => {
    const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    setWord(newWord);
    setBoard(getEmptyBoard(MAX_TRIES, newWord.length));
    setCurrentRow(0);
    setCurrentCol(0);
    setGameOver(false);
    setWon(false);
    setSubmittedRows([]);
  };

  const handleInput = (key) => {
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

  useEffect(() => {
    const handleKey = (e) => {
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
        <h1 className="title">🎮 {t("wordle")}</h1>
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