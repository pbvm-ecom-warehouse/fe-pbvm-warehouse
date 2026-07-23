const LEGAL_FORM_WORDS = new Set(["co", "phan", "thanh", "tnhh", "ty", "vien"]);

function toAsciiWords(value: string) {
  return (
    value
      .replace(/[đĐ]/g, (character) => (character === "đ" ? "d" : "D"))
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[A-Za-z0-9]+/g) ?? []
  );
}

export function suggestSupplierCode(name: string) {
  const words = toAsciiWords(name);
  const meaningfulWords = words.filter(
    (word) => !LEGAL_FORM_WORDS.has(word.toLowerCase()),
  );
  const source = meaningfulWords.length > 0 ? meaningfulWords : words;

  return source
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
