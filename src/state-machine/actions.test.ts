import { describe, it, expect, vi } from 'vitest'
import { actionRunner } from './actions'
import { BLOCK_TYPES } from './constants'
import type { Context, ParsedSegment } from './actions'

const getMockContext = (overrides: Partial<Context> = {}): Context => ({
  isProcessingNewLine: false,
  isProcessingStylingMarkerSegment: false,
  blockContentBuffer: '',
  blockType: '',
  parsedSegment: '',
  styles: [],
  isBlockDefining: false,
  headerLevel: 0,
  codeBlockLanguage: '',
  codeBlockSegmentsBuffer: [],
  encounteredCodeBlockExitMarkerCandidate: false,
  ...overrides,
})

describe('State Machine Actions', () => {
  describe('Simple setters', () => {
    it('should set isProcessingNewLine', () => {
      const context = getMockContext()
      const result = actionRunner('set::isProcessingNewLine', context, { value: true }, {})
      expect(result).toEqual({ isProcessingNewLine: true })
    })

    it('should set isProcessingStylingMarkerSegment', () => {
      const context = getMockContext()
      const result = actionRunner('set::isProcessingStylingMarkerSegment', context, { value: true }, {})
      expect(result).toEqual({ isProcessingStylingMarkerSegment: true })
    })

    it('should set paragraph block type', () => {
      const context = getMockContext({ blockType: BLOCK_TYPES.header, isProcessingNewLine: true })
      const result = actionRunner('set::paragraph', context, {}, {})
      expect(result).toEqual({ blockType: BLOCK_TYPES.paragraph, isBlockDefining: true })
    })
  })

  describe('Resets', () => {
    it('should reset blockContentBuffer', () => {
      const context = getMockContext({ blockContentBuffer: 'some content' })
      const result = actionRunner('reset::blockContentBuffer', context, {}, {})
      expect(result).toEqual({ blockContentBuffer: '' })
    })

    it('should reset codeBlockSegmentsBuffer', () => {
      const context = getMockContext({ codeBlockSegmentsBuffer: ['a', 'b'] })
      const result = actionRunner('reset::codeBlockSegmentsBuffer', context, {}, {})
      expect(result).toEqual({ codeBlockSegmentsBuffer: [] })
    })

    it('should reset inlineTextStyle', () => {
      const context = getMockContext({ styles: ['bold'] })
      const result = actionRunner('reset::inlineTextStyle', context, {}, {})
      expect(result).toEqual({ styles: [] })
    })
  })

  describe('Buffers', () => {
    it('should buffer block content', () => {
      const context = getMockContext({ blockContentBuffer: 'start' })
      const result = actionRunner('buffer::blockContent', context, { segment: ' end' }, {})
      expect(result).toEqual({ blockContentBuffer: 'start end' })
    })

    it('should buffer code block segments', () => {
      const context = getMockContext({ codeBlockSegmentsBuffer: ['first'] })
      const result = actionRunner('buffer::codeBlockSegments', context, { segment: 'second' }, {})
      expect(result).toEqual({ codeBlockSegmentsBuffer: ['first', 'second'] })
    })
  })

  describe('Complex Actions', () => {
    it('should set header properties correctly', () => {
      const context = getMockContext()
      const result = actionRunner('set::header', context, { segment: '## Header 2' }, {})
      expect(result).toEqual({
        blockType: BLOCK_TYPES.header,
        headerLevel: 2,
        isBlockDefining: true,
      })
    })

    it('should set code block properties correctly', () => {
      const context = getMockContext()
      const result = actionRunner('set::codeBlock', context, { segment: '```javascript\n' }, {})
      expect(result).toEqual({
        blockType: BLOCK_TYPES.codeBlock,
        codeBlockLanguage: 'javascript',
        isBlockDefining: true,
      })
    })

    it('should apply full inline text style', () => {
      const context = getMockContext()
      const result = actionRunner('apply::inlineTextStyle', context, { segment: '*italic*' }, { styleGroup: 'italic', match: 'full' })
      expect(result).toEqual(expect.objectContaining({
        parsedSegment: 'italic ',
        styles: ['italic'],
      }))
    })

    it('should apply partial start inline text style', () => {
        const context = getMockContext()
        const result = actionRunner('apply::inlineTextStyle', context, { segment: '*italic' }, { styleGroup: 'italic', match: 'partial::start' })
        expect(result).toEqual(expect.objectContaining({
          parsedSegment: 'italic ',
          styles: ['italic'],
        }))
      })
  })

  describe('emitParsedSegment', () => {
    it('should emit a parsed segment', () => {
      const emitter = vi.fn()
      const context = getMockContext({
        blockType: BLOCK_TYPES.paragraph,
        styles: ['bold'],
        isBlockDefining: true,
        isProcessingNewLine: true,
      })
      const result = actionRunner('emit::parsedSegment', context, { segment: 'Hello ' }, { emitter })

      const expectedSegment: ParsedSegment = {
        segment: 'Hello ',
        styles: ['bold'],
        type: 'paragraph',
        isBlockDefining: true,
        isProcessingNewLine: true,
      }

      expect(emitter).toHaveBeenCalledWith(expectedSegment)
      expect(result).toEqual({ isBlockDefining: false, isProcessingNewLine: false })
    })

    it('should truncate trailing newline when specified', () => {
      const emitter = vi.fn()
      const context = getMockContext({ blockType: BLOCK_TYPES.paragraph })
      actionRunner('emit::parsedSegment', context, { segment: 'Hello\n\n' }, { emitter, isTruncateTrailingNewLine: true })
      expect(emitter.mock.calls[0][0].segment).toBe('Hello')
    })

    it('should skip styles when specified', () => {
        const emitter = vi.fn()
        const context = getMockContext({ blockType: BLOCK_TYPES.paragraph, styles: ['bold'] })
        actionRunner('emit::parsedSegment', context, { segment: 'Hello ' }, { emitter, skipStyles: true })
        expect(emitter.mock.calls[0][0].styles).toEqual([])
      })
  })

  it('should throw error for unknown action', () => {
    expect(() => actionRunner('unknown::action', getMockContext(), {}, {})).toThrow('No action found for: unknown::action')
  })
})
