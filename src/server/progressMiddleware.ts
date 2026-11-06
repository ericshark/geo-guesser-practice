import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  DEFAULT_PROGRESS_FILE_PATH,
  readProgressFile,
  writeProgressFile,
} from '../storage/diskAdapter.ts';
import { validateProgressData } from '../storage/schema.ts';

export function createProgressMiddleware(
  filePath: string = DEFAULT_PROGRESS_FILE_PATH
) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void
  ) => {
    const urlPath = req.url?.split('?')[0];
    if (urlPath !== '/api/progress') {
      next();
      return;
    }

    try {
      if (req.method === 'GET') {
        const data = await readProgressFile(filePath);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
        return;
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const decoder = new TextDecoder();
        let rawBody = '';
        for await (const chunk of req) {
          rawBody +=
            typeof chunk === 'string'
              ? chunk
              : decoder.decode(chunk, { stream: true });
        }
        rawBody += decoder.decode();
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'Malformed JSON body' }));
          return;
        }

        const validated = validateProgressData(parsed);
        if (!validated.ok) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: validated.error }));
          return;
        }

        const saved = await writeProgressFile(filePath, validated.data);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true, data: saved }));
        return;
      }

      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Internal server error',
        })
      );
    }
  };
}
