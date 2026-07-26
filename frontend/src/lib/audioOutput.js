export function getAudioOutputId() {
  return localStorage.getItem('moonlight:audioOutputId') || 'default';
}

export function setAudioOutputId(deviceId) {
  localStorage.setItem('moonlight:audioOutputId', deviceId);
  window.dispatchEvent(new CustomEvent('moonlight:audiooutputchange'));
  applyAudioOutputToAll(deviceId);
}

export function applyAudioOutputToElement(element, deviceId) {
  if (!element || typeof element.setSinkId !== 'function') return;
  const targetId = deviceId === 'default' ? '' : deviceId;
  element.setSinkId(targetId).catch((err) => {
    console.warn('Failed to setSinkId on element:', element, err);
  });
}

export function applyAudioOutputToAll(deviceId) {
  if (typeof HTMLMediaElement.prototype.setSinkId !== 'function') return;
  const id = deviceId || getAudioOutputId();
  const targetId = id === 'default' ? '' : id;
  const elements = document.querySelectorAll('audio, video');
  elements.forEach((el) => {
    el.setSinkId(targetId).catch(() => {});
  });
}