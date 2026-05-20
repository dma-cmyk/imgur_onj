/**
 * Pastes the given link into the Open2ch (おーぷん2ch) comment textarea if the active tab is an Open2ch thread.
 */
export async function pasteToOpen2ch(link: string): Promise<{ success: boolean, message?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.url?.includes('open2ch.net')) {
    return { success: false, message: 'おーぷん2chのページを開いてから使用してください。' };
  }

  if (!tab.id) return { success: false, message: 'タブが見つかりません。' };

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (url) => {
        const textarea = document.querySelector('textarea[name="MESSAGE"]') as HTMLTextAreaElement;
        if (textarea) {
          const space = textarea.value && !textarea.value.endsWith('\n') ? '\n' : '';
          textarea.value += space + url + '\n';
          textarea.focus();
        } else {
          throw new Error('書き込み欄が見つかりませんでした。');
        }
      },
      args: [link]
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || '貼り付けに失敗しました。' };
  }
}
