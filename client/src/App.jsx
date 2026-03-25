import { useState, useEffect } from "react";
import "./style.css";
import { handleInputLogic } from "./utils/handleInput";
import { getColor } from "./utils/getColor";
import { getEmptyBoard } from "./utils/getEmptyBoard";
import { keyboardRows } from "./utils/keyboard";

const WORD = "REACT";
const MAX_TRIES = 6;

function App() {
  const [board, setBoard] = useState(getEmptyBoard(MAX_TRIES, WORD.length));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [submittedRows, setSubmittedRows] = useState([]);

  const handleInput = (key) => {
    handleInputLogic({
      key,
      board,
      setBoard,
      currentRow,
      setCurrentRow,
      currentCol,
      setCurrentCol,
      WORD,
      MAX_TRIES,
      setGameOver,
      gameOver,
      setSubmittedRows
    });
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Backspace") return handleInput("BACK");
      if (e.key === "Enter") return handleInput("ENTER");
      if (/^[a-zA-Z]$/.test(e.key)) return handleInput(e.key.toUpperCase());
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <div className="app">
      <h1>Wordle Clone</h1>

      <button onClick={() => setShowKeyboard(!showKeyboard)}>
        Toggle Keyboard
      </button>

      <div className="board">
        {board.map((row, rIdx) => (
          <div key={rIdx} className="row">
            {row.map((letter, cIdx) => {
              const isSubmitted = submittedRows.includes(rIdx);

              return (
                <div
                  key={cIdx}
                  className={`tile ${
                    isSubmitted ? getColor(letter, cIdx, WORD) : ""
                  } ${isSubmitted ? "flip" : ""}`}
                  style={{ animationDelay: `${cIdx * 0.2}s` }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {showKeyboard && (
        <div className="keyboard">
          {keyboardRows.map((row, i) => (
            <div key={i} className="key-row">
              {row.map((key) => (
                <button key={key} onClick={() => handleInput(key)}>
                  {key === "BACK" ? "⌫" : key}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {gameOver && <div className="game-over">Game Over! Word was {WORD}</div>}
    </div>
  );
}
export default App;