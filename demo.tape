# eyes4ai demo — record with: vhs demo.tape
# Install VHS: https://github.com/charmbracelet/vhs

Output demo.gif
Output demo.mp4

Set Shell "bash"
Set FontSize 14
Set Width 1000
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

# Title
Type "# eyes4ai — passive AI activity recorder"
Enter
Sleep 1s

# Step 1: Install
Type "# Step 1: Install globally"
Enter
Sleep 500ms
Type "npm install -g @eyes4ai/cli"
Enter
Sleep 2s
Type "eyes4ai install 4318 --global"
Enter
Sleep 3s

# Step 2: Show what was configured
Type "# Codex, Claude Code, git hooks, and daemon are now set up"
Enter
Sleep 2s

# Step 3: Use an AI tool (simulate)
Type "# Step 2: Use your AI tools as usual — Codex, Claude Code, etc."
Enter
Sleep 1s
Type "# eyes4ai passively records OTel telemetry in the background"
Enter
Sleep 2s

# Step 4: Make a commit
Type "# Step 3: Commit your work"
Enter
Sleep 500ms
Type 'git commit -m "feat: add auth module"'
Enter
Sleep 2s

# Step 5: Check the report
Type "# Step 4: Check your AI activity report"
Enter
Sleep 500ms
Type "eyes4ai report --days 7"
Enter
Sleep 4s

# Show sample output
Type ""
Enter
Type "# Period: last 7 days"
Enter
Type "#"
Enter
Type "# AI activity"
Enter
Type "#   Sessions:          12  (codex: 8, claude: 4)"
Enter
Type "#   Turns:             87  (codex: 55, claude: 32)"
Enter
Type "#   AI-active days:    5 / 7"
Enter
Type "#   Estimated cost:    $4.23  (codex: $2.80, claude: $1.43)"
Enter
Type "#"
Enter
Type "# Committed output"
Enter
Type "#   AI-linked commits: 9"
Enter
Type "#   Lines changed:     +1,247 / -382"
Enter
Type "#"
Enter
Type "# Yield"
Enter
Type "#   Session-to-commit: 75%"
Enter
Type "#   Avg cost/commit:   $0.47"
Enter
Sleep 5s

Type "# All data stays local. No cloud. No telemetry leaves your machine."
Enter
Sleep 3s
