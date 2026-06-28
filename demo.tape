# LocaleGuard terminal demo.
#
# Render to demo.gif with VHS (https://github.com/charmbracelet/vhs):
#   brew install vhs        # (or see VHS install docs)
#   vhs demo.tape
#
# CI can render it via .github/workflows/demo.yml.

Output demo.gif

Set Shell "bash"
Set FontSize 16
Set Width 1120
Set Height 760
Set Padding 20
Set Theme "Dracula"
Set TypingSpeed 55ms

# Setup (hidden): build, then expose `localeguard` as a function that runs the
# built entrypoint directly — no dependency on npm having linked the bin, so this
# works in CI and on a fresh clone.
Hide
Type `ROOT="$(git rev-parse --show-toplevel)"` Enter
Type `npm --prefix "$ROOT" run build >/dev/null 2>&1` Enter
Sleep 12s
Type `localeguard() { node "$ROOT/packages/cli/dist/src/index.js" "$@"; }` Enter
Type `cd "$ROOT/examples/react-i18next-app"` Enter
Type "clear" Enter
Show

Sleep 800ms
Type "localeguard check" Sleep 700ms Enter
Sleep 5s
