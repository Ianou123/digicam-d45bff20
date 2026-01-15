import { useEffect, useState } from 'react';
import { getSignedDocumentUrl } from '@/lib/storage';
import { Loader2 } from 'lucide-react';

interface SignedImageProps {
  fileUrl: string;
  alt: string;
  className?: string;
}

export function SignedImage({ fileUrl, alt, className = '' }: SignedImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadSignedUrl = async () => {
      setLoading(true);
      setError(false);
      
      const url = await getSignedDocumentUrl(fileUrl);
      if (url) {
        setSignedUrl(url);
      } else {
        setError(true);
      }
      setLoading(false);
    };

    loadSignedUrl();
  }, [fileUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Unable to load image</p>
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
    />
  );
}
