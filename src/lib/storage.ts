import { supabase } from '@/integrations/supabase/client';

/**
 * Generates a signed URL for accessing a file in the documents bucket.
 * Routes through the `get-signed-url` Edge Function so that:
 *  - the anon key never directly requests storage
 *  - document ownership is verified server-side
 *  - the download action is logged atomically server-side
 *
 * Falls back to direct signed URL generation for legacy/non-document contexts.
 *
 * @param filePathOrUrl - Either a file path or a full URL (legacy documents)
 * @param expiresIn     - URL expiration in seconds (default: 1 hour)
 * @param documentId    - Required for the Edge Function path; omit for legacy fallback
 */
export async function getSignedDocumentUrl(
  filePathOrUrl: string,
  expiresIn: number = 3600,
  documentId?: string
): Promise<string | null> {
  if (!filePathOrUrl) return null;

  // Prefer the Edge Function path when we have a documentId
  if (documentId) {
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: { documentId, filePath: filePathOrUrl, expiresIn },
      });

      if (error) {
        console.error('Edge Function error (get-signed-url):', error);
        // Fall through to direct fallback
      } else if (data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (err) {
      console.error('Edge Function call failed, falling back:', err);
    }
  }

  // Legacy fallback: direct Supabase storage (no server-side audit log)
  let filePath = filePathOrUrl;
  if (filePathOrUrl.includes('/storage/v1/object/public/documents/')) {
    const match = filePathOrUrl.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
    if (match) filePath = decodeURIComponent(match[1]);
  } else if (filePathOrUrl.startsWith('http')) {
    try {
      const url = new URL(filePathOrUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
      if (pathMatch) filePath = decodeURIComponent(pathMatch[1]);
    } catch {
      // keep as-is
    }
  }

  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL (fallback):', error);
      return null;
    }
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL (fallback):', error);
    return null;
  }
}

/**
 * Downloads a document by obtaining a signed URL via the Edge Function,
 * then triggering a browser download. The activity log is written server-side
 * by the Edge Function — callers should NOT write a separate download log.
 *
 * @param filePathOrUrl - File path or legacy public URL
 * @param filename      - Suggested filename for download
 * @param documentId    - Required to route through the Edge Function
 */
export async function downloadDocument(
  filePathOrUrl: string,
  filename: string,
  documentId?: string
): Promise<boolean> {
  const signedUrl = await getSignedDocumentUrl(filePathOrUrl, 3600, documentId);

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
    // Fallback: open signed URL in new tab
    window.open(signedUrl, '_blank');
    return true;
  }
}

