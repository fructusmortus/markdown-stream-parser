# Tree-Sitter Migration Roadmap

## Overview
This document outlines the plan to bring the tree-sitter-based markdown parser implementation up to feature parity with the existing state-machine parser.

## State-Machine Parser Capabilities (Current Baseline)

### Block Elements
1. **Headers** (Levels 1-6)
   - Detected by: `#{1,6}\s` pattern
   - Output includes: `level` field (1-6)
   - Content emitted WITHOUT the `#` markers
   - Example: `## Header` → `{type: 'header', level: 2, segment: 'Header'}`

2. **Paragraphs**
   - Default block type for regular text
   - Can contain inline styles
   - Output: `{type: 'paragraph', segment: '...', styles: [...]}`

3. **Code Blocks**
   - Detected by: ` ```language\n` pattern
   - Includes language detection (e.g., `javascript`, `python`)
   - Output includes: `language` field
   - Example: ` ```javascript\n` → `{type: 'codeBlock', language: 'javascript'}`
   - Content between markers is emitted as code segments

### Inline Styles
1. **Bold** - `**text**`
   - Style: `['bold']`
   
2. **Italic** - `*text*`
   - Style: `['italic']`
   
3. **Bold + Italic** - `***text***`
   - Style: `['bold', 'italic']`
   
4. **Strikethrough** - `~~text~~`
   - Style: `['strikethrough']`
   
5. **Inline Code** - `` `code` ``
   - Style: `['code']`

### Key Features
1. **Segment Splitting**
   - Prefixed content: text before style markers emitted separately
   - Styled content: emitted with appropriate `styles` array
   - Postfixed content: text after style markers emitted separately
   - Example: `before**bold**after` → 3 segments:
     - `{segment: 'before', styles: []}`
     - `{segment: 'bold', styles: ['bold']}`
     - `{segment: 'after', styles: []}`

2. **isBlockDefining Flag**
   - `true` when:
     - Starting a new block type
     - Transitioning between blocks
     - Processing header with newline
     - First segment of paragraph after code block
   - `false` for subsequent segments within same block

3. **isProcessingNewLine Flag**
   - `true` when segment contains `\n`
   - Used to track paragraph boundaries

4. **Whitespace Handling**
   - Trailing newlines can be truncated
   - Spaces preserved in styled segments

## Tree-Sitter Current Issues

### 1. ❌ Style Name Mismatches
**Problem**: Tree-sitter uses different style names than expected
- Currently: `'inline_code'`
- Expected: `'code'`
- Tree-sitter node names don't map 1:1 to output style names

**Solution**:
```typescript
// In detectActiveStyles()
if (current.type === 'code_span') {
    styles.add('code');  // NOT 'inline_code'
}
```

### 2. ❌ Block Type Naming Inconsistency
**Problem**: Inconsistent naming convention
- State-machine uses: `'codeBlock'` (camelCase)
- Tree-sitter uses: `'code_block'` (snake_case)

**Solution**: Ensure consistent camelCase throughout
```typescript
case 'fenced_code_block':
    return { type: 'codeBlock' };  // NOT 'code_block'
```

### 3. ❌ Missing Language Detection for Code Blocks
**Problem**: Code blocks don't include language field
- State-machine: `{type: 'codeBlock', language: 'javascript'}`
- Tree-sitter: `{type: 'code_block'}` (no language)

**Solution**: Parse the `info_string` child node in fenced_code_block
```typescript
private getCodeBlockLanguage(node: Parser.SyntaxNode): string {
    // Find info_string child node
    const infoString = node.children.find(c => c.type === 'info_string');
    return infoString ? infoString.text.trim() : '';
}
```

### 4. ❌ Header Content Includes Markers
**Problem**: Headers emitted with `#` symbols
- Expected: `{segment: 'Header Text'}`
- Actual: `{segment: '## Header Text'}`

**Solution**: Extract only the text content from heading nodes
```typescript
private getHeaderContent(node: Parser.SyntaxNode, newContent: string): string {
    // Remove leading # and whitespace
    return newContent.replace(/^#{1,6}\s*/, '');
}
```

### 5. ❌ No Segment Splitting for Inline Styles
**Problem**: Everything emitted as single chunk
- State-machine: `'before**bold**after'` → 3 segments
- Tree-sitter: `'before**bold**after'` → 1 segment

**Solution**: Implement segment boundary detection
- Detect style marker positions
- Split content at style boundaries
- Emit prefixed, styled, and postfixed content separately

### 6. ❌ Incomplete Style Detection
**Problem**: Styles not properly tracked through nested nodes
- May miss styles when content spans multiple nodes
- Style inheritance not working correctly

**Solution**: Walk up the tree more carefully and test with nested examples

### 7. ❌ isBlockDefining Logic Too Simple
**Problem**: Flag not accurately reflecting block transitions
- Currently only checks if block type changed
- Doesn't handle newline boundaries properly
- Doesn't detect paragraph boundaries correctly

**Solution**: Enhanced logic considering:
- Previous block type
- Newline presence
- Node boundaries
- Content position

## Implementation Plan

