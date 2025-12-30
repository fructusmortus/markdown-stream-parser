# Tree-Sitter vs State-Machine Parser: Feature Comparison

## Quick Reference

| Feature | State Machine | Tree-Sitter | Status | Priority |
|---------|---------------|-------------|---------|----------|
| **Block Types** |
| Headers (1-6) | ✅ Full | ⚠️ Partial | Levels work, content includes markers | 🔴 HIGH |
| Paragraphs | ✅ Full | ✅ Full | Working | ✅ DONE |
| Code Blocks | ✅ Full | ⚠️ Partial | Missing language extraction | 🔴 HIGH |
| **Inline Styles** |
| Bold (`**`) | ✅ Full | ⚠️ Detected | No segment splitting | 🔴 HIGH |
| Italic (`*`) | ✅ Full | ⚠️ Detected | No segment splitting | 🔴 HIGH |
| Bold-Italic (`***`) | ✅ Full | ⚠️ Detected | No segment splitting | 🔴 HIGH |
| Strikethrough (`~~`) | ✅ Full | ⚠️ Detected | No segment splitting | 🟡 MED |
| Inline Code (`` ` ``) | ✅ Full | ⚠️ Detected | Wrong style name | 🔴 HIGH |
| **Output Features** |
| Segment Splitting | ✅ Full | ❌ None | Major gap | 🔴 HIGH |
| Prefixed Content | ✅ Full | ❌ None | Part of splitting | 🔴 HIGH |
| Postfixed Content | ✅ Full | ❌ None | Part of splitting | 🔴 HIGH |
| isBlockDefining | ✅ Smart | ⚠️ Basic | Too simplistic | 🟡 MED |
| isProcessingNewLine | ✅ Full | ✅ Full | Working | ✅ DONE |
| **Naming Consistency** |
| Block types | camelCase | snake_case | Inconsistent | 🟡 MED |
| Style names | Match spec | Wrong names | `'code'` vs `'inline_code'` | 🔴 HIGH |

## Detailed Comparison

### 1. Headers

#### State Machine
```typescript
Input: "## Header Text\n"
Output: {
  segment: "Header Text",  // ✅ Markers stripped
  type: "header",
  level: 2,
  styles: [],
  isBlockDefining: true,
  isProcessingNewLine: true
}
```

#### Tree-Sitter (Current)
```typescript
Input: "## Header Text\n"
Output: {
  segment: "## Header Text\n",  // ❌ Markers included
  type: "header",
  level: 2,
  styles: [],
  isBlockDefining: true,
  isProcessingNewLine: true
}
```

**Issues**:
- ❌ Content includes `##` markers
- ❌ May include trailing newline

**Fix Required**: Extract only text content from heading nodes

---

### 2. Code Blocks

#### State Machine
```typescript
Input: "```javascript\ncode\n```\n"
Output: {
  segment: "code",
  type: "codeBlock",          // ✅ camelCase
  language: "javascript",      // ✅ Language extracted
  styles: [],
  isBlockDefining: true,
  isProcessingNewLine: true
}
```

#### Tree-Sitter (Current)
```typescript
Input: "```javascript\ncode\n```\n"
Output: {
  segment: "code",
  type: "code_block",         // ❌ snake_case
  // ❌ Missing language field
  styles: [],
  isBlockDefining: true,
  isProcessingNewLine: true
}
```

**Issues**:
- ❌ Wrong naming convention (`code_block` vs `codeBlock`)
- ❌ No language field
- ❌ Language not extracted from info_string

**Fix Required**: 
1. Use camelCase naming
2. Parse info_string node for language

---

### 3. Inline Styles: Bold

#### State Machine
```typescript
Input: "before**bold**after"
Output: [
  {
    segment: "before",        // ✅ Prefixed content
    type: "paragraph",
    styles: [],
    isBlockDefining: true,
    isProcessingNewLine: false
  },
  {
    segment: "bold",          // ✅ Styled content only
    type: "paragraph",
    styles: ["bold"],         // ✅ Style applied
    isBlockDefining: false,
    isProcessingNewLine: false
  },
  {
    segment: "after",         // ✅ Postfixed content
    type: "paragraph",
    styles: [],
    isBlockDefining: false,
    isProcessingNewLine: false
  }
]
```

#### Tree-Sitter (Current)
```typescript
Input: "before**bold**after"
Output: [
  {
    segment: "before**bold**after",  // ❌ No splitting
    type: "paragraph",
    styles: ["bold"],                // ⚠️ Style detected but...
    isBlockDefining: true,
    isProcessingNewLine: false
  }
]
```

**Issues**:
- ❌ No segment splitting at style boundaries
- ❌ Entire content emitted as one chunk
- ❌ Style markers (`**`) included in output
- ❌ Prefixed/postfixed content not separated

**Fix Required**: Implement segment boundary detection and splitting

---

### 4. Inline Code Style

#### State Machine
```typescript
Input: "Run `npm install` now"
Output: [
  { segment: "Run ", styles: [] },
  { segment: "npm install", styles: ["code"] },  // ✅ 'code'
  { segment: " now", styles: [] }
]
```

#### Tree-Sitter (Current)
```typescript
Input: "Run `npm install` now"
Output: [
  {
    segment: "Run `npm install` now",
    styles: ["inline_code"]              // ❌ Wrong name
  }
]
```

**Issues**:
- ❌ Style name is `'inline_code'` should be `'code'`
- ❌ No segment splitting (same as bold)

**Fix Required**: 
1. Map `code_span` node to `'code'` style
2. Implement splitting

---

### 5. isBlockDefining Flag

#### State Machine Logic
```typescript
isBlockDefining = true when:
  - Block type changes (paragraph → header)
  - New line in routing state
  - First segment of new paragraph after code block
  - Transitioning from any block to different block type

isBlockDefining = false when:
  - Continuing within same block
  - Not at block boundary
  - Subsequent segments of styled content
```

#### Tree-Sitter (Current)
```typescript
isBlockDefining = this.isNewBlock(blockInfo, nodeAtPosition)

isNewBlock():
  - Returns true if currentBlock is null
  - Returns true if block type changed
  - Returns true if level changed (headers)
  - Returns true if node starts after last segment
  - Otherwise false
```

**Issues**:
- ⚠️ Doesn't account for content position within blocks
- ⚠️ May incorrectly mark continued content as new block
- ⚠️ Doesn't properly handle inline style boundaries

**Fix Required**: More sophisticated logic considering:
- Previous segment position
- Style boundaries
- Newline positions
- Block node boundaries

---

## Critical Gaps Ranked

### 🔴 HIGH Priority (Blocks Basic Functionality)

1. **Segment Splitting for Inline Styles** (Biggest Gap)
   - State machine: 3 segments for `before**bold**after`
   - Tree-sitter: 1 segment
   - Impact: Cannot properly render styled content
   - Complexity: High - need boundary detection

2. **Header Content Extraction**
   - State machine: `"Header Text"`
   - Tree-sitter: `"## Header Text"`
   - Impact: Headers display with markers
   - Complexity: Low - strip leading `#`

3. **Code Block Language**
   - State machine: `language: "javascript"`
   - Tree-sitter: No language field
   - Impact: Cannot syntax highlight code
   - Complexity: Medium - parse info_string

4. **Style Name Mapping**
   - State machine: `'code'`
   - Tree-sitter: `'inline_code'`
   - Impact: UI won't recognize styles
   - Complexity: Low - fix mapping

### 🟡 MEDIUM Priority (Quality of Life)

5. **Naming Consistency**
   - State machine: `'codeBlock'`
   - Tree-sitter: `'code_block'`
   - Impact: API inconsistency
   - Complexity: Low - rename

6. **isBlockDefining Logic**
   - Impact: May affect UI block rendering
   - Complexity: Medium - refine conditions

7. **Strikethrough Support**
   - Less commonly used
   - Same splitting issue as other styles

### 🟢 LOW Priority (Nice to Have)

8. **Better Error Handling**
9. **Performance Optimization**
10. **Extended Markdown Features**

---

## Implementation Order

### Phase 1: Critical Fixes (Must Have)
These are required for basic functionality parity:

1. ✅ Fix style names (`'code'` not `'inline_code'`)
2. ✅ Fix block type names (`'codeBlock'` not `'code_block'`)  
3. ✅ Strip header markers from content
4. ✅ Extract code block language

**Estimated Effort**: 2-3 hours
**Test With**: Basic examples, visual check in svelte-demo

### Phase 2: Segment Splitting (Core Feature)
This is the most complex but essential feature:

1. 🔧 Detect inline style boundaries in parsed content
2. 🔧 Split content at style marker positions
3. 🔧 Emit prefixed content as separate segment
4. 🔧 Emit styled content with styles array
5. 🔧 Emit postfixed content as separate segment
6. 🔧 Handle multiple styles in same content
7. 🔧 Handle nested/adjacent styles

**Estimated Effort**: 6-8 hours
**Test With**: Inline style tests, complex nested examples

### Phase 3: Refinements
Polish and edge cases:

1. 🔧 Improve isBlockDefining logic
2. 🔧 Handle edge cases (empty segments, etc.)
3. 🔧 Performance optimization
4. 🔧 Comprehensive test coverage

**Estimated Effort**: 3-4 hours
**Test With**: All state-machine tests, LLM examples

---

## Testing Strategy

### Test Migration Plan

#### Step 1: Port Basic Tests
From `markdown-state-machine.test.ts`:
- Simple paragraph
- Headers (all levels)
- Code blocks

**Expected**: These should mostly pass after Phase 1

#### Step 2: Port Style Tests
- Bold, italic, bold-italic
- Strikethrough, inline code
- Mixed styles

**Expected**: Will fail until Phase 2 complete

#### Step 3: Port Complex Tests
- Prefixed/postfixed content
- Nested styles
- State transitions
- Edge cases

**Expected**: Should pass after Phase 3

### Visual Testing with svelte-demo

After each phase:
1. Run svelte-demo
2. Load test examples
3. Compare visual output
4. Check that styled segments render correctly

Key examples to test:
- `claude-3.7-history-of-cats.json`
- `gpt-4.o-happy-number-5-programs.json`
- `claude-3.7-markdown-with-nested-code-block.json`

---

## Performance Comparison

### State Machine
- ✅ Incremental processing
- ✅ Minimal memory (no AST)
- ✅ Regex-based (fast)
- ❌ Complex state management
- ❌ Hard to extend

### Tree-Sitter
- ✅ Proper AST parsing
- ✅ Robust structure
- ✅ Easy to extend
- ⚠️ Re-parses on each chunk
- ⚠️ Full content buffer
- ⚠️ More memory usage

**Expected**: Tree-sitter may be slightly slower but should be acceptable for streaming use case.

---

## Success Metrics

### Minimum Viable (Phase 1)
- [ ] All block types correctly identified
- [ ] Header content without markers
- [ ] Code blocks include language
- [ ] Style names match specification
- [ ] Naming consistency (camelCase)

### Feature Complete (Phase 2)
- [ ] Segment splitting works
- [ ] Prefixed/postfixed content separate
- [ ] All inline styles properly applied
- [ ] Multiple styles in same content
- [ ] Matches state-machine output structure

### Production Ready (Phase 3)
- [ ] All state-machine tests pass
- [ ] Visual parity in svelte-demo
- [ ] Performance acceptable
- [ ] Edge cases handled
- [ ] Documentation complete

---

## Migration Risks

### High Risk
1. **Segment Splitting Complexity**
   - Most complex feature to implement
   - Risk of bugs with edge cases
   - May need multiple iterations

2. **Performance Degradation**
   - Re-parsing on each chunk could be slow
   - May need optimization

### Medium Risk
3. **Style Detection Accuracy**
   - Tree-sitter node types may not map perfectly
   - Nested styles could be tricky

4. **Block Boundary Detection**
   - Different parsing model may cause issues
   - Need careful testing

### Low Risk
5. **Naming/Mapping Issues**
   - Easy to fix
   - Quick testing cycle

---

## Rollback Plan

If tree-sitter implementation fails to reach parity:

1. **Keep both implementations**
   - Export both parsers
   - Let users choose
   - Document trade-offs

2. **Feature flag approach**
   - Use tree-sitter where it works
   - Fall back to state-machine for complex cases

3. **Hybrid approach**
   - Use tree-sitter for structure detection
   - Use state-machine for streaming/splitting

---

## Conclusion

**Current State**: Tree-sitter can detect structures but cannot match state-machine output format

**Biggest Gap**: Segment splitting for inline styles (critical for proper rendering)

**Estimated Total Effort**: 11-15 hours to reach full parity

**Recommendation**: 
1. Start with Phase 1 quick wins (2-3 hours)
2. Validate approach with svelte-demo
3. Proceed to Phase 2 if Phase 1 successful
4. Keep state-machine as fallback during migration

The roadmap is achievable, but segment splitting will require careful implementation and thorough testing.
