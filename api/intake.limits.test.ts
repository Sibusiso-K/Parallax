import { describe, expect, it } from 'vitest';
import { POST } from './intake.js';

// Size limits on POST /api/intake. The text is capped at 4,000 characters, so the body cap must allow for JSON escaping:
// 4,000 quote marks are 4,000 characters but about 8,000 characters of JSON.
const post = (body: string) => POST(new Request('http://localhost/api/intake', { method: 'POST', body }));

describe('POST /api/intake size limits', () => {
  it('accepts a 4,000-character text even when JSON escapes every character', async () => {
    const res = await post(JSON.stringify({ text: '"'.repeat(4000) }));
    expect(res.status).toBe(200);
  });

  it('refuses a text one character over the limit with 400, not 413', async () => {
    const res = await post(JSON.stringify({ text: 'a'.repeat(4001) }));
    expect(res.status).toBe(400);
  });

  it('refuses a body far over the limit with 413', async () => {
    expect((await post(JSON.stringify({ text: 'a'.repeat(60_000) }))).status).toBe(413);
  });

  it('marks every answer no-store, because it can hold a founder\'s figures', async () => {
    const answered = await post(JSON.stringify({ text: 'Should I take the contract?' }));
    const refused = await post('x'.repeat(50_000));
    expect(answered.headers.get('cache-control')).toBe('no-store');
    expect(refused.headers.get('cache-control')).toBe('no-store');
  });
});
