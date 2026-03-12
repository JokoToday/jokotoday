import { supabase } from './supabase';

export const getPublicImageUrl = (path: string): string => {
  const { data } = supabase
    .storage
    .from('assets')
    .getPublicUrl(path);

  return data.publicUrl;
};

export const uploadImage = async (
  file: File,
  path: string
): Promise<{ url: string | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .storage
      .from('assets')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      return { url: null, error };
    }

    const url = getPublicImageUrl(data.path);
    return { url, error: null };
  } catch (err) {
    return { url: null, error: err as Error };
  }
};

export const deleteImage = async (
  path: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .storage
      .from('assets')
      .remove([path]);

    return { error };
  } catch (err) {
    return { error: err as Error };
  }
};

export const listImages = async (
  folder: string
): Promise<{ files: any[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .storage
      .from('assets')
      .list(folder);

    if (error) {
      return { files: null, error };
    }

    return { files: data, error: null };
  } catch (err) {
    return { files: null, error: err as Error };
  }
};
