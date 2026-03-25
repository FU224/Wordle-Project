export const getEmptyBoard = (rows, cols) => {
  return Array.from({ length: rows }, () => Array(cols).fill(""));
};