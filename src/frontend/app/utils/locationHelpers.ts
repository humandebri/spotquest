/**
 * Location extraction helper functions
 * Handles various EXIF GPS formats and coordinate conversions
 */

interface GPSCoordinate {
  latitude: number;
  longitude: number;
}

/**
 * Convert DMS (Degrees, Minutes, Seconds) to decimal degrees
 * @param degrees - Degrees value
 * @param minutes - Minutes value  
 * @param seconds - Seconds value
 * @param direction - Direction (N/S/E/W)
 * @returns Decimal degrees (negative for S/W)
 */
export function dmsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  direction: string
): number {
  let decimal = degrees + minutes / 60 + seconds / 3600;
  
  // Apply negative sign for South and West
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
}

/**
 * Parse EXIF GPS coordinate which can be in various formats:
 * - Number: direct decimal degrees
 * - String: "DD°MM'SS.SS\"" or decimal string
 * - Array: [degrees, minutes, seconds]
 * - Object: {degrees, minutes, seconds}
 */
export function parseExifGPSCoordinate(
  value: any,
  ref?: string
): number | null {
  if (value == null) return null;

  // Direct number
  if (typeof value === 'number') {
    return value;
  }

  // String format
  if (typeof value === 'string') {
    // Try to parse as decimal
    const decimal = parseFloat(value);
    if (!isNaN(decimal)) {
      return ref === 'S' || ref === 'W' ? -decimal : decimal;
    }

    // Try to parse DMS format: "DD°MM'SS.SS\""
    const dmsMatch = value.match(/(\d+)°(\d+)'([\d.]+)"/);
    if (dmsMatch) {
      return dmsToDecimal(
        parseFloat(dmsMatch[1]),
        parseFloat(dmsMatch[2]),
        parseFloat(dmsMatch[3]),
        ref || 'N'
      );
    }

    return null;
  }

  // Array format: [degrees, minutes, seconds]
  if (Array.isArray(value) && value.length >= 3) {
    const degrees = parseFloat(value[0]);
    const minutes = parseFloat(value[1]);
    const seconds = parseFloat(value[2]);
    
    if (!isNaN(degrees) && !isNaN(minutes) && !isNaN(seconds)) {
      return dmsToDecimal(degrees, minutes, seconds, ref || 'N');
    }
  }

  // Object format: {degrees, minutes, seconds} or {_h, _m, _s}
  if (typeof value === 'object' && value !== null) {
    let degrees = 0, minutes = 0, seconds = 0;
    
    if ('degrees' in value && 'minutes' in value && 'seconds' in value) {
      degrees = parseFloat(value.degrees);
      minutes = parseFloat(value.minutes);
      seconds = parseFloat(value.seconds);
    } else if ('_h' in value && '_m' in value && '_s' in value) {
      degrees = parseFloat(value._h);
      minutes = parseFloat(value._m);
      seconds = parseFloat(value._s);
    } else if ('deg' in value && 'min' in value && 'sec' in value) {
      degrees = parseFloat(value.deg);
      minutes = parseFloat(value.min);
      seconds = parseFloat(value.sec);
    }
    
    if (!isNaN(degrees) && !isNaN(minutes) && !isNaN(seconds)) {
      return dmsToDecimal(degrees, minutes, seconds, ref || 'N');
    }
  }

  return null;
}

/**
 * Extract location from EXIF data with support for various formats
 */
export function extractLocationFromExif(exif: any): GPSCoordinate | null {
  if (!exif) return null;

  let latitude: number | null = null;
  let longitude: number | null = null;

  // Try various EXIF field names for latitude
  const latitudeFields = [
    'GPSLatitude', 'gpsLatitude', 'latitude', 'Latitude',
    'GPS.GPSLatitude', 'gps.latitude', 'exif.GPSLatitude'
  ];
  
  const longitudeFields = [
    'GPSLongitude', 'gpsLongitude', 'longitude', 'Longitude',
    'GPS.GPSLongitude', 'gps.longitude', 'exif.GPSLongitude'
  ];

  const latRefFields = [
    'GPSLatitudeRef', 'gpsLatitudeRef', 'latitudeRef',
    'GPS.GPSLatitudeRef', 'gps.latitudeRef'
  ];

  const lonRefFields = [
    'GPSLongitudeRef', 'gpsLongitudeRef', 'longitudeRef',
    'GPS.GPSLongitudeRef', 'gps.longitudeRef'
  ];

  // Find latitude
  for (const field of latitudeFields) {
    if (exif[field] != null) {
      const ref = findFieldValue(exif, latRefFields);
      latitude = parseExifGPSCoordinate(exif[field], ref);
      if (latitude !== null) break;
    }
  }

  // Find longitude
  for (const field of longitudeFields) {
    if (exif[field] != null) {
      const ref = findFieldValue(exif, lonRefFields);
      longitude = parseExifGPSCoordinate(exif[field], ref);
      if (longitude !== null) break;
    }
  }

  // Check nested GPS object
  if ((latitude === null || longitude === null) && exif.GPS) {
    const gpsData = extractLocationFromExif(exif.GPS);
    if (gpsData) {
      latitude = latitude ?? gpsData.latitude;
      longitude = longitude ?? gpsData.longitude;
    }
  }

  // Validate coordinates
  if (
    latitude !== null && 
    longitude !== null && 
    isValidCoordinate(latitude, longitude)
  ) {
    return { latitude, longitude };
  }

  return null;
}

/**
 * Find the first non-null value from a list of field names
 */
function findFieldValue(obj: any, fields: string[]): any {
  for (const field of fields) {
    if (obj[field] != null) {
      return obj[field];
    }
  }
  return null;
}

/**
 * Validate GPS coordinates
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    latitude >= -90 && 
    latitude <= 90 && 
    longitude >= -180 && 
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0) // Exclude null island
  );
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  
  return `${Math.abs(latitude).toFixed(6)}°${latDir}, ${Math.abs(longitude).toFixed(6)}°${lonDir}`;
}

/**
 * Parse EXIF DateTime to timestamp
 */
export function parseExifDateTime(dateTimeStr: any): number | null {
  if (!dateTimeStr) return null;
  
  if (typeof dateTimeStr === 'number') {
    return dateTimeStr;
  }
  
  if (typeof dateTimeStr === 'string') {
    // EXIF format: "YYYY:MM:DD HH:MM:SS"
    const match = dateTimeStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const date = new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4]),
        parseInt(match[5]),
        parseInt(match[6])
      );
      return date.getTime();
    }
    
    // Try direct parsing
    const timestamp = Date.parse(dateTimeStr);
    if (!isNaN(timestamp)) {
      return timestamp;
    }
  }
  
  return null;
}

/**
 * Match MediaLibrary asset with picked photo using various strategies
 */
export function matchAssetWithPickedPhoto(asset: any, pickedPhoto: any): boolean {
  const fileName = pickedPhoto.uri.split('/').pop() || '';
  const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  
  // Direct URI match
  if (asset.uri === pickedPhoto.uri) return true;
  
  // Filename match (with and without extension)
  if (asset.filename === fileName) return true;
  const assetNameWithoutExt = asset.filename.replace(/\.[^.]+$/, '');
  if (assetNameWithoutExt === fileNameWithoutExt) return true;
  
  // Partial match
  if (asset.uri.includes(fileName) || pickedPhoto.uri.includes(asset.filename)) return true;
  
  // Time-based match (within 5 seconds)
  const exif = (pickedPhoto as any).exif;
  if (exif?.DateTimeOriginal && asset.creationTime) {
    const exifTime = parseExifDateTime(exif.DateTimeOriginal);
    if (exifTime && Math.abs(asset.creationTime - exifTime) < 5000) {
      console.log('⏰ Time-based match found');
      return true;
    }
  }
  
  return false;
}