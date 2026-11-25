const button = document.getElementById('update');
const status = document.getElementById('status');

function waitUntil(worker, states) {
  return new Promise((resolve, reject) => {
    function check() {
      if (!states.includes(worker.state) && worker.state !== 'redundant') return;
      cleanup();
      if (worker.state === 'redundant') reject(new Error('更新已失效'));
      else resolve();
    }
    function cleanup() {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', check);
    }
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('更新逾時'));
    }, 20000);
    worker.addEventListener('statechange', check);
    check();
  });
}

button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = '正在檢查新版…';
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration) {
      if (!registration.waiting && !registration.installing) await registration.update();
      const worker = registration.waiting ?? registration.installing;
      if (worker) {
        status.textContent = '正在下載並啟用新版…';
        await waitUntil(worker, ['installed', 'activating', 'activated']);
        if (worker.state === 'installed') worker.postMessage({type:'SKIP_WAITING'});
        await waitUntil(worker, ['activated']);
      }
    }
    window.location.replace('/');
  } catch {
    status.textContent = '更新未完成，請確認 USB 還連著、Mac 預覽仍在運作，然後重試。';
    button.disabled = false;
  }
});
