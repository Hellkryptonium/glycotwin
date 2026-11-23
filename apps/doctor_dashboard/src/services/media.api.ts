import { api } from './api';
import type { ApiResponse } from '../types/api';

type MediaAsset = { id: string; contentType: string; sizeBytes: number };
type Upload = { asset: MediaAsset; uploadUrl: string };

export async function getMediaUrl(assetId: string) {
  const response = await api.get<ApiResponse<{ url: string }>>(`/media/assets/${encodeURIComponent(assetId)}/url`);
  return response.data.data.url;
}

export async function uploadProfilePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a JPEG, PNG, or WebP image smaller than 5 MB.');
  const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('The profile photo could not be read.')); reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? ''); reader.readAsDataURL(file); });
  const created = await api.post<ApiResponse<MediaAsset>>('/media/uploads/inline', { purpose: 'PROFILE_PHOTO', contentType: file.type, sizeBytes: file.size, fileName: file.name, base64 });
  const asset = created.data.data;
  await api.post(`/media/assets/${asset.id}/attach-profile-photo`);
  return { assetId: asset.id, previewUrl: URL.createObjectURL(file) };
}
