import { spawn } from 'node:child_process';

export function runProcess(command, args, { timeoutMs, onStdout, onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    const timer = timeoutMs
      ? setTimeout(() => {
          try { child.kill('SIGKILL'); } catch {}
          reject(new Error(`${command} timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : null;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stdout += text;
      onStdout?.(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stderr += text;
      onStderr?.(text);
    });

    child.once('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });

    child.once('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const err = new Error(stderr.trim() || `${command} exited with code ${code}`);
      err.code = code;
      err.stderr = stderr;
      reject(err);
    });
  });
}
