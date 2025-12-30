# State Machine Markdown Parser - Supported Features

## Overview
This document comprehensively details all features supported by the original state-machine-based markdown parser implementation.

## Block-Level Elements

### 1. Headers (✅ Fully Supported)
**Syntax**: `#{1,6} content`

**Supported Levels**: 1-6
- `# Heading 1` → level 1
- `## Heading 2` → level 2  
- `### Heading 3` → level 3
- `#### Heading 4` → level 4
- `##### Heading 5` → level 5
- `###### Heading 6` → level 6

**Detection Pattern**: `/^(#{1,6}\s?)(.*)/`

**Output Format**:
```typescript
{
  segment: "Header Content",  // WITHOUT # markers
  type: "header",
  level: 2,                    // 1-6
  styles: [],
  isBlockDefining: true,
  isProcessingNewLine: false
}
```

**Key Behaviors**:
- Header markers (`#`) are stripped from output
- Only content after markers is emitted
- Space after `#` is optional but recommended
- Newline ends header processing
- Resets parser to routing state after newline

### 2. Paragraphs (✅ Fully Supported)
**Default Block Type**: Used when no other block pattern matches

**Output Format**:
```typescript
{
  segment: "Paragraph text",
  type: "paragraph",
  styles: [],              // Can include inline styles
  isBlockDefining: true,   // true for first segment
  isProcessingNewLine: false
}
```

**Key Behaviors**:
- Default fallback for regular text
- Can contain inline styles (bold, italic, etc.)
- Multiple segments within same paragraph have `isBlockDefining: false`
- Newline can end paragraph but doesn't always

### 3. Code Blocks (✅ Fully Supported)
**Syntax**: ` ```language\n...content...```\n`

