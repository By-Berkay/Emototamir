// Açık / koyu tema. Seçim tarayıcıda saklanır; seçim yoksa işletim sisteminin tercihi kullanılır.
const KEY = "emt-theme";

export function getTheme() {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {
    // Depolama kapalıysa (gizli pencere vb.) sistem tercihine düşülür
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme) {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch (e) {
    // Kaydedilemezse yalnızca bu oturumda uygulanır
  }
  applyTheme(theme);
}
