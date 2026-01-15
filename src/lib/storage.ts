import { supabase } from '@/integrations/supabase/client';

/**
 * Generates a signed URL for accessing a file in the documents bucket.
 * The bucket is private, so all access requires signed URLs.
 * 
 * @param filePathOrUrl - Either a file path (e.g., "client_id/filename.pdf") 
 *                        or a full public URL (legacy documents)
 * @param expiresIn - URL expiration in seconds (default: 1 hour)
 * @returns Signed URL or null if generation fails
 */
export async function getSignedDocumentUrl(
  filePathOrUrl: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!filePathOrUrl) return null;
  
  // Extract file path from full URL if it's a legacy public URL
  let filePath = filePathOrUrl;
  
  // Check if it's a full Supabase storage URL
  if (filePathOrUrl.includes('/storage/v1/object/public/documents/')) {
    // Extract the path after "documents/"
    const match = filePathOrUrl.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
    if (match) {
      filePath = decodeURIComponent(match[1]);
    }
  } else if (filePathOrUrl.startsWith('http')) {
    // If it's some other URL format, try to extract path
    try {
      const url = new URL(filePathOrUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
      if (pathMatch) {
        filePath = decodeURIComponent(pathMatch[1]);
      }
    } catch {
      // If URL parsing fails, use as-is (might be a path already)
    }
  }
  
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}

/**
 * Downloads a document using a signed URL
 * @param filePathOrUrl - File path or legacy public URL
 * @param filename - Suggested filename for download
 */
export async function downloadDocument(
  filePathOrUrl: string,
  filename: string
): Promise<boolean> {
  const signedUrl = await getSignedDocumentUrl(filePathOrUrl);
  
  if (!signedUrl) {
    console.error('Failed to generate signed URL for download');
    return false;
  }
  
  try {
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error('Failed to fetch file');
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    
    return true;
  } catch (error) {
    console.error('Download error:', error);
    // Fallback: try opening signed URL directly
    window.open(signedUrl, '_blank');
    return true;
  }
}