**Detection Patterns**:
- Start: `/^(\s*```)([a-zA-Z_+-]*)(?:\n|\\n)([a-zA-Z_+\-\s]*)$/`
- End: `/(?<!`)```(?!`)\s*((\n|\\n){1,})/`

**Supported Languages**: Any alphanumeric string with `_`, `+`, `-`
- Examples: `javascript`, `python`, `cpp`, `shell`, `typescript`

**Output Format**:
```typescript
{
  segment: "code content",
  type: "codeBlock",
  language: "javascript",  // extracted from opening marker
  styles: [],
  isBlockDefining: true,
  isProcessingNewLine: true
}
```

**Key Behaviors**:
- Language extracted from ` ```language` pattern
- Content between markers emitted as code segments
- Closing ` ``` ` with newline ends code block
- No inline style processing within code blocks
- Can handle empty code blocks

## Inline Styles

### 1. Bold (✅ Fully Supported)
**Syntax**: `**text**`

**Detection Patterns**:
- Full: `/^([^*]*)(\*\*)([^\s*](?:[^*]*[^\s*])?)(\*\*)([^*]*)$/`
- Partial Start: `/^( *)(\*\*)([^\s*](?:[^*]*[^\s*])?)([^*]*)$/`
- Partial End: `/^(\s*\S+)(\*\*)([\s\S]*)$/`

**Output Style**: `['bold']`

**Example**:
```typescript
Input: "Hello **world** test"
Output: [
  { segment: "Hello ", styles: [] },
  { segment: "world", styles: ["bold"] },
  { segment: " test", styles: [] }
]
```

### 2. Italic (✅ Fully Supported)
**Syntax**: `*text*`

**Detection Patterns**:
- Full: `/^([^*]*)(\*)([^\s*](?:[^*]*[^\s*])?)(\*)([^*]*)$/`
- Partial Start: `/^( *)(\*)([^\s*](?:[^*]*[^\s*])?)([^*]*)$/`
- Partial End: `/^(\s*\S+)(\*)([\s\S]*)$/`

**Output Style**: `['italic']`

**Example**:
```typescript
Input: "This is *italic* text"
Output: [
  { segment: "This is ", styles: [] },
  { segment: "italic", styles: ["italic"] },
  { segment: " text", styles: [] }
]
```

### 3. Bold + Italic (✅ Fully Supported)
**Syntax**: `***text***`

**Detection Patterns**:
- Full: `/^([^*]*)(\*\*\*)([^\s*](?:[^*]*[^\s*])?)(\*\*\*)([^*]*)$/`
- Partial Start: `/^( *)(\*\*\*)([^\s*](?:[^*]*[^\s*])?)([^*]*)$/`
- Partial End: `/^(\s*\S+)(\*\*\*)([\s\S]*)$/`

**Output Style**: `['bold', 'italic']` (both styles in array)

**Example**:
```typescript
Input: "Text ***bolditalic*** end"
Output: [
  { segment: "Text ", styles: [] },
  { segment: "bolditalic", styles: ["bold", "italic"] },
  { segment: " end", styles: [] }
]
```

### 4. Strikethrough (✅ Fully Supported)
**Syntax**: `~~text~~`

**Detection Patterns**:
- Full: `/^([^~]*)(~~)([^\s~](?:[^~]*[^\s~])?)(~~)([^~]*)$/`
- Partial Start: `/^( *)(~~)([^\s~](?:[^~]*[^\s~])?)([^~]*)$/`
- Partial End: `/^(\s*\S+)(~~)([\s\S]*?)$/`

**Output Style**: `['strikethrough']`

**Example**:
```typescript
Input: "This ~~deleted~~ text"
Output: [
  { segment: "This ", styles: [] },
  { segment: "deleted", styles: ["strikethrough"] },
  { segment: " text", styles: [] }
]
```

### 5. Inline Code (✅ Fully Supported)
**Syntax**: `` `text` ``

**Detection Patterns**:
- Full: `/^([^`]*)(`)([^\s`](?:[^`]*[^\s`])?)(`)([^`]*)$/`
- Partial Start: `/^( *)(`)([^\s`](?:[^`]*[^\s`])?)([^`]*)$/`
- Partial End: `/^(\s*\S+)(`)([\s\S]*)$/`

**Output Style**: `['code']`

**Example**:
```typescript
Input: "Run `npm install` command"
Output: [
  { segment: "Run ", styles: [] },
  { segment: "npm install", styles: ["code"] },
  { segment: " command", styles: [] }
]
```

## Advanced Features

### Prefixed and Postfixed Content
The parser intelligently splits segments when inline styles are detected:

**Pattern**: `prefix**styled**postfix`

**Behavior**:
1. **Emit prefixed content** (if exists)
   - Segment: `"prefix"`
   - Styles: `[]`
   - isBlockDefining: depends on context

2. **Emit styled content**
   - Segment: `"styled"`
   - Styles: `["bold"]`
   - isBlockDefining: `false`

3. **Emit postfixed content** (if exists)
   - Segment: `"postfix"`
   - Styles: `[]`
   - isBlockDefining: `false`

### Partial Style Markers
Handles styles that span multiple chunks:

**Scenario 1: Partial Start**
```typescript
Chunk 1: "text *partial"
Chunk 2: " italic* end"
```
- First chunk detected as partial start
- State machine tracks incomplete style
- Second chunk completes the style
- Proper style applied when complete

**Scenario 2: Partial End**
```typescript
Chunk 1: "*incomplete"
Chunk 2: " style*"
```
- Continuation of italic from previous chunk
- Style closed when closing marker found

### Nested Styles (⚠️ Limited Support)
**Supported**:
```typescript
"*This is **bold** and italic*"
```
- Processes inner `**bold**` first
- Then processes outer `*italic*`

**Limitations**:
- Complex nesting may not work perfectly
- Priority given to innermost complete styles

## State Management

### Block Element States
```typescript
enum BLOCK_ELEMENT_STATES {
    routing = 'routing',
    processingHeader = 'processingHeader',
    processingParagraph = 'processingParagraph',
    processingCodeBlock = 'processingCodeBlock',
}
```

### Inline Element States
```typescript
enum INLINE_ELEMENT_STATES {
    routing = 'routing',
    processingItalicText = 'processingItalicText',
    processingBoldText = 'processingBoldText',
    processingBoldItalicText = 'processingBoldItalicText',
    processingStrikethroughText = 'processingStrikethroughText',
    processingInlineCode = 'processingInlineCode',
}
```

### Context Properties
```typescript
{
  isProcessingNewLine: boolean,          // true when \n encountered
  isProcessingStylingMarkerSegment: boolean,
  blockContentBuffer: string,            // accumulated block content
  blockType: string,                     // current block type
  parsedSegment: string,                 // current segment being parsed
  styles: string[],                      // active styles
  isBlockDefining: boolean,              // true for new blocks
  headerLevel: number,                   // 0-6 for headers
  codeBlockLanguage: string,             // language for code blocks
  codeBlockSegmentsBuffer: string[],     // buffered code segments
  encounteredCodeBlockExitMarkerCandidate: boolean
}
```

## Output Structure

### StreamingChunk Interface
```typescript
interface StreamingChunk {
  status: 'START_STREAM' | 'STREAMING' | 'END_STREAM';
  segment?: {
    segment: string;           // The actual text content
    type: string;              // Block type: header, paragraph, codeBlock
    level?: number;            // For headers: 1-6
    language?: string;         // For code blocks
    styles: string[];          // Inline styles: bold, italic, etc.
    isBlockDefining: boolean;  // true for new block starts
    isProcessingNewLine: boolean; // true if segment contains \n
  }
}
```

### Lifecycle Events
1. **START_STREAM**: Emitted when `startParsing()` called
2. **STREAMING**: Emitted for each parsed segment
3. **END_STREAM**: Emitted when `stopParsing()` called

## Regex Patterns Reference

### Block Patterns
```typescript
headerMarker: /^(#{1,6}\s?)(.*)/
codeBlockStartMarker: /^(\s*```)([a-zA-Z_+-]*)(?:\n|\\n)([a-zA-Z_+\-\s]*)$/
codeBlockEndMarker: /(?<!`)```(?!`)\s*((\n|\\n){1,})/
```

### Newline Detection
```typescript
hasNewLineSymbol: /(\n|\\n)+/
endsWithNewLine: /(?:\\n|\n)[ \t]*$/
endsWithMoreThanOneNewLine: /(?:\\n|\n){2,}[ \t]*$/
```

### Inline Style Patterns
Each style has 4 patterns:
- `partialOrFull`: Detects potential matches
- `full`: Complete style markers (open + close)
- `partialStart`: Only opening marker found
- `partialEnd`: Only closing marker found

## Testing Coverage

### Block Elements
- ✅ Simple paragraphs
- ✅ Headers (all 6 levels)
- ✅ Code blocks with language
- ✅ Code blocks without language
- ✅ Empty code blocks
- ✅ Consecutive code blocks

### Inline Styles
- ✅ Bold (`**`)
- ✅ Italic (`*`)
- ✅ Bold + Italic (`***`)
- ✅ Strikethrough (`~~`)
- ✅ Inline code (`` ` ``)
- ✅ Mixed styles in same segment
- ✅ Prefixed content
- ✅ Postfixed content

