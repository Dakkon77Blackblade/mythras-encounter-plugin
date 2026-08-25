---
description: Standard workflow guidelines for developing the Mythras Encounter Plugin.
trigger: always_on
---

# Mythras Encounter Plugin Development Workflow

Whenever the user asks you to implement a new feature or fix a bug in this project, you must follow this exact workflow:

## 1. Issue Tracking
- Before writing code, use the `gh issue create` command to create a GitHub issue describing the feature or bug (unless an issue already exists for it).
- Keep the title clear and add a short description outlining the requirements.

## 2. Branching
- Create a feature branch off of `main` using the format: `feature/issue-<number>-<short-description>`.
- Example: `git checkout -b feature/issue-8-add-spells`.
- Never commit directly to `main`.

## 3. Implementation and Planning
- For complex changes, use the Antigravity planning mode (create an `implementation_plan.md` artifact and wait for user approval).
- Write clean, documented TypeScript.
- Update `CHANGELOG.md` under the `[Unreleased]` header for all notable changes before merging.

## 4. Building and Verification
- Always run `npm run build` to verify the code compiles without TypeScript errors.
- Ensure the Obsidian plugin's `main.js` is up to date (we use a symlink for local development, so the build output immediately reflects in the Obsidian vault).

## 5. Pull Request and Merge
- Add all files, commit with a descriptive message referencing the issue number (e.g., `git commit -m "Implement spells system (fixes #8)"`).
- Push the feature branch to `origin`.
- Use the GitHub CLI to create and merge a Pull Request automatically:
  ```bash
  gh pr create --title "Short summary" --body "Fixes #<number>"
  gh pr merge --merge --delete-branch
  ```
- Switch back to `main` (`git checkout main`) and pull the latest changes (`git pull`).

Follow this workflow rigorously to keep the repository history clean and traceable.
