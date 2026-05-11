import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { settings } from '../settings.js';
import { unavailable } from './httpError.js';
import { isNonEmptyString } from './strings.js';

const sessionPrefix = 'auroratube-ffmpeg-';

const safeOutputOptions = (options = []) => Array.isArray(options)
  ? options.flat().map((value) => String(value)).filter((value) => value.length > 0)
  : [];

const safeInputs = (inputs = []) => inputs.map((input) => String(input || '').trim()).filter(isNonEmptyString);

const spawnFfmpeg = async ({ inputs, outputOptions, proxyUrl, timeoutMs }) => {
  const tempDir = await mkdtemp(join(tmpdir(), sessionPrefix));
  const sessionFile = join(tempDir, 'session.json');
  const payload = {
    createdAt: new Date().toISOString(),
    inputs,
    outputOptions,
  };
  await writeFile(sessionFile, JSON.stringify(payload, null, 2), 'utf8');

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    ...(isNonEmptyString(proxyUrl) ? ['-http_proxy', proxyUrl] : []),
    ...inputs.flatMap((input) => ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '2', '-i', input]),
    ...outputOptions,
    '-f', 'mp4',
    'pipe:1',
  ];

  const child = spawn('ffmpeg', args, {
    cwd: tempDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stderr = '';
  let finished = false;
  let timer = null;
  const cleanup = async () => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    child.kill('SIGKILL');
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  };

  timer = timeoutMs > 0 ? setTimeout(() => {
    child.kill('SIGKILL');
  }, timeoutMs) : null;

  return {
    child,
    tempDir,
    cleanup,
    onStderr: (chunk) => {
      stderr += chunk.toString('utf8');
    },
    getError: (code) => unavailable('ffmpeg failed', stderr.trim() || `exit code ${code}`),
  };
};

export const mergeStreamsToResponse = async ({
  res,
  inputs = [],
  outputOptions = [],
  proxyUrl = config.proxy_url,
  timeoutMs = settings.requestTimeoutMs,
  download = false,
  title = 'video',
}) => {
  const safeInputsList = safeInputs(inputs);
  if (!safeInputsList.length) {
    throw unavailable('ffmpeg inputs missing');
  }

  const safeOptions = safeOutputOptions(outputOptions);
  const session = await spawnFfmpeg({
    inputs: safeInputsList,
    outputOptions: safeOptions,
    proxyUrl,
    timeoutMs,
  });

  const disposition = String(title || 'video').replace(/[\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'video';
  const fileName = `${disposition}.mp4`;
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  const ascii = fileName.replace(/[^ -~]/g, '_');

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encoded}`);
  res.setHeader('Accept-Ranges', 'none');
  res.setHeader('Cache-Control', 'no-store');

  session.child.stderr.on('data', session.onStderr);

  const closeHandler = () => {
    session.cleanup().catch(() => {});
  };
  res.once('close', closeHandler);
  res.once('finish', closeHandler);

  try {
    await new Promise((resolve, reject) => {
      session.child.once('error', async (error) => {
        await session.cleanup().catch(() => {});
        reject(unavailable('ffmpeg is not available', error?.message));
      });

      session.child.once('close', (code) => {
        if (code === 0) resolve();
        else reject(session.getError(code));
      });

      session.child.stdout.pipe(res);
    });
  } catch (error) {
    await session.cleanup().catch(() => {});
    throw error instanceof Error ? error : unavailable('ffmpeg pipeline failed', String(error));
  } finally {
    res.off('close', closeHandler);
    res.off('finish', closeHandler);
    await session.cleanup().catch(() => {});
  }
};
