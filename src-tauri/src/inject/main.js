const tauri = window.__TAURI__;
const css = String.raw;

const customStyles = css`
  :root {
    /* disable bouncy scroll */
    overscroll-behavior: none;
  }

  body {
    /* increase height of the navbar container elements */
    --ytmusic-nav-bar-height: 80px;
  }

  * {
    /* disable text selection */
    user-select: none;
    -webkit-user-select: none;

    /* use default cursor to give a more native feel */
    cursor: default !important;

    /* hide scrollbars */
    &::-webkit-scrollbar {
      display: none !important;
    }
    &::-webkit-scrollbar-thumb {
      display: none !important;
    }
  }

  /* inset navbar elements for the traffic lights and taskbar */
  #layout  > ytmusic-nav-bar {
    padding-top: 40px;
    padding-bottom: 20px;
  }
  #guide-renderer > div.guide-nav.style-scope.ytmusic-guide-renderer {
    padding-top: 40px;
    padding-bottom: 20px;
  }

  /* add blur effect to the player bar */
  #player-bar-background {
    background: rgba(0, 0, 0, 0.4) !important;
    backdrop-filter: blur(20px);
  }
  ytmusic-player-bar {
    /* make the player bar transparent */
    background: transparent !important;
    /* make the player progress bar full width */
    width:100vw !important;
  }

  /* WIP: make the expanding controls transparent and hide unwanted elements */
  #expanding-menu {
    background: transparent !important;
  }
  #right-controls:has(+ #expanding-menu[aria-hidden="false"]) > div {
    display: none;
  }

  #player-page[is-mweb-modernization-enabled] {
    /* increase the height of the expanded player bar m-ui*/
    --ytmusic-player-page-player-bar-height: 94px !important;

    &[player-page-open][is-mweb-modernization-enabled] {
      &:not([is-tabs-view]) > div > #main-panel {
        /* inset player page controls for traffic lights */
        padding-top: 20px !important;
      }
      > div > #top-player-bar {
        /* inset the top player bar for traffic lights */
        padding-top: 30px !important;
      }
    }
  }
`;

async function saveOrLoadCssFromCache(el, _fileName) {
  try {
    const fileName = _fileName || el.href.split('/').pop();
    const isLoaded = !!(el?.sheet?.cssRules.length);
    console.debug(`Handling CSS file ${fileName}, loaded: ${isLoaded}`);
    if (isLoaded) {
      const cacheLastModified = await tauri.fs.stat(fileName, { baseDir: tauri.fs.BaseDirectory.AppCache })
        .then(fileInfo => fileInfo.mtime)
        .catch(() => null);
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      console.debug(`${fileName} cache last modified: ${cacheLastModified}`);
      if (cacheLastModified && (now - cacheLastModified) < oneDay) return;
      const rules = Array.from(el.sheet.cssRules).map(rule => rule.cssText).join('\n');
      await tauri.fs.writeTextFile(fileName, rules, { baseDir: tauri.fs.BaseDirectory.AppCache }).catch(() => null);
      console.debug(`Cached ${fileName} at ${now}`);
    } else {
      console.debug(`Loading CSS file ${fileName} from cache`);
      const cachedRules = await tauri.fs.readTextFile(fileName, { baseDir: tauri.fs.BaseDirectory.AppCache }).catch(() => null);
      if (!cachedRules) return;
      const stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(cachedRules);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
      console.debug(`Loaded ${fileName} from cache`);
    }
  } catch (error) {
    console.error(`Error handling CSS file ${el.href}:`, error);
  }
}

