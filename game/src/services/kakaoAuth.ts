declare global {
  interface Window {
    Kakao: any;
  }
}

export const initKakaoSDK = () => {
  if (!window.Kakao) {
    console.error('❌ Kakao SDK not loaded');
    return;
  }

  if (!window.Kakao.isInitialized()) {
    const appId = import.meta.env.VITE_KAKAO_APP_ID;
    if (!appId) {
      console.error('❌ VITE_KAKAO_APP_ID not set in environment');
      return;
    }
    window.Kakao.init(appId);
    console.log('✅ Kakao SDK initialized');
  }
};

export const loginWithKakao = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!window.Kakao) {
      reject(new Error('Kakao SDK not loaded'));
      return;
    }

    window.Kakao.Auth.login({
      scope: 'profile_image,profile_nickname,account_email',
      success: (authObj: any) => {
        console.log('✅ Kakao login success');
        resolve(authObj);
      },
      fail: (error: any) => {
        console.error('❌ Kakao login failed:', error);
        reject(error);
      },
    });
  });
};

export const logoutWithKakao = (): Promise<void> => {
  return new Promise((resolve) => {
    if (!window.Kakao) {
      resolve();
      return;
    }

    window.Kakao.Auth.logout(() => {
      console.log('✅ Logged out from Kakao');
      resolve();
    });
  });
};

export const getUserInfo = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!window.Kakao) {
      reject(new Error('Kakao SDK not loaded'));
      return;
    }

    window.Kakao.API.request({
      url: '/v2/user/me',
      success: (response: any) => {
        resolve(response);
      },
      fail: (error: any) => {
        reject(error);
      },
    });
  });
};
