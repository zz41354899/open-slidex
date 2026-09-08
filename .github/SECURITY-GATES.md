# Security gate activation

The repository workflow creates one stable pull-request status named
`Security gates passed`. Configure the `main` branch ruleset to require this
status, require a pull request, and block force pushes and branch deletion.
Add a tag ruleset for `v*` that restricts tag creation to release maintainers and
blocks tag updates and deletion; this closes the remaining tag-move race outside
the workflow's resolved commit-SHA checks.
Also enable GitHub immutable releases so the published release tag and assets
cannot be changed or deleted after publication. The workflow creates a draft,
rechecks the remote tag against the tested SHA, publishes it, verifies GitHub
reports `isImmutable=true`, and only then allows the npm publication job to run.
If immutable releases are not enabled, npm publishing fails closed.

Enable the ruleset only after `.github/workflows/security.yml` has run once on a
pull request, so GitHub can resolve the exact status name. The standalone release
workflow independently calls the same security workflow and will not start its
platform builds if any applicable gate fails.

Release assets are intentionally public; hiding an installer is not a security
boundary. Trust comes from immutable tagged assets, SHA-256 integrity, GitHub
build provenance, and the attached SPDX SBOM. A downloaded asset can be checked
with:

```bash
gh attestation verify open-slidex-darwin-arm64.tar.gz --repo zz41354899/open-slidex
gh attestation verify open-slidex-darwin-arm64.tar.gz \
  --repo zz41354899/open-slidex --predicate-type https://spdx.dev/Document/v2.3
```

The repository ruleset is an external GitHub setting and cannot be made
effective by YAML alone. Do not make the status required until the workflow that
defines it is present on the default branch.
