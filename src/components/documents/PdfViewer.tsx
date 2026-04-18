import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { getSignedDocumentUrl } from '@/lib/storage';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfViewerProps {
  url: string;
  className?: string;
  autoFit?: boolean;
}

export function PdfViewer({ url, className = '', autoFit = true }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialScaleSet, setInitialScaleSet] = useState(false);

  // Load PDF document
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    console.log('PdfViewer: Loading PDF from URL:', url);

    const loadPdf = async () => {
      try {
        // Get signed URL for private bucket access
        const signedUrl = await getSignedDocumentUrl(url);
        
        if (!signedUrl) {
          throw new Error('Failed to generate signed URL for document');
        }

        const loadingTask = pdfjsLib.getDocument({
          url: signedUrl,
          withCredentials: false,
        });
        console.log('PdfViewer: getDocument task created');
        const pdf = await loadingTask.promise;
        console.log('PdfViewer: PDF loaded, pages:', pdf.numPages);
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
        setLoading(false);
      } catch (err: any) {
        console.error('PdfViewer: Error loading PDF:', err);
        console.error('PdfViewer: Error message:', err?.message);
        setError(`Erreur: ${err?.message || 'Impossible de charger le PDF'}`);
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      pdfDoc?.destroy();
    };
  }, [url]);

  // Calculate auto-fit scale based on container width
  useEffect(() => {
    if (!pdfDoc || !containerRef.current || initialScaleSet) return;

    const calculateAutoFitScale = async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current!.clientWidth - 32; // padding
        const autoFitScale = Math.min(containerWidth / viewport.width, 2);
        setScale(autoFit ? autoFitScale : 1);
        setInitialScaleSet(true);
      } catch (err) {
        console.error('Error calculating auto-fit scale:', err);
        setScale(1);
        setInitialScaleSet(true);
      }
    };

    calculateAutoFitScale();
  }, [pdfDoc, autoFit, initialScaleSet]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !initialScaleSet) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, scale, initialScaleSet]);

  const goToPrevPage = () => {
    setPageNum((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNum((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-[600px] bg-muted/30 rounded-lg ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-[600px] bg-muted/30 rounded-lg text-muted-foreground ${className}`}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-t-lg border border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNum <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {pageNum} / {numPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNum >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas container */}
      <div 
        ref={containerRef}
        className="overflow-auto h-[550px] border border-t-0 border-border rounded-b-lg bg-muted/20"
      >
        <div className="flex justify-center p-4">
          <canvas ref={canvasRef} className="shadow-lg" />
        </div>
      </div>
    </div>
  );
}
