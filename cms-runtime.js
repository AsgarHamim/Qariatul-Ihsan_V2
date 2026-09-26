(function () {
  'use strict';

  const TEXT_KEY = 'qi-cms-text';
  const DB_NAME = 'qi-cms';
  const DB_VERSION = 1;
  const STORE = 'images';
  const objectUrls = new Map();
  let defaultTexts = { en: {}, bn: {} };
  let connectedDict = null;

  const imageSlots = [
    { id:'site-logo', section:'Brand', label:'Header and footer logo', selector:'.nav-logo img, .footer-brand img', type:'image' },
    { id:'hero-background', section:'Home', label:'Hero background', selector:'.hero-bg', type:'background', overlay:'radial-gradient(ellipse at 30% 20%,rgba(180,160,90,.18),transparent 55%),linear-gradient(180deg,rgba(20,26,16,.25),rgba(20,26,16,.55) 68%,rgba(20,26,16,.88))' },
    { id:'land-map', section:'Our Land', label:'Interactive land image', selector:'#explorer', type:'background' },
    { id:'agriculture-vegetables', section:'Agriculture', label:'Vegetables image', selector:'#agriculture .two-col > div:nth-child(2) .ph:nth-child(1)', type:'background' },
    { id:'agriculture-fruits', section:'Agriculture', label:'Fruits image', selector:'#agriculture .two-col > div:nth-child(2) .ph:nth-child(2)', type:'background' },
    { id:'agriculture-crops', section:'Agriculture', label:'Crops image', selector:'#agriculture .two-col > div:nth-child(2) .ph:nth-child(3)', type:'background' },
    { id:'agriculture-fish', section:'Agriculture', label:'Fish image', selector:'#agriculture .two-col > div:nth-child(2) .ph:nth-child(4)', type:'background' },
    { id:'pond-feature', section:'Pond', label:'Pond feature image', selector:'.river-wrap', type:'background', overlay:'linear-gradient(160deg,rgba(20,40,24,.5),rgba(52,90,60,.4))' },
    { id:'livestock-showcase', section:'Animals', label:'Livestock showcase image', selector:'.animal-showcase img', type:'image' },
    { id:'store-land', section:'Store', label:'From Our Land image', selector:'.store-split .store-card:nth-child(1)', type:'background', overlay:'linear-gradient(160deg,rgba(28,45,25,.08),rgba(20,28,18,.7))' },
    { id:'store-heritage', section:'Store', label:'From Our Heritage image', selector:'.store-split .store-card:nth-child(2)', type:'background', overlay:'linear-gradient(160deg,rgba(28,45,25,.08),rgba(20,28,18,.7))' },
    { id:'product-1', section:'Products', label:'Seasonal Vegetables', selector:'#products .product-card:nth-child(1) .product-img', type:'background' },
    { id:'product-2', section:'Products', label:'Orchard Fruits', selector:'#products .product-card:nth-child(2) .product-img', type:'background' },
    { id:'product-3', section:'Products', label:'Rice Atta', selector:'#products .product-card:nth-child(3) .product-img', type:'background' },
    { id:'product-4', section:'Products', label:'Mustard Oil', selector:'#products .product-card:nth-child(4) .product-img', type:'background' },
    { id:'journal-1', section:'Journal', label:'A Day at Qariatul Ihsan', selector:'.journal-card:nth-child(1) .journal-img', type:'background' },
    { id:'journal-2', section:'Journal', label:'Our First Harvest', selector:'.journal-card:nth-child(2) .journal-img', type:'background' },
    { id:'journal-3', section:'Journal', label:'Life Beside the Pond', selector:'.journal-card:nth-child(3) .journal-img', type:'background' }
  ];

  for (let i = 1; i <= 30; i += 1) {
    imageSlots.push({
      id:`gallery-${i}`,
      section:'Gallery',
      label:`Gallery image ${i}`,
      selector:`#galleryGrid .gallery-item:nth-child(${i}) img, #galleryGrid .gallery-item:nth-child(${i}) .ph`,
      type:'auto'
    });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readTextOverrides() {
    try { return JSON.parse(localStorage.getItem(TEXT_KEY) || '{"en":{},"bn":{}}'); }
    catch (_) { return { en:{}, bn:{} }; }
  }

  function writeTextOverrides(value) {
    localStorage.setItem(TEXT_KEY, JSON.stringify(value));
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function imageRequest(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }

  function getImage(id) { return imageRequest('readonly', store => store.get(id)); }
  function putImage(id, blob) { return imageRequest('readwrite', store => store.put(blob, id)); }
  function deleteImage(id) { return imageRequest('readwrite', store => store.delete(id)); }

  function slotElements(slot, root) {
    try { return Array.from((root || document).querySelectorAll(slot.selector)); }
    catch (_) { return []; }
  }

  function setElementImage(element, slot, url) {
    const useImage = slot.type === 'image' || (slot.type === 'auto' && element.tagName === 'IMG');
    if (useImage) {
      element.src = url;
      element.removeAttribute('srcset');
    } else {
      element.style.backgroundImage = slot.overlay ? `${slot.overlay},url("${url}")` : `url("${url}")`;
      element.style.backgroundSize = 'cover';
      element.style.backgroundPosition = 'center';
    }
    element.dataset.cmsApplied = slot.id;
  }

  async function applyImage(slot) {
    const elements = slotElements(slot);
    if (!elements.length) return;
    if (objectUrls.has(slot.id)) {
      elements.filter(element => element.dataset.cmsApplied !== slot.id).forEach(element => setElementImage(element, slot, objectUrls.get(slot.id)));
      return;
    }
    const blob = await getImage(slot.id).catch(() => null);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    objectUrls.set(slot.id, url);
    elements.forEach(element => setElementImage(element, slot, url));
  }

  async function applyAllImages() {
    await Promise.all(imageSlots.map(applyImage));
  }

  function getSlotPreview(slot, root) {
    const element = slotElements(slot, root)[0];
    if (!element) return '';
    if (element.tagName === 'IMG') return element.currentSrc || element.src || '';
    const inline = element.style.backgroundImage || getComputedStyle(element).backgroundImage;
    const matches = [...inline.matchAll(/url\(["']?(.*?)["']?\)/g)];
    return matches.length ? matches[matches.length - 1][1] : '';
  }

  function connect(dict) {
    connectedDict = dict;
    defaultTexts = clone(dict);
    const overrides = readTextOverrides();
    ['en','bn'].forEach(lang => Object.assign(dict[lang], overrides[lang] || {}));
    applyAllImages();
    return dict;
  }

  const api = {
    imageSlots,
    connect,
    getDefaultTexts:() => clone(defaultTexts),
    getCurrentTexts:() => connectedDict ? clone(connectedDict) : clone(defaultTexts),
    readTextOverrides,
    writeTextOverrides,
    getImage,
    putImage,
    deleteImage,
    applyAllImages,
    getSlotPreview
  };

  window.QICMSRuntime = api;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAllImages, { once:true });
  } else {
    applyAllImages();
  }
  new MutationObserver(() => applyAllImages()).observe(document.documentElement, { childList:true, subtree:true });
})();
