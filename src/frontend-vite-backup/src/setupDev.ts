// 開発環境用のセットアップ
export function setupDevelopmentAuth() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 開発環境では自動的にmockAuthを有効にする
    const mockAuthEnabled = localStorage.getItem('mockAuth') === 'true';
    
    if (!mockAuthEnabled) {
      console.log('Setting up mock authentication for development...');
      localStorage.setItem('mockAuth', 'true');
      
      // ページをリロードして設定を反映
      window.location.reload();
    }
  }
}

// 開発環境でmockAuthをクリアする関数
export function clearMockAuth() {
  localStorage.removeItem('mockAuth');
  localStorage.removeItem('authSession');
  window.location.reload();
}

// 開発環境用の位置情報モック
export function mockGeolocation() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Setting up mock geolocation for development...');
    
    // 東京タワーの座標をデフォルトとして使用
    const mockPosition = {
      coords: {
        latitude: 35.6586,
        longitude: 139.7454,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    };

    // getCurrentPositionをモック
    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
    navigator.geolocation.getCurrentPosition = function(success, error, options) {
      console.log('[Mock Geolocation] getCurrentPosition called');
      setTimeout(() => {
        success(mockPosition as GeolocationPosition);
      }, 1000);
    };

    // watchPositionをモック
    let watchId = 1;
    const originalWatchPosition = navigator.geolocation.watchPosition;
    navigator.geolocation.watchPosition = function(success, error, options) {
      console.log('[Mock Geolocation] watchPosition called');
      const id = watchId++;
      
      // 初回の位置情報を送信
      setTimeout(() => {
        success(mockPosition as GeolocationPosition);
      }, 1000);
      
      // 10秒ごとに位置を少し変更して送信
      const interval = setInterval(() => {
        mockPosition.coords.latitude += (Math.random() - 0.5) * 0.0001;
        mockPosition.coords.longitude += (Math.random() - 0.5) * 0.0001;
        mockPosition.timestamp = Date.now();
        success(mockPosition as GeolocationPosition);
      }, 10000);
      
      // clearWatchで停止できるように保存
      (window as any)[`mockWatchInterval_${id}`] = interval;
      
      return id;
    };

    // clearWatchもモック
    const originalClearWatch = navigator.geolocation.clearWatch;
    navigator.geolocation.clearWatch = function(id) {
      console.log('[Mock Geolocation] clearWatch called for id:', id);
      const interval = (window as any)[`mockWatchInterval_${id}`];
      if (interval) {
        clearInterval(interval);
        delete (window as any)[`mockWatchInterval_${id}`];
      }
    };

    // permissions.queryもモック
    if (navigator.permissions) {
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = async function(desc: any) {
        if (desc.name === 'geolocation') {
          console.log('[Mock Permissions] geolocation query - returning granted');
          return {
            state: 'granted',
            addEventListener: () => {},
            removeEventListener: () => {}
          } as any;
        }
        return originalQuery(desc);
      };
    }
  }
}

// デバッグ用のグローバルヘルパー
if (typeof window !== 'undefined') {
  (window as any).GTSDebug = {
    // 認証状態をトグル
    toggleAuth: () => {
      const current = localStorage.getItem('mockAuth') === 'true';
      localStorage.setItem('mockAuth', (!current).toString());
      window.location.reload();
    },
    
    // 位置情報モックをトグル
    toggleGeoMock: () => {
      const current = localStorage.getItem('mockGeo') === 'true';
      localStorage.setItem('mockGeo', (!current).toString());
      window.location.reload();
    },
    
    // すべてのローカルストレージをクリア
    clearAll: () => {
      localStorage.clear();
      window.location.reload();
    },
    
    // 現在の状態を表示
    status: () => {
      console.log('=== Guess the Spot Debug Status ===');
      console.log('Mock Auth:', localStorage.getItem('mockAuth') === 'true' ? 'Enabled' : 'Disabled');
      console.log('Mock Geo:', localStorage.getItem('mockGeo') === 'true' ? 'Enabled' : 'Disabled');
      console.log('Protocol:', window.location.protocol);
      console.log('Hostname:', window.location.hostname);
      console.log('Geolocation Available:', 'geolocation' in navigator);
      console.log('===================================');
    },
    
    // ヘルプ
    help: () => {
      console.log('=== Guess the Spot Debug Commands ===');
      console.log('GTSDebug.toggleAuth()   - Toggle mock authentication');
      console.log('GTSDebug.toggleGeoMock() - Toggle mock geolocation');
      console.log('GTSDebug.clearAll()     - Clear all local storage');
      console.log('GTSDebug.status()       - Show current status');
      console.log('=====================================');
    }
  };
  
  // 起動時にヘルプを表示
  console.log('🎮 Guess the Spot Debug Mode Available');
  console.log('Type GTSDebug.help() for available commands');
}