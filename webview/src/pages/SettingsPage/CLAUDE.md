# Settings Page Authoring Principles

Every agent that adds or modifies a setting item under `SettingsPage` follows the principles below.
Exceptions are made **only in special cases or when the user gives separate instructions.**

## 1. Check First — Look at the Reference First

**Before** adding a setting, verify whether the same setting already exists in Cursor's official Claude Code extension.

- Reference location: `~/.vscode/extensions/anthropic.claude-code-*` (or `~/.cursor/extensions/...`).
  Setting keys are in `package.json` under `contributes.configuration` (e.g., `claudeCode.*`); UI text/behavior is in
  `webview/index.js` (minified). (See [[cursor-claude-code-extension-bundle-reverse-engineering]])
- **If a matching feature exists, bring over its behavior, title/description text, and value type as faithfully as possible.**
  Making it 100% identical to the reference is the best practice and the goal. Do not make it arbitrarily different.
- Only when there is no matching feature do you move on to the principles below.

## 2. If Not in the Reference — Keep It Simple and Clear

A new setting with no match in the reference should be made in the **simplest possible form**.

- Keep the description text as short as possible. **Short enough to read as a single line even on mobile** — simple but clear.
- Example: `CLAUDE_CONFIG_DIR` → label `CLAUDE_CONFIG_DIR`,
  description `Home directory for Claude's config. Same as the CLAUDE_CONFIG_DIR environment variable.`
- Avoid verbose, multi-sentence descriptions (listing the scope of behavior, side notes, etc.).

## 3. Add New Settings to General

Unless instructed otherwise, put new setting items in the [General](./General/index.tsx) section.
Only place them in a section that is clearly a different domain (CLI, Appearance, Privacy, etc.) — and even then,
treat "when in doubt, General" as the default.

## 4. Use the User's Wording As-Is for Naming

Do not arbitrarily alter label/key names. Use the **exact** text of the words the user used.

- If the user calls it `CLAUDE_CONFIG_DIR`, the label is also `CLAUDE_CONFIG_DIR`. Do not change it to ~~`Config Directory`~~ on your own.
- Expose unique identifiers such as environment variables, flags, and CLI options in their original form.

## 5. Don't Create a New Section Just for One Item

A `SettingSection` (title + box) is created **only when grouping several related items.**
Creating a whole set of `section + title + description + input` just to add a single input
is a UI misuse antipattern. Add it as a single `SettingRow` within an existing section.

- Good examples: [HostModeRow](./General/HostModeRow.tsx), [ClaudeConfigDirRow](./General/ClaudeConfigDirRow.tsx)
  — both are single `SettingRow`s inside the General section.
- Antipattern: wrapping each item in a new `<SettingSection title="...">`.

## 6. Don't Add a Save Button — Input Is Save

Except in special cases, do not introduce a Save button. **Input = save** must hold.

- `Select` / `ToggleSwitch`: save immediately on `onChange`.
- Free input (`input`): save on `onBlur` (when focus leaves). Skip saving if the value has not changed.
- Do not add ~~a separate `Save` button~~ or ~~auxiliary buttons like "Save to global / Save to project"~~.

## Component Patterns

- Separate each setting item into a component in its own file (e.g., `XxxRow.tsx`), and compose it in the section's `index.tsx`.
- Use `SettingSection` / `SettingRow` from [common](./common) for shared layout.
- For global/project scope, `ScopeTabs` synchronizes both the `useSettings` and `useClaudeSettings` scopes,
  so the item reads one of the two `scope`s and saves according to the current tab.
- Style only with Tailwind classes. Inline `style={{}}` is prohibited.
- Follow the project root conventions for props declarations, named exports, splitting into a folder when over 100 lines, etc.

## Blur-Save Example (ClaudeConfigDirRow)

```tsx
<SettingRow label="CLAUDE_CONFIG_DIR" description="...">
  <input
    value={draft}
    onChange={(e) => setDraft(e.target.value)}
    onBlur={() => void commit()}   // input = save, no separate button
    placeholder="Default (~/.claude)"
  />
</SettingRow>
```
