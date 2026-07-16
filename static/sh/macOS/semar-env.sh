autoload -Uz colors && colors

_semarenv_allowed_paths=()
_semarenv_config_hash=""

_semarenv_msg() {
  [[ -z "$1" ]] && return
  local color="$1"
  shift

  if (( $# == 0 )); then
    print -P "%F{$color}[SemarEnv]%f"
  else
    print -P "%F{$color}[SemarEnv] ${*:1}%f"
  fi
}

_semarenv_hash() {
  local hash
  if hash=$(shasum -a 256 "$1" 2>/dev/null); then
    echo ${hash%% *}
  else
    echo "invalid"
    return 1
  fi
}

_semarenv_reload() {
  local config_file
  local -a valid_paths
  local new_hash dir_path clean_dir

    if [[ -f "$HOME/Library/SemarEnv/bin/.semarenv.dir" ]]; then
      config_file="$HOME/Library/SemarEnv/bin/.semarenv.dir"
    elif [[ -f "$HOME/Library/PhpWebStudy/bin/.semarenv.dir" ]]; then
      config_file="$HOME/Library/PhpWebStudy/bin/.semarenv.dir"
    else
      return 1
    fi

  new_hash=$(_semarenv_hash "$config_file") || return

  [[ "$new_hash" == "$_semarenv_config_hash" ]] && return

  _semarenv_allowed_paths=()
  _semarenv_config_hash="$new_hash"

  if [[ -f "$config_file" ]]; then
    while IFS= read -r dir_path || [[ -n "$dir_path" ]]; do
      dir_path="${dir_path//$'\r'/}"
      if [[ "$dir_path" =~ ^/ ]]; then
        clean_dir="${dir_path:A}"
        clean_dir="${clean_dir%%/}"
        valid_paths+=("$clean_dir")
      fi
    done < "$config_file"
  else
    return 1
  fi

  _semarenv_allowed_paths=("${valid_paths[@]}")
}

semarenv_autoload() {
  _semarenv_reload || return
  local current_path="${PWD}" found=0
  for allow_path in "${_semarenv_allowed_paths[@]}"; do
    [[ "$allow_path" == "$current_path" ]] && { found=1; break; }
  done
  (( found )) || return

  if [[ -f ".semarenv" ]]; then
    _semarenv_msg cyan "Loading environment variables..."
    source ".semarenv" && _semarenv_msg green "âœ“ Load successful" || _semarenv_msg red "âœ— Load failed"
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd semarenv_autoload

semarenv_autoload
