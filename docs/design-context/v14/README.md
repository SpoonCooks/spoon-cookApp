# Persisted V14 design context

One file per Figma node, recording what `mcp__figma__get_design_context` returned for it against
the authoritative V14 file `3iYf9ckrUDZLPlJP56dyKI`, page `Cook App` (`434:2401`).

## Why these are distilled rather than verbatim

`docs/design-context/v13/` archives the raw React+Tailwind response byte for byte. That is the
right thing for a response you may need to re-read for a detail you did not know you needed, and
it is kept. These V14 records instead state **every measurement, colour, string, font, node id and
asset URL the response carried**, in the order the design nests them — because what a later run
needs from a policy sheet is `pill w-281, px-12 py-4, rounded-15, fill #ffd600`, not the Tailwind
class string that encodes it. Nothing is summarised away: if the response stated a number, it is
here.

The rule is the same as V13's: **a successful context call is a one-time cost.** Do not re-fetch a
node that has a file here.

## Asset URLs expire

The `https://www.figma.com/api/mcp/asset/...` links are provenance for bytes already downloaded
into `assets/images/figma-v14/` and hashed in the asset ledger. They stop resolving about seven
days after capture. Nothing in `src/` may reference one.
