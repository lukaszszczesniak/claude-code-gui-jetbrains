#!/usr/bin/env bash
# Polish messages.
# Variable-prefix pattern for bash 3.2 compatibility:
#   MSG_pl_<key>
# shellcheck disable=SC2034

MSG_pl_caution_marketplace="⚠  To polecenie aktualizuje wyłącznie runtime uruchamiany w terminalu.\n    Samą wtyczkę do IDE JetBrains trzeba zaktualizować osobno przez marketplace.\n    (Settings → Plugins → Updates)"

# Status / info
MSG_pl_running_already="v%s działa już na porcie 19836. Otwieranie przeglądarki..."
MSG_pl_running_already_no_browser="v%s działa już na porcie 19836."
MSG_pl_backend_starting="Uruchamianie backend v%s..."
MSG_pl_backend_started="Backend gotowy na porcie %s."
MSG_pl_backend_stopping="Zatrzymywanie backendu (PID %s)..."
MSG_pl_backend_stopped="Backend zatrzymany."
MSG_pl_opening_browser="Otwieranie %s..."

# Update prompts
MSG_pl_update_prompt="Dostępna jest nowsza wersja: v%s (obecnie v%s)."
MSG_pl_update_prompt_question="Zaktualizować teraz? (y/N): "
MSG_pl_update_declined="Utrzymuję obecną v%s. Otwieranie przeglądarki..."
MSG_pl_update_killed_old="Zatrzymano stary backend. Instalowanie v%s..."

# Errors
MSG_pl_err_port_foreign="Port 19836 jest zajęty przez inny proces (nie claude-code-gui)."
MSG_pl_err_port_foreign_hint="Zatrzymaj ten proces i spróbuj ponownie. (Wskazówka: lsof -i :19836)"
MSG_pl_err_node_missing="Node.js nie jest zainstalowany lub nie ma go w PATH."
MSG_pl_err_node_missing_hint="Zainstaluj Node.js ≥ 18 ze strony https://nodejs.org/ i uruchom ponownie."
MSG_pl_err_download_failed="Nie udało się pobrać %s"
MSG_pl_err_no_release="Nie udało się pobrać najnowszego release'u z GitHuba."
MSG_pl_err_runtime_missing="Runtime v%s nie ma w cache, a pobieranie się nie powiodło."
MSG_pl_err_port_handshake_timeout="Backend nie wyprintował PORT w ciągu %s sekund."

# Doctor
MSG_pl_doctor_header="ccg doctor — diagnostyka środowiska"
MSG_pl_doctor_node_ok="✔ node: %s"
MSG_pl_doctor_node_missing="✘ node: nie znaleziono"
MSG_pl_doctor_path_ok="✔ ~/.claude-code-gui/bin jest w PATH"
MSG_pl_doctor_path_missing="✘ ~/.claude-code-gui/bin NIE jest w PATH"
MSG_pl_doctor_cache_count="ℹ runtime'y w cache: %s"
MSG_pl_doctor_port_free="✔ port 19836 jest dostępny"
MSG_pl_doctor_port_us="ℹ port 19836: nasz backend (v%s)"
MSG_pl_doctor_port_foreign="✘ port 19836: obcy proces"

# Version
MSG_pl_version_ccg="wersja ccg: %s"
MSG_pl_version_runtime_cached="runtime(y) w cache: %s"
MSG_pl_version_runtime_none="runtime(y) w cache: (brak)"
MSG_pl_version_backend_running="działający backend: v%s na porcie 19836"
MSG_pl_version_backend_none="działający backend: (brak)"

# Install / uninstall
MSG_pl_install_welcome="Instalowanie claude-code-gui (ccg) v%s..."
MSG_pl_install_path_added="Dodano %s do PATH przez %s"
MSG_pl_install_path_already="Wpis w PATH już istnieje w %s"
MSG_pl_install_done="✔ Instalacja zakończona. Otwórz nowy terminal lub wpisz w obecnym: source %s"
MSG_pl_install_done_then="Następnie uruchom poleceniem: ccg"
MSG_pl_install_overwrite_prompt="Wykryto istniejącą instalację v%s. Nadpisać? (Y/n): "
MSG_pl_uninstall_removing="Usuwanie %s..."
MSG_pl_uninstall_path_removed="Usunięto wpis z PATH w %s"
MSG_pl_uninstall_done="✔ Odinstalowano. Możesz zamknąć otwarte sesje ccg."

# List (process tree)
MSG_pl_list_header="Procesy backendu claude-code-gui:"
MSG_pl_list_none="Żaden proces backendu claude-code-gui nie jest obecnie uruchomiony."
MSG_pl_list_root_with_port="● PID %s  port %s%s  [%s/%s]"
MSG_pl_list_root_no_port="● PID %s  [%s/%s]"
MSG_pl_list_port_confirmed=" ✔"
MSG_pl_list_port_unconfirmed=" ?"
MSG_pl_list_child="    └─ PID %s  %s"
MSG_pl_list_zombie_hint="(zombie — zabij jego proces nadrzędny, aby go usunąć)"
MSG_pl_list_help_hint="Użyj 'ccg stop', aby zakończyć drzewo backendu na porcie 19836."

