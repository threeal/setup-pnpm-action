# Setup Standalone pnpm Action

A GitHub Action that downloads and sets up standalone [pnpm](https://pnpm.io/) on the runner.

## Usage

```yaml
- name: Setup pnpm
  uses: threeal/setup-pnpm-action@v2.1.0
```

## Inputs

| Name           | Description                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `version`      | The version, version range, or tag of pnpm to install.                                                                                  |
| `version-file` | A file specifying the version of pnpm to install. Supports `package.json` with a `devEngines.packageManager` or `packageManager` field. |

A version range resolves to the highest published version satisfying it. It follows npm's range syntax, such as `^11`, `11.x`, `>=10.0.0 <12.0.0`, `10.0.0 - 11`, or `^10 || ^11`.

`version` and `version-file` are mutually exclusive. If neither is set, the version is read from `package.json` in the current directory if available, otherwise the latest version is installed.

When reading `package.json`, `devEngines.packageManager` takes precedence over `packageManager`, the same way pnpm reads them. Its `version` can be an exact version or a version range, and the latest version is installed if it's omitted.

With either field, if a `pnpm-lock.yaml` next to that `package.json` locks a pnpm version satisfying the version read from it, that locked version is installed instead, without querying the npm registry, matching the version pnpm itself runs.

## Outputs

| Name      | Description                             |
| --------- | --------------------------------------- |
| `version` | The version of pnpm that was installed. |

## Example

```yaml
- name: Setup pnpm
  uses: threeal/setup-pnpm-action@v2.1.0
  with:
    version: 12.15.0

- name: Check pnpm
  run: pnpm --version
```

## License

This project is licensed under the [MIT License](LICENSE).

Copyright © 2025-2026 [Alfi Maulana](https://github.com/threeal)
