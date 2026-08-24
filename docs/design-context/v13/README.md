# Persisted V13 design context

One file per Figma node. Large responses are archived verbatim under `raw/<node-id>.tsx.txt`;
screens whose context arrived inline are written up as `<node-id>.md`. Both hold the reference code
`mcp__figma__get_design_context` returned, plus the asset URLs it referenced.

The archives carry a `.txt` extension so the TypeScript, ESLint and Prettier passes never treat
them as project source — they are another tool's output, kept byte-identical on purpose.

## Why this directory exists

Run 3 recorded only *that* a node's context had been fetched, in
`scripts/visual/context-captured.json`, and not what came back. When run 4 needed to implement
those nodes the context was gone, the MCP server was unavailable, and three `performance` screens
could not be built from a call that had already been paid for. Persisting the response makes a
context call a one-time cost for the life of the repository, which is what the brief's
"never repeat a successful context call" rule actually requires.

## What is and is not authoritative here

The reference code is React + Tailwind and is **not** the implementation. It is the record of the
design's measurements — sizes, spacings, colours, copy, font pairings and node ids. The
implementation lives in `src/` and follows the project's own conventions.

The asset URLs in these files are `https://www.figma.com/api/mcp/asset/...` links that **expire
about seven days after capture**. They are kept as provenance for the bytes already downloaded into
`assets/images/figma-v13/` (hashed in `ASSETS.json`), never as a runtime source. Nothing in `src/`
may reference one.
