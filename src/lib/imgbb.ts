// src/lib/imgbb.ts
const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY || 'YOUR_DEFAULT_IMGBB_KEY';

export async function uploadToImgBB(base64Image: string, onStatusChange?: (status: string) => void) {
  try {
    if (onStatusChange) onStatusChange('initializing');
    
    const formData = new FormData();
    const base64Data = base64Image.split(',')[1] || base64Image;
    formData.append('image', base64Data);

    if (onStatusChange) onStatusChange('uploading');
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      if (onStatusChange) onStatusChange('error');
      throw new Error(result?.error?.message || 'Failed to upload image');
    }

    if (onStatusChange) onStatusChange('complete');
    return result.data.url;
  } catch (error) {
    if (onStatusChange) onStatusChange('error');
    throw error;
  }
}
