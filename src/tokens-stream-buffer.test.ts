import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import TokensStreamBuffer from './tokens-stream-buffer.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('TokensStreamBuffer - Long Consecutive Sequences Bug', () => {
  let buffer: TokensStreamBuffer
  let emittedSegments: string[]

  beforeEach(() => {
    buffer = new TokensStreamBuffer()
    emittedSegments = []

    buffer.subscribeToSegmentCompletion((segment: string) => {
      emittedSegments.push(segment)
    })
  })

  it('should handle normal text with whitespace correctly', () => {
    // Normal case that works
    buffer.receiveChunk('Hello ')
    buffer.receiveChunk('world!')
    buffer.receiveChunk(' ')

    expect(emittedSegments).toEqual(['Hello ', 'world! '])
  })

  it('SHOULD FAIL: proves the core freeze bug - chunks without whitespace dont emit', () => {
    // Test the exact condition that causes the freeze

    // These chunks have whitespace - they should emit
    buffer.receiveChunk('hello ')
    buffer.receiveChunk('world ')

    expect(emittedSegments.length).toBe(2) // Should pass

    // Now add chunks WITHOUT whitespace - these should NOT emit (proving the bug)
    const chunksWithoutWhitespace = ['AB', 'CD', 'EF', 'GH', 'IJ']

    for (const chunk of chunksWithoutWhitespace) {
      buffer.receiveChunk(chunk)
    }

    // This should fail: we added 5 more chunks but got no new emissions
    expect(emittedSegments.length).toBeGreaterThan(2) // SHOULD FAIL - proves the bug

    // Buffer should contain accumulated content
    expect(buffer.buffer).toBe('ABCDEFGHIJ') // Should pass - proves accumulation
  })

  it('SHOULD FAIL: demonstrates buffer grows infinitely without whitespace', () => {
    // Start with empty buffer
    expect(buffer.buffer.length).toBe(0)

    // Add many chunks without whitespace
    for (let i = 0; i < 20; i++) {
      buffer.receiveChunk('XX')
    }

    // No emissions should happen
    expect(emittedSegments.length).toBe(0) // Should pass

    // Buffer should have grown to 40 characters
    expect(buffer.buffer.length).toBe(40) // Should pass

    // This proves the bug: buffer grows indefinitely without emission
    // In real scenario, this leads to memory issues and freezing
    expect(buffer.buffer.length).toBeLessThan(10) // SHOULD FAIL - proves buffer accumulation bug
  })

  it('should eventually emit when whitespace is added after long sequence', () => {
    // Add chunks without whitespace
    buffer.receiveChunk('TEST')
    buffer.receiveChunk('DATA')

    // No emissions yet
    expect(emittedSegments.length).toBe(0)

    // Add whitespace - this should trigger emission
    buffer.receiveChunk(' ')

    // Now it should emit
    expect(emittedSegments.length).toBe(1)
    expect(emittedSegments[0]).toBe('TESTDATA ')
  })

  it('proves regex pattern is the root cause', () => {
    // This is the exact regex pattern from TokensStreamBuffer
    const pattern = /(\s*\S+\s+|\s*\S+((\n|\\n)+))/g

    // Test strings without trailing whitespace - these should NOT match
    const withoutWhitespace = [
      'ABCDEF',
      'TESTDATA',
      'H4sIAAAAAA',
      'verylongstringwithoutspaces'
    ]

    for (const str of withoutWhitespace) {
      pattern.lastIndex = 0 // Reset regex
      const match = pattern.test(str)
      expect(match).toBe(false) // Should pass - proves these don't match
    }

    // Test strings WITH trailing whitespace - these SHOULD match
    const withWhitespace = [
      'ABCDEF ',
      'TESTDATA ',
      'H4sIAAAAAA\n'
    ]

    for (const str of withWhitespace) {
      pattern.lastIndex = 0 // Reset regex
      const match = pattern.test(str)
      expect(match).toBe(true) // Should pass - proves these DO match
    }

    // This proves the root cause: regex only matches strings with trailing whitespace/newlines
  })

  it('SHOULD FAIL: reproduces issue with real problematic data pattern (limited to avoid hang)', () => {
    // Use the pattern from the actual problematic file but limit it to avoid hanging
    const problematicFile = path.join(__dirname, '../demo/llm-stream-examples-manually-simulated/long-consecutive-sequence.json')
    const problematicData = JSON.parse(fs.readFileSync(problematicFile, 'utf-8'))

    // Process initial chunks that work normally (they have whitespace)
    const initialChunks = problematicData.slice(0, 10)
    for (const chunk of initialChunks) {
      buffer.receiveChunk(chunk)
    }

    const initialEmissions = emittedSegments.length
    expect(initialEmissions).toBeGreaterThan(0) // Should have some emissions

    // Now find and process the problematic base64 sequence (without whitespace)
    const base64StartIndex = problematicData.findIndex((chunk: string) => chunk === '= ') + 2
    if (base64StartIndex > 1) {
      // Take only 30 chunks to avoid hanging, but enough to prove the bug
      const problematicSequence = problematicData.slice(base64StartIndex, base64StartIndex + 30)

      for (const chunk of problematicSequence) {
        buffer.receiveChunk(chunk)
      }

      const finalEmissions = emittedSegments.length

      // This should fail: we processed 30+ base64 chunks but got no new emissions
      expect(finalEmissions).toBeGreaterThan(initialEmissions) // SHOULD FAIL - proves the freeze bug

      // Buffer should have accumulated content
      expect(buffer.buffer.length).toBeGreaterThan(0) // Should pass
    }
  })

  it('demonstrates the exact freeze scenario with safe limits', () => {
    // Simulate what happens in char-streamer with the problematic file

    // Process some normal content first
    buffer.receiveChunk('I ')
    buffer.receiveChunk('have ')
    buffer.receiveChunk('encoded_data ')

    expect(emittedSegments.length).toBe(3) // Should pass

    // Now process the pattern that causes the freeze: 'a = "' followed by base64
    buffer.receiveChunk('a ')  // This will emit
    buffer.receiveChunk('= ')  // This will emit
    buffer.receiveChunk('"')   // This starts the problem - no whitespace

    expect(emittedSegments.length).toBe(5) // Should pass

    // Now add base64-like chunks without whitespace - this should NOT emit
    const base64Chunks = ['H4', 'sI', 'AA', 'AA', 'AA', '+1', '9a', '3e', 'bx', 'tb']

    for (const chunk of base64Chunks) {
      buffer.receiveChunk(chunk)
    }

    // This is the bug: despite adding 10 more chunks, no new emissions
    expect(emittedSegments.length).toBe(5) // Should pass - confirms the bug

    // All those chunks should be accumulated in buffer
    expect(buffer.buffer).toBe('"H4sIAAAAAA+19a3ebxtb') // Should pass

    // This condition causes the freeze in real scenarios with longer sequences
  })
})

