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

  ytmusic-menu-popup-renderer {
    /* WIP: enable scrollbar for the custom right click menu */
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


document.addEventListener('DOMContentLoaded', () => {
  const LAST_PLAYED_ID = "last-played-id"
  const lastPlayedId = localStorage.getItem(LAST_PLAYED_ID);
  if (lastPlayedId) {
    localStorage.removeItem(LAST_PLAYED_ID);
    const url = new URL(window.location.href);
    url.pathname = '/watch';
    url.search = `?v=${lastPlayedId}`;
    window.location.href = url.toString();
  }

  const customStylesElement = document.createElement('style');
  customStylesElement.innerHTML = customStyles;
  document.head.appendChild(customStylesElement);
  console.log('Main script loaded', customStylesElement);

  const tauri = window.__TAURI__;
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

  const cachedRes = []

  // find all urls in the head and add them to the cachedRes 
  Array.from(document.head.querySelectorAll('link[rel="stylesheet"], script')).forEach(el => {
    const url = el.href || el.src;
    if (url) {
      cachedRes.push(url);
    }
  })

  console.log('Cached resources', cachedRes);

  //add event listener for service worker install 
  navigator.serviceWorker.addEventListener('install', (event) => {
    console.log('Service worker installed');
    event.waitUntil(
      caches.open('yt-appshell-assets').then((cache) => {
        cache.addAll(cachedRes);
      })
    );
  });
});
