'use strict';

// Notes
// this.act('debug::parsedSegment', {event: {segment}, params: {origin: STATES.processingParagraph}})

import { INLINE_STYLE_GROUPS } from './constants.ts';    // Constants for different types of markdown styling
import { evaluationRunner } from './evaluations.ts';    // Evaluator methods for different types of markdown styling
import { actionRunner } from './actions.ts';    // Action methods for different types of markdown styling

const IS_DEBUG = false;

type InitialContext = {
    isProcessingNewLine: boolean;
    isProcessingStylingMarkerSegment: boolean;

    blockContentBuffer: string;

    blockType: string;
    parsedSegment: string;
    styles: any[];

    isBlockDefining: boolean;

    headerLevel: number;

    codeBlockLanguage: string;
    codeBlockSegmentsBuffer: string[];
    encounteredCodeBlockExitMarkerCandidate: boolean;
};

const initialContext = (): InitialContext => ({
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
});

const STATES: Record<string, string> = {
    routing: 'routing',
    processingHeader: 'processingHeader',
    processingParagraph: 'processingParagraph',
    processingItalicText: 'processingItalicText',
    processingBoldText: 'processingBoldText',
    processingBoldItalicText: 'processingBoldItalicText',
    processingStrikethroughText: 'processingStrikethroughText',
    processingInlineCode: 'processingInlineCode',
    processingCodeBlock: 'processingCodeBlock',
};

export default class TextStreamStateMachine {
    context: InitialContext;

    constructor() {
        this.context = initialContext();
        this.currentState = STATES.routing;
        this.parsedSegmentListeners = [];    // Store subscriber functions
        this.notifyParsedSegment = this.notifyParsedSegment.bind(this);    // Bind the notifyParsedSegment method to the instance
    }

    // Allow components to subscribe to parsed segment completion
    subscribeToParsedSegment(listener) {
        this.parsedSegmentListeners.push(listener);
        return () => this.unsubscribeFromParsedSegment(listener);
    }

    // Allow components to unsubscribe from parsed segment completion
    unsubscribeFromParsedSegment(listener) {
        this.parsedSegmentListeners = this.parsedSegmentListeners.filter(l => l !== listener);
    }

    // Internal method to notify all parsed segment complete listeners
    notifyParsedSegment(segment) {
        this.parsedSegmentListeners.forEach(listener => listener(segment));
    }

    // Evaluates the current state based on the event and parameters.
    evaluate(evaluationName, {event, params}) {
        return evaluationRunner(evaluationName, this.context, event, params);
    }

    // Actions to be performed on state transitions. Mutates the context !!!
    act(actionName, {event, params}) {
        // Merging context with the result of the action
        this.context = {
            ...this.context,
            ...actionRunner(actionName, this.context, event, params)
        }
    }

    // Transition to a new state
    transition(state) {
        this.currentState = state;
    }

    resetParser() {
        this.context = initialContext();
        this.currentState = STATES.routing;
    }

    checkForNewLine(segment, {resetParser = false, transitionTo = STATES.routing}) {
        if (
            this.evaluate('ends::newLine', {event: {segment}, params: {}})
        ) {
            this.act('reset::blockContentBuffer', {event: {}, params: {}});
            this.act('set::isProcessingNewLine', {event: {value: true}, params: {}});
            resetParser && this.resetParser();
            transitionTo && this.transition(transitionTo);
        }
    }

    processHeader(segment) {
        this.act('buffer::blockContent', {event: {segment}, params: {}});

        // Skip the first emit if the styling marker segment is being processed
        if(this.evaluate('is::processingStylingMarkerSegment', {event: {}, params: {}})) {
            this.act('set::isProcessingStylingMarkerSegment', {event: {value: false}, params: {}});    // Reset the styling marker segment flag after the first emit
            return;
        }

        this.act('emit::parsedSegment', {
            event: {segment},
            params: {
                emitter: this.notifyParsedSegment,
                isTruncateTrailingNewLine: true,
                origin: STATES.processingHeader,
                isDebug: IS_DEBUG
            }
        });

        this.checkForNewLine(segment, {resetParser: true, transitionTo: STATES.routing})
    }

    processInlineStylesGroup(segment, styleGroup) {
        if (this.evaluate('is::inlineStyleMarkerFull', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}})) {
            this.act('apply::inlineTextStyle', {event: {segment}, params: {match: 'full', styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}});

            // If there's any content before the styling marker, emit it
            if(this.evaluate('has::prefixedContent', {event: {}, params: {}})) {
                this.act('buffer::blockContent', {event: {segment: this.context.prefixedContent}, params: {}});
                this.act('emit::parsedSegment', {
                    event: {segment: this.context.prefixedContent},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: false,
                        skipStyles: true,
                        origin: `processing::${INLINE_STYLE_GROUPS[styleGroup].name}::FULL::prefixedContent`,
                        isDebug: IS_DEBUG
                    }
                });
                this.act('reset::prefixedContent', {event: {}, params: {}});
            }

            this.act('buffer::blockContent', {event: {segment: this.context.parsedSegment}, params: {}});
            this.act('emit::parsedSegment', {
                event: {segment: this.context.parsedSegment},
                params: {
                    emitter: this.notifyParsedSegment,
                    isTruncateTrailingNewLine: true,
                    origin: `processing::${INLINE_STYLE_GROUPS[styleGroup].name}::FULL`,
                    isDebug: IS_DEBUG
                }
            });

            // If there's any content after the styling marker, emit it
            if(this.evaluate('has::postfixedContent', {event: {}, params: {}})) {
                this.act('buffer::blockContent', {event: {segment: this.context.postfixedContent}, params: {}});
                this.act('emit::parsedSegment', {
                    event: {segment: this.context.postfixedContent},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: true,
                        skipStyles: true,
                        origin: `processing::${INLINE_STYLE_GROUPS[styleGroup].name}::FULL::postfixedContent`,
                        isDebug: IS_DEBUG
                    }
                });
                this.act('reset::postfixedContent', {event: {}, params: {}});
            }

            this.act('reset::inlineTextStyle', {event: {}, params: {}});
            this.checkForNewLine(segment, {resetParser: false, transitionTo: STATES.routing})
            this.transition(STATES.routing);
            return;
        }

        if (
            this.evaluate('is::inlineStyleMarkerPartialStart', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}}) &&
            !this.evaluate('is::inlineStyleMarkerFull', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}})
        ) {
            this.act('apply::inlineTextStyle', {event: {segment}, params: {match: 'partial::start', styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}});

            // If there's any content before the styling marker, emit it
            if(this.evaluate('has::prefixedContent', {event: {}, params: {}})) {
                this.act('buffer::blockContent', {event: {segment: this.context.prefixedContent}, params: {}});
                this.act('emit::parsedSegment', {
                    event: {segment: this.context.prefixedContent},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: false,
                        skipStyles: true,
                        origin: `processing::${INLINE_STYLE_GROUPS[styleGroup].name}::partialSTART::prefixedContent`,
                        isDebug: IS_DEBUG
                    }
                });
                this.act('reset::prefixedContent', {event: {}, params: {}});
            }

            this.act('buffer::blockContent', {event: {segment: this.context.parsedSegment}, params: {}});
            this.act('emit::parsedSegment', {
                event: {segment: this.context.parsedSegment},
                params: {
                    emitter: this.notifyParsedSegment,
                    isTruncateTrailingNewLine: true,
                    origin: `processing::${INLINE_STYLE_GROUPS[styleGroup].name}::partialSTART`,
                    isDebug: IS_DEBUG
                }
            });
            return;
        }

        if (
            this.evaluate('is::inlineStyleMarkerPartialEnd', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}}) &&
            !this.evaluate('is::inlineStyleMarkerFull', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}})
        ) {
            this.act('apply::inlineTextStyle', {event: {segment}, params: {match: 'partial::end', styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}});
            this.act('buffer::blockContent', {event: {segment: this.context.parsedSegment}, params: {}});
            this.act('emit::parsedSegment', {
                event: {segment: this.context.parsedSegment},
                params: {
                    emitter: this.notifyParsedSegment,
                    isTruncateTrailingNewLine: true,
                    origin: `processing::${INLINE_STYLE_GROUPS[styleGroup].name}::partialEND`,
                    isDebug: IS_DEBUG
                }
            });

            // If there's any content after the styling marker, emit it
            if(this.evaluate('has::postfixedContent', {event: {}, params: {}})) {
                this.act('buffer::blockContent', {event: {segment: this.context.postfixedContent}, params: {}});
                this.act('emit::parsedSegment', {
                    event: {segment: this.context.postfixedContent},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: true,
                        skipStyles: true,
                        origin: `processing::${INLINE_STYLE_GROUPS[styleGroup].name}::partialEND::postfixedContent`,
                        isDebug: IS_DEBUG
                    }
                });
                this.act('reset::postfixedContent', {event: {}, params: {}});
            }

            this.act('reset::inlineTextStyle', {event: {}, params: {}});
            this.transition(STATES.routing);
        }

        if (
            !this.evaluate('is::inlineStyleMarkerPartialStart', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}}) &&
            !this.evaluate('is::inlineStyleMarkerPartialEnd', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS[styleGroup].name}})
        ) {
            this.act('buffer::blockContent', {event: {segment}, params: {}});
            this.act('emit::parsedSegment', {
                event: {segment},
                params: {
                    emitter: this.notifyParsedSegment,
                    isTruncateTrailingNewLine: true,
                    origin: `processing::${INLINE_STYLE_GROUPS[styleGroup].name}::MIDDLE`,
                    isDebug: IS_DEBUG
                }
            });
        }

        this.checkForNewLine(segment, {resetParser: false, transitionTo: STATES.routing})
    }

    processCodeBlock(segment) {
        // Skip the first emit if the styling marker segment is being processed
        if(this.evaluate('is::processingStylingMarkerSegment', {event: {}, params: {}})) {
            this.act('set::isProcessingStylingMarkerSegment', {event: {value: false}, params: {}});    // Reset the styling marker segment flag after the first emit
            return;
        }

        // Buffer the code block segments
        this.act('buffer::codeBlockSegments', {event: {segment}, params: {}});

        if (this.context.codeBlockSegmentsBuffer.length > 1) {
            const prevSegment = this.context.codeBlockSegmentsBuffer.shift(); // .shift() removes the first element and returns it
            const currentSegment = this.context.codeBlockSegmentsBuffer[0]; // Therefore the [0] element is now the current segment

            // Regular code block segment
            if (
                !this.evaluate('is::codeBlockEndMarker', {event: {segment: prevSegment}, params: {}}) &&
                !this.evaluate('is::codeBlockEndMarker', {event: {segment: currentSegment}, params: {}})
            ) {
                // Print the previous segment WITH new lines
                this.act('buffer::blockContent', {event: {segment: prevSegment}, params: {}});
                this.act('emit::parsedSegment', {
                    event: {segment: prevSegment},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: false,
                        origin: STATES.processingCodeBlock + '::// Regular code block segment',
                        isDebug: IS_DEBUG
                    }
                });
            }

            // Potential single code block end
            if (
                !this.evaluate('is::codeBlockEndMarker', {event: {segment: prevSegment}, params: {}}) &&
                this.evaluate('is::codeBlockEndMarker', {event: {segment: currentSegment}, params: {}})
            ) {
                // Print the previous segment WITHOUT new lines
                this.act('buffer::blockContent', {event: {segment: prevSegment}, params: {}});
                this.act('emit::parsedSegment', {
                    event: {segment: prevSegment},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: true,
                        origin: STATES.processingCodeBlock + '::// Potential single code block end',
                        isDebug: IS_DEBUG
                    }
                });
            }
            // console.log({prevSegment, currentSegment})
            // Eventually it turned into a Double code block in some cases
            if (
                this.evaluate('is::codeBlockEndMarker', {event: {segment: prevSegment}, params: {}}) &&
                this.evaluate('is::codeBlockEndMarker', {event: {segment: currentSegment}, params: {}})
            ) {
                // Print the previous segment WITHOUT new lines
                this.act('buffer::blockContent', {event: {segment: prevSegment}, params: {}});
                this.act('emit::parsedSegment', {
                    event: {segment: `\n${prevSegment}`},
                    params: {
                        emitter: this.notifyParsedSegment,
                        isTruncateTrailingNewLine: true,
                        origin: STATES.processingCodeBlock + '::// Eventually it turned into a Double code block in some cases',
                        isDebug: IS_DEBUG
                    }
                });

                this.act('reset::blockContentBuffer', {event: {}, params: {}});
                this.act('set::isProcessingNewLine', {event: {value: true}, params: {}});
                this.act('reset::codeBlockSegmentsBuffer', {event: {}, params: {}});
                this.transition(STATES.routing);
                return;
            }

            // Finally exit the code block processing when encountered a non-codeBlock segment after a codeBlock segment
            if (
                this.evaluate('is::codeBlockEndMarker', {event: {segment: prevSegment}, params: {}}) &&
                !this.evaluate('is::codeBlockEndMarker', {event: {segment: currentSegment}, params: {}})
            ) {
                this.act('reset::blockContentBuffer', {event: {}, params: {}});
                this.act('set::isProcessingNewLine', {event: {value: true}, params: {}});
                this.act('reset::codeBlockSegmentsBuffer', {event: {}, params: {}});
                this.transition(STATES.routing);
                this.parseSegment(currentSegment); // Forward the current segment to the routing state for re-evaluation
                return;
            }
        }
    }

    processParagraph(segment) {
        this.act('buffer::blockContent', {event: {segment}, params: {}});
        this.act('emit::parsedSegment', {
            event: {segment},
            params: {
                emitter: this.notifyParsedSegment,
                isTruncateTrailingNewLine: true,
                origin: STATES.processingParagraph,
                isDebug: IS_DEBUG
            }
        });

        this.checkForNewLine(segment, {resetParser: false, transitionTo: STATES.routing})

        // Always transition back to routing state so that each new segment is evaluated independently
        this.transition(STATES.routing);
    }

    // Parses the stream of text: feeds characters into state machine and records transitions.
    parseSegment(segment) {
        IS_DEBUG && console.log('------------------------------------------------------------------------------------------------------------------------STATE:', this.currentState);
        if(this.currentState === STATES.routing) {
            if (
                this.evaluate('is::processingNewLine', {event: {}, params: {}}) &&
                this.evaluate('is::headerMarker', {event: {segment}, params: {}})
            ) {
                this.act('set::header', {event: {segment}, params: {}});
                this.act('set::isProcessingNewLine', {event: {value: false}, params: {}});
                this.act('set::isProcessingStylingMarkerSegment', {event: {value: true}, params: {}});
                this.transition(STATES.processingHeader);
            }

            // Detected inline styles (italic), routing to the processingItalicText state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS.italic.name}})) {
                // console.log('italicitalicitalicitalicitalicitalicitalicitalicitalicitalicitalicitalicitalic', {segment, context: this.context})
                this.transition(STATES.processingItalicText);
            }

            // Detected inline styles (bold), routing to the processingBoldText state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS.bold.name}})) {
                this.transition(STATES.processingBoldText);
            }

            // Detected inline styles (boldItalic), routing to the processingBoldItalicText state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS.boldItalic.name}})) {
                this.transition(STATES.processingBoldItalicText);
            }

            // Detected inline styles (strikethrough), routing to the processingStrikethroughText state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS.strikethrough.name}})) {
                this.transition(STATES.processingStrikethroughText);
            }

            // Detected inline styles (inlineCode), routing to the processingInlineCode state
            if (this.evaluate('is::inlineStyleMarkerPartialOrFull', {event: {segment}, params: {styleGroup: INLINE_STYLE_GROUPS.inlineCode.name}})) {
                this.transition(STATES.processingInlineCode);
            }

            // Detected codeBlock, routing to the processingCodeBlock state
            if (this.evaluate('is::codeBlockStartMarker', {event: {segment}, params: {}})) {
                this.act('set::codeBlock', {event: {segment}, params: {}});
                this.act('set::isProcessingStylingMarkerSegment', {event: {value: true}, params: {}});
                this.act('reset::blockContentBuffer', {event: {}, params: {}});
                this.transition(STATES.processingCodeBlock);
            }

            // If no markdown routing path is detected, then default to regular paragraph
            if (
                this.currentState === STATES.routing ||
                !this.evaluate('is::blockTypeSet', {event: {}, params: {}})
            ) {
                this.act('set::paragraph', {event: {}, params: {}});
            }

            if (this.currentState === STATES.routing) {
                this.transition(STATES.processingParagraph);
            }
        }

        // Process the segment based on the current state
        switch(this.currentState) {
            case STATES.processingHeader:
                this.processHeader(segment);
                break;

            case STATES.processingItalicText:
                // this.act('debug::parsedSegment', {event: {segment}, params: {origin: STATES.processingItalicText}});
                this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.italic.name);
                break;

            case STATES.processingBoldText:
                this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.bold.name);
                break;

            case STATES.processingBoldItalicText:
                this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.boldItalic.name);
                break;

            case STATES.processingStrikethroughText:
                this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.strikethrough.name);
                break;

            case STATES.processingInlineCode:
                this.processInlineStylesGroup(segment, INLINE_STYLE_GROUPS.inlineCode.name);
                break;

            case STATES.processingCodeBlock:
                this.processCodeBlock(segment);
                break;

            case STATES.processingParagraph:
                this.processParagraph(segment);
                break;

            default:
                console.error('Unknown state');
        }
    }

}

// Usage
// const machine = new TextStreamStateMachine();
// console.log(machine.parse('Word, sentence! Next line\nAnother line'));
