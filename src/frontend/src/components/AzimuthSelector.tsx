interface AzimuthSelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function AzimuthSelector({ 
  value, 
  onChange, 
  disabled = false,
  className = '' 
}: AzimuthSelectorProps) {
  const getCompassDirection = (azimuth: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(azimuth / 45) % 8;
    return directions[index];
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Compass Direction (Azimuth)
        </label>
        <span className="text-lg font-semibold text-primary-600">
          {value}° {getCompassDirection(value)}
        </span>
      </div>
      
      <div className="relative">
        <input
          type="range"
          min="0"
          max="360"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={disabled}
        />
        
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>N</span>
          <span>NE</span>
          <span>E</span>
          <span>SE</span>
          <span>S</span>
          <span>SW</span>
          <span>W</span>
          <span>NW</span>
          <span>N</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center">
        <div className="relative w-24 h-24">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full transform -rotate-90"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="2"
            />
            <line
              x1="50"
              y1="50"
              x2={50 + 40 * Math.cos(value * Math.PI / 180)}
              y2={50 + 40 * Math.sin(value * Math.PI / 180)}
              stroke="#3b82f6"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="4" fill="#3b82f6" />
          </svg>
        </div>
      </div>
    </div>
  );
}