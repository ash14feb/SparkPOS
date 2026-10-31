const IMAGEKIT_PRIVATE_KEY = import.meta.env.VITE_IMAGEKIT_PRIVATE_KEY || 'YOUR_DEFAULT_IMAGEKIT_PRIVATE_KEY';

export async function uploadToImageKit(base64Image: string, onStatusChange?: (status: string) => void, fileName?: string) {
  try {
    if (onStatusChange) onStatusChange('initializing');

    const base64Data = base64Image.split(',')[1] || base64Image;
    const formData = new FormData();
    formData.append('file', base64Data);
    formData.append('fileName', fileName || `menu-${Date.now()}.jpg`);
    formData.append('folder', 'sparkpos');
    formData.append('useUniqueFileName', 'true');

    if (onStatusChange) onStatusChange('uploading');

    const auth = btoa(`${IMAGEKIT_PRIVATE_KEY}:`);
    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}` },
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      if (onStatusChange) onStatusChange('error');
      throw new Error(result?.message || 'Failed to upload image');
    }

    if (onStatusChange) onStatusChange('complete');
    return result.url;
  } catch (error) {
    if (onStatusChange) onStatusChange('error');
    throw error;
  }
}
