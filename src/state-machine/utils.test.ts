import { describe, it, expect } from 'vitest'
import { truncateTrailingNewLine } from './utils'

describe('State Machine Utils', () => {
  describe('truncateTrailingNewLine', () => {
    it('should remove a single trailing newline', () => {
      expect(truncateTrailingNewLine('hello\n')).toBe('hello')
    })

    it('should remove multiple trailing newlines', () => {
      expect(truncateTrailingNewLine('hello\n\n\n')).toBe('hello')
    })

    it('should remove a single trailing escaped newline', () => {
      expect(truncateTrailingNewLine('hello\\n')).toBe('hello')
    })

    it('should remove multiple trailing escaped newlines', () => {
      expect(truncateTrailingNewLine('hello\\n\\n\\n')).toBe('hello')
    })

    it('should remove mixed trailing newlines', () => {
      expect(truncateTrailingNewLine('hello\n\\n\n')).toBe('hello')
    })

    it('should not modify string with no trailing newline', () => {
      expect(truncateTrailingNewLine('hello')).toBe('hello')
    })

    it('should not modify string with leading or middle newlines', () => {
      expect(truncateTrailingNewLine('\nhello\nworld')).toBe('\nhello\nworld')
    })

    it('should handle an empty string', () => {
      expect(truncateTrailingNewLine('')).toBe('')
    })

    it('should handle a string with only newlines', () => {
      expect(truncateTrailingNewLine('\n\n')).toBe('')
    })
  })
})
