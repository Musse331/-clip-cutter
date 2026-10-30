const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ffmpeg = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');

function createWindow() {
  const win = new BrowserWindow({
    width: 980, height: 820, minWidth: 640, minHeight: 600,
    backgroundColor: '#0e0e12', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile('index.html');
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.handle('open', async () => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] }]
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('save', async (_e, defaultName) => {
  const r = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }]
  });
  return r.canceled ? null : r.filePath;
});

function run(args, onTime) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, args, { windowsHide: true });
    let err = '';
    p.stderr.on('data', d => {
      const s = d.toString(); err += s;
      const m = [...s.matchAll(/time=(\d+):(\d+):([\d.]+)/g)].pop();
      if (m && onTime) onTime(+m[1] * 3600 + +m[2] * 60 + +m[3]);
    });
    p.on('error', reject);
    p.on('close', c => c === 0 ? resolve() : reject(new Error(err.slice(-500))));
  });
}

function hasAudio(input) {
  return new Promise(resolve => {
    const p = spawn(ffmpeg, ['-i', input], { windowsHide: true });
    let err = '';
    p.stderr.on('data', d => err += d);
    p.on('close', () => resolve(/Stream #.*Audio:/.test(err)));
  });
}

ipcMain.handle('export', async (e, { input, output, segs, fast }) => {
  const send = f => e.sender.send('progress', Math.min(1, f));
  const total = segs.reduce((a, g) => a + g.e - g.s, 0);
  try {
    if (!fast) {
      // Accurate cut, re-encodes to H.264 / AAC
      const audio = await hasAudio(input);
      let f = '';
      segs.forEach((g, i) => {
        f += `[0:v]trim=start=${g.s}:end=${g.e},setpts=PTS-STARTPTS[v${i}];`;
        if (audio) f += `[0:a]atrim=start=${g.s}:end=${g.e},asetpts=PTS-STARTPTS[a${i}];`;
      });
      f += segs.map((_, i) => `[v${i}]` + (audio ? `[a${i}]` : '')).join('') +
           `concat=n=${segs.length}:v=1:a=${audio ? 1 : 0}[v]` + (audio ? '[a]' : '');
      const args = ['-y', '-i', input, '-filter_complex', f, '-map', '[v]'];
      if (audio) args.push('-map', '[a]');
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p');
      if (audio) args.push('-c:a', 'aac', '-b:a', '192k');
      args.push('-movflags', '+faststart', output);
      await run(args, t => send(t / total));
    } else {
      // Fast: stream copy, no quality loss. Cuts snap to the nearest keyframe.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcutter-'));
      const ext = path.extname(input) || '.mp4';
      const parts = [];
      for (let i = 0; i < segs.length; i++) {
        const g = segs[i], tmp = path.join(dir, `p${i}${ext}`);
        await run(['-y', '-ss', String(g.s), '-i', input, '-t', String(g.e - g.s),
                   '-c', 'copy', '-avoid_negative_ts', 'make_zero', tmp]);
        parts.push(tmp); send((i + 1) / segs.length * 0.9);
      }
      const list = path.join(dir, 'list.txt');
      fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
      await run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', output]);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    send(1);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
