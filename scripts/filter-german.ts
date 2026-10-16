const SKIP_PHRASES = [
    "B2", "C1", "C2",
    "sehr gute Deutschkenntnisse",
    "verhandlungssicher",
    "fluent German",
    "fließend Deutsch",
    "sichere Beherrschung",
];

const SOFT_PHRASES = [
    "A2", "B1",
    "gute Deutschkenntnisse",
    "Grundkenntnisse",
    "German is a plus",
];

// Returns the first phrase found as a whole word, or null.
// \b means "word boundary", so "B2" matches "B2" but not "B2B".
function findPhrase(text: string, phrases: string[]) {
    for (const phrase of phrases) {
        if (new RegExp(`\\b${phrase}\\b`, "i").test(text)) {
            return phrase;
        }
    }
    return null;
}

export function skipGerman(text: string) {
    return findPhrase(text, SKIP_PHRASES);
}

export function softGerman(text: string) {
    return findPhrase(text, SOFT_PHRASES);
}
