export async function uploadToImgur(
  source: File | string | Blob, 
  clientId: string, 
  title?: string, 
  description?: string
): Promise<{ link: string, deletehash: string }> {
  const formData = new FormData();
  formData.append('image', source);
  if (title) formData.append('title', title);
  if (description) formData.append('description', description);

  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Authorization': `Client-ID ${clientId}`,
    },
    body: formData
  });

  if (!response.ok) {
    const errData = await response.json();
    const errorMsg = errData?.data?.error || `HTTP error! status: ${response.status}`;
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (data.success) {
    return {
      link: data.data.link,
      deletehash: data.data.deletehash
    };
  } else {
    throw new Error(data.data.error || 'Unknown error during upload.');
  }
}

export async function deleteFromImgur(deletehash: string, clientId: string): Promise<void> {
  const response = await fetch(`https://api.imgur.com/3/image/${deletehash}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Client-ID ${clientId}`,
    }
  });

  if (!response.ok) {
    if (response.status !== 404) {
      const errData = await response.json();
      throw new Error(errData?.data?.error || `HTTP error! status: ${response.status}`);
    }
  }
}
