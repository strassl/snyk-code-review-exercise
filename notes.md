# Notes

## Description
We would like to invite you to join us for a technical discussion and code collaboration based on a pull request (PR), and we’d like to offer you the chance to review the code before we meet. We have a sample code base representing an internal production service with a PR ready to submit. This is code that is working towards solving the problem detailed in the issue linked in the PR comment. We’d like you to review the PR, and offer suggestions about issues you might have found within the change. Remember that validating correctness of the implementation is part of the review process. 

## Util
- Test using `curl http://127.0.0.1:3000/package/react/16.13.0 | jq`

## General
- `npm audit` reports 5 moderate severity vulnerabilities (4 x inefficient regex complexity in ansi-regex and transitives,  1 x regex DoS in tmpl)
- Repository is missing a Lockfile and has unpinned versions -> no reproducible builds will be a problem. (fixed in main)

## Git Nitpicks
- Commit c8cdd63f41587efe0c8d1fe12ea333c791c78359: "Adds transative dependencies" should be spelled "transitive"
- Commit c8cdd63f41587efe0c8d1fe12ea333c791c78359: robb1e indicates in GitHub that all commits should be signed, but this one isn't. Apparently because aron set robb1e as the author but committed it himself. Not necessarily a problem, but worth talking to the author about to find out why this happened.

## Code Nitpicks
- `tsConfig.json:10` I'd recommend getting rid of line 13 asap (`noImplicitAny: false`). In my experience making TS as strict as possible is a good idea.