# Retired audit registers

Superseded outputs of earlier audit rounds, kept so the evidence chain behind a live
document still resolves. Nothing here is maintained: the HEAD it names, the counts it
quotes and the gates it reports were true on the date in its own header and are not
re-checked.

## Why this directory is outside the debt ceiling

`debt.auditDocsLines` measures the non-blank lines of the `.md` files directly under
`docs/audit` — the collector reads that directory without descending, so a ceiling meant
to bound the audit prose a reader has to keep honest does not also bill for history.

That makes this directory a way to dodge the ceiling, which is why arrival is a declared
act instead of a `mkdir`: `tests/unit/audit-archive-is-declared.test.ts` carries the whole
inventory and checks both directions — an undeclared file here is red, and so is a
declaration whose file has left. It also fails any live document that still points at an
archived register by its pre-move path.

## What belongs here

A register for a round that has closed, moved whole, with its header date intact. Not a
section, not a working document, and not a place to put prose that is merely
inconvenient: a file that still has to be kept true belongs beside the ceiling that keeps
it honest.

## What is not policed

Contents. An archived register is not diffed against the tree, because the claim it makes
is about the revision it names, and rewriting history to satisfy today's gate would
destroy the only thing it is good for. Edits are visible in `git log --follow` for the
file; that is the intended auditor.
