import { supabase } from '@/integrations/supabase/client';

export type OcrProvider = 'simulated' | 'cloud' | 'local_dc';

interface OcrOptions {
  onProgress?: (progress: number | ((prev: number) => number)) => void;
}

/**
 * Handles OCR processing for a document based on the organization's hosting model.
 * Currently uses a simulated implementation, but provides the structure for multi-deployment.
 */
export async function requestOcr(documentId: string, provider: OcrProvider = 'simulated', options?: OcrOptions): Promise<void> {
  const { onProgress } = options || {};

  switch (provider) {
    case 'simulated':
    default:
      await simulateOcrProcessing(documentId, onProgress);
      break;
    
    // Future integrations for data sovereignty:
    // case 'local_dc':
    //   await callLocalOcrService(documentId, onProgress);
    //   break;
    // case 'cloud':
    //   await callCloudOcrService(documentId, onProgress);
    //   break;
  }
}

/**
 * Simulates OCR processing time and updates the document status.
 */
async function simulateOcrProcessing(documentId: string, onProgress?: (progress: number | ((prev: number) => number)) => void): Promise<void> {
  // Simulate progress
  const progressInterval = setInterval(() => {
    onProgress?.((prev: number) => {
      if (prev >= 90) {
        clearInterval(progressInterval as any);
        return 90;
      }
      return prev + (Math.random() * 15);
    });
  }, 300);

  // Simulate OCR delay (2-4 seconds)
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

  clearInterval(progressInterval as any);
  onProgress?.(() => 100);

  // Update document status to 'ready'
  await supabase
    .from('documents')
    .update({ status: 'ready' })
    .eq('id', documentId);
}
