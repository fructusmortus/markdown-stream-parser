'use strict'

import { INLINE_STYLE_GROUPS } from './constants.ts'
import { evaluationRunner } from './evaluations.ts'
import { actionRunner } from './actions.ts'

import type { ActionParams, ParsedSegment } from './actions.ts'
import type { EvaluationEvent } from './evaluations.ts'

const IS_DEBUG = false

enum BLOCK_ELEMENT_STATES {
    routing = 'routing',
    processingHeader = 'processingHeader',
    processingParagraph = 'processingParagraph',
    processingCodeBlock = 'processingCodeBlock',
}

enum INLINE_ELEMENT_STATES {
    routing = 'routing',
    processingItalicText = 'processingItalicText',
    processingBoldText = 'processingBoldText',
    processingBoldItalicText = 'processingBoldItalicText',
    processingStrikethroughText = 'processingStrikethroughText',
    processingInlineCode = 'processingInlineCode',
}

export type Context = {
    isProcessingNewLine: boolean
    isProcessingStylingMarkerSegment: boolean

    blockContentBuffer: string

    blockType: string
    parsedSegment: string
    styles: any[]

    isBlockDefining: boolean

    headerLevel: number

    codeBlockLanguage: string
    codeBlockSegmentsBuffer: string[]
    encounteredCodeBlockExitMarkerCandidate: boolean

    parsedSegmentPrefixedContent?: string
    parsedSegmentPostfixedContent?: string
    prefixedContent?: string
    postfixedContent?: string
}


const initialContext = (): Context => ({
    isProcessingNewLine: true,
    isProcessingStylingMarkerSegment: false,

    blockContentBuffer: '',

    blockType: '',
    parsedSegment: '',
    styles: [],

    isBlockDefining: true,

    headerLevel: 0,

    codeBlockLanguage: '',
    codeBlockSegmentsBuffer: [],
    encounteredCodeBlockExitMarkerCandidate: false,
})

export default class TextStreamStateMachine {
    context: Context
    blockElementState: string
    inlineElementState: string
    parsedSegmentListeners: Array<(blockContent: ParsedSegment) => void>    // Store subscriber functions

    constructor() {
        this.context = initialContext()
        this.blockElementState = BLOCK_ELEMENT_STATES.routing    // Initial state for block elements
        this.inlineElementState = INLINE_ELEMENT_STATES.routing    // Initial state for inline elements
        this.parsedSegmentListeners = []    // Store subscriber functions
        this.notifyParsedSegment = this.notifyParsedSegment.bind(this)    // Bind the notifyParsedSegment method to the instance
    }

    // Allow components to subscribe to parsed segment completion
    subscribeToParsedSegment(listener: (blockContent: ParsedSegment) => void) {
        this.parsedSegmentListeners.push(listener)
        return () => this.unsubscribeFromParsedSegment(listener)
    }

    // Allow components to unsubscribe from parsed segment completion
    unsubscribeFromParsedSegment(listener: (blockContent: ParsedSegment) => void) {
        this.parsedSegmentListeners = this.parsedSegmentListeners.filter(l => l !== listener)
    }

    // Internal method to notify all parsed segment complete listeners
    notifyParsedSegment(blockContent: ParsedSegment) {
        this.parsedSegmentListeners.forEach(listener => listener(blockContent))
    }

    // Evaluates the current state based on the event and parameters.
    evaluate(evaluationName: string, {event, params}: { event: EvaluationEvent, params: ActionParams}): boolean {
        return evaluationRunner(evaluationName, this.context, event, params)
    }

    // Actions to be performed on state transitions. Mutates the context !!!
    act(actionName: string, {event, params}: { event: any, params: ActionParams}): void {
        // Merging context with the result of the action
        this.context = {
            ...this.context,
            ...actionRunner(actionName, this.context, event, params)
        }
    }

    transitionBlockElementState(state: string): void {
        this.blockElementState = state
    }

    transitionInlineElementState(state: string): void {
        this.inlineElementState = state
    }

