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


document.addEventListener('DOMContentLoaded', async () => {
  const tauri = window.__TAURI__;

  const appCacheDir = tauri.path.appCacheDir;
  const fs = tauri.fs;

  const LAST_PLAYED_ID = "last-played-id"
  tauri.core.invoke("get_autoplay").then((autoplay) => {
    const lastPlayedId = localStorage.getItem(LAST_PLAYED_ID);
    if (autoplay && lastPlayedId) {
      localStorage.removeItem(LAST_PLAYED_ID);
      const url = new URL(window.location.href);
      url.pathname = '/watch';
      url.search = `?v=${lastPlayedId}`;
      window.location.href = url.toString();
    }
  })

  const customStylesElement = document.createElement('style');
  customStylesElement.innerHTML = customStyles;
  document.head.appendChild(customStylesElement);
  console.log('Main script loaded', customStylesElement);

  const appWindow = tauri.window.getCurrentWindow();

  if (!document.querySelector("[data-tauri-decorum-tb]")) {
    // if the taskbar is not already present, create it
    let tbElHtml= `
      <div data-tauri-decorum-tb="" style="top: 0px; left: 0px; z-index: 100; width: 100%; height: 32px;
      display: flex; position: fixed; align-items: end; justify-content: end; background-color: transparent;">
        <div data-tauri-drag-region="" style="width: 100%; height: 100%; background: none;"></div>
      </div>`
    document.body.insertAdjacentHTML('afterbegin', tbElHtml);
  }


  if (!window.__DEBUG_MODE__) {
    document.addEventListener('contextmenu', event => event.preventDefault());
  }


  document.addEventListener('copy', async (event) =>  {
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


  // safari doesnt think that internet can go down, so manually handling caching
  // TODO: abstract logic for other files
  Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).forEach(async el => {
    // TODO: try to cache all css files, safari is not well
    if (!el.href.startsWith(window.location.origin + '/s/_/')) return;
    // the main css file
    const isLoaded = !!(el?.sheet?.cssRules.length);
    console.log('Processing stylesheet link:', el.href, 'Loaded:', isLoaded);
    if (isLoaded) {
      let rules = '';
      for (let i = 0; i < el.sheet.cssRules.length; i++) {
        rules += el.sheet.cssRules[i].cssText + '\n';
      }
      // this is bad, should not be done on each load, but its a spa so we are okay?
      await fs.writeTextFile('main.css', rules, { baseDir: fs.BaseDirectory.AppCache });
    } else {
      // this is bad, should not be done on each load, but its a spa so we are okay?
      const cachedRules = await fs.readTextFile('main.css', { baseDir: fs.BaseDirectory.AppCache });
      const stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(cachedRules);
      document.adoptedStyleSheets = [stylesheet];
    }
  })


  //add event listener for service worker install 
  // navigator.serviceWorker.addEventListener('activate', (event) => {
  //   console.log('Service worker installed');
  //   event.waitUntil(
  //     caches.open('yt-appshell-assets').then((cache) => {
  //       cache.addAll(cachedRes);
  //     })
  //   );
  // });
});
