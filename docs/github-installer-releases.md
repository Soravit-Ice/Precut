# Separate public installer repository

Precut downloads use `Soravit-Ice/Precut-releases`. The source repository and
download repository have independent visibility. Public installers still use
the existing Store license/trial enforcement inside the application.

The tagged workflow builds and tests the same three targets. Configure on the
source repo:

- Variable `PRECUT_DOWNLOAD_REPOSITORY=Soravit-Ice/Precut-releases`.
- Prefer a GitHub App installed only on that download repo, with Contents:
  read/write and Administration: read (checks immutable release configuration).
  Set variable `DOWNLOADS_APP_ID` and secret `DOWNLOADS_APP_PRIVATE_KEY` in the
  `release-upload` environment or repository. The workflow generates a temporary
  installation token scoped to that repository.
- Alternatively set `DOWNLOADS_RELEASE_TOKEN`, a fine-grained token with those
  same repository permissions and an appropriate expiration.

Keep the variable unset until the credential is ready; releases continue through
the existing R2 pipeline. The source workflow's `GITHUB_TOKEN` does not have write
access to the separate download repo. Never put any write token into the app,
public configuration, artifact manifest or repository files.

Enable immutable releases on the downloads repo before uploading. The uploader
hashes each local installer and publishes a complete GitHub release with
`release-manifest.json` and `SHA256SUMS`. Assets must be smaller than 2 GiB. It
refuses mismatched existing files and reuses identical immutable releases on
reruns. Store verifies the actual downloadable bytes again using the source
workflow's original OIDC identity, then marks the release READY. Publish in
Store Admin using the existing approval flow.

For an existing Store release, copy the exact R2 bytes and manifest, upload them
to the same version tag on the download repo, then use Move to GitHub in Store
Admin. All targets switch together after verification. R2 copies are retained
for rollback. No application rebuild, version bump or new license is needed.
This change does not add OS code signing or notarization to unsigned installers.

The workflow does not change source visibility. Making source public allows
permanent copies/forks even if it becomes private later. Yanking a Store release
does not recall public GitHub files or downloaded copies.

Detailed operator instructions, API contracts and rollback tool are in the
Store repository's `docs/github-releases.md`.