    resetParser(): void {
        this.context = initialContext()
        // this.currentState = STATES.routing

        this.blockElementState = BLOCK_ELEMENT_STATES.routing
        this.inlineElementState = INLINE_ELEMENT_STATES.routing
    }

    processHeader(segment: string) {
        this.act('buffer::blockContent', { event: { segment }, params: {} })

        // Skip the first emit if the styling marker segment is being processed
        if(this.evaluate('is::processingStylingMarkerSegment', { event: {}, params: {} })) {
            this.act('set::isProcessingStylingMarkerSegment', { event: { value: false }, params: {} })    // Reset the styling marker segment flag after the first emit
            return
        }

        this.act('emit::parsedSegment', {
            event: { segment },
            params: {
                emitter: this.notifyParsedSegment,
                isTruncateTrailingNewLine: true,
                // origin: STATES.processingHeader,
                origin: BLOCK_ELEMENT_STATES.processingHeader,
                isDebug: IS_DEBUG
            }
        })

        if (
            this.evaluate('ends::newLine', { event: { segment }, params: {} })
        ) {
            this.act('reset::blockContentBuffer', { event: {}, params: {} })
            this.act('set::isProcessingNewLine', { event: { value: true }, params: {} })

            // When new line symbol is met, reset the current block context and states
            this.resetParser()
            this.transitionBlockElementState(BLOCK_ELEMENT_STATES.routing)
            this.transitionInlineElementState(INLINE_ELEMENT_STATES.routing)
        }
    }

    processInlineStylesGroup(segment: string, styleGroup: string) {
        const styleGroupConfig = INLINE_STYLE_GROUPS[styleGroup]
        if (!styleGroupConfig) {
            throw new Error(`Unknown style group: ${styleGroup}`)
        }

        if (this.evaluate('is::inlineStyleMarkerFull', { event: { segment }, params: {styleGroup: styleGroupConfig.name } })) {
            this.act('apply::inlineTextStyle', {
                event: { segment },
                params: {
                    match: 'full',
                    styleGroup: styleGroupConfig.name
                }
            })

            // If there's any content before the styling marker, emit it
            if(this.evaluate('has::prefixedContent', { event: {}, params: {} })) {
                this.act('buffer::blockContent', { event: { segment: this.context.prefixedContent}, params: {} })
                this.act('emit::parsedSegment', {
                    event: { segment: this.context.prefixedContent},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: false,
                        skipStyles: true,
                        origin: `processing::${styleGroupConfig.name}::FULL::prefixedContent`,
                        isDebug: IS_DEBUG
                    }
                })
                this.act('reset::prefixedContent', { event: {}, params: {} })
            }

            this.act('buffer::blockContent', { event: { segment: this.context.parsedSegment }, params: {} })
            this.act('emit::parsedSegment', {
                event: { segment: this.context.parsedSegment },
                params: {
                    emitter: this.notifyParsedSegment,
                    isTruncateTrailingNewLine: true,
                    origin: `processing::${styleGroupConfig.name}::FULL`,
                    isDebug: IS_DEBUG
                }
            })

            // If there's any content after the styling marker, emit it
            if(this.evaluate('has::postfixedContent', { event: {}, params: {} })) {
                this.act('buffer::blockContent', { event: { segment: this.context.postfixedContent}, params: {} })
                this.act('emit::parsedSegment', {
                    event: { segment: this.context.postfixedContent},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: true,
                        skipStyles: true,
                        origin: `processing::${styleGroupConfig.name}::FULL::postfixedContent`,
                        isDebug: IS_DEBUG
                    }
                })
                this.act('reset::postfixedContent', { event: {}, params: {} })
            }

            this.act('reset::inlineTextStyle', { event: {}, params: {} })

            if (
                this.evaluate('ends::newLine', { event: { segment }, params: {} })
            ) {
                this.act('reset::blockContentBuffer', { event: {}, params: {} })
                this.act('set::isProcessingNewLine', { event: { value: true }, params: {} })

                // When new line symbol is met, reset the current block context and states
                this.resetParser()
                this.transitionBlockElementState(BLOCK_ELEMENT_STATES.routing)
                this.transitionInlineElementState(INLINE_ELEMENT_STATES.routing)
            }

