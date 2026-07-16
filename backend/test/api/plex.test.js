const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { __test } = require('../../src/api/plex');

function createMockProcess() {
  const proc = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.killSignals = [];
  proc.kill = (signal) => {
    proc.killSignals.push(signal);
    return true;
  };
  return proc;
}

function createTimerHarness() {
  let nextId = 1;
  const timers = [];

  function setTimeoutImpl(fn, ms) {
    const id = nextId++;
    timers.push({ id, fn, ms });
    return id;
  }

  function clearTimeoutImpl(id) {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index >= 0) {
      timers.splice(index, 1);
    }
  }

  function fireByDelay(ms) {
    const index = timers.findIndex((timer) => timer.ms === ms);
    assert.notEqual(index, -1, `expected a timer with delay ${ms}`);
    const [{ fn }] = timers.splice(index, 1);
    fn();
  }

  return { setTimeoutImpl, clearTimeoutImpl, fireByDelay };
}

test('deepScanPlexVideoItems scans movie and episode batches with ffmpeg-derived metadata', async () => {
  const ffmpegOutputs = [
    [
      'Input #0, matroska,webm, from "movie":',
      '  Stream #0:0: Video: hevc, yuv420p, 3840x2160',
      '  Stream #0:1: Audio: eac3, 48000 Hz, 5.1, fltp',
    ].join('\n'),
    [
      'Input #0, mov,mp4,m4a,3gp,3g2,mj2, from "episode":',
      '  Stream #0:0: Video: h264, yuv420p, 1280x720',
      '  Stream #0:1: Audio: aac, 48000 Hz, stereo, fltp',
    ].join('\n'),
  ];
  let spawnCount = 0;
  let detailLookups = 0;

  const movieItem = {
    ratingKey: 'movie-1',
    title: 'Movie One',
    Media: [{ Part: [{ key: '/library/parts/movie-1/file.mkv' }], videoResolution: '480', videoCodec: 'mpeg4', audioCodec: 'mp3', audioChannels: 2 }],
  };
  const episodeItem = {
    ratingKey: 'episode-1',
    grandparentTitle: 'Show One',
    title: 'Episode One',
    Media: [{ videoResolution: '480', videoCodec: 'mpeg4', audioCodec: 'mp3', audioChannels: 2 }],
  };

  const result = await __test.deepScanPlexVideoItems(
    [movieItem, episodeItem],
    { baseUrl: 'http://plex.local:32400', plexToken: 'token', headers: {} },
    {
      concurrency: 2,
      spawnImpl() {
        const proc = createMockProcess();
        const stderrText = ffmpegOutputs[spawnCount++];
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from(stderrText));
          proc.emit('close', 0, null);
        });
        return proc;
      },
      async fetchDetails() {
        detailLookups += 1;
        return {
          ...episodeItem,
          Media: [{ Part: [{ key: '/library/parts/episode-1/file.mkv' }], videoResolution: '480', videoCodec: 'mpeg4', audioCodec: 'mp3', audioChannels: 2 }],
        };
      },
    }
  );

  assert.equal(result.stats.scanned, 2);
  assert.equal(result.stats.metadataLookups, 1);
  assert.equal(result.stats.fallbacks, 0);
  assert.equal(detailLookups, 1);
  assert.equal(result.items[0].Media[0].videoResolution, '4k');
  assert.equal(result.items[0].Media[0].videoCodec, 'hevc');
  assert.equal(result.items[0].Media[0].audioCodec, 'eac3');
  assert.equal(result.items[0].Media[0].audioChannels, 6);
  assert.equal(result.items[1].Media[0].videoResolution, '720');
  assert.equal(result.items[1].Media[0].videoCodec, 'h264');
  assert.equal(result.items[1].Media[0].audioCodec, 'aac');
  assert.equal(result.items[1].Media[0].audioChannels, 2);
});

test('runFfmpegDeepScan times out with SIGTERM before SIGKILL when ffmpeg exits during grace period', async () => {
  const proc = createMockProcess();
  const timers = createTimerHarness();

  const promise = __test.runFfmpegDeepScan('http://plex.local/video', {
    spawnImpl() {
      return proc;
    },
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    timeoutMs: 10,
    termGraceMs: 5,
  });

  timers.fireByDelay(10);
  assert.deepEqual(proc.killSignals, ['SIGTERM']);
  proc.emit('close', null, 'SIGTERM');

  await assert.rejects(promise, /timed out after 10ms after SIGTERM/);
  assert.deepEqual(proc.killSignals, ['SIGTERM']);
});

test('runFfmpegDeepScan escalates to SIGKILL when ffmpeg ignores SIGTERM', async () => {
  const proc = createMockProcess();
  const timers = createTimerHarness();

  const promise = __test.runFfmpegDeepScan('http://plex.local/video', {
    spawnImpl() {
      return proc;
    },
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    timeoutMs: 10,
    termGraceMs: 5,
  });

  timers.fireByDelay(10);
  timers.fireByDelay(5);
  assert.deepEqual(proc.killSignals, ['SIGTERM', 'SIGKILL']);
  proc.emit('close', null, 'SIGKILL');

  await assert.rejects(promise, /SIGTERM\+SIGKILL/);
});

test('runFfmpegDeepScan redacts Plex tokens from stderr-derived error messages', async () => {
  const proc = createMockProcess();

  const promise = __test.runFfmpegDeepScan('http://plex.local/video', {
    spawnImpl() {
      process.nextTick(() => {
        proc.stderr.emit('data', Buffer.from('http://plex.local/library/parts/1/file.mkv?X-Plex-Token=super-secret-token\n'));
        proc.emit('close', 1, null);
      });
      return proc;
    },
  });

  await assert.rejects(
    promise,
    (err) => {
      assert.match(err.message, /X-Plex-Token=\[REDACTED\]/);
      assert.doesNotMatch(err.message, /super-secret-token/);
      return true;
    }
  );
});

test('toSafeDeepScanMessage redacts common Plex token parameter names', () => {
  const message = __test.toSafeDeepScanMessage(
    'ffmpeg failed for http://plex.local/file.mkv?X-Plex-Token=secret&plexToken=other&token=third'
  );

  assert.match(message, /X-Plex-Token=\[REDACTED\]/);
  assert.match(message, /plexToken=\[REDACTED\]/);
  assert.match(message, /token=\[REDACTED\]/);
  assert.doesNotMatch(message, /secret|other|third/);
});