### State Transitions
- ✅ Paragraph → Header
- ✅ Header → Code Block
- ✅ Code Block → Paragraph
- ✅ Paragraph → Paragraph (continuation)

### Edge Cases
- ✅ Empty segments
- ✅ Multiple consecutive newlines
- ✅ Malformed markdown
- ✅ Incomplete style markers
- ✅ Rapid state transitions

## Limitations & Known Issues

### Not Supported
- ❌ Lists (ordered/unordered)
- ❌ Blockquotes
- ❌ Tables
- ❌ Links
- ❌ Images
- ❌ Horizontal rules
- ❌ HTML tags
- ❌ Nested code blocks within lists
- ❌ Multiple heading styles (only ATX `#` supported, not Setext)

### Partial Support
- ⚠️ Complex nested inline styles
- ⚠️ Inline styles across newlines (reset on newline)
- ⚠️ Very deeply nested style combinations

### Performance Considerations
- Buffer accumulation for code blocks
- Regex matching on every segment
- State tracking overhead

## API Usage

### Initialization
```typescript
const parser = MarkdownStreamParser.getInstance('unique-id');
```

### Parsing Flow
```typescript
// Subscribe to parsed segments
const unsubscribe = parser.subscribeToTokenParse((chunk, unsub) => {
  console.log(chunk);
});

// Start parsing
parser.startParsing();

// Send chunks
parser.parseToken('## ');
parser.parseToken('Header\n');
parser.parseToken('Some ');
parser.parseToken('**bold** ');
parser.parseToken('text.\n');

// Stop parsing
parser.stopParsing();

// Cleanup
unsubscribe();
MarkdownStreamParser.removeInstance('unique-id');
```

### Event Stream
```typescript
{ status: 'START_STREAM' }
{ status: 'STREAMING', segment: { segment: 'Header', type: 'header', level: 2, ... } }
{ status: 'STREAMING', segment: { segment: 'Some ', type: 'paragraph', ... } }
{ status: 'STREAMING', segment: { segment: 'bold', type: 'paragraph', styles: ['bold'], ... } }
{ status: 'STREAMING', segment: { segment: ' text.', type: 'paragraph', ... } }
{ status: 'END_STREAM' }
```

## Summary
The state-machine parser provides solid support for:
- ✅ Basic block elements (headers, paragraphs, code blocks)
- ✅ Five inline styles (bold, italic, bold-italic, strikethrough, inline code)
- ✅ Proper segment splitting with prefixed/postfixed content
- ✅ Streaming chunk processing
- ✅ State tracking and transitions

It serves as an excellent baseline for the tree-sitter implementation to match and eventually exceed.