async function saveOrLoadImageFromCache(el) {
  try {
    const fileName = el.src.split('/').pop();
    const isLoaded = (el.complete && el.naturalWidth !== 0)
    console.debug(`Handling image file ${fileName}, loaded: ${isLoaded}`, el.complete, el.naturalWidth);
    if (isLoaded) {
      const cacheLastModified = await tauri.fs.stat(fileName, { baseDir: tauri.fs.BaseDirectory.AppCache })
        .then(fileInfo => fileInfo.mtime)
        .catch(() => null);
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      console.debug(`${fileName} cache last modified: ${cacheLastModified}`);
      if (cacheLastModified && (now - cacheLastModified) < oneDay) return;
      const buf = await fetch(el.src).then(res => res.blob()).then(blob => blob.arrayBuffer());
      await tauri.fs.writeFile(fileName, buf, { baseDir: tauri.fs.BaseDirectory.AppCache });
      console.debug(`Cached ${fileName} at ${now}`);
    } else {
      console.debug(`Loading image file ${fileName} from cache`);
      const fileExtension = el.src.split('.').pop();
      const cachedFile = await tauri.fs.readFile(fileName, { baseDir: tauri.fs.BaseDirectory.AppCache });
      const mime = (fileExtension === 'svg') ? 'svg+xml' : fileExtension;
      const blob = new Blob([cachedFile], { type: `image/${mime}` }); // TODO: get the correct type if needed
      const url = URL.createObjectURL(blob);
      el.src = url;
      el.onload = () => {
        URL.revokeObjectURL(url);
        console.debug(`Loaded ${fileName} from cache`);
      }
    }
  } catch (error) {
    console.error(`Error handling image file ${el.src}:`, error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const fs = tauri.fs;

  const LAST_PLAYED_ID = "last-played-id"
  await tauri.core.invoke("get_autoplay").then((autoplay) => {
    const lastPlayedId = localStorage.getItem(LAST_PLAYED_ID);
    if (autoplay && lastPlayedId) {
      localStorage.removeItem(LAST_PLAYED_ID);
      const url = new URL(window.location.href);
      url.pathname = '/watch';
      url.search = `?v=${lastPlayedId}`;
      window.location.href = url.toString();
    }
  })

  // mannual caching for files ignored by the service worker
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach(el => {
    if (!el.href.startsWith(window.location.origin)) return; // TODO: cache fonts too
    if (el.href.startsWith(window.location.origin + '/s/_/')) {
      saveOrLoadCssFromCache(el, "main.css")
    } else {
      saveOrLoadCssFromCache(el);
    }
  });



  const customStylesElement = document.createElement('style');
  customStylesElement.innerHTML = customStyles;
  document.head.appendChild(customStylesElement);
  console.log('Main script loaded', customStylesElement);

  const appWindow = tauri.window.getCurrentWindow();

  if (!document.querySelector("[data-tauri-decorum-tb]")) {
    // if the taskbar is not already present, create it
    let tbElHtml = `
      <div data-tauri-decorum-tb="" style="top: 0px; left: 0px; z-index: 100; width: 100%; height: 32px;
      display: flex; position: fixed; align-items: end; justify-content: end; background-color: transparent;">
        <div data-tauri-drag-region="" style="width: 100%; height: 100%; background: none;"></div>
      </div>`
    document.body.insertAdjacentHTML('afterbegin', tbElHtml);
  }

  if (!window.__DEBUG_MODE__) {
    document.addEventListener('contextmenu', event => event.preventDefault());
  }

  document.addEventListener('copy', async (event) => {
    const value = event.target.value
    if (value) {
      event.preventDefault();
      const url = new URL(value);
      url.searchParams.delete('si');
      await tauri.clipboardManager.writeText(url.toString());
    }
  });

  const titleLinkObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const url = new URL(mutation.target.href);
        const v = url.searchParams.get('v');
        if (v) {
          localStorage.setItem(LAST_PLAYED_ID, v);
        }
      }
    });
  })

  const domObserver = new MutationObserver((mutations, obs) => {
    const titleLink = document.querySelector('.ytp-title-link');
    if (titleLink) {
      titleLinkObserver.observe(titleLink, {
        attributeFilter: ['href']
      });

      obs.disconnect();
    }
  });
  domObserver.observe(document.body, {
    childList: true,
    subtree: true
  });


  //add event listener for service worker install 
  // navigator.serviceWorker.addEventListener('activate', (event) => {
  //   console.debug('Service worker installed');
  //   event.waitUntil(
  //     caches.open('yt-appshell-assets').then((cache) => {
  //       cache.addAll(cachedRes);
  //     })
  //   );
  // });
});

window.addEventListener('load', () => {
  // mannual caching for files ignored by the service worker
  document.querySelectorAll('.logo.ytmusic-logo').forEach(el => saveOrLoadImageFromCache(el));
})