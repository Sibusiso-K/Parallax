// Use Node's built-in TypeScript support; no dev server, bundler, dotenv or download.
import { readFile, access } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.endsWith('.js') || !specifier.startsWith('.')) throw error;
    const url = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
    await access(url);
    return { url: url.href, shortCircuit: true };
  }
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith('.ts')) return nextLoad(url, context);
  const source = await readFile(new URL(url), 'utf8');
  return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(source, { mode: 'strip' }) };
}
