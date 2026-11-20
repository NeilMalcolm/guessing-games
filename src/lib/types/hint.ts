
/**
 * Returns the display text for the given word. Displays with a capitalised first letter.
 * @param word the word to get display text for.
 * @returns a string representing the word with a capitalised first letter.
 */
export function getInDisplayTextFormat(word: string): string {
    if (!word || word.length === 0) {
        return word;
    }

    return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
 }