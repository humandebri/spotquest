export const formatPrincipal = (principalId: string, currentPrincipalId?: string): string => {
  if (principalId === currentPrincipalId) {
    return 'You';
  }
  return `${principalId.slice(0, 5)}...${principalId.slice(-3)}`;
};

export const formatSPOT = (amount: number): string => {
  return `${(amount / 100).toFixed(2)} SPOT`;
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(0)}%`;
};

export const formatDate = (timestamp: number | string): string => {
  return new Date(timestamp).toLocaleDateString();
};

export const formatDateTime = (timestamp: number | string): string => {
  return new Date(timestamp).toLocaleString();
};