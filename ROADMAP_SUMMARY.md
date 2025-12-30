# Roadmap Summary: Tree-Sitter Parser Migration

## Executive Summary

I've completed a comprehensive analysis of both the state-machine and tree-sitter markdown parser implementations. The tree-sitter version is structurally sound but missing several critical features needed to match the state-machine parser's output format.

## What I've Created

### 1. **STATE_MACHINE_FEATURES.md**
Complete documentation of the old parser's capabilities:
- All supported block types (headers 1-6, paragraphs, code blocks)
- All inline styles (bold, italic, bold-italic, strikethrough, inline code)
- Segment splitting behavior
- Output structure and flags
- API usage patterns
- 70+ test cases documented

### 2. **TREE_SITTER_MIGRATION_ROADMAP.md**
Detailed implementation plan:
- Phase-by-phase breakdown
- Expected output formats with examples
- Success criteria
- Testing strategy
- Risk areas identified

### 3. **COMPARISON_AND_GAPS.md**
Side-by-side comparison highlighting:
- Feature-by-feature status
- Specific issues with code examples
- Priority rankings (HIGH/MED/LOW)
- Implementation order
- Estimated effort (11-15 hours total)

## Key Findings

### What the State-Machine Parser Supports ✅

**Block Elements:**
- Headers (1-6 levels) with level detection
- Paragraphs with inline styles
- Code blocks with language extraction

**Inline Styles:**
- Bold (`**text**`)
- Italic (`*text*`)
- Bold-Italic (`***text***`)
- Strikethrough (`~~text~~`)
- Inline code (`` `text` ``)

**Critical Features:**
- **Segment Splitting**: `before**bold**after` → 3 separate segments
- **Prefixed/Postfixed Content**: Emitted as separate segments without styles
- **Clean Output**: Header markers stripped, styled content isolated

### What Tree-Sitter Currently Lacks ❌

1. **🔴 CRITICAL: No Segment Splitting**
   - Everything emitted as one chunk
   - Cannot properly render styled content
   - Biggest implementation challenge

2. **🔴 HIGH: Header Content Includes Markers**
   - Outputs `"## Header"` instead of `"Header"`
   - Easy fix but critical for display

3. **🔴 HIGH: Missing Code Block Language**
   - No `language` field in output
   - Cannot syntax highlight

4. **🔴 HIGH: Wrong Style Names**
   - Uses `'inline_code'` instead of `'code'`
   - UI won't recognize styles

5. **🟡 MEDIUM: Naming Inconsistency**
   - Uses `'code_block'` instead of `'codeBlock'`
   - API inconsistency

## Implementation Phases

### Phase 1: Quick Wins (2-3 hours) 🎯
**Goal**: Basic functionality parity

- Fix style name mapping (`'code'` not `'inline_code'`)
- Fix block type naming (`'codeBlock'` not `'code_block'`)
- Strip header markers from output
- Extract code block language

**Test**: Basic examples should render correctly in svelte-demo

### Phase 2: Segment Splitting (6-8 hours) 🔥
**Goal**: Match state-machine output structure

- Detect inline style boundaries
- Split content at style markers
- Emit prefixed/styled/postfixed segments separately
- Handle multiple and nested styles

**Test**: All inline style examples should work

### Phase 3: Refinements (3-4 hours) ✨
**Goal**: Production ready

- Improve `isBlockDefining` logic
- Edge case handling
- Performance optimization
- Full test coverage

**Test**: All state-machine tests pass

## Critical Gap: Segment Splitting Explained

### Current Tree-Sitter Behavior ❌
```typescript
Input: "Hello **world** test"

Output: [
  {
    segment: "Hello **world** test",  // ❌ One chunk
    styles: ["bold"],                  // ⚠️ Style detected but applied to all
    type: "paragraph"
  }
]
```

### Required State-Machine Behavior ✅
```typescript
Input: "Hello **world** test"

Output: [
  {
    segment: "Hello ",        // ✅ Prefixed content
    styles: [],
    type: "paragraph"
  },
  {
    segment: "world",         // ✅ Styled content only
    styles: ["bold"],
    type: "paragraph"
  },
  {
    segment: " test",         // ✅ Postfixed content
    styles: [],
    type: "paragraph"
  }
]
```

### Why It Matters
- UI needs separate segments to apply styles correctly
- Cannot render `<span class="bold">` around only "world"
- Current output would bold everything or nothing

## Implementation Strategy

### Approach for Segment Splitting

1. **Detect Style Nodes**
   - Walk tree to find `strong_emphasis`, `emphasis`, `code_span` nodes
   - Record their start/end positions

2. **Split Content**
   - For each new chunk, check if it overlaps style boundaries
   - Split content at style start/end positions
   - Track which segment is inside vs outside styles

