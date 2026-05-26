#!/usr/bin/env bash
# Korean messages.
# Variable-prefix pattern for bash 3.2 compatibility: MSG_ko_<key>
# shellcheck disable=SC2034

MSG_ko_caution_marketplace="⚠  이 명령은 터미널 실행용 런타임만 갱신합니다.\n    JetBrains IDE 플러그인 자체는 마켓플레이스를 통해 별도로 업데이트해야 합니다.\n    (Settings → Plugins → Updates)"

# Status / info
MSG_ko_running_already="이미 v%s가 19836 포트에서 실행 중입니다. 브라우저를 엽니다..."
MSG_ko_running_already_no_browser="이미 v%s가 19836 포트에서 실행 중입니다."
MSG_ko_backend_starting="백엔드 v%s를 시작합니다..."
MSG_ko_backend_started="백엔드가 %s 포트에서 준비됐습니다."
MSG_ko_backend_stopping="백엔드를 종료합니다 (PID %s)..."
MSG_ko_backend_stopped="백엔드가 종료됐습니다."
MSG_ko_opening_browser="%s 를 엽니다..."

# Update prompts
MSG_ko_update_prompt="새 버전이 있습니다: v%s (현재 v%s)."
MSG_ko_update_prompt_question="지금 업데이트할까요? (y/N): "
MSG_ko_update_declined="기존 v%s를 유지합니다. 브라우저를 엽니다..."
MSG_ko_update_killed_old="기존 백엔드를 종료했습니다. v%s를 설치합니다..."

# Errors
MSG_ko_err_port_foreign="19836 포트가 다른 프로세스에 점유되어 있습니다 (claude-code-gui가 아님)."
MSG_ko_err_port_foreign_hint="해당 프로세스를 종료한 뒤 다시 시도하세요. (힌트: lsof -i :19836)"
MSG_ko_err_node_missing="Node.js가 설치되어 있지 않거나 PATH에 없습니다."
MSG_ko_err_node_missing_hint="https://nodejs.org/ 에서 Node.js 18 이상을 설치한 뒤 다시 실행하세요."
MSG_ko_err_download_failed="%s 다운로드에 실패했습니다."
MSG_ko_err_no_release="GitHub에서 최신 릴리즈를 가져오지 못했습니다."
MSG_ko_err_runtime_missing="v%s 런타임이 캐시에 없고 다운로드에도 실패했습니다."
MSG_ko_err_port_handshake_timeout="백엔드가 %s초 안에 PORT를 출력하지 않았습니다."

# Doctor
MSG_ko_doctor_header="ccg doctor — 환경 진단"
MSG_ko_doctor_node_ok="✔ node: %s"
MSG_ko_doctor_node_missing="✘ node: 찾을 수 없음"
MSG_ko_doctor_path_ok="✔ ~/.claude-code-gui/bin 이 PATH에 있음"
MSG_ko_doctor_path_missing="✘ ~/.claude-code-gui/bin 이 PATH에 없음"
MSG_ko_doctor_cache_count="ℹ 캐시된 런타임: %s개"
MSG_ko_doctor_port_free="✔ 19836 포트가 비어있음"
MSG_ko_doctor_port_us="ℹ 19836 포트: 우리 백엔드 (v%s)"
MSG_ko_doctor_port_foreign="✘ 19836 포트: 다른 프로세스 점유"

# Version
MSG_ko_version_ccg="ccg 버전: %s"
MSG_ko_version_runtime_cached="캐시된 런타임: %s"
MSG_ko_version_runtime_none="캐시된 런타임: (없음)"
MSG_ko_version_backend_running="실행 중인 백엔드: v%s (19836 포트)"
MSG_ko_version_backend_none="실행 중인 백엔드: (없음)"

# Install / uninstall
MSG_ko_install_welcome="claude-code-gui (ccg) v%s 설치를 시작합니다..."
MSG_ko_install_path_added="%s 를 PATH에 추가했습니다 (%s)"
MSG_ko_install_path_already="%s 에 PATH 항목이 이미 있습니다"
MSG_ko_install_done="✔ 설치 완료. 새 터미널을 열거나 다음을 실행하세요: source %s"
MSG_ko_install_done_then="그 후 실행: ccg"
MSG_ko_install_overwrite_prompt="기존 설치(v%s)가 감지됐습니다. 덮어쓸까요? (Y/n): "
MSG_ko_uninstall_removing="%s 를 제거합니다..."
MSG_ko_uninstall_path_removed="%s 에서 PATH 항목을 제거했습니다"
MSG_ko_uninstall_done="✔ 제거 완료. 실행 중인 ccg 세션이 있다면 종료하세요."

# Generic
MSG_ko_abort="중단됐습니다."
MSG_ko_unknown_command="알 수 없는 명령: %s"
MSG_ko_usage_header="사용법: ccg <command> [args]"
