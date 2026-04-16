export const getColor = (letter, index, WORD, guessRow) => {
  if (WORD[index] === letter) return "green";
  
  if (WORD.includes(letter)) {
    const wordCount = Array.from(WORD).filter(l => l === letter).length;
    
    let greenCount = 0;
    for (let i = 0; i < guessRow.length; i++) {
      if (guessRow[i] === letter && WORD[i] === letter) {
        greenCount++;
      }
    }
    
    let yellowCount = 0;
    for (let i = 0; i < index; i++) {
      if (guessRow[i] === letter && WORD[i] !== letter) {
        yellowCount++;
      }
    }
    
    if (greenCount + yellowCount < wordCount) {
      return "yellow";
    }
  }
  
  return "gray";
};