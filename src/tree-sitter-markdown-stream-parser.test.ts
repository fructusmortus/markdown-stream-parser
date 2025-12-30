import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MarkdownStreamParser } from './tree-sitter-markdown-stream-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Tree-Sitter MarkdownStreamParser - Phase 1: Quick Wins', () => {
  let parser: MarkdownStreamParser
  let parsedSegments: any[] = []
  const instanceId = 'test-tree-sitter'

  // Set up path for WASM files
  const wasmDir = path.join(__dirname, '../demo/svelte-demo/static')

  beforeEach(async () => {
    parsedSegments = []

    // Configure WASM path for testing - this will also help locateFile find tree-sitter.wasm
    MarkdownStreamParser.configureWasmPath(path.join(wasmDir, 'tree-sitter-markdown.wasm'))

    parser = await MarkdownStreamParser.getInstance(instanceId)

    parser.subscribeToTokenParse((chunk) => {
      if (chunk.status === 'STREAMING' && chunk.segment) {
        parsedSegments.push(chunk.segment)
      }
    })

    parser.startParsing()
  })

  afterEach(() => {
    parser.stopParsing()
    MarkdownStreamParser.removeInstance(instanceId)
  })

  describe('Basic Block Types', () => {
    it('should use camelCase for block type names', async () => {
      parser.parseToken('```javascript\n')
      parser.parseToken('code\n')
      parser.parseToken('```\n')
      parser.stopParsing()

      const codeBlockSegments = parsedSegments.filter(s => s.type.includes('code') || s.type.includes('Code'))
      expect(codeBlockSegments.length).toBeGreaterThan(0)

      // Should be 'codeBlock' not 'code_block'
      const hasCorrectNaming = codeBlockSegments.some(s => s.type === 'codeBlock')
      expect(hasCorrectNaming).toBe(true)
    })

    it('should extract language from code blocks', async () => {
      parser.parseToken('```javascript\n')
      parser.parseToken('const x = 1;\n')
      parser.parseToken('```\n')
      parser.stopParsing()

      const codeBlockSegments = parsedSegments.filter(s => s.type === 'codeBlock')
      expect(codeBlockSegments.length).toBeGreaterThan(0)

      // Should have language field
      const hasLanguage = codeBlockSegments.some(s => s.language === 'javascript')
      expect(hasLanguage).toBe(true)
    })

    it('should handle code blocks without language', async () => {
      parser.parseToken('```\n')
      parser.parseToken('code\n')
      parser.parseToken('```\n')
      parser.stopParsing()

      const codeBlockSegments = parsedSegments.filter(s => s.type === 'codeBlock')
      expect(codeBlockSegments.length).toBeGreaterThan(0)

      // Language should be empty string or undefined
      const firstCodeBlock = codeBlockSegments[0]
      expect(firstCodeBlock.language === '' || firstCodeBlock.language === undefined).toBe(true)
    })
  })

  describe('Header Processing', () => {
    it('should strip header markers from content', async () => {
      parser.parseToken('## ')
      parser.parseToken('Header Text\n')
      parser.stopParsing()

      const headerSegments = parsedSegments.filter(s => s.type === 'header')
      expect(headerSegments.length).toBeGreaterThan(0)

      // Content should NOT include ##
      const headerContent = headerSegments.map(s => s.segment).join('')
      expect(headerContent).not.toContain('##')
      expect(headerContent.trim()).toBe('Header Text')
    })

    it('should detect all 6 header levels correctly', async () => {
      const levels = [1, 2, 3, 4, 5, 6]

      for (const level of levels) {
        parsedSegments = []
        parser = await MarkdownStreamParser.getInstance(`test-${level}`)
        parser.subscribeToTokenParse((chunk) => {
          if (chunk.status === 'STREAMING' && chunk.segment) {
            parsedSegments.push(chunk.segment)
          }
        })
        parser.startParsing()

        const markers = '#'.repeat(level)
        parser.parseToken(`${markers} `)
        parser.parseToken(`Level ${level}\n`)
        parser.stopParsing()

        const headerSegments = parsedSegments.filter(s => s.type === 'header')
        expect(headerSegments.length).toBeGreaterThan(0)
        expect(headerSegments[0].level).toBe(level)

        MarkdownStreamParser.removeInstance(`test-${level}`)
      }
    })

    it('should handle multiple headers in sequence', async () => {
      parser.parseToken('# First\n')
      parser.parseToken('## Second\n')
      parser.parseToken('### Third\n')
      parser.stopParsing()

      const headerSegments = parsedSegments.filter(s => s.type === 'header')
      expect(headerSegments.length).toBeGreaterThan(0)

      // Check that content doesn't include markers
      headerSegments.forEach(seg => {
        expect(seg.segment).not.toMatch(/^#+\s/)
      })
    })
  })

  describe('Inline Style Names', () => {
    it('should use "code" not "inline_code" for inline code', async () => {
      parser.parseToken('Run `npm install` now\n')
      parser.stopParsing()

      const styledSegments = parsedSegments.filter(s => s.styles && s.styles.length > 0)

      if (styledSegments.length > 0) {
        // Should use 'code' not 'inline_code'
        const hasCorrectStyleName = styledSegments.some(s => s.styles.includes('code'))
        const hasWrongStyleName = styledSegments.some(s => s.styles.includes('inline_code'))

        expect(hasCorrectStyleName).toBe(true)
        expect(hasWrongStyleName).toBe(false)
      }
    })

    it('should detect bold style correctly', async () => {
      parser.parseToken('This is **bold** text\n')
      parser.stopParsing()

      const styledSegments = parsedSegments.filter(s => s.styles && s.styles.includes('bold'))
      // Should detect bold style
      expect(styledSegments.length).toBeGreaterThan(0)
    })

    it('should detect italic style correctly', async () => {
      parser.parseToken('This is *italic* text\n')
      parser.stopParsing()

      const styledSegments = parsedSegments.filter(s => s.styles && s.styles.includes('italic'))
      // Should detect italic style
      expect(styledSegments.length).toBeGreaterThan(0)
    })

    it('should detect strikethrough style correctly', async () => {
      parser.parseToken('This is ~~deleted~~ text\n')
      parser.stopParsing()

      const styledSegments = parsedSegments.filter(s => s.styles && s.styles.includes('strikethrough'))
      // Should detect strikethrough style
      expect(styledSegments.length).toBeGreaterThan(0)
    })
  })

  describe('Real LLM Stream Example - gpt-4.5-cat-coding.json', () => {
    it('should parse real streaming data correctly', async () => {
      const examplePath = path.join(__dirname, '../demo/llm-streams-examples/gpt-4.5-cat-coding.json')

      if (!fs.existsSync(examplePath)) {
        console.warn('Example file not found, skipping test')
        return
      }

      const chunks = JSON.parse(fs.readFileSync(examplePath, 'utf-8'))

      // Process first 50 chunks to test Phase 1 fixes
      const testChunks = chunks.slice(0, 50)

      for (const chunk of testChunks) {
        parser.parseToken(chunk)
      }

      parser.stopParsing()

      // Phase 1 validation checks
      console.log('\n=== Phase 1 Test Results ===')
      console.log(`Total segments parsed: ${parsedSegments.length}`)

      // 1. Check for correct block type naming (camelCase)
      const codeBlocks = parsedSegments.filter(s => s.type === 'codeBlock')
      const wrongCodeBlocks = parsedSegments.filter(s => s.type === 'code_block')
      console.log(`✓ Code blocks with correct naming (codeBlock): ${codeBlocks.length}`)
      console.log(`✗ Code blocks with wrong naming (code_block): ${wrongCodeBlocks.length}`)
      expect(wrongCodeBlocks.length).toBe(0)

      // 2. Check for language extraction in code blocks
      if (codeBlocks.length > 0) {
        const blocksWithLanguage = codeBlocks.filter(s => s.language)
        console.log(`✓ Code blocks with language field: ${blocksWithLanguage.length}/${codeBlocks.length}`)
      }

      // 3. Check for correct style names
      const wrongStyleSegments = parsedSegments.filter(s =>
        s.styles && s.styles.includes('inline_code')
      )
      const correctStyleSegments = parsedSegments.filter(s =>
        s.styles && s.styles.includes('code')
      )
      console.log(`✓ Segments with correct style name (code): ${correctStyleSegments.length}`)
      console.log(`✗ Segments with wrong style name (inline_code): ${wrongStyleSegments.length}`)
      expect(wrongStyleSegments.length).toBe(0)

      // 4. Check headers don't include markers
      const headers = parsedSegments.filter(s => s.type === 'header')
      const headersWithMarkers = headers.filter(s => s.segment && s.segment.match(/^#+\s/))
      console.log(`✓ Headers parsed: ${headers.length}`)
      console.log(`✗ Headers with markers in content: ${headersWithMarkers.length}`)
      expect(headersWithMarkers.length).toBe(0)

      // 5. Check for style detection
      const styledSegments = parsedSegments.filter(s => s.styles && s.styles.length > 0)
      console.log(`✓ Segments with styles detected: ${styledSegments.length}`)

      console.log('\n=== Sample Segments ===')
      console.log('First header:', headers[0])
      if (codeBlocks.length > 0) console.log('First code block:', codeBlocks[0])
      if (styledSegments.length > 0) console.log('First styled segment:', styledSegments[0])
    })
  })

  describe('Output Structure Validation', () => {
    it('should have correct output structure matching state machine', async () => {
      parser.parseToken('## Header\n')
      parser.parseToken('Paragraph text.\n')
      parser.stopParsing()

      parsedSegments.forEach(segment => {
        // Required fields
        expect(segment).toHaveProperty('segment')
        expect(segment).toHaveProperty('type')
        expect(segment).toHaveProperty('styles')
        expect(segment).toHaveProperty('isBlockDefining')
        expect(segment).toHaveProperty('isProcessingNewLine')

        // Types should be correct
        expect(typeof segment.segment).toBe('string')
        expect(typeof segment.type).toBe('string')
        expect(Array.isArray(segment.styles)).toBe(true)
        expect(typeof segment.isBlockDefining).toBe('boolean')
        expect(typeof segment.isProcessingNewLine).toBe('boolean')
      })
    })

    it('should set isProcessingNewLine correctly', async () => {
      parser.parseToken('Text without newline ')
      parser.parseToken('and more\n')
      parser.stopParsing()

      const withNewline = parsedSegments.filter(s => s.segment.includes('\n'))
      const withoutNewline = parsedSegments.filter(s => !s.segment.includes('\n'))

      withNewline.forEach(s => {
        expect(s.isProcessingNewLine).toBe(true)
      })
    })
  })
  describe('Table Inline Code', () => {
    it('should strip backticks from inline code inside tables', async () => {
      parser.parseToken('| Col | `code` |\n')
      parser.stopParsing()

      const cellSegments = parsedSegments.filter(s => s.segment.trim() === 'code')
      const rawSegments = parsedSegments.filter(s => s.segment === '`code`')

      // Should have stripped backticks
      if (rawSegments.length > 0) {
        console.log('Failed: Found unstripped code segment:', rawSegments[0])
      }

      expect(rawSegments.length).toBe(0)
      expect(cellSegments.length).toBeGreaterThan(0)
      expect(cellSegments[0].styles).toContain('code')
    })

    it('should detect table block types for complete tables', async () => {
      parser.parseToken('| A | B |\n')
      parser.parseToken('|---|---|\n')
      parser.parseToken('| 1 | 2 |\n')
      parser.stopParsing()

      // Should have table-related segments
      const tableSegments = parsedSegments.filter(s =>
        s.type === 'table_header_cell' || s.type === 'table_cell' || s.type === 'table'
      )
      console.log('Table segments:', tableSegments)
      console.log('All segments:', parsedSegments)

      expect(tableSegments.length).toBeGreaterThan(0)
    })

    it('should suppress pipe delimiters from output', async () => {
      parser.parseToken('| A | B |\n')
      parser.parseToken('|---|---|\n')
      parser.parseToken('| 1 | 2 |\n')
      parser.stopParsing()

      // Should NOT have any segments that are just '|' or '| '
      const pipeSegments = parsedSegments.filter(s => /^\|[\s]*$/.test(s.segment))
      console.log('Pipe segments (should be empty):', pipeSegments)

      expect(pipeSegments.length).toBe(0)
    })

    it('should suppress delimiter row content', async () => {
      parser.parseToken('| A |\n')
      parser.parseToken('|---|\n')
      parser.parseToken('| B |\n')
      parser.stopParsing()

      // Should NOT have any segments containing '---'
      const delimiterSegments = parsedSegments.filter(s => s.segment.includes('---'))
      console.log('Delimiter segments (should be empty):', delimiterSegments)

      expect(delimiterSegments.length).toBe(0)
    })

    it('should handle inline code in full table structure', async () => {
      parser.parseToken('| Header |\n')
      parser.parseToken('|--------|\n')
      parser.parseToken('| `code` |\n')
      parser.stopParsing()

      // Should have code segment with proper style
      const codeSegments = parsedSegments.filter(s => s.styles && s.styles.includes('code'))
      console.log('Code segments:', codeSegments)

      expect(codeSegments.length).toBeGreaterThan(0)
      // Code should be stripped of backticks
      const hasStrippedCode = codeSegments.some(s => s.segment.trim() === 'code')
      expect(hasStrippedCode).toBe(true)
    })
  })
})
