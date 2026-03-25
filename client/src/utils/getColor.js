export const getColor = (letter, index, WORD) => {
  if (WORD[index] === letter) return "green";
  if (WORD.includes(letter)) return "yellow";
  return "gray";
};