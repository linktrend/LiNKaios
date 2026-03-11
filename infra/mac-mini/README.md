# Mac Mini Execution Node Baseline (MVO)

## Responsibilities

- Host Ollama embeddings and local worker model runtime
- Run Agent Zero worker runtimes under restricted local user
- Provide private model endpoint to VPS over Tailscale

## Baseline controls

- Dedicated limited macOS user for worker processes
- Optional Docker isolation for worker execution
- Tailscale private IP allowlist only

## Ollama requirements

- Pull and serve `nomic-embed-text`
- Pull and serve `deepseek-r1:8b`
- Bind API to private network interface only
