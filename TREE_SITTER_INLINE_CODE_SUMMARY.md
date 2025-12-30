# Tree-Sitter Inline Code Implementation Summary

## Primary Objective
Implement tree-sitter based markdown parsing to detect and strip backticks (`) from inline code and triple backticks (```) from code blocks, while preserving the `code` style annotation.

---

## Key Technical Discoveries

### 1. tree-sitter-markdown uses two grammars
- **`tree-sitter-markdown`** (block-level): Creates `inline` placeholder nodes
- **`tree-sitter-markdown-inline`**: Parses inline content for `code_span`, `emphasis`, etc.
- Both WASM files are at `/demo/svelte-demo/static/`

### 2. Incremental parsing requires `tree.edit()`
- Without calling `tree.edit()` before re-parsing, tree-sitter doesn't properly update the tree
- Fixed in `processRawChunk()` at lines 306-330

### 3. Buffering incomplete structures
- TokensStreamBuffer splits by word boundaries, breaking `` `inline code` `` into `` `inline `` and `` code` ``
- **Solution:** Buffer content with unmatched backticks until closing backtick arrives
- Uses `pendingInlineContent` and `pendingInlineStartIndex` fields

### 4. code_span nodes have only delimiter children
- No text nodes inside code_span - must extract content using byte ranges between delimiters
- `contentStart = delimiters[0].endIndex`, `contentEnd = delimiters[last].startIndex`

### 5. Style detection must use overlap, not position
- Changed from `findActiveNodeAtPosition(startPos)` to checking all `code_spans` for overlap with range
- Fixed in `detectActiveStyles()` around lines 672-710

### 6. Inline tree nodes have 0-based positions
- When `findActiveNodeAtPosition` returns a node from the inline tree, its positions are relative to the inline content, not the document
- Must track whether we're in an inline tree node to avoid incorrect position calculations
- Bug was causing `relative range: 537-543` when inline content was only 76 chars

---

## Current State

### Working ✅
- Code blocks strip ``` fences correctly
- Single-word inline code (`` `word` ``) strips backticks
- Multi-word inline code when complete (`` `inline code` ``) strips backticks
- Buffering waits for closing backtick before emitting
- Surrounding text preserved: `` "(`re` " `` → `"(re "` with code style

### Remaining Issues (4 segments with backticks)
All 4 are inside **markdown tables** (`pipe_table`):
- `` `\bword\b` ``
- `` `.*` ``
- `` `\d` ``
- `` `[A-Za-z]` ``

### Root Cause
`findInlineNodeAtPosition()` only finds `inline` nodes, but table cells use `pipe_table_cell` type. Need to also parse `pipe_table_cell` content with the inline parser.

---

## Key Code Locations

| Function | Location | Purpose |
|----------|----------|---------|
| `processRawChunk()` | ~line 291 | Adds chunks, calls tree.edit(), parses |
| `generateSegments()` | ~line 343 | Main segment generation with buffering logic |
| `detectActiveStyles()` | ~line 653 | Detects code/bold/italic styles via inline parser |
| `getInlineCodeContent()` | ~line 823 | Strips backticks, preserves surrounding text |
| `findInlineNodeAtPosition()` | ~line 567 | Finds inline node at position (needs table support) |
| `hasCompleteCodeSpanAt()` | ~line 556 | Checks if code_span covers a range |

---

## Immediate Next Step

Update `findInlineNodeAtPosition()` to also find `pipe_table_cell` nodes:

```typescript
private findInlineNodeAtPosition(node: Parser.SyntaxNode, position: number): Parser.SyntaxNode | null {
    // If this node is an inline or pipe_table_cell node that contains the position, return it
    if ((node.type === 'inline' || node.type === 'pipe_table_cell') && 
        position >= node.startIndex && position < node.endIndex) {
        return node;
    }
    // ... rest unchanged
}
```

Also update `detectActiveStyles()` to handle `pipe_table_cell` the same as `inline`.

---

## Debug Files Available

| File | Purpose |
|------|---------|
| `/demo/test-real-stream.ts` | Tests with actual gpt-4.5-cat-coding.json |
| `/demo/test-trace-backtick.ts` | Traces specific backtick sequences |
| `/demo/test-paren-backtick.ts` | Tests `` (`re`) `` pattern |
| `/demo/debug-header-stripping.ts` | Main debug script |

---

## Test Commands

```bash
# Run debug script
docker exec -it lixpi-markdown-stream-parser-demo bash -c "cd /usr/src/service && npx tsx demo/test-real-stream.ts 2>&1"

# Run test suite
docker exec -it lixpi-markdown-stream-parser-demo bash -c "cd /usr/src/service && npm test -- tree-sitter-markdown-stream-parser.test.ts --run"
```

---

## Notes

- Many debug `console.log` statements with prefixes `[STYLE]`, `[GETCODE]`, `[DEBUG]` are still in the code - should be removed once working
- The code has extensive comments explaining the logic
- All 13 Phase 1 tests are passing
