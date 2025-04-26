
import fs from 'fs'

import { log, info, infoStr, warn, err } from './debug-tools.ts'

import MarkdownStreamParser from '../src/markdown-stream-parser.ts'

const DELAY = 0;

const fileName = '2025-04-09T23:05:36.718Z'
const sourceFile = `/usr/src/service/debug-scripts/llm-streams-examples/${fileName}.json`;

const markdownStreamParser = MarkdownStreamParser.getInstance(fileName)

async function* streamJSONinChunks(jsonArray) {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Iterate over each object in the json array
    for (const item of jsonArray) {
        if (item !== '') {
            yield item;
            await delay(DELAY);
        }
    }
  }


;(async () => {
    console.log('\n')

    const jsonContent = fs.readFileSync(sourceFile, { encoding: 'utf-8' });

    const jsonData = JSON.parse(jsonContent);

    const textStream = streamJSONinChunks(jsonData);


    // Parser has to be started before the stream is created
    markdownStreamParser.startParsing();

    // for await (const chunk of textStream) {
    //     // console.log('chunk', JSON.stringify(chunk))
    //     markdownStreamParser.parseToken(chunk);
    // }

    for await (const chunk of ["Hello", " ~~world~~", "!", "  \n"]) {
        markdownStreamParser.parseToken(chunk);
    }

    // At the end of the stream, it flushes any remaining content
    markdownStreamParser.stopParsing();

})()






markdownStreamParser.subscribeToTokenParse((parsedSegment, unsubscribe) => {
    //INFO: Parsed segment is available here
    console.log('parsedSegment', parsedSegment)

    // At the end of the stream, unsubscribe from the parser service
    if (parsedSegment.status === 'END_STREAM') {
        unsubscribe()
        MarkdownStreamParser.removeInstance(fileName)
    }
})



// // Subscribe to the parser service
// const markdownStreamParserUnsubscribe = markdownStreamParser.subscribeToTokenParse(parsedSegment => {
//     //INFO: Parsed segment is available here
//     console.log(parsedSegment)
// })


// if(!markdownStreamParser.parsing) {
//     markdownStreamParserUnsubscribe()    // Unsubscribe from the parser service
//     MarkdownStreamParser.removeInstance(fileName)    // Dispose of the parser instance
// }



