import Card from './Card';

interface PhotoCardProps {
  photoUrl: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

export default function PhotoCard({
  photoUrl,
  title,
  subtitle,
  onClick,
  className = ''
}: PhotoCardProps) {
  return (
    <Card 
      padding="none" 
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${className}`}
      onClick={onClick}
    >
      <img
        src={photoUrl || '/placeholder-photo.jpg'}
        alt={title}
        className="w-full h-64 object-cover"
      />
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        )}
      </div>
    </Card>
  );
}