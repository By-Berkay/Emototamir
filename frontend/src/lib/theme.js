// Uygulama yalnızca koyu temada çalışır. Açık tema kaldırıldı.
export function getTheme() {
  return "dark";
}

export function applyTheme() {
  const root = document.documentElement;
  root.classList.add("dark");
  root.style.colorScheme = "dark";
}

export function setTheme() {
  applyTheme();
}
