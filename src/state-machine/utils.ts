'use strict'

export const truncateTrailingNewLine = (input: string): string => input.replace(/(\\n|\n)+$/, '')
