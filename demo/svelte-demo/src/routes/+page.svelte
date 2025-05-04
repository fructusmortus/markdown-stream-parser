<script lang="ts">
import { onMount } from 'svelte';
import { MarkdownStreamParser } from '@lixpi/markdown-stream-parser';

type ExampleFile = { base: string; json: string; txt: string };

let examples: ExampleFile[] = [];
let selectedExample: ExampleFile | null = null;
let delay = 80;
let streaming = false;
let tokens: string[] = [];
let txtContent = '';
let jsonContent = '';
let parsedSegments: any[] = [];
let parsedBlocks: any[][] = [];
let currentToken = '';
let currentParsedChunk: any = null;
let error = '';
let jsonItems: string[] = []; // Add state for parsed JSON items
let currentTokenIndex: number | null = null; // Track the index of the current token

async function loadExamples() {
  try {
    const res = await fetch('/llm-examples-manifest.json');
    examples = await res.json();
    selectedExample = examples[0] ?? null;
  } catch (e) {
    error = 'Failed to load examples manifest.';
  }
}

async function loadSelectedFiles() {
  if (!selectedExample) return;
  try {
    const [jsonRes, txtRes] = await Promise.all([
      fetch(selectedExample.json),
      fetch(selectedExample.txt),
    ]);
    tokens = await jsonRes.json();
    txtContent = await txtRes.text();
    // Fetch raw JSON as text for display
    const rawJsonRes = await fetch(selectedExample.json);
    jsonContent = await rawJsonRes.text();
  } catch (e) {
    error = 'Failed to load example files.';
  }
}

function handleExampleChange() {
  parsedSegments = [];
  currentToken = '';
  currentParsedChunk = null;
  currentTokenIndex = null; // Reset index on example change
}

async function simulateStream() {
  if (!selectedExample) return;
  streaming = true;
  parsedSegments = [];
  currentToken = '';
  currentParsedChunk = null;
  currentTokenIndex = null; // Reset index before starting
  error = '';

  const parserId = 'demo-' + Date.now();
  const parser = MarkdownStreamParser.getInstance(parserId);
  parser.startParsing();

  // Add explicit types for parsed and unsubscribe
  let unsub = parser.subscribeToTokenParse((parsed: any, unsubscribe: () => void) => {
    if (parsed.status === 'END_STREAM') {
      currentParsedChunk = parsed; // Update currentParsedChunk with END_STREAM status
      parsedSegments = [...parsedSegments, parsed]; // Also add it to parsedSegments
      unsubscribe();
      MarkdownStreamParser.removeInstance(parserId);
      streaming = false;
      currentTokenIndex = null; // Remove highlight when stream ends
      currentToken = ''; // Clear current token display
    } else {
      parsedSegments = [...parsedSegments, parsed];
      currentParsedChunk = parsed;
    }
  });

  for (let i = 0; i < tokens.length; i++) {
    if (!streaming) {
      currentTokenIndex = null; // Remove highlight if stopped early
      currentToken = ''; // Clear current token if stopped early
      break;
    }
    currentTokenIndex = i; // Highlight the current token index
    currentToken = tokens[i];
    parser.parseToken(tokens[i]);
    await new Promise((r) => setTimeout(r, delay));
  }
  parser.stopParsing();
  streaming = false;
  if (currentTokenIndex !== null) { // Ensure highlight is removed if loop finishes naturally
      currentTokenIndex = null;
      currentToken = ''; // Clear current token if loop finishes naturally
  }
}

$: parsedBlocks = (() => {
  const blocks = [];
  let currentBlock = [];
  for (const seg of parsedSegments) {
    if (seg.segment?.isBlockDefining && currentBlock.length) {
      blocks.push(currentBlock);
      currentBlock = [];
    }
    currentBlock.push(seg);
  }
  if (currentBlock.length) blocks.push(currentBlock);
  return blocks;
})();

onMount(async () => {
  await loadExamples();
  await loadSelectedFiles();
});

$: if (selectedExample) {
  loadSelectedFiles();
}

$: { // Reactive block to parse jsonContent when it changes
  if (jsonContent) {
    try {
      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed)) {
        jsonItems = parsed;
      } else {
        console.error("Parsed jsonContent is not an array:", parsed);
        jsonItems = []; // Reset or handle as appropriate
      }
    } catch (e) {
      console.error("Failed to parse jsonContent:", e);
      jsonItems = []; // Reset on error
    }
  } else {
    jsonItems = [];
  }
}
</script>

<div class="p-6 min-h-screen bg-gray-50">
    <div class="mb-5">
        <h1 class="text-2xl font-bold mb-4">@lixpi/markdown-stream-parser <span class="text-gray-500"><i>demo</i></span></h1>
        <h2 class="mb-5">This is just a <b>quick and dirty showcase</b> of the <i>@lixpi/markdown-stream-parser</i>, the <b class="text-red-600">parser itself has nothing to do with rendering</b> !!! Please keep that in mind...</h2>
        <h3 class="mb-5">This <b>demo is entirely `vibe-coded`</b>, while <b>the parser is painstakingly created by a human being 👩‍💻 :)</b></h3>
    </div>
  <label class="block text-sm font-medium mb-1">Select LLM Example</label>
  <div class="mb-6 flex flex-col md:flex-row md:items-center gap-4">
    <select
      class="appearance-none rounded border bg-white px-3 py-1 pr-8 shadow leading-tight focus:outline-none focus:shadow-outline bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-right-1.5"
      bind:value={selectedExample}
      on:change={handleExampleChange}
    >
      {#each examples as ex}
        <option value={ex}>{ex.base}</option>
      {/each}
    </select>
    <div class="flex items-center gap-2">
      <label class="text-sm">Delay: {delay}ms</label>
      <input type="range" min="10" max="500" step="10" bind:value={delay} class="w-32" />
    </div>
    <button class="bg-blue-600 text-white px-3 py-1 rounded shadow hover:bg-blue-700 disabled:opacity-50" on:click={simulateStream} disabled={streaming}>
      Simulate stream
    </button>
    {#if error}
      <span class="text-red-600 ml-4 self-center">{error}</span>
    {/if}
  </div>

  <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
    <!-- Parsed stream column -->
    <div class="md:col-span-2 bg-white rounded shadow p-4 min-h-[400px] flex flex-col">
      <h2 class="font-bold mb-2 text-lg">Parsed Stream</h2>
      <div class="flex-1 overflow-auto space-y-2">
        {#each parsedBlocks as block}
          <div class="my-1">
            {#each block as seg}
              {#if seg.segment?.type === 'header'}
                {#if seg.segment?.level === 1}
                  <h1 class="inline text-2xl font-bold">{seg.segment?.segment}</h1>
                {:else if seg.segment?.level === 2}
                  <h2 class="inline text-xl font-bold">{seg.segment?.segment}</h2>
                {:else if seg.segment?.level === 3}
                  <h3 class="inline text-lg font-semibold">{seg.segment?.segment}</h3>
                {:else}
                  <span class="inline font-semibold">{seg.segment?.segment}</span>
                {/if}
              {:else if seg.segment?.type === 'codeBlock'}
                <pre class="inline bg-gray-100 rounded p-1 font-mono text-sm text-gray-800 overflow-x-auto align-middle"><code>{seg.segment?.segment}</code></pre>
              {:else if seg.segment?.type === 'blockQuote'}
                <span class="inline border-l-4 border-blue-400 pl-2 italic text-gray-700">{seg.segment?.segment}</span>
              {:else}
                <span class="inline text-base leading-relaxed">
                  {#if seg.segment?.styles?.length}
                    <span class={
                      seg.segment.styles.includes('bold') && seg.segment.styles.includes('italic') ? 'font-bold italic' :
                      seg.segment.styles.includes('bold') ? 'font-bold' :
                      seg.segment.styles.includes('italic') ? 'italic' :
                      ''
                    }>
                      {#if seg.segment.styles.includes('strikethrough')}
                        <span class="line-through">{seg.segment?.segment}</span>
                      {:else if seg.segment.styles.includes('code')}
                        <code class="bg-gray-200 rounded px-1 text-sm font-mono">{seg.segment?.segment}</code>
                      {:else}
                        {seg.segment?.segment}
                      {/if}
                    </span>
                  {:else}
                    {seg.segment?.segment}
                  {/if}
                </span>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
    </div>

    <!-- Current token & parsed chunk column -->
    <div class="flex flex-col gap-4 sticky top-6 self-start">
      <div class="bg-white rounded shadow p-4 min-h-[180px]">
        <h2 class="font-bold mb-2 text-lg">Current Token</h2>
        <pre class="font-mono text-blue-700 text-lg break-all whitespace-pre-wrap">{JSON.stringify(currentToken, null, 2)}</pre>
      </div>
      <div class="bg-white rounded shadow p-4 min-h-[180px]">
        <h2 class="font-bold mb-2 text-lg">Parsed Chunk</h2>
        {#if currentParsedChunk}
          <pre class="font-mono text-gray-800 text-sm whitespace-pre-wrap">{JSON.stringify(currentParsedChunk, null, 2)}</pre>
        {/if}
      </div>
    </div>

    <!-- Raw JSON column -->
    <div class="bg-white rounded shadow p-4 min-h-[400px] flex flex-col">
      <h2 class="font-bold mb-2 text-lg">Raw array of streamed tokens</h2>
      <div class="flex-1 overflow-auto font-mono text-sm text-gray-700 space-y-1">
        {#each jsonItems as item, index}
          <!-- Apply conditional background -->
          <div
            class="whitespace-pre-wrap break-all p-1 rounded transition-colors duration-150 {index === currentTokenIndex ? 'bg-blue-200' : 'bg-gray-100 hover:bg-blue-100'}"
          >
            {JSON.stringify(item)}
          </div>
        {/each}
      </div>
    </div>

    <!-- Full txt column -->
    <div class="bg-white rounded shadow p-4 min-h-[400px] flex flex-col">
      <h2 class="font-bold mb-2 text-lg">Concatenated raw LLM output</h2>
      <pre class="flex-1 overflow-auto whitespace-pre-wrap text-gray-700">{txtContent}</pre>
    </div>
  </div>
</div>

<style>
  /* Tailwind is used, but you can add custom styles here if needed */
</style>