describe('TokensStreamBuffer - Comprehensive Tests', () => {
  let buffer: TokensStreamBuffer
  let emittedSegments: string[]

  beforeEach(() => {
    buffer = new TokensStreamBuffer()
    emittedSegments = []
    buffer.subscribeToSegmentCompletion((segment: string) => {
      emittedSegments.push(segment)
    })
  })

  it('should not emit for incomplete segments', () => {
    buffer.receiveChunk('test')
    expect(emittedSegments.length).toBe(0)
    expect(buffer.buffer).toBe('test')
  })

  it('should emit a segment when a space is received', () => {
    buffer.receiveChunk('hello')
    buffer.receiveChunk(' ')
    expect(emittedSegments).toEqual(['hello '])
    expect(buffer.buffer).toBe('')
  })

  it('should emit a segment when a newline is received', () => {
    buffer.receiveChunk('hello')
    buffer.receiveChunk('\n')
    expect(emittedSegments).toEqual(['hello\n'])
    expect(buffer.buffer).toBe('')
  })

  it('should handle multiple segments in a single chunk', () => {
    buffer.receiveChunk('one two three ')
    expect(emittedSegments).toEqual(['one ', 'two ', 'three '])
    expect(buffer.buffer).toBe('')
  })

  it('should handle segments split across multiple chunks', () => {
    buffer.receiveChunk('seg')
    buffer.receiveChunk('ment ')
    expect(emittedSegments).toEqual(['segment '])
    expect(buffer.buffer).toBe('')
  })

  it('should handle mixed whitespace', () => {
    buffer.receiveChunk('a \nb\tc ')
    expect(emittedSegments).toEqual(['a \n', 'b\t', 'c '])
    expect(buffer.buffer).toBe('')
  })

  it('should flush the remaining buffer content', () => {
    buffer.receiveChunk('remaining')
    expect(emittedSegments.length).toBe(0)
    buffer.flushBuffer()
    expect(emittedSegments).toEqual(['remaining'])
    expect(buffer.buffer).toBe('')
  })

  it('should handle empty chunks', () => {
    buffer.receiveChunk('')
    expect(emittedSegments.length).toBe(0)
    expect(buffer.buffer).toBe('')
  })

  it('should throw an error for non-string chunks', () => {
    // @ts-ignore
    expect(() => buffer.receiveChunk(123)).toThrow('Chunk must be a string.')
  })

  it('should correctly subscribe and unsubscribe', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    const unsubscribe1 = buffer.subscribeToSegmentCompletion(listener1)
    buffer.subscribeToSegmentCompletion(listener2)

    buffer.receiveChunk('test ')
    expect(listener1).toHaveBeenCalledWith('test ')
    expect(listener2).toHaveBeenCalledWith('test ')

    unsubscribe1()
    buffer.receiveChunk('another ')
    expect(listener1).toHaveBeenCalledTimes(1)
    expect(listener2).toHaveBeenCalledTimes(2)
    expect(listener2).toHaveBeenCalledWith('another ')
  })

  it('should handle buffer being set directly', () => {
    buffer.buffer = 'direct set '
    expect(emittedSegments).toEqual(['direct ', 'set '])
    expect(buffer.buffer).toBe('')
  })

  it('should handle complex stream simulation', () => {
    buffer.receiveChunk('This is a test stream.\nIt has ');
    expect(emittedSegments).toEqual(['This ', 'is ', 'a ', 'test ', 'stream.\n', 'It ', 'has ']);
    expect(buffer.buffer).toBe('');
    buffer.receiveChunk('multiple parts.');
    buffer.flushBuffer();
    expect(emittedSegments).toEqual(['This ', 'is ', 'a ', 'test ', 'stream.\n', 'It ', 'has ', 'multiple ', 'parts.']);
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle very long words without spaces', () => {
      const longWord = 'a'.repeat(1000)
      buffer.receiveChunk(longWord)
      buffer.receiveChunk(' ')

      expect(emittedSegments).toEqual([`${longWord} `])
      expect(buffer.buffer).toBe('')
    })

    it('should handle rapid alternating chunks', () => {
      for (let i = 0; i < 10; i++) {
        buffer.receiveChunk('a')
        buffer.receiveChunk(' ')
      }

      expect(emittedSegments.length).toBe(10)
      expect(emittedSegments).toEqual(Array(10).fill('a '))
    })

    it('should handle chunks with only whitespace', () => {
      buffer.receiveChunk('word')
      buffer.receiveChunk('   ')
      buffer.receiveChunk('   ')
      buffer.receiveChunk('another')
      buffer.receiveChunk(' ')

      // The regex processes whitespace in a specific way based on pattern matching
      expect(emittedSegments).toEqual(['word   ', '   another '])
    })

    it('should handle mixed newline formats', () => {
      buffer.receiveChunk('line1\n')
      buffer.receiveChunk('line2\\n')
      buffer.receiveChunk('line3\r\n')
      buffer.receiveChunk('word ')

      expect(emittedSegments).toEqual(['line1\n', 'line2\\n', 'line3\r\n', 'word '])
    })

    it('should handle multiple consecutive newlines', () => {
      buffer.receiveChunk('para1\n')
      buffer.receiveChunk('\n')
      buffer.receiveChunk('\n')
      buffer.receiveChunk('para2 ')

      // The regex groups consecutive newlines differently
      expect(emittedSegments).toEqual(['para1\n', '\n\npara2 '])
    })

    it('should handle unicode and special characters', () => {
      buffer.receiveChunk('🔥emoji ')
      buffer.receiveChunk('café ')
      buffer.receiveChunk('naïve ')
      buffer.receiveChunk('测试 ')

      expect(emittedSegments).toEqual(['🔥emoji ', 'café ', 'naïve ', '测试 '])
    })

    it('should handle buffer overflow scenarios', () => {
      // Simulate a scenario where many small chunks accumulate
      const chunks = Array(100).fill('a')
      chunks.forEach(chunk => buffer.receiveChunk(chunk))
      buffer.receiveChunk(' ')

      expect(emittedSegments).toEqual([`${'a'.repeat(100)} `])
    })

    it('should handle interleaved punctuation', () => {
      buffer.receiveChunk('Hello,')
      buffer.receiveChunk(' ')
      buffer.receiveChunk('world!')
      buffer.receiveChunk(' ')
      buffer.receiveChunk('How')
      buffer.receiveChunk(' ')
      buffer.receiveChunk('are')
      buffer.receiveChunk(' ')
      buffer.receiveChunk('you?')
      buffer.receiveChunk(' ')

      expect(emittedSegments).toEqual(['Hello, ', 'world! ', 'How ', 'are ', 'you? '])
    })

    it('should handle tabs and special whitespace', () => {
      buffer.receiveChunk('word1\t')
      buffer.receiveChunk('word2 ')
      buffer.receiveChunk('word3\v')
      buffer.receiveChunk('word4 ')

      expect(emittedSegments).toEqual(['word1\t', 'word2 ', 'word3\v', 'word4 '])
    })

    it('should handle regex pattern edge cases', () => {
      // Test patterns that might confuse the regex
      buffer.receiveChunk('a')
      buffer.receiveChunk('.')
      buffer.receiveChunk('b ')
      buffer.receiveChunk('c*d ')
      buffer.receiveChunk('e+f ')
      buffer.receiveChunk('g?h ')

      expect(emittedSegments).toEqual(['a.b ', 'c*d ', 'e+f ', 'g?h '])
    })

    it('should maintain correct buffer state during processing', () => {
      expect(buffer.buffer).toBe('')

      buffer.receiveChunk('partial')
      expect(buffer.buffer).toBe('partial')
      expect(emittedSegments).toEqual([])

      buffer.receiveChunk(' word ')
      expect(buffer.buffer).toBe('')
      expect(emittedSegments).toEqual(['partial ', 'word '])
    })

    it('should handle repeated subscriptions and unsubscriptions', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      const unsub1 = buffer.subscribeToSegmentCompletion(listener1)
      const unsub2 = buffer.subscribeToSegmentCompletion(listener2)

      buffer.receiveChunk('test ')
      expect(listener1).toHaveBeenCalledWith('test ')
      expect(listener2).toHaveBeenCalledWith('test ')

      unsub1()
      buffer.receiveChunk('test2 ')
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(2)

      unsub2()
      buffer.receiveChunk('test3 ')
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(2)
    })

    it('should handle malformed input gracefully', () => {
      // Test with null bytes and control characters
      buffer.receiveChunk('word1\0word2 ')
      buffer.receiveChunk('word3\x01word4 ')

      expect(emittedSegments.length).toBe(2)
      expect(emittedSegments[0]).toContain('word1')
      expect(emittedSegments[0]).toContain('word2')
    })

    it('should handle very frequent chunk updates', () => {
      // Simulate high-frequency streaming
      const word = 'streaming'
      for (let i = 0; i < word.length; i++) {
        buffer.receiveChunk(word[i])
      }
      buffer.receiveChunk(' ')

      expect(emittedSegments).toEqual(['streaming '])
    })

    it('should preserve exact whitespace patterns', () => {
      buffer.receiveChunk('  start  ')
      buffer.receiveChunk('  middle  ')
      buffer.receiveChunk('  end  ')
      buffer.receiveChunk('\n')

      // The regex processes whitespace based on its matching pattern
      expect(emittedSegments).toEqual(['  start  ', '  middle  ', '  end  '])
    })

    it('should handle processBufferForCompletion directly', () => {
      // Test the public method directly
      buffer.buffer = 'direct test '
      buffer.processBufferForCompletion()

      expect(emittedSegments).toEqual(['direct ', 'test '])
      expect(buffer.buffer).toBe('')
    })

    it('should handle error conditions in chunk reception', () => {
      // Test error handling for non-string input
      expect(() => {
        (buffer as any).receiveChunk(123)
      }).toThrow('Chunk must be a string.')

      expect(() => {
        (buffer as any).receiveChunk(null)
      }).toThrow('Chunk must be a string.')

      expect(() => {
        (buffer as any).receiveChunk(undefined)
      }).toThrow('Chunk must be a string.')
    })
  })

  describe('Performance and Memory Scenarios', () => {
    it('should handle large buffers efficiently', () => {
      const largeText = 'word '.repeat(10000)
      buffer.receiveChunk(largeText)

      expect(emittedSegments.length).toBe(10000)
      expect(buffer.buffer).toBe('')
    })

    it('should not leak memory with repeated operations', () => {
      // Simulate many cycles of accumulation and emission
      for (let cycle = 0; cycle < 100; cycle++) {
        buffer.receiveChunk(`cycle${cycle} `)
        emittedSegments.length = 0 // Clear for next cycle
      }

      expect(buffer.buffer).toBe('')
      expect(buffer.wordCompleteListeners.length).toBe(1) // Only our test listener
    })

    it('should handle streaming markdown content', () => {
      // Simulate realistic markdown streaming
      const markdownChunks = [
        '# ', 'Header\n',
        'This ', 'is ', '**bold** ', 'text.\n',
        '```javascript\n',
        'const ', 'x ', '= ', '"test";\n',
        '```\n',
        'End ', 'of ', 'document.'
      ]

      markdownChunks.forEach(chunk => buffer.receiveChunk(chunk))
      buffer.flushBuffer()

      expect(emittedSegments.length).toBeGreaterThan(0)
      expect(emittedSegments.join('')).toBe(markdownChunks.join(''))
    })
  })
});
