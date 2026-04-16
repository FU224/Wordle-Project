export const handleInputLogic = ({
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
  setSubmittedRows,
  setWon
}) => {
  if (gameOver) return;

  if (key === "BACK") {
    if (currentCol > 0) {
      const newBoard = [...board];
      newBoard[currentRow][currentCol - 1] = "";
      setBoard(newBoard);
      setCurrentCol(currentCol - 1);
    }
  } else if (key === "ENTER") {
    if (currentCol === WORD.length) {
      const guess = board[currentRow].join("");
      setSubmittedRows((prev) => [...prev, currentRow]);

      if (guess === WORD) {
        setGameOver(true);
        setWon(true);
      } else if (currentRow + 1 === MAX_TRIES) {
        setGameOver(true);
        setWon(false);
      } else {
        setCurrentRow(currentRow + 1);
        setCurrentCol(0);
      }
    }
  } else {
    if (currentCol < WORD.length) {
      const newBoard = [...board];
      newBoard[currentRow][currentCol] = key;
      setBoard(newBoard);
      setCurrentCol(currentCol + 1);
    }
  }
};