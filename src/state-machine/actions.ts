'use strict';

import { BLOCK_TYPES, REGEX, INLINE_STYLE_GROUPS } from './constants.ts';
import { truncateTrailingNewLine } from './utils.ts';

const setIsProcessingNewLine = (context, event, params) => ({
    isProcessingNewLine: event.value
})

const setIsProcessingStylingMarkerSegment = (context, event, params) => ({
    isProcessingStylingMarkerSegment: event.value
})

const setHeader = (context, event, params) => {
    const match = event.segment.match(REGEX.headerMarker);
    if (match) {
        const hashes = match[1]
        const headerFirstSegment = match[2] // The first segment of the header

        return {
            blockType: BLOCK_TYPES.header,
            headerLevel: hashes.length -1,
            isBlockDefining: true, // Mark as blockDefining when transitioning to a new block type
        }
    }
}

const applyInlineTextStyle = (context, event, params) => {
    const { styleGroup, match } = params;
    let matchObject = {};

    switch (match) {
        case 'full':
            matchObject = (([
                fullMatch,
                prefixedContent,
                openingStyleMarker,
                content,
                closingStyleMarker,
                postfixedContent
            ]) => ({
                fullMatch: fullMatch || '',
                prefixedContent: prefixedContent || '',
                openingStyleMarker: openingStyleMarker || '',
                content: content || '',
                closingStyleMarker: closingStyleMarker || '',
                postfixedContent: postfixedContent || ''
            }))(event.segment.match(INLINE_STYLE_GROUPS[styleGroup].regex.full) || []);
            break;
        case 'partial::start':
            matchObject = (([
                fullMatch,
                prefixedContent,
                openingStyleMarker,
                content,
            ]) => ({
                fullMatch: fullMatch || '',
                prefixedContent: prefixedContent || '',
                openingStyleMarker: openingStyleMarker || '',
                content: content || '',
            }))(event.segment.match(INLINE_STYLE_GROUPS[styleGroup].regex.partialStart) || []);
            break;
        case 'partial::end':
            matchObject = (([
                fullMatch,
                content,
                closingStyleMarker,
                postfixedContent
            ]) => ({
                fullMatch: fullMatch || '',
                content: content || '',
                closingStyleMarker: closingStyleMarker || '',
                postfixedContent: postfixedContent || ''
            }))(event.segment.match(INLINE_STYLE_GROUPS[styleGroup].regex.partialEnd) || []);
            break;
    }

    let parsedSegment = matchObject.content;

    if(!matchObject.postfixedContent) {     // If there's no postfixed content, add a space to the parsed segment
        parsedSegment = `${parsedSegment} `;
    }

    return {
        prefixedContent: matchObject.prefixedContent,
        postfixedContent: matchObject.postfixedContent,
        parsedSegment,
        styles: INLINE_STYLE_GROUPS[styleGroup].styles,
    }
}

const setParagraph = (context, event, params) => ({
    blockType: BLOCK_TYPES.paragraph,
    isBlockDefining: ((context.blockType !== BLOCK_TYPES.paragraph) || context.isProcessingNewLine) ? true : false, // Mark as blockDefining when transitioning to a new block type
})

const setCodeBlock = (context, event, params) => {
    const matchObject = (([
        fullMatch,
        backticks,
        codeLanguage,
        postfixedContent
    ]) => ({
        fullMatch: fullMatch || '',
        backticks: backticks || '',
        codeLanguage: codeLanguage || '',
        postfixedContent: postfixedContent || '',
    }))(event.segment.match(REGEX.codeBlockStartMarker) || []);

    return {
        blockType: BLOCK_TYPES.codeBlock,
        codeBlockLanguage: matchObject.codeLanguage,
        isBlockDefining: true, // Mark as blockDefining when transitioning to a new block type
    }
}

const debugParsedSegment = (context, event, params) => {
    console.log({origin: params.origin, parsedSegment: context})
}

const bufferBlockContent = (context, event, params) => ({
    blockContentBuffer: context.blockContentBuffer + event.segment
})

const bufferCodeBlockSegments = (context, event, params) => ({
    codeBlockSegmentsBuffer: [...context.codeBlockSegmentsBuffer, event.segment]
})

const resetBlockContentBuffer = (context, event, params) => ({
    blockContentBuffer: ''
})

const resetCodeBlockSegmentsBuffer = (context, event, params) => ({
    codeBlockSegmentsBuffer: []
})

const resetInlineTextStyle = (context, event, params) => ({
    styles: []
})

const resetPrefixedContent = (context, event, params) => ({
    parsedSegmentPrefixedContent: ''
})

const resetPostfixedContent = (context, event, params) => ({
    parsedSegmentPostfixedContent: ''
})

const emitParsedSegment = (context, event, params) => {
    const {
        emitter = (blockContent) => console.error('emitParsedSegment emitter function is not set, using default value:', blockContent),
        isTruncateTrailingNewLine = false,
        skipStyles = false,
        isDebug = false
    } = params;
    const segment = isTruncateTrailingNewLine ? truncateTrailingNewLine(event.segment) : event.segment;
    const styles = skipStyles ? [] : context.styles;

    const blockContent = {
        ...(context.blockType === BLOCK_TYPES.codeBlock && { language: context.codeBlockLanguage }),
        ...(context.blockType === BLOCK_TYPES.header && { level: context.headerLevel }),
        segment,
        styles,
        type: context.blockType,
        isBlockDefining: context.isBlockDefining,
        isProcessingNewLine: context.isProcessingNewLine,
        ...(isDebug && {content: context.blockContentBuffer}),
        ...(isDebug && {origin: `${params.origin || null}`}),
    }

    emitter(blockContent)     // Emit the parsed segment

    // And mutate the context after
    return {
        isBlockDefining: false,
        isProcessingNewLine: false,
    }
}

const ACTIONS = {
    'set::header': setHeader,
    'set::isProcessingNewLine': setIsProcessingNewLine,
    'set::isProcessingStylingMarkerSegment': setIsProcessingStylingMarkerSegment,
    'set::codeBlock': setCodeBlock,
    'set::paragraph': setParagraph,

    'apply::inlineTextStyle': applyInlineTextStyle,

    'reset::blockContentBuffer': resetBlockContentBuffer,
    'reset::codeBlockSegmentsBuffer': resetCodeBlockSegmentsBuffer,
    'reset::inlineTextStyle': resetInlineTextStyle,
    'reset::prefixedContent': resetPrefixedContent,
    'reset::postfixedContent': resetPostfixedContent,

    'buffer::blockContent': bufferBlockContent,
    'buffer::codeBlockSegments': bufferCodeBlockSegments,

    'emit::parsedSegment': emitParsedSegment,

    'debug::parsedSegment': debugParsedSegment,
}

export const actionRunner = (actionName, context, event, params) => {
    if (ACTIONS.hasOwnProperty(actionName) === false) {
        throw new Error(`No action found for: ${actionName}`);
    }

    return ACTIONS[actionName](context, event, params);
}
