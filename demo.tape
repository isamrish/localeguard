# LocaleGuard terminal demo.
#
# Render to demo.gif with VHS (https://github.com/charmbracelet/vhs):
#   brew install vhs        # (or see VHS install docs)
#   npm run build && vhs demo.tape
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

# Setup (hidden): use the locally built CLI and run inside the example app.
Hide
Type `export PATH="$(git rev-parse --show-toplevel)/node_modules/.bin:$PATH"` Enter
Type `cd "$(git rev-parse --show-toplevel)/examples/react-i18next-app"` Enter
Type "clear" Enter
Show

Sleep 800ms
Type "localeguard check" Sleep 700ms Enter
Sleep 5s
