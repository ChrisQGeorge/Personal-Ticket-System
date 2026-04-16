const $ = (sel) => document.querySelector(sel);

chrome.storage.sync.get(['serverUrl'], (data) => {
  $('#server-url').value = data.serverUrl || '';
});

$('#save-btn').addEventListener('click', async () => {
  const url = $('#server-url').value.trim().replace(/\/+$/, '');
  await chrome.storage.sync.set({ serverUrl: url });
  $('#status').textContent = 'Saved!';
  setTimeout(() => { $('#status').textContent = ''; }, 2000);
});
