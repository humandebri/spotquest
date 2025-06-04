interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  animation?: boolean;
}

export default function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = true
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  const animationClass = animation ? 'animate-pulse' : '';
  
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full'
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClass} ${className}`}
      style={style}
    />
  );
}