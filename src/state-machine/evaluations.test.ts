import { describe, it, expect } from 'vitest'
import { evaluationRunner } from './evaluations'
import { BLOCK_TYPES } from './constants'
import type { Context } from './markdown-state-machine'

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
  prefixedContent: '',
  postfixedContent: '',
  ...overrides,
})

describe('State Machine Evaluations', () => {
  it('should check is::processingNewLine', () => {
    const context = getMockContext({ isProcessingNewLine: true })
    expect(evaluationRunner('is::processingNewLine', context, {}, {})).toBe(true)
  })

  it('should check is::blockTypeSet', () => {
    const context = getMockContext({ blockType: BLOCK_TYPES.paragraph })
    expect(evaluationRunner('is::blockTypeSet', context, {}, {})).toBe(true)
    const emptyContext = getMockContext()
    expect(evaluationRunner('is::blockTypeSet', emptyContext, {}, {})).toBe(false)
  })

  it('should check for header marker', () => {
    expect(evaluationRunner('is::headerMarker', getMockContext(), { segment: '# h1' }, {})).toBe(true)
    expect(evaluationRunner('is::headerMarker', getMockContext(), { segment: 'not a header' }, {})).toBe(false)
  })

  it('should check for full inline style marker', () => {
    const context = getMockContext()
    expect(evaluationRunner('is::inlineStyleMarkerFull', context, { segment: '*italic*' }, { styleGroup: 'italic' })).toBe(true)
    expect(evaluationRunner('is::inlineStyleMarkerFull', context, { segment: '*italic' }, { styleGroup: 'italic' })).toBe(false)
  })

  it('should check for partial start inline style marker', () => {
    const context = getMockContext()
    expect(evaluationRunner('is::inlineStyleMarkerPartialStart', context, { segment: '*italic' }, { styleGroup: 'italic' })).toBe(true)
    expect(evaluationRunner('is::inlineStyleMarkerPartialStart', context, { segment: 'italic*' }, { styleGroup: 'italic' })).toBe(false)
  })

  it('should check for code block start marker', () => {
    expect(evaluationRunner('is::codeBlockStartMarker', getMockContext(), { segment: '```js\n' }, {})).toBe(true)
    expect(evaluationRunner('is::codeBlockStartMarker', getMockContext(), { segment: '```' }, {})).toBe(false)
  })

  it('should check for code block end marker', () => {
    expect(evaluationRunner('is::codeBlockEndMarker', getMockContext(), { segment: '```\n' }, {})).toBe(true)
    expect(evaluationRunner('is::codeBlockEndMarker', getMockContext(), { segment: '```' }, {})).toBe(false)
  })

  it('should check for newline symbol', () => {
    expect(evaluationRunner('has::newLine', getMockContext(), { segment: 'hello\nworld' }, {})).toBe(true)
    expect(evaluationRunner('has::newLine', getMockContext(), { segment: 'hello world' }, {})).toBe(false)
  })

  it('should check for prefixed content', () => {
    const context = getMockContext({ prefixedContent: 'prefix' })
    expect(evaluationRunner('has::prefixedContent', context, {}, {})).toBe(true)
    const emptyContext = getMockContext()
    expect(evaluationRunner('has::prefixedContent', emptyContext, {}, {})).toBe(false)
  })

  it('should check for postfix content', () => {
    const context = getMockContext({ postfixedContent: 'postfix' })
    expect(evaluationRunner('has::postfixedContent', context, {}, {})).toBe(true)
    const emptyContext = getMockContext()
    expect(evaluationRunner('has::postfixedContent', emptyContext, {}, {})).toBe(false)
  })

  it('should check if segment ends with newline', () => {
    expect(evaluationRunner('ends::newLine', getMockContext(), { segment: 'hello\n' }, {})).toBe(true)
    expect(evaluationRunner('ends::newLine', getMockContext(), { segment: 'hello' }, {})).toBe(false)
  })

  it('should check if segment ends with more than one newline', () => {
    expect(evaluationRunner('ends::moreThanOneNewLine', getMockContext(), { segment: 'hello\n\n' }, {})).toBe(true)
    expect(evaluationRunner('ends::moreThanOneNewLine', getMockContext(), { segment: 'hello\n' }, {})).toBe(false)
  })

  it('should throw error for unknown evaluation', () => {
    expect(() => evaluationRunner('unknown::evaluation', getMockContext(), {}, {})).toThrow('No evaluation found for: unknown::evaluation')
  })
})
