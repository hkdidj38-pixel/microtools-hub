# Requiring the CI check on `main`

The repository CI workflow reports the **`build-and-test`** job (GitHub may display it as **`CI / build-and-test`**). The workflow runs `npm ci`, `npm test`, and `npm run build` on pull requests targeting `main` and pushes to `main`.

To require this check for future pull requests, a repository administrator must configure GitHub manually:

1. Open **Settings → Branches** (or the repository's **Rulesets** settings) and edit or create the rule applying to `main`.
2. Enable **Require a pull request before merging** if that is the repository's chosen review policy.
3. Enable **Require status checks to pass before merging**.
4. Search for and select the **`build-and-test`** check from the **CI** workflow. If it is not listed yet, run the workflow successfully once, then return to the rule editor.
5. Save the rule and verify on a test pull request that the check is required.

This change adds the workflow only. It does not alter branch-protection rules, repository settings, or merge policy.
