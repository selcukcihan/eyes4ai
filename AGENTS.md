# Project Rules

These instructions apply to every task performed in this repository.

## Purpose
- Treat this file as the project-wide source of truth for repository-specific working rules.
- Read and follow these instructions before making changes in this repo.

## Working Style
- Prefer minimal, targeted changes over broad refactors.
- Preserve existing conventions and structure unless explicitly asked to change them.
- Call out assumptions when repository context is missing.
- If a request is ambiguous and the risk of a wrong change is material, ask a concise clarifying question before editing.

## Code Changes
- Fix root causes when practical; avoid cosmetic-only changes unless requested.
- Do not introduce new dependencies unless they are necessary for the task.
- Keep files and APIs simple; avoid premature abstraction.
- Add comments only when they clarify non-obvious logic.

## Verification
- Run the smallest relevant verification for the change made.
- If tests or builds cannot be run, state that clearly and explain why.
- Do not claim success without checking the relevant output.
- Make sure to run the full test suite and any linters and checks after each iteration.
- After each UI or style change, generate fresh screenshots that reflect the current state and attach them in the chat so the user gets visual confirmation of the direction.

## Safety
- Do not overwrite or revert user changes unless explicitly requested.
- Avoid destructive commands unless the user clearly asked for them.
- For secrets, use environment variables or the project’s existing secret-management approach.

## Communication
- Be concise and direct.
- Summarize what changed, how it was verified, and any remaining risk.
- Prefer actionable next steps over long explanations.

## Updating These Rules
- If the user asks to change repository-wide behavior, update this file.
- New instructions added here should be treated as persistent for future interactions in this repo.

## Logging LLM Use
- Maintain an append only file that logs all user input that you receive. Make sure there are no secrets in this log file because we will check it in git.
- The logs should also include a timestamp.
- One log entry per line.
- Do not log prompts that does not touch any files in the repo that needs version controlling. An example is, if the prompt asks a question about a concept, we do not log this as it won't change the state of the repository.

## Version Control
- After each prompt you generate or alter some code, make sure to add them to git.
- To do that, you do "git add ." and git commit with a meaningful and concise message.
- Never ever check in secrets or personal data.
- Use git in an append only manner, do only incremental updates and never rollback changes or overwrite previous commits.

## Testing
- Testing logic must be self contained.
- Tests must be lightweight most of the time.
- Tests must only depend on the subject being tested.
- Tests for each app must live in a sibling `test` directory at the same level as `src`.
- Test directory hierarchy must mirror the `src` hierarchy.
- If a source file is `src/foo/bar.ts`, its test should be `test/foo/bar.test.ts`.

## Development
- Keep separate concerns in separate files.
- Favor composition over inheritance.
- Consider using dependency injection and keep dependencies to a minimum.
- Keep functions small and one purpose.
- Each module, function or unit of development must have a single responsibility.
- Each file/module must be responsible for one thing only.
- Keep diffs to a minimum as much as possible.
- Maintain a fast feedback loop in our development cycle.
- Act as autonomous as possible with minimal guidance from user by making use of all the skills available to you.
- Long-running or batch-style scripts must emit progress logging so the user can see what the script is doing, how many items have been processed, how many remain, and overall progress.

## Technical Decisions
- Before picking a certain solution like a framework, cloud provider or database etc. you must run it through me and we decide together.
- Find a good balance of tech-debt tomorrow vs. practicality today.

## How You as Coding Agent Act

Operate autonomously. Do not stop to propose obvious next steps.
If a next step is sensible and low-risk, implement it.
Make reasonable assumptions from the existing codebase and continue until you hit a real blocker.

Only interrupt me if:
1. The choice is irreversible or high-risk.
2. You need external credentials, access, or a product decision that cannot be inferred.
3. You find conflicting requirements in the repo or my prior instructions.

Otherwise:
- choose the next step yourself
- make the code changes
- run relevant tests/checks
- fix follow-up issues you introduced
- continue iterating

Batch non-blocking questions at the end under “Open decisions”.
Do not ask me for permission to do straightforward engineering work.

You may modify app code, tests, config, migrations, and docs in this repo.
You may install/update normal dependencies if needed.
Prefer the most complete implementation over a partial scaffold.