3. **Emit Segments**
   - Before style: emit with `styles: []`
   - Inside style: emit with appropriate styles
   - After style: emit with `styles: []`

4. **Handle Nesting**
   - Track style stack (entering/exiting styles)
   - Combine styles for nested segments
   - Example: bold inside italic → `styles: ['italic', 'bold']`

### Example Implementation Sketch

```typescript
private splitSegmentByStyles(
  content: string,
  startIndex: number,
  endIndex: number,
  node: Parser.SyntaxNode
): StreamingChunk[] {
  const segments: StreamingChunk[] = [];
  
  // Find all style boundaries in range
  const styleBoundaries = this.findStyleBoundaries(node, startIndex, endIndex);
  
  // Split content at boundaries
  let currentPos = startIndex;
  for (const boundary of styleBoundaries) {
    // Emit content before boundary
    if (currentPos < boundary.start) {
      segments.push(this.createSegment(
        content.substring(currentPos - startIndex, boundary.start - startIndex),
        boundary.stylesBeforeStart
      ));
    }
    
    // Emit styled content
    segments.push(this.createSegment(
      boundary.content,
      boundary.styles
    ));
    
    currentPos = boundary.end;
  }
  
  // Emit remaining content
  if (currentPos < endIndex) {
    segments.push(this.createSegment(
      content.substring(currentPos - startIndex),
      []
    ));
  }
  
  return segments;
}
```

## Testing Plan

### Incremental Testing

**After Phase 1:**
```bash
# Test basic blocks
npm test -- tree-sitter-markdown-stream-parser.test.ts
# Visual check
cd demo/svelte-demo && npm run dev
```

**After Phase 2:**
```bash
# Test inline styles
npm test -- --grep "inline style"
# Load complex examples in svelte-demo
```

**After Phase 3:**
```bash
# Full test suite
npm test
# All LLM examples in svelte-demo
```

### Key Test Files to Use
- `claude-3.7-history-of-cats.json` - Mixed content
- `gpt-4.o-happy-number-5-programs.json` - Code blocks
- `claude-3.7-markdown-with-nested-code-block.json` - Complex nesting

## Estimated Timeline

| Phase | Tasks | Hours | Priority |
|-------|-------|-------|----------|
| Phase 1 | Style names, block types, header content, code language | 2-3 | 🔴 HIGH |
| Phase 2 | Segment splitting, boundary detection, emit logic | 6-8 | 🔴 HIGH |
| Phase 3 | Flag refinement, edge cases, tests, polish | 3-4 | 🟡 MED |
| **Total** | | **11-15** | |

## Recommended Next Steps

1. **Start with Phase 1** (quick wins)
   - Get immediate visual improvements
   - Validate approach
   - Build confidence

2. **Test Early and Often**
   - After each fix, check svelte-demo
   - Visual feedback is crucial
   - Easier to debug incrementally

3. **Phase 2 in Iterations**
   - Start with simple case (single bold)
   - Then prefixed/postfixed
   - Then multiple styles
   - Then nested styles

4. **Keep State-Machine as Reference**
   - Don't remove it yet
   - Use for comparison testing
   - Fallback option if needed

## Success Criteria

### Minimum Viable ✅
- [ ] Headers render without `#` markers
- [ ] Code blocks show language
- [ ] Style names match API expectations
- [ ] Basic blocks work in svelte-demo

### Feature Complete ✅
- [ ] Segment splitting works
- [ ] All inline styles render correctly
- [ ] Prefixed/postfixed content separate
- [ ] Output structure matches state-machine

### Production Ready ✅
- [ ] All tests pass
- [ ] Visual parity in svelte-demo
- [ ] Performance acceptable
- [ ] Documentation complete

## Risk Mitigation

### High Risk: Segment Splitting Complexity
- **Mitigation**: Implement incrementally, test each step
- **Fallback**: Keep state-machine for inline styles only

### Medium Risk: Performance
- **Mitigation**: Profile after Phase 2, optimize if needed
- **Fallback**: Cache parsed trees, batch updates

### Low Risk: Edge Cases
- **Mitigation**: Port all state-machine tests
- **Fallback**: Document known limitations

## Conclusion

The tree-sitter implementation has a solid foundation but needs significant work on the output formatting side. The biggest challenge is segment splitting for inline styles, which is critical for proper rendering.

**The roadmap is achievable with focused effort on the three phases.**

All documentation is in place. You can now:
1. Review the roadmap documents
2. Start implementing Phase 1 (quickest wins)
3. Test with svelte-demo after each phase
4. Iterate based on visual feedback

**Would you like me to start implementing Phase 1 now?**