            this.transitionInlineElementState(INLINE_ELEMENT_STATES.routing)    // Transition only the inline group state, block state stays unchanged

            return
        }

        if (
            this.evaluate('is::inlineStyleMarkerPartialStart', { event: { segment }, params: {styleGroup: styleGroupConfig.name } }) &&
            !this.evaluate('is::inlineStyleMarkerFull', { event: { segment }, params: {styleGroup: styleGroupConfig.name } })
        ) {
            this.act('apply::inlineTextStyle', {
                event: { segment },
                params: {
                    match: 'partial::start',
                    styleGroup: styleGroupConfig.name
                }
            })

            // If there's any content before the styling marker, emit it
            if(this.evaluate('has::prefixedContent', { event: {}, params: {} })) {
                this.act('buffer::blockContent', { event: { segment: this.context.prefixedContent}, params: {} })
                this.act('emit::parsedSegment', {
                    event: { segment: this.context.prefixedContent},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: false,
                        skipStyles: true,
                        origin: `processing::${styleGroupConfig.name}::partialSTART::prefixedContent`,
                        isDebug: IS_DEBUG
                    }
                })
                this.act('reset::prefixedContent', { event: {}, params: {} })
            }

            this.act('buffer::blockContent', { event: { segment: this.context.parsedSegment }, params: {} })
            this.act('emit::parsedSegment', {
                event: { segment: this.context.parsedSegment },
                params: {
                    emitter: this.notifyParsedSegment,
                    isTruncateTrailingNewLine: true,
                    origin: `processing::${styleGroupConfig.name}::partialSTART`,
                    isDebug: IS_DEBUG
                }
            })

            return
        }

        if (
            this.evaluate('is::inlineStyleMarkerPartialEnd', { event: { segment }, params: {styleGroup: styleGroupConfig.name} }) &&
            !this.evaluate('is::inlineStyleMarkerFull', { event: { segment }, params: {styleGroup: styleGroupConfig.name} })
        ) {
            this.act('apply::inlineTextStyle', {
                event: { segment },
                params: {
                    match: 'partial::end',
                    styleGroup: styleGroupConfig.name
                }
            })
            this.act('buffer::blockContent', { event: { segment: this.context.parsedSegment }, params: {} })
            this.act('emit::parsedSegment', {
                event: { segment: this.context.parsedSegment },
                params: {
                    emitter: this.notifyParsedSegment,
                    isTruncateTrailingNewLine: true,
                    origin: `processing::${styleGroupConfig.name}::partialEND`,
                    isDebug: IS_DEBUG
                }
            })

            // If there's any content after the styling marker, emit it
            if(this.evaluate('has::postfixedContent', { event: {}, params: {} })) {
                this.act('buffer::blockContent', {
                    event: { segment: this.context.postfixedContent },
                    params: {}
                })
                this.act('emit::parsedSegment', {
                    event: { segment: this.context.postfixedContent},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: true,
                        skipStyles: true,
                        origin: `processing::${styleGroupConfig.name}::partialEND::postfixedContent`,
                        isDebug: IS_DEBUG
                    }
                })
                this.act('reset::postfixedContent', { event: {}, params: {} })
            }

            this.act('reset::inlineTextStyle', { event: {}, params: {} })
            this.transitionInlineElementState(INLINE_ELEMENT_STATES.routing)
        }

        if (
            !this.evaluate('is::inlineStyleMarkerPartialStart', { event: { segment }, params: {styleGroup: styleGroupConfig.name } }) &&
            !this.evaluate('is::inlineStyleMarkerPartialEnd', { event: { segment }, params: {styleGroup: styleGroupConfig.name } })
        ) {
            this.act('buffer::blockContent', { event: { segment }, params: {} })
            this.act('emit::parsedSegment', {
                event: { segment },
                params: {
                    emitter: this.notifyParsedSegment,
                    isTruncateTrailingNewLine: true,
                    origin: `processing::${styleGroupConfig.name}::MIDDLE`,
                    isDebug: IS_DEBUG
                }
            })
        }

        if (
            this.evaluate('ends::newLine', { event: { segment }, params: {} })
        ) {
            this.act('reset::blockContentBuffer', { event: {}, params: {} })
            this.act('set::isProcessingNewLine', { event: { value: true }, params: {} })

            // When new line symbol is met, reset the current block context and states
            this.resetParser()
            this.transitionBlockElementState(BLOCK_ELEMENT_STATES.routing)
            this.transitionInlineElementState(INLINE_ELEMENT_STATES.routing)
        }
    }

    processCodeBlock(segment: string) {
        // Skip the first emit if the styling marker segment is being processed
        if(this.evaluate('is::processingStylingMarkerSegment', { event: {}, params: {} })) {
            // Reset the styling marker segment flag after the first emit
            this.act('set::isProcessingStylingMarkerSegment', {
                event: { value: false },
                params: {}
            })
            return
        }

        // Buffer the code block segments
        this.act('buffer::codeBlockSegments', { event: { segment }, params: {} })

        if (this.context.codeBlockSegmentsBuffer.length > 1) {
            const prevSegment = this.context.codeBlockSegmentsBuffer.shift() // .shift() removes the first element and returns it
            const currentSegment = this.context.codeBlockSegmentsBuffer[0] // Therefore the [0] element is now the current segment

            if (!prevSegment || !currentSegment) {
                return // Safety check for undefined values
            }

            // Regular code block segment
            if (
                !this.evaluate('is::codeBlockEndMarker', { event: { segment: prevSegment }, params: {} }) &&
                !this.evaluate('is::codeBlockEndMarker', { event: { segment: currentSegment }, params: {} })
            ) {
                // Print the previous segment WITH new lines
                this.act('buffer::blockContent', { event: { segment: prevSegment }, params: {} })
                this.act('emit::parsedSegment', {
                    event: { segment: prevSegment },
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: false,
                        // origin: STATES.processingCodeBlock + '::// Regular code block segment',
                        origin: BLOCK_ELEMENT_STATES.processingCodeBlock + '::// Regular code block segment',
                        isDebug: IS_DEBUG
                    }
                })
            }

            // Potential single code block end
            if (
                !this.evaluate('is::codeBlockEndMarker', { event: { segment: prevSegment }, params: {} }) &&
                this.evaluate('is::codeBlockEndMarker', { event: { segment: currentSegment }, params: {} })
            ) {
                // Print the previous segment WITHOUT new lines
                this.act('buffer::blockContent', { event: { segment: prevSegment }, params: {} })
                this.act('emit::parsedSegment', {
                    event: { segment: prevSegment },
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: true,
                        // origin: STATES.processingCodeBlock + '::// Potential single code block end',
                        origin: BLOCK_ELEMENT_STATES.processingCodeBlock + '::// Potential single code block end',
                        isDebug: IS_DEBUG
                    }
                })
            }

            // Eventually it turned into a Double code block in some cases
            if (
                this.evaluate('is::codeBlockEndMarker', { event: { segment: prevSegment }, params: {} }) &&
                this.evaluate('is::codeBlockEndMarker', { event: { segment: currentSegment }, params: {} })
            ) {
                // Print the previous segment WITHOUT new lines
                this.act('buffer::blockContent', { event: { segment: prevSegment }, params: {} })
                this.act('emit::parsedSegment', {
                    event: { segment: `\n${prevSegment}`},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: true,
                        // origin: STATES.processingCodeBlock + '::// Eventually it turned into a Double code block in some cases',
                        origin: BLOCK_ELEMENT_STATES.processingCodeBlock + '::// Eventually it turned into a Double code block in some cases',
                        isDebug: IS_DEBUG
                    }
                })

                this.act('reset::blockContentBuffer', { event: {}, params: {} })
                this.act('set::isProcessingNewLine', { event: { value: true }, params: {} })
                this.act('reset::codeBlockSegmentsBuffer', { event: {}, params: {} })

                // this.transition(STATES.routing)
                this.transitionBlockElementState(BLOCK_ELEMENT_STATES.routing)
                return
            }

            // Finally exit the code block processing when encountered a non-codeBlock segment after a codeBlock segment
            if (
                this.evaluate('is::codeBlockEndMarker', { event: { segment: prevSegment }, params: {} }) &&
                !this.evaluate('is::codeBlockEndMarker', { event: { segment: currentSegment }, params: {} })
            ) {
                this.act('reset::blockContentBuffer', { event: {}, params: {} })
                this.act('set::isProcessingNewLine', {
                    event: { value: true },
                    params: {}
                })
                this.act('reset::codeBlockSegmentsBuffer', { event: {}, params: {} })

                // this.transition(STATES.routing)
                this.transitionBlockElementState(BLOCK_ELEMENT_STATES.routing)

                this.parseSegment(currentSegment) // Forward the current segment to the routing state for re-evaluation
                return
            }
        }
    }

    processParagraph(segment: string) {
        this.act('buffer::blockContent', { event: { segment }, params: {} })
        this.act('emit::parsedSegment', {
            event: { segment },
            params: {
                emitter: this.notifyParsedSegment,
                isTruncateTrailingNewLine: true,
                origin: BLOCK_ELEMENT_STATES.processingParagraph,
                isDebug: IS_DEBUG
            }
        })

        if (
            this.evaluate('ends::newLine', { event: { segment }, params: {} })
        ) {
            this.act('reset::blockContentBuffer', { event: {}, params: {} })
            this.act('set::isProcessingNewLine', { event: { value: true }, params: {} })

            // When new line symbol is met, reset the current block context and states
            this.resetParser()
            this.transitionBlockElementState(BLOCK_ELEMENT_STATES.routing)
            this.transitionInlineElementState(INLINE_ELEMENT_STATES.routing)
        }

        // Always transition back to routing state so that each new segment is evaluated independently
        this.transitionBlockElementState(BLOCK_ELEMENT_STATES.routing)
    }

    // Parses the stream of text: feeds characters into state machine and records transitions.
    parseSegment(segment: string) {
        IS_DEBUG && console.log('------------------------------------------------------------------------------------------------------------------------STATE:', {
            'this.blockElementState': this.blockElementState,
            'this.inlineElementState': this.inlineElementState
        })

        // Evaluate for top level blocks first
        if(
            this.blockElementState === BLOCK_ELEMENT_STATES.routing
            && this.inlineElementState === INLINE_ELEMENT_STATES.routing    // If we're in a processing inline element style state, then there's no point to evaluate for higher order block patterns, we should finish parsing the inline element style first.
        ) {
            if (
                this.evaluate('is::processingNewLine', { event: {}, params: {} }) &&
                this.evaluate('is::headerMarker', { event: { segment }, params: {} })
            ) {
                this.act('set::header', { event: { segment }, params: {} })
                this.act('set::isProcessingNewLine', { event: {value: false}, params: {} })
                this.act('set::isProcessingStylingMarkerSegment', { event: {value: true}, params: {} })
                this.transitionBlockElementState(BLOCK_ELEMENT_STATES.processingHeader)
            }

            // Detected codeBlock, routing to the processingCodeBlock state
            if (this.evaluate('is::codeBlockStartMarker', { event: { segment }, params: {} })) {
                this.act('set::codeBlock', {
                    event: { segment },
                    params: {}
                })
                this.act('set::isProcessingStylingMarkerSegment', {
                    event: { value: true },
                    params: {}
                })
                this.act('reset::blockContentBuffer', { event: {}, params: {} })
                this.transitionBlockElementState(BLOCK_ELEMENT_STATES.processingCodeBlock)
            }

            // If no markdown routing path is detected, then default to regular paragraph
            if (
                this.blockElementState === BLOCK_ELEMENT_STATES.routing ||
                !this.evaluate('is::blockTypeSet', { event: {}, params: {} })
            ) {
                this.act('set::paragraph', { event: {}, params: {} })
            }

            if (this.blockElementState === BLOCK_ELEMENT_STATES.routing) {
                this.transitionBlockElementState(BLOCK_ELEMENT_STATES.processingParagraph)
            }
        }

        // And the only after top level block type is detected we can proceed with inline styles evaluations. Because inline style elements can't be on their own, they're only allowed as a child nodes of higher order type element.s
        if(
            this.inlineElementState === INLINE_ELEMENT_STATES.routing
            && this.blockElementState !== BLOCK_ELEMENT_STATES.processingCodeBlock    // We shouldn't even care to evaluate for inline styles when processing code blocks. Code blocks can't have any formatting (obviously...) and also skipping this evaluation makes things a lot more stable
        ) {
            // Detected inline styles (italic), routing to the processingItalicText state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', { event: { segment }, params: {styleGroup: INLINE_STYLE_GROUPS.italic!.name } })) {
                this.transitionInlineElementState(INLINE_ELEMENT_STATES.processingItalicText)
            }

            // Detected inline styles (bold), routing to the processingBoldText state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', { event: { segment }, params: {styleGroup: INLINE_STYLE_GROUPS.bold!.name } })) {
                this.transitionInlineElementState(INLINE_ELEMENT_STATES.processingBoldText)
            }

            // Detected inline styles (boldItalic), routing to the processingBoldItalicText state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', { event: { segment }, params: {styleGroup: INLINE_STYLE_GROUPS.boldItalic!.name } })) {
                this.transitionInlineElementState(INLINE_ELEMENT_STATES.processingBoldItalicText)
            }

            // Detected inline styles (strikethrough), routing to the processingStrikethroughText state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', { event: { segment }, params: {styleGroup: INLINE_STYLE_GROUPS.strikethrough!.name } })) {
                this.transitionInlineElementState(INLINE_ELEMENT_STATES.processingStrikethroughText)
            }

            // Detected inline styles (inlineCode), routing to the processingInlineCode state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', { event: { segment }, params: {styleGroup: INLINE_STYLE_GROUPS.inlineCode!.name } })) {
                this.transitionInlineElementState(INLINE_ELEMENT_STATES.processingInlineCode)
            }
        }

        // Once the state is transitioned, proceed with the processing in the same pass. This is a deviation from classical FSM, but doing it this way allows for denser code and more flexibility
        if(
            this.blockElementState !== BLOCK_ELEMENT_STATES.routing
            && this.inlineElementState === INLINE_ELEMENT_STATES.routing    // Prevent from processing element twice if a substate is active
        ) {
            switch(this.blockElementState) {
                case BLOCK_ELEMENT_STATES.processingHeader:
                    this.processHeader(segment)
                    break

                case BLOCK_ELEMENT_STATES.processingCodeBlock:
                    this.processCodeBlock(segment)
                    break

                case BLOCK_ELEMENT_STATES.processingParagraph:
                    this.processParagraph(segment)
                    break

                default:
                    console.error('Unknown blockElementState state')
            }
        }

        if(this.inlineElementState !== INLINE_ELEMENT_STATES.routing) {
            switch(this.inlineElementState) {
                case INLINE_ELEMENT_STATES.processingItalicText:
                    // this.act('debug::parsedSegment', { event: { segment }, params: {origin: STATES.processingItalicText } })
                    this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.italic!.name)
                    break

                case INLINE_ELEMENT_STATES.processingBoldText:
                    this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.bold!.name)
                    break

                case INLINE_ELEMENT_STATES.processingBoldItalicText:
                    this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.boldItalic!.name)
                    break

                case INLINE_ELEMENT_STATES.processingStrikethroughText:
                    this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.strikethrough!.name)
                    break

                case INLINE_ELEMENT_STATES.processingInlineCode:
                    this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.inlineCode!.name)
                    break

                default:
                    console.error('Unknown inlineElementState state')
            }
        }

    }
}

// Usage
// const machine = new TextStreamStateMachine()
// console.log(machine.parse('Word, sentence! Next line\nAnother line'))
