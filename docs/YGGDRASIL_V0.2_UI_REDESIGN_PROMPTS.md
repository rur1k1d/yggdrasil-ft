# Yggdrasil-ft v0.2.0 - UI Redesign Prompts & Notes
Data: 2025-10-25
Autor: Commander

## Koncepcja
- Styl: A) Refined Dark Rune - ciemny, elegancki, premium. Zachowujemy obecną paletę (złoto/czerń/szarości) jako unikatową pod nas.
- "Wow" na wejściu, po wejściu do drzewa bardziej stonowane premium.
- Drzewo ma iść z góry na dół (top->down) zgodnie z dynasty layout: head na górze, partner obok, dzieci poniżej, rodzice powyżej, unlinked tray z boku.
- Główny nacisk na czytelność przy dużym drzewie.
- Animacje: mocniejsze tylko na starcie (DataRain), po wejściu subtelne hover/fade, respektować prefers-reduced-motion.
- Offline-first. Aplikacja ma dać się ściągnąć i uruchomić lokalnie na Windows/Linux (instrukcja).

## Komponenty z 21st.dev / inspiracje
Używamy inspiracji Termix pod kątem dashboardowego podejścia, ale bez kopiowania 1:1. Priorytet: czytelne połączenia w drzewie idące z góry na dół.

## DataRain (intro)
Integracja animacji DataRain na ekranie powitalnym.
- Dostosować do Preact (useEffect/useRef z preact/hooks)
- Pełnoekranowe na starcie
- Po krótkim czasie / kliknięciu "Enter" fade-out do widoku drzewa
- Respektować prefers-reduced-motion (minimalna wersja)
- Zachować wydajność

## Dashboard-like management (na wzór Termix)
Chcemy wygodnego "dashboardu" do zarządzania zawartością drzewka. Ma być przejrzysty, top->down w nawigacji po strukturze.

## Offline download
Dodać instrukcję pobrania uruchomienia lokalnie:
- Windows (npm i / npm run dev lub build + preview)
- Linux (npm i / npm run dev lub build + preview)
- Opcja dist/ jako statyczna paczka

Plik: INSTALL_LOCAL.md w projekcie.

## Zasady
- Minimalne zmiany, bez dużego refaktoru
- Engine first (tree-layout) potem wizual
- Po każdym większym kroku sprawdzać
- Commit dopiero po mojej akceptacji
- Wszystkie pliki/docs w EN poza dyskusją
- Preact + Vite + TS, bez masowej migracji na shadcn/React
