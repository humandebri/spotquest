import React from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'underline' | 'pills' | 'enclosed';
}

export default function Tabs({ 
  tabs, 
  activeTab, 
  onChange,
  className = '',
  variant = 'underline'
}: TabsProps) {
  const getTabClasses = (isActive: boolean) => {
    const baseClasses = 'flex items-center px-4 py-2 font-medium text-sm transition-colors focus:outline-none';
    
    switch (variant) {
      case 'underline':
        return `${baseClasses} border-b-2 ${
          isActive 
            ? 'text-primary-600 border-primary-600' 
            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
        }`;
      
      case 'pills':
        return `${baseClasses} rounded-md ${
          isActive
            ? 'bg-primary-100 text-primary-700'
            : 'text-gray-500 hover:text-gray-700'
        }`;
      
      case 'enclosed':
        return `${baseClasses} border ${
          isActive
            ? 'bg-white text-primary-600 border-gray-200 border-b-white'
            : 'bg-gray-50 text-gray-500 border-transparent hover:text-gray-700'
        }`;
      
      default:
        return baseClasses;
    }
  };

  const containerClasses = {
    underline: 'flex space-x-8 border-b border-gray-200',
    pills: 'flex space-x-2',
    enclosed: 'flex space-x-1 border-b border-gray-200'
  };

  return (
    <div className={`${containerClasses[variant]} ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={getTabClasses(activeTab === tab.id)}
        >
          {tab.icon && <span className="mr-2">{tab.icon}</span>}
          {tab.label}
          {tab.badge && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}