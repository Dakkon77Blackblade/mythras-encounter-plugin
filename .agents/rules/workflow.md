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
- **USER TESTING IS MANDATORY:** You MUST STOP and wait for the user to explicitly confirm that they have tested the changes and that everything works flawlessly in Obsidian. DO NOT proceed to the merge step until the user gives explicit approval.

## 5. Versioning
- Before committing your final changes on the feature branch, always bump the version if the changes warrant it.
- Run `npm version patch` (for bug fixes), `npm version minor` (for new features), or `npm version major` (for breaking changes).
- This will automatically run `version-bump.mjs` and sync `manifest.json` and `versions.json`.

## 6. Merge and Push (No Pull Request)
- **CRITICAL**: ONLY perform this step AFTER the user has explicitly confirmed successful testing of the feature branch.
- Add all files, commit with a descriptive message referencing the issue number (e.g., `git commit -m "Implement spells system (#8)"`).
- Push the feature branch to `origin` for backup.
- Since we are doing local feature development, do not use Pull Requests. Instead, merge the feature branch directly into `main` locally and push:
  ```bash
  git checkout main
  git merge feature/issue-<number>-<short-description>
  git push origin main
  ```
- Delete the feature branch locally and remotely, and close the issue:
  ```bash
  git branch -d feature/issue-<number>-<short-description>
  git push origin --delete feature/issue-<number>-<short-description>
  gh issue close <number>
  ```

Follow this workflow rigorously to keep the repository history clean and traceable.
