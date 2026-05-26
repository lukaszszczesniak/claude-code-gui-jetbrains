#!/usr/bin/env bash
# English messages (default + fallback locale).
# Variable-prefix pattern for bash 3.2 compatibility:
#   MSG_<locale>_<key>
# shellcheck disable=SC2034

MSG_en_caution_marketplace="⚠  This command only updates the terminal runtime.\n    The JetBrains IDE plugin must be updated separately via the marketplace.\n    (Settings → Plugins → Updates)"

# Status / info
MSG_en_running_already="Already running v%s on port 19836. Opening browser..."
MSG_en_running_already_no_browser="Already running v%s on port 19836."
MSG_en_backend_starting="Starting backend v%s..."
MSG_en_backend_started="Backend ready on port %s."
MSG_en_backend_stopping="Stopping backend (PID %s)..."
MSG_en_backend_stopped="Backend stopped."
MSG_en_opening_browser="Opening %s..."

# Update prompts
MSG_en_update_prompt="A newer version is available: v%s (currently v%s)."
MSG_en_update_prompt_question="Update now? (y/N): "
MSG_en_update_declined="Keeping existing v%s. Opening browser..."
MSG_en_update_killed_old="Stopped old backend. Installing v%s..."

# Errors
MSG_en_err_port_foreign="Port 19836 is in use by another process (not claude-code-gui)."
MSG_en_err_port_foreign_hint="Please stop that process and try again. (Hint: lsof -i :19836)"
MSG_en_err_node_missing="Node.js is not installed or not on PATH."
MSG_en_err_node_missing_hint="Install Node.js ≥ 18 from https://nodejs.org/ and re-run."
MSG_en_err_download_failed="Failed to download %s"
MSG_en_err_no_release="Could not fetch latest release from GitHub."
MSG_en_err_runtime_missing="Runtime v%s is not in cache and download failed."
MSG_en_err_port_handshake_timeout="Backend did not print PORT within %s seconds."

# Doctor
MSG_en_doctor_header="ccg doctor — environment diagnostics"
MSG_en_doctor_node_ok="✔ node: %s"
MSG_en_doctor_node_missing="✘ node: not found"
MSG_en_doctor_path_ok="✔ ~/.claude-code-gui/bin is on PATH"
MSG_en_doctor_path_missing="✘ ~/.claude-code-gui/bin is NOT on PATH"
MSG_en_doctor_cache_count="ℹ cached runtimes: %s"
MSG_en_doctor_port_free="✔ port 19836 is free"
MSG_en_doctor_port_us="ℹ port 19836: our backend (v%s)"
MSG_en_doctor_port_foreign="✘ port 19836: foreign process"

# Version
MSG_en_version_ccg="ccg version: %s"
MSG_en_version_runtime_cached="cached runtime(s): %s"
MSG_en_version_runtime_none="cached runtime(s): (none)"
MSG_en_version_backend_running="running backend: v%s on port 19836"
MSG_en_version_backend_none="running backend: (none)"

# Install / uninstall
MSG_en_install_welcome="Installing claude-code-gui (ccg) v%s..."
MSG_en_install_path_added="Added %s to PATH via %s"
MSG_en_install_path_already="PATH entry already present in %s"
MSG_en_install_done="✔ Installation complete. Open a new terminal or run: source %s"
MSG_en_install_done_then="Then run: ccg"
MSG_en_install_overwrite_prompt="Existing installation v%s detected. Overwrite? (Y/n): "
MSG_en_uninstall_removing="Removing %s..."
MSG_en_uninstall_path_removed="Removed PATH entry from %s"
MSG_en_uninstall_done="✔ Uninstall complete. You may close any open ccg sessions."

# Generic
MSG_en_abort="Aborted."
MSG_en_unknown_command="Unknown command: %s"
MSG_en_usage_header="Usage: ccg <command> [args]"
