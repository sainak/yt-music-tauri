const customStyles = `
  :root {
    overscroll-behavior: none;
  }

  * {
    user-select: none;
    -webkit-user-select: none;

    cursor: default;

    &::-webkit-scrollbar {
      display: none !important;
    }
    &::-webkit-scrollbar-thumb {
      display: none !important;
    }
  }

  #layout {
    --ytmusic-nav-bar-height: 80px;

    > ytmusic-nav-bar {
      padding-top: 40px;
      padding-bottom: 20px;
    }
  }

  #player-bar-background {
    background: rgba(0, 0, 0, 0.4) !important;
    backdrop-filter: blur(20px);
  }

  ytmusic-player-bar {
    width:100vw !important;
    background: transparent !important;
  }

  #player-page[is-mweb-modernization-enabled] {
    --ytmusic-player-page-player-bar-height: 94px !important;

    &[player-page-open][is-mweb-modernization-enabled] {
      > div > #top-player-bar {
        padding-top: 30px !important;
      }

      &:not([is-tabs-view]) > div > #main-panel {
        margin-top: 20px !important;
      }
    }
  }

  div[data-tauri-drag-region] {
    cursor: grab;
    -webkit-app-region: drag;
    user-select: none;
    -webkit-user-select: none;

    &:active {
      cursor: grabbing;
      cursor: -webkit-grabbing;
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

  // const invisibleTitleBar = document.querySelector('div[data-tauri-drag-region]');

  // invisibleTitleBar.addEventListener('dblclick', () => {
  //   appWindow.isFullscreen().then(fullscreen => {
  //     appWindow.setFullscreen(!fullscreen);
  //   });
  // });

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
