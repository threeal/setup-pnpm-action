# Setup Standalone pnpm Action

A GitHub Action that downloads and sets up standalone [pnpm](https://pnpm.io/) on the runner.

## Usage

```yaml
- name: Setup pnpm
  uses: threeal/setup-pnpm-action@v2.0.0
```

## Inputs

| Name      | Description                     | Default        |
| --------- | ------------------------------- | -------------- |
| `version` | The version of pnpm to install. | Latest version |

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