# Stop (process tree termination)
MSG_pl_stop_none="Żaden backend nie działa na porcie %s."
MSG_pl_stop_target="Zatrzymywanie drzewa backendu z korzeniem w PID %s..."
MSG_pl_stop_done="Drzewo backendu zatrzymane."
MSG_pl_stop_force="Tryb wymuszony: wysyłanie SIGKILL natychmiast (bez łagodnego zamykania)."
MSG_pl_stop_all_prompt="To zatrzyma WSZYSTKIE drzewa backend.mjs (znaleziono %s), w tym te zarządzane przez IDE. Kontynuować? (y/N): "
MSG_pl_stop_all_none="Nie znaleziono drzew backend.mjs do zatrzymania."
MSG_pl_stop_no_roots="Nie znaleziono drzew backend.mjs."
MSG_pl_stop_not_ours="⚠  PID %s nie należy do drzewa backendu claude-code-gui."
MSG_pl_stop_not_ours_prompt="Zabić go mimo to (wraz z procesami potomnymi)? (y/N): "
MSG_pl_stop_aborted="Przerwano. Nic nie zostało zatrzymane."

# Doctor (backend process hint)
MSG_pl_doctor_backend_count="ℹ wykryto procesy backend.mjs: %s — uruchom 'ccg list', aby zobaczyć drzewo"
MSG_pl_doctor_backend_warn="⚠ wykryto procesy backend.mjs: %s — uruchom 'ccg list', aby sprawdzić"

# Help: list / stop
MSG_pl_help_list_header="ccg list — pokaż drzewo procesów backendu"
MSG_pl_help_list_body="  ccg list             Wypisz backend(y) i ich procesy potomne,\n                       z PID, portem (jeśli jest) i etykietą źródła (ide/standalone).\n  ccg list -h, --help  Pokazuje tę pomoc."
MSG_pl_help_stop_header="ccg stop — zakończ drzewo procesów backendu"
MSG_pl_help_stop_body="  ccg stop                 Zatrzymaj backend na porcie 19836 wraz z procesami potomnymi.\n  ccg stop <pid>           Zatrzymaj drzewo z korzeniem w tym PID.\n  ccg stop --port <port>   Zatrzymaj backend na tym porcie (alias: -p).\n  ccg stop --all           Zatrzymaj KAŻDE drzewo backend.mjs, także te z IDE (pyta najpierw; alias: -a).\n  ccg stop --force         Pomiń SIGTERM, wyślij SIGKILL natychmiast (alias: -f).\n  ccg stop --no-tree       Zatrzymaj tylko wskazany proces, bez procesów potomnych.\n  ccg stop -h, --help      Pokazuje tę pomoc.\n\n  Kolejność kończenia: najpierw procesy potomne (liście), potem korzeń. Każdy proces\n  dostaje SIGTERM, do 3 sekund na zakończenie, następnie SIGKILL. Z --force SIGKILL\n  wysyłany jest natychmiast. PID, który nie należy do drzewa backendu, wyzwala\n  pytanie o potwierdzenie, zanim cokolwiek zostanie zabite."

# Help: run / update / version / doctor / self-update / uninstall
MSG_pl_help_run_header="ccg run — uruchamia backend i otwiera przeglądarkę"
MSG_pl_help_run_body="  ccg run              Sprawdza port 19836, uruchamia nowy backend (lub używa już działającego),\n                       następnie otwiera WebView w przeglądarce. To domyślne\n                       polecenie, więc samo 'ccg' działa tak samo. Nie przyjmuje argumentów.\n  ccg run -h, --help   Pokazuje tę pomoc."
MSG_pl_help_update_header="ccg update — wymusza aktualizację runtime'u do najnowszego release'u"
MSG_pl_help_update_body="  ccg update             Aktualizuje runtime do najnowszego release'u z GitHuba. Jeśli\n                         backend działa, jest najpierw zatrzymywany, a potem zastępowany.\n  ccg update -h, --help  Pokazuje tę pomoc."
MSG_pl_help_version_header="ccg version — pokazuje wersje ccg, runtime'u i backendu"
MSG_pl_help_version_body="  ccg version             Pokazuje zainstalowany ccg, runtime'y w cache oraz\n                          wersję ewentualnego działającego backendu. Alias: -v.\n  ccg version -h, --help  Pokazuje tę pomoc."
MSG_pl_help_doctor_header="ccg doctor — zdiagnozuj środowisko"
MSG_pl_help_doctor_body="  ccg doctor             Sprawdza node, PATH, cache, port 19836 oraz ile\n                         procesów backendu jest w tym momencie uruchomionych.\n  ccg doctor -h, --help  Pokazuje tę pomoc."
MSG_pl_help_self_update_header="ccg self-update — aktualizacja ccg"
MSG_pl_help_self_update_body="  ccg self-update             Uruchamia ponownie skrypt instalacyjny, aby zaktualizować cli ccg.\n  ccg self-update -h, --help  Pokazuje tę pomoc."
MSG_pl_help_uninstall_header="ccg uninstall — usuwa ccg z tej maszyny"
MSG_pl_help_uninstall_body="  ccg uninstall             Usuwa ccg z tej maszyny (pliki binarne, runtime'y, wpis w PATH).\n  ccg uninstall -h, --help  Pokazuje tę pomoc."

# Restart loop (standalone foreground)
MSG_pl_backend_restarting="Backend zakończył się z sygnałem restartu. Restartowanie..."
MSG_pl_err_restart_loop="Backend restartował się zbyt szybko (wykryto pętlę awarii). Przerywam."

# Generic
MSG_pl_abort="Przerwano."
MSG_pl_unknown_command="Nieznane polecenie: %s"
MSG_pl_usage_header="Użycie: ccg <command> [args]"
