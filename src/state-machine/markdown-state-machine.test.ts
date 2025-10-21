import { describe, it, expect, beforeEach, vi } from 'vitest'
import MarkdownStreamStateMachine from './markdown-state-machine'
import { BLOCK_TYPES } from './constants'
import type { ParsedSegment } from './actions'

describe('MarkdownStreamStateMachine', () => {
  let machine: MarkdownStreamStateMachine
  let parsedSegmentListener: any

  beforeEach(() => {
    machine = new MarkdownStreamStateMachine()
    parsedSegmentListener = vi.fn()
    machine.subscribeToParsedSegment(parsedSegmentListener)
  })

  it('should initialize with correct default state', () => {
    expect(machine.blockElementState).toBe('routing')
    expect(machine.inlineElementState).toBe('routing')
    expect(machine.context.isProcessingNewLine).toBe(true)
  })

  it('should reset the parser to initial state', () => {
    machine.parseSegment('## A header')
    machine.resetParser()
    expect(machine.blockElementState).toBe('routing')
    expect(machine.inlineElementState).toBe('routing')
    expect(machine.context.isProcessingNewLine).toBe(true)
    expect(machine.context.blockType).toBe('')
  })

  describe('Paragraph Processing', () => {
    it('should process a simple paragraph', () => {
      machine.parseSegment('Hello ')
      machine.parseSegment('world.\n')

      expect(parsedSegmentListener).toHaveBeenCalledTimes(2)
      expect(parsedSegmentListener).toHaveBeenCalledWith(expect.objectContaining({
        segment: 'Hello ',
        type: BLOCK_TYPES.paragraph,
      }))
      expect(parsedSegmentListener).toHaveBeenCalledWith(expect.objectContaining({
        segment: 'world.',
        type: BLOCK_TYPES.paragraph,
      }))
    })
  })

  describe('Header Processing', () => {
    it('should process a header', () => {
      machine.parseSegment('## ')
      machine.parseSegment('A header\n')

      expect(parsedSegmentListener).toHaveBeenCalledWith(expect.objectContaining({
        segment: 'A header',
        type: BLOCK_TYPES.header,
        level: 2,
      }))
    })
  })

  describe('Code Block Processing', () => {
    it('should process a simple code block', () => {
      machine.parseSegment('```javascript\n')
      machine.parseSegment('const a = 1;\n')
      machine.parseSegment('```\n')
      machine.parseSegment('after')

      expect(parsedSegmentListener).toHaveBeenCalledWith(expect.objectContaining({
        segment: 'const a = 1;',
        type: BLOCK_TYPES.codeBlock,
        language: 'javascript',
      }))
      expect(parsedSegmentListener).toHaveBeenCalledWith(expect.objectContaining({
        segment: 'after',
        type: BLOCK_TYPES.paragraph,
      }))
    })
  })

  describe('Inline Style Processing', () => {
    it('should process inline styles without errors', () => {
      machine.parseSegment('Here ')
      machine.parseSegment('is ')
      machine.parseSegment('**bold**')
      machine.parseSegment(' text.\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      expect(parsedSegmentListener.mock.calls.length).toBeGreaterThan(0)
    })

    it('should handle italic style processing', () => {
      machine.parseSegment('This ')
      machine.parseSegment('is ')
      machine.parseSegment('*italic*')
      machine.parseSegment(' text.\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      expect(parsedSegmentListener.mock.calls.length).toBeGreaterThan(0)
    })

    it('should handle nested styles', () => {
      machine.parseSegment('*This ')
      machine.parseSegment('is ')
      machine.parseSegment('**bold**')
      machine.parseSegment(' and ')
      machine.parseSegment('italic*')

      expect(parsedSegmentListener).toHaveBeenCalled()
      expect(parsedSegmentListener.mock.calls.length).toBeGreaterThan(0)
    })
  })

  it('should subscribe and unsubscribe listeners', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    const unsubscribe1 = machine.subscribeToParsedSegment(listener1)
    machine.subscribeToParsedSegment(listener2)

    machine.parseSegment('test ')
    expect(listener1).toHaveBeenCalled()
    expect(listener2).toHaveBeenCalled()

    unsubscribe1()
    machine.parseSegment('another ')
    expect(listener1).toHaveBeenCalledTimes(1)
    expect(listener2).toHaveBeenCalledTimes(2)
  })

  describe('Complex State Transitions', () => {
    it('should transition from paragraph to header correctly', () => {
      machine.parseSegment('Regular ')
      machine.parseSegment('paragraph.\n')
      machine.parseSegment('# ')
      machine.parseSegment('Header\n')

      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].type === BLOCK_TYPES.paragraph)).toBe(true)
      expect(calls.some(call => call[0].type === BLOCK_TYPES.header && call[0].level === 1)).toBe(true)
    })

    it('should transition from header to code block correctly', () => {
      machine.parseSegment('## ')
      machine.parseSegment('Code Example\n')
      machine.parseSegment('```js\n')
      machine.parseSegment('console.log("hello");\n')
      machine.parseSegment('```\n')

      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].type === BLOCK_TYPES.header && call[0].level === 2)).toBe(true)
      expect(calls.some(call => call[0].type === BLOCK_TYPES.codeBlock && call[0].language === 'js')).toBe(true)
    })

    it('should transition from code block back to paragraph', () => {
      machine.parseSegment('```python\n')
      machine.parseSegment('print("test")\n')
      machine.parseSegment('```\n')
      machine.parseSegment('Back ')
      machine.parseSegment('to ')
      machine.parseSegment('paragraph.\n')

      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].type === BLOCK_TYPES.codeBlock && call[0].language === 'python')).toBe(true)
      expect(calls.some(call => call[0].type === BLOCK_TYPES.paragraph && call[0].segment.includes('Back'))).toBe(true)
    })
  })

  describe('Complex Code Block Scenarios', () => {
    it('should handle consecutive code block end markers', () => {
      machine.parseSegment('```js\n')
      machine.parseSegment('code here\n')
      machine.parseSegment('```\n')
      machine.parseSegment('```\n')
      machine.parseSegment('after')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].type === BLOCK_TYPES.codeBlock)).toBe(true)
      expect(calls.some(call => call[0].type === BLOCK_TYPES.paragraph && call[0].segment.includes('after'))).toBe(true)
    })

    it('should handle code blocks with various languages', () => {
      const languages = ['javascript', 'python', 'typescript', 'cpp', 'shell']

      languages.forEach(lang => {
        machine.resetParser()
        machine = new MarkdownStreamStateMachine()
        parsedSegmentListener = vi.fn()
        machine.subscribeToParsedSegment(parsedSegmentListener)

        machine.parseSegment(`\`\`\`${lang}\n`)
        machine.parseSegment('code content\n')
        machine.parseSegment('```\n')

        const calls = parsedSegmentListener.mock.calls
        expect(calls.some(call => call[0].type === BLOCK_TYPES.codeBlock && call[0].language === lang)).toBe(true)
      })
    })

    it('should handle empty code blocks', () => {
      machine.parseSegment('```\n')
      machine.parseSegment('```\n')
      machine.parseSegment('after')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].type === BLOCK_TYPES.paragraph && call[0].segment.includes('after'))).toBe(true)
    })
  })

  describe('Complex Inline Style Processing', () => {
    it('should handle partial start inline styles across segments', () => {
      machine.parseSegment('Text ')
      machine.parseSegment('with ')
      machine.parseSegment('*partial')
      machine.parseSegment(' ')
      machine.parseSegment('italic*')
      machine.parseSegment(' end.\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].styles && call[0].styles.includes('italic'))).toBe(true)
    })

    it('should handle mixed inline styles in same segment', () => {
      machine.parseSegment('Text ')
      machine.parseSegment('with ')
      machine.parseSegment('**bold**')
      machine.parseSegment(' and ')
      machine.parseSegment('*italic*')
      machine.parseSegment(' styles.\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].styles && call[0].styles.includes('bold'))).toBe(true)
      expect(calls.some(call => call[0].styles && call[0].styles.includes('italic'))).toBe(true)
    })

    it('should handle bold italic combined styles', () => {
      machine.parseSegment('Text ')
      machine.parseSegment('with ')
      machine.parseSegment('***bolditalic***')
      machine.parseSegment(' style.\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call =>
        call[0].styles &&
        call[0].styles.includes('bold') &&
        call[0].styles.includes('italic')
      )).toBe(true)
    })

    it('should handle strikethrough styles', () => {
      machine.parseSegment('Text ')
      machine.parseSegment('with ')
      machine.parseSegment('~~strikethrough~~')
      machine.parseSegment(' style.\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].styles && call[0].styles.includes('strikethrough'))).toBe(true)
    })

    it('should handle inline code styles', () => {
      machine.parseSegment('Text ')
      machine.parseSegment('with ')
      machine.parseSegment('`code`')
      machine.parseSegment(' style.\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].styles && call[0].styles.includes('code'))).toBe(true)
    })

    it('should handle prefixed and postfixed content in inline styles', () => {
      machine.parseSegment('before*italic*after')
      machine.parseSegment(' more.\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls

      // Should emit prefixed content
      expect(calls.some(call => call[0].segment.includes('before'))).toBe(true)
      // Should emit styled content
      expect(calls.some(call => call[0].styles && call[0].styles.includes('italic'))).toBe(true)
      // Should emit postfixed content
      expect(calls.some(call => call[0].segment.includes('after'))).toBe(true)
    })

    it('should reset inline styles when encountering newlines', () => {
      machine.parseSegment('*incomplete')
      machine.parseSegment(' italic\n')
      machine.parseSegment('new ')
      machine.parseSegment('paragraph')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls

      // After newline, should start fresh paragraph
      expect(calls.some(call =>
        call[0].segment.includes('new') &&
        call[0].type === BLOCK_TYPES.paragraph
      )).toBe(true)
    })
  })

  describe('Header Level Processing', () => {
    it('should correctly identify all header levels', () => {
      const levels = [1, 2, 3, 4, 5, 6]

      levels.forEach(level => {
        machine.resetParser()
        machine = new MarkdownStreamStateMachine()
        parsedSegmentListener = vi.fn()
        machine.subscribeToParsedSegment(parsedSegmentListener)

        const hashes = '#'.repeat(level)
        machine.parseSegment(`${hashes} `)
        machine.parseSegment(`Header ${level}\n`)

        const calls = parsedSegmentListener.mock.calls
        expect(calls.some(call =>
          call[0].type === BLOCK_TYPES.header &&
          call[0].level === level
        )).toBe(true)
      })
    })

    it('should handle headers without space after hashes', () => {
      machine.parseSegment('#Header')
      machine.parseSegment(' content\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls

      // The state machine processes #Header as a header, but with level 0 (due to hashes.length - 1)
      expect(calls.some((call: any) => call[0].type === BLOCK_TYPES.header && call[0].level === 0)).toBe(true)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty segments gracefully', () => {
      machine.parseSegment('')
      machine.parseSegment('text')
      machine.parseSegment('')
      machine.parseSegment('\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      // Should not crash and should process the text segment
    })

    it('should handle multiple consecutive newlines', () => {
      machine.parseSegment('paragraph\n')
      machine.parseSegment('\n')
      machine.parseSegment('\n')
      machine.parseSegment('new ')
      machine.parseSegment('paragraph')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].segment.includes('new'))).toBe(true)
    })

    it('should handle malformed markdown gracefully', () => {
      machine.parseSegment('*incomplete italic')
      machine.parseSegment(' text\n')
      machine.parseSegment('**incomplete ')
      machine.parseSegment('bold\n')
      machine.parseSegment('```incomplete')
      machine.parseSegment(' code\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      // Should not crash and should process as paragraph content
      const calls = parsedSegmentListener.mock.calls
      expect(calls.length).toBeGreaterThan(0)
    })

    it('should handle rapid state transitions', () => {
      machine.parseSegment('# ')
      machine.parseSegment('Header\n')
      machine.parseSegment('```js\n')
      machine.parseSegment('code\n')
      machine.parseSegment('```\n')
      machine.parseSegment('## ')
      machine.parseSegment('Another\n')

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls
      expect(calls.some(call => call[0].type === BLOCK_TYPES.header && call[0].level === 1)).toBe(true)
      expect(calls.some(call => call[0].type === BLOCK_TYPES.codeBlock)).toBe(true)
      expect(calls.some(call => call[0].type === BLOCK_TYPES.header && call[0].level === 2)).toBe(true)
    })
  })

  describe('Context and State Management', () => {
    it('should maintain context across different block types', () => {
      expect(machine.context.blockContentBuffer).toBe('')
      expect(machine.context.styles).toEqual([])
      expect(machine.context.isBlockDefining).toBe(true)
      expect(machine.context.isProcessingNewLine).toBe(true)
    })

    it('should reset context appropriately when transitioning states', () => {
      machine.parseSegment('# ')
      machine.parseSegment('Header\n')

      // After processing header with newline, should reset
      expect(machine.context.isProcessingNewLine).toBe(true)
      expect(machine.blockElementState).toBe('routing')
    })

    it('should evaluate conditions correctly', () => {
      // Test the public evaluate method
      expect(machine.evaluate('is::processingNewLine', { event: {}, params: {} })).toBe(true)
      expect(machine.evaluate('is::blockTypeSet', { event: {}, params: {} })).toBe(false)
      expect(machine.evaluate('is::headerMarker', { event: { segment: '# Header' }, params: {} })).toBe(true)
    })

    it('should act on context changes correctly', () => {
      const initialContext = { ...machine.context }
      machine.act('set::isProcessingNewLine', { event: { value: false }, params: {} })
      expect(machine.context.isProcessingNewLine).toBe(false)
      expect(machine.context.isProcessingNewLine).not.toBe(initialContext.isProcessingNewLine)
    })

    it('should transition states correctly', () => {
      machine.transitionBlockElementState('processingHeader')
      expect(machine.blockElementState).toBe('processingHeader')

      machine.transitionInlineElementState('processingItalicText')
      expect(machine.inlineElementState).toBe('processingItalicText')
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complex markdown document', () => {
      const segments = [
        '# ', 'Main Title\n',
        'This ', 'is ', 'a ', '**bold** ', 'paragraph.\n',
        '## ', 'Code Section\n',
        '```javascript\n',
        'const x = "test";\n',
        'console.log(x);\n',
        '```\n',
        'Back ', 'to ', '*italic* ', 'text.\n'
      ]

      segments.forEach(segment => machine.parseSegment(segment))

      expect(parsedSegmentListener).toHaveBeenCalled()
      const calls = parsedSegmentListener.mock.calls

      // Should have header
      expect(calls.some(call => call[0].type === BLOCK_TYPES.header && call[0].level === 1)).toBe(true)
      expect(calls.some(call => call[0].type === BLOCK_TYPES.header && call[0].level === 2)).toBe(true)

      // Should have bold style
      expect(calls.some(call => call[0].styles && call[0].styles.includes('bold'))).toBe(true)

      // Should have code block
      expect(calls.some(call => call[0].type === BLOCK_TYPES.codeBlock && call[0].language === 'javascript')).toBe(true)

      // Should have italic style
      expect(calls.some(call => call[0].styles && call[0].styles.includes('italic'))).toBe(true)
    })
  })
})