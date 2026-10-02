// The emoji people can react with (C35). Client-safe: the reactions UI and lib/comments both read it.
export const freeRxns = ['➕', '➖', '🤔', '😮', '🥳', '💡', '❓', '🔥', '👏', '🌈']

// Tipped reactions: dollars of charity money moved to the commenter.
export const tippedRxns = {
  '🧡': 1,
  '🏅': 10,
  '🏆': 100,
} as { [key: string]: number }
