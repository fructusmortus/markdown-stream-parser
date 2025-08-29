
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkdownStreamParser } from './markdown-stream-parser'

// Mock child components
vi.mock('./tokens-stream-buffer.ts', () => {
  const TokensStreamBuffer = vi.fn()
  TokensStreamBuffer.prototype.receiveChunk = vi.fn()
  TokensStreamBuffer.prototype.flushBuffer = vi.fn()
  TokensStreamBuffer.prototype.subscribeToSegmentCompletion = vi.fn((cb: (segment: string) => void) => {
    TokensStreamBuffer.prototype.triggerSegmentCompletion = (segment: string) => cb(segment)
    return vi.fn() // return unsubscribe function
  })
  return { default: TokensStreamBuffer }
})

vi.mock('./state-machine/markdown-state-machine.ts', () => {
  const MarkdownStreamParserStateMachine = vi.fn()
  MarkdownStreamParserStateMachine.prototype.parseSegment = vi.fn()
  MarkdownStreamParserStateMachine.prototype.resetParser = vi.fn()
  MarkdownStreamParserStateMachine.prototype.subscribeToParsedSegment = vi.fn((cb: (segment: any) => void) => {
    MarkdownStreamParserStateMachine.prototype.triggerParsedSegment = (segment: any) => cb(segment)
    return vi.fn() // return unsubscribe function
  })
  return { default: MarkdownStreamParserStateMachine }
})

describe('MarkdownStreamParser', () => {
  let parser: MarkdownStreamParser
  const instanceId = 'test-instance'

  beforeEach(() => {
    // Clear all instances and mocks before each test
    vi.clearAllMocks()
    MarkdownStreamParser.removeInstance(instanceId)
    parser = MarkdownStreamParser.getInstance(instanceId)
  })

  it('should be a singleton for a given instanceId', () => {
    const parser2 = MarkdownStreamParser.getInstance(instanceId)
    expect(parser).toBe(parser2)
  })

  it('should create different instances for different instanceIds', () => {
    const parser2 = MarkdownStreamParser.getInstance('another-instance')
    expect(parser).not.toBe(parser2)
    MarkdownStreamParser.removeInstance('another-instance')
  })

  it('should remove an instance', () => {
    MarkdownStreamParser.removeInstance(instanceId)
    const parser2 = MarkdownStreamParser.getInstance(instanceId)
    expect(parser).not.toBe(parser2)
  })

  describe('Parsing Lifecycle', () => {
    it('should not be parsing initially', () => {
      expect(parser.parsing).toBe(false)
    })

    it('should start parsing and subscribe to dependencies', () => {
      const listener = vi.fn()
      parser.subscribeToTokenParse(listener)
      parser.startParsing()

      expect(parser.parsing).toBe(true)
      expect(parser.tokensStreamProcessor.subscribeToSegmentCompletion).toHaveBeenCalled()
      expect(parser.markdownStreamParser.subscribeToParsedSegment).toHaveBeenCalled()
      expect(listener).toHaveBeenCalledWith({ status: 'START_STREAM' }, expect.any(Function))
    })

    it('should not start parsing if already parsing', () => {
      parser.startParsing()
      const listener = vi.fn()
      parser.subscribeToTokenParse(listener)
      parser.startParsing() // second call
      expect(listener).not.toHaveBeenCalledWith({ status: 'START_STREAM' }, expect.any(Function))
    })

    it('should stop parsing, flush, reset, and unsubscribe', () => {
      const listener = vi.fn()
      parser.subscribeToTokenParse(listener)
      parser.startParsing()
      parser.stopParsing()

      expect(parser.parsing).toBe(false)
      expect(parser.tokensStreamProcessor.flushBuffer).toHaveBeenCalled()
      expect(parser.markdownStreamParser.resetParser).toHaveBeenCalled()
      expect(listener).toHaveBeenCalledWith({ status: 'END_STREAM' }, expect.any(Function))
    })

    it('should throw error if parseToken is called before startParsing', () => {
      const error = parser.parseToken('chunk')
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe('Parser is not started.')
    })
  })

  describe('Data Flow', () => {
    it('should pass chunks to TokensStreamBuffer', () => {
      parser.startParsing()
      parser.parseToken('some chunk')
      expect(parser.tokensStreamProcessor.receiveChunk).toHaveBeenCalledWith('some chunk')
    })

    it('should pass segments from buffer to state machine', () => {
      parser.startParsing()
      // @ts-ignore - triggerSegmentCompletion is a mock-specific helper
      parser.tokensStreamProcessor.triggerSegmentCompletion('segment ')
      expect(parser.markdownStreamParser.parseSegment).toHaveBeenCalledWith('segment ')
    })

    it('should notify listeners with parsed segments from state machine', () => {
      const listener = vi.fn()
      parser.subscribeToTokenParse(listener)
      parser.startParsing()

      const parsedSegment = { type: 'paragraph', content: 'hello' }
      // @ts-ignore - triggerParsedSegment is a mock-specific helper
      parser.markdownStreamParser.triggerParsedSegment(parsedSegment)

      expect(listener).toHaveBeenCalledWith({ status: 'STREAMING', segment: parsedSegment }, expect.any(Function))
    })
  })

  describe('Subscription', () => {
    it('should subscribe and notify listeners', () => {
      const listener = vi.fn()
      parser.subscribeToTokenParse(listener)
      parser.startParsing()
      parser.stopParsing()

      expect(listener).toHaveBeenCalledWith({ status: 'START_STREAM' }, expect.any(Function))
      expect(listener).toHaveBeenCalledWith({ status: 'END_STREAM' }, expect.any(Function))
    })

    it('should allow unsubscribing', () => {
      const listener = vi.fn()
      const unsubscribe = parser.subscribeToTokenParse(listener)

      unsubscribe()

      parser.startParsing()
      expect(listener).not.toHaveBeenCalled()
    })
  })
})
