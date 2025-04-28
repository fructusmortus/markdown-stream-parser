'use strict'

export default class TokensStreamBuffer {
    private _buffer: string
    wordCompleteListeners: Array<(word: string) => void>

    constructor() {
        this._buffer = ''
        this.wordCompleteListeners = []
    }

    private processBufferForCompletion() {
        const pattern = /(\s*\S+\s+|\s*\S+((\n|\\n)+))/g
        let match
        let lastIndex = 0

        // Use exec() since it provides indices, which we use to slice the buffer correctly
        while ((match = pattern.exec(this.buffer)) !== null) {
            const matchObject = (([
                fullMatch,
                prefixedWhitespace,
                content,
                postfixedWhitespace
            ]) => ({
                fullMatch: fullMatch || '',
                prefixedWhitespace: prefixedWhitespace || '',
                content: content || '',
                postfixedWhitespace: postfixedWhitespace || '',
            }))(match || [])

            lastIndex = match.index + matchObject.fullMatch.length    // Calculate the index of the end of the match

            this.notifyWordCompletion(matchObject.fullMatch)    // Emit the word
        }

        // Update the buffer by slicing off the processed part
        if (lastIndex > 0) {
            this.buffer = this.buffer.slice(lastIndex)
        }
    }

    private notifyWordCompletion(word) {
        this.wordCompleteListeners.forEach(listener => listener(word))
    }

    public subscribeToSegmentCompletion(listener) {
        this.wordCompleteListeners.push(listener)
        return () => this.unsubscribeFromSegmentCompletion(listener)
    }

    public unsubscribeFromSegmentCompletion(listener) {
        this.wordCompleteListeners = this.wordCompleteListeners.filter(l => l !== listener)
    }

    // Handle the end of the stream by flushing any remaining content
    public flushBuffer(): void {
        // If there's any content in the buffer that hasn't been emitted, emit it
        if (this.buffer.length > 0) {
            this.notifyWordCompletion(this.buffer)
            this.buffer = ''
        }
    }

    // Use a setter for buffer to trigger word processing upon each chunk addition
    public set buffer(value) {
        this._buffer = value
        this.processBufferForCompletion()
    }

    // Use a getter for buffer to access the current buffer value
    public get buffer() {
        return this._buffer
    }

    public receiveChunk(chunk): void {
        if (typeof chunk !== 'string') {
            throw new Error('Chunk must be a string.')
        }

        // Directly set the buffer to trigger the word processing logic
        this.buffer += chunk
    }
}

// Usage:
// const streamProcessor = new TokensStreamProcessor()
// streamProcessor.subscribeToSegmentCompletion(word => console.log(`Word completed: ${word}`))

// Simulating chunks being received:
// streamProcessor.receiveChunk('Hel')
// streamProcessor.receiveChunk('lo ')   // Emits 'Hello'
// streamProcessor.receiveChunk('wor')
// streamProcessor.receiveChunk('ld!\n') // Emits 'world!', then 'Bingo!'
// streamProcessor.receiveChunk('Bingo')
// streamProcessor.receiveChunk('!')