### Phase 1: Fix Basic Mappings (Quick Wins)
- [ ] Fix style names (`'code'` instead of `'inline_code'`)
- [ ] Fix block type names (camelCase consistency)
- [ ] Add code block language detection
- [ ] Fix header content extraction (remove markers)

### Phase 2: Segment Splitting (Core Feature)
- [ ] Detect inline style boundaries in content
- [ ] Implement segment splitting logic
- [ ] Emit prefixed content separately
- [ ] Emit styled content with proper styles array
- [ ] Emit postfixed content separately
- [ ] Handle multiple styles in same segment

### Phase 3: Flag Logic Improvements
- [ ] Fix `isBlockDefining` logic
- [ ] Improve `isProcessingNewLine` detection
- [ ] Handle block transitions correctly

### Phase 4: Testing & Validation
- [ ] Port state-machine tests to tree-sitter
- [ ] Add new tests for edge cases
- [ ] Verify with svelte-demo visual testing
- [ ] Test with all LLM stream examples

## Testing Strategy

### Unit Tests to Port
From `markdown-state-machine.test.ts`:
1. Simple paragraph processing
2. Headers (all 6 levels)
3. Code blocks (with/without language)
4. Inline styles: bold, italic, bold-italic, strikethrough, inline code
5. Mixed inline styles
6. Prefixed/postfixed content
7. Nested styles
8. State transitions (paragraph→header, header→code, code→paragraph)
9. Edge cases (empty segments, multiple newlines, malformed markdown)

### Integration Testing
- Test with svelte-demo for visual verification
- Use existing LLM stream examples
- Compare output between state-machine and tree-sitter implementations

## Expected Output Format

### Example 1: Simple Paragraph
**Input**: `'Hello '`, `'world.\n'`

**Output**:
```json
[
  {
    "status": "STREAMING",
    "segment": {
      "segment": "Hello ",
      "type": "paragraph",
      "styles": [],
      "isBlockDefining": true,
      "isProcessingNewLine": false
    }
  },
  {
    "status": "STREAMING",
    "segment": {
      "segment": "world.",
      "type": "paragraph",
      "styles": [],
      "isBlockDefining": false,
      "isProcessingNewLine": true
    }
  }
]
```

### Example 2: Header
**Input**: `'## '`, `'A header\n'`

**Output**:
```json
[
  {
    "status": "STREAMING",
    "segment": {
      "segment": "A header",
      "type": "header",
      "level": 2,
      "styles": [],
      "isBlockDefining": true,
      "isProcessingNewLine": true
    }
  }
]
```

### Example 3: Bold Style with Prefixed Content
**Input**: `'before**bold**after'`

**Output**:
```json
[
  {
    "status": "STREAMING",
    "segment": {
      "segment": "before",
      "type": "paragraph",
      "styles": [],
      "isBlockDefining": true,
      "isProcessingNewLine": false
    }
  },
  {
    "status": "STREAMING",
    "segment": {
      "segment": "bold",
      "type": "paragraph",
      "styles": ["bold"],
      "isBlockDefining": false,
      "isProcessingNewLine": false
    }
  },
  {
    "status": "STREAMING",
    "segment": {
      "segment": "after",
      "type": "paragraph",
      "styles": [],
      "isBlockDefining": false,
      "isProcessingNewLine": false
    }
  }
]
```

### Example 4: Code Block with Language
**Input**: ` ```javascript\n`, `'const a = 1;\n'`, ` ```\n`

**Output**:
```json
[
  {
    "status": "STREAMING",
    "segment": {
      "segment": "const a = 1;",
      "type": "codeBlock",
      "language": "javascript",
      "styles": [],
      "isBlockDefining": true,
      "isProcessingNewLine": true
    }
  }
]
```

## Success Criteria

### Minimum Requirements
- ✅ All block types correctly identified (header, paragraph, codeBlock)
- ✅ Header levels correctly detected (1-6)
- ✅ Code block language correctly extracted
- ✅ All inline styles correctly detected (bold, italic, bold-italic, strikethrough, code)
- ✅ Segment splitting works for inline styles
- ✅ Prefixed/postfixed content emitted separately
- ✅ isBlockDefining flag accurate for block transitions
- ✅ All state-machine tests pass with tree-sitter implementation

### Nice to Have
- 🎯 Better performance than state-machine
- 🎯 Support for nested styles (e.g., bold within italic)
- 🎯 Support for more markdown features (lists, blockquotes, etc.)
- 🎯 Better handling of malformed markdown

## Notes

### Tree-Sitter Advantages
- More robust parsing (proper AST)
- Better handling of complex/nested structures
- Easier to extend with new features
- Industry-standard approach

### Challenges
- Different parsing model (AST vs streaming state machine)
- Need to "chunk" AST into streaming segments
- Style boundary detection more complex
- Must maintain streaming performance characteristics

### Migration Risk Areas
1. **Inline style splitting**: Most complex feature to replicate
2. **Block boundaries**: Need careful testing for edge cases
3. **Performance**: AST parsing on each chunk may be slower
4. **Memory**: Full content buffering vs incremental processing

## Next Steps
1. Start with Phase 1 quick wins
2. Add comprehensive tests as we go
3. Test each feature with svelte-demo
4. Compare output with state-machine for each test case
5. Document any behavioral differences
