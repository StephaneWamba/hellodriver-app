import { createClient } from '@supabase/supabase-js';
import { config } from '../../core/config.js';
import type { Buffer } from 'node:buffer';

const supabaseUrl = config.SUPABASE_URL;
const supabaseServiceKey = config.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials for storage');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET = config.SUPABASE_STORAGE_BUCKET;

/**
 * Upload a file to Supabase Storage.
 * Returns the storage PATH, not a public URL — driver-documents holds ID
 * documents (permis, CNI, assurance) and is deliberately a private bucket,
 * so getPublicUrl() would produce a URL that 400s "Bucket not found" for
 * everyone (Supabase's public-object endpoint returns that same generic
 * error for private buckets, to avoid confirming a private bucket exists).
 * Callers must exchange the path for a signed URL via getSignedUrl() at
 * read time, each time the document actually needs to be viewed.
 */
export async function uploadFile(
  userId: string,
  documentType: string,
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const path = `${userId}/${documentType}/${Date.now()}-${fileName}`;

  const { data, error } = await supabase.storage.from(BUCKET).upload(path, fileBuffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return data.path;
}

/**
 * Exchange a storage path for a short-lived signed URL — the only way to
 * actually read an object out of the private driver-documents bucket.
 */
export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Delete a file from storage (admin use only)
 */
export async function deleteFile(userId: string, documentType: string): Promise<void> {
  // List files in the user's document folder
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(`${userId}/${documentType}`);

  if (listError) {
    throw new Error(`Failed to list files: ${listError.message}`);
  }

  if (!files || files.length === 0) {
    return;
  }

  // Delete all files in the folder
  const filePaths = files.map((file) => `${userId}/${documentType}/${file.name}`);

  const { error: deleteError } = await supabase.storage.from(BUCKET).remove(filePaths);

  if (deleteError) {
    throw new Error(`Failed to delete file: ${deleteError.message}`);
  }
}
