import Alert from './Alert';
import Button from './Button';

interface ErrorMessageProps {
  error: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorMessage({ error, onRetry, className = '' }: ErrorMessageProps) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message || 'An unexpected error occurred';

  return (
    <Alert type="error" className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm">{message}</p>
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="ghost"
            size="small"
            className="ml-4"
          >
            Retry
          </Button>
        )}
      </div>
    </Alert>
  );
}