# Setup Standalone pnpm Action

A GitHub Action that downloads and sets up standalone [pnpm](https://pnpm.io/) on the runner.

## Usage

```yaml
- name: Setup pnpm
  uses: threeal/setup-pnpm-action@v2.0.0
```

## Inputs

| Name           | Description                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `version`      | The version or tag of pnpm to install.                                                                                                  |
| `version-file` | A file specifying the version of pnpm to install. Supports `package.json` with a `devEngines.packageManager` or `packageManager` field. |

`version` and `version-file` are mutually exclusive. If neither is set, the version is read from `package.json` in the current directory if available, otherwise the latest version is installed.

`devEngines.packageManager.version` may have a leading range operator (`^`, `~`, `=`, `>=`, `<=`, `>`, `<`), such as `^11.5.0`, but the action installs exactly the version that follows the operator — it does not resolve the range against other published versions.

## Outputs

| Name      | Description                             |
| --------- | --------------------------------------- |
| `version` | The version of pnpm that was installed. |

## Example

```yaml
- name: Setup pnpm
  uses: threeal/setup-pnpm-action@v2.0.0
  with:
    version: 11.5.0

- name: Check pnpm
  run: pnpm --version
```

## License

This project is licensed under the [MIT License](LICENSE).

Copyright © 2025-2026 [Alfi Maulana](https://github.com/threeal)
