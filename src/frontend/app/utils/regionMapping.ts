/**
 * 地域名管理ユーティリティ（簡素化版）
 * 英語地域名をそのまま使用・表示し、検索重視の設計
 * 市町村レベルまで対応可能
 */

/**
 * 逆ジオコーディング結果から表示用地域名を生成
 * @param address Nominatim APIのaddressオブジェクト
 * @returns 英語表示用地域名（例: "Tokyo, Japan"）
 */
export function formatLocationName(address: any): string {
  const components: string[] = [];
  
  // 市町村レベル（優先順位順）
  const cityName = address.city || 
                   address.town || 
                   address.village || 
                   address.municipality ||
                   address.county;
  
  if (cityName) {
    components.push(cityName);
  }
  
  // 州・県レベル
  const stateName = address.state || 
                    address.province || 
                    address.region;
  
  if (stateName && stateName !== cityName) {
    components.push(stateName);
  }
  
  // 国レベル
  if (address.country) {
    components.push(address.country);
  }
  
  return components.join(', ') || 'Unknown Location';
}

/**
 * 地域名の正規化（検索用）
 * @param locationName 地域名
 * @returns 検索用に正規化された文字列
 */
export function normalizeLocationName(locationName: string): string {
  return locationName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s,]/g, '') // 特殊文字を除去
    .replace(/\s+/g, ' '); // 連続する空白を単一空白に
}

/**
 * 地域名検索（部分一致）
 * @param searchQuery 検索クエリ
 * @param locationName 対象地域名
 * @returns マッチするかどうか
 */
export function matchesLocationSearch(searchQuery: string, locationName: string): boolean {
  if (!searchQuery.trim()) {
    return true; // 空クエリは全てにマッチ
  }
  
  const normalizedQuery = normalizeLocationName(searchQuery);
  const normalizedLocation = normalizeLocationName(locationName);
  
  // 複数キーワードに対応
  const queryWords = normalizedQuery.split(/[\s,]+/).filter(word => word.length > 0);
  
  return queryWords.every(word => 
    normalizedLocation.includes(word)
  );
}

/**
 * 国名の正規化マッピング（主要国のみ）
 * Nominatimから返される国名の表記揺れを統一
 */
const COUNTRY_NORMALIZATIONS: { [key: string]: string } = {
  'united states of america': 'United States',
  'usa': 'United States',
  'united states': 'United States',
  'japan': 'Japan',
  'deutschland': 'Germany',
  'great britain': 'United Kingdom',
  'uk': 'United Kingdom',
  'united kingdom': 'United Kingdom',
  'south korea': 'South Korea',
  'republic of korea': 'South Korea',
  'people\'s republic of china': 'China',
  'prc': 'China',
};

/**
 * 国名を正規化
 * @param countryName 生の国名
 * @returns 正規化された国名
 */
export function normalizeCountryName(countryName: string): string {
  const normalized = countryName.toLowerCase();
  return COUNTRY_NORMALIZATIONS[normalized] || countryName;
}

/**
 * 短縮地域表示（スペース制限がある場合）
 * @param locationName 完全な地域名
 * @param maxLength 最大文字数
 * @returns 短縮された地域名
 */
export function abbreviateLocationName(locationName: string, maxLength: number = 30): string {
  if (locationName.length <= maxLength) {
    return locationName;
  }
  
  const parts = locationName.split(', ');
  
  // 国名を省略して再計算
  if (parts.length > 1) {
    const withoutCountry = parts.slice(0, -1).join(', ');
    if (withoutCountry.length <= maxLength) {
      return withoutCountry;
    }
  }
  
  // それでも長い場合は最初の部分のみ
  if (parts.length > 0) {
    const firstPart = parts[0];
    if (firstPart.length <= maxLength) {
      return firstPart;
    }
  }
  
  // 最後の手段として切り詰め
  return locationName.substring(0, maxLength - 3) + '...';
}

/**
 * 地域の階層レベルを判定
 * @param locationName 地域名
 * @returns 階層レベル（'city' | 'state' | 'country'）
 */
export function getLocationLevel(locationName: string): 'city' | 'state' | 'country' {
  const parts = locationName.split(', ');
  
  if (parts.length >= 3) {
    return 'city'; // 市町村レベル
  } else if (parts.length === 2) {
    return 'state'; // 州・県レベル
  } else {
    return 'country'; // 国レベル
  }
}

/**
 * 地域名から国名のみを抽出
 * @param locationName 完全な地域名（例: "Tokyo, Japan"）
 * @returns 国名のみ（例: "Japan"）
 */
export function extractCountryName(locationName: string): string {
  const parts = locationName.split(', ');
  return parts[parts.length - 1] || locationName;
}

/**
 * 検索用のキーワード候補を生成
 * @param locationName 地域名
 * @returns 検索キーワード配列
 */
export function generateSearchKeywords(locationName: string): string[] {
  const parts = locationName.split(', ');
  const keywords: string[] = [];
  
  // 各部分を個別にキーワード化
  parts.forEach(part => {
    keywords.push(part.trim());
    
    // 複数単語の場合、各単語もキーワード化
    const words = part.trim().split(/\s+/);
    if (words.length > 1) {
      keywords.push(...words);
    }
  });
  
  // 部分的な組み合わせも追加
  for (let i = 0; i < parts.length - 1; i++) {
    for (let j = i + 1; j <= parts.length; j++) {
      keywords.push(parts.slice(i, j).join(', '));
    }
  }
  
  // 重複除去と正規化
  return [...new Set(keywords.map(k => normalizeLocationName(k)))];
}

// 使用例とテスト用データ
export const SAMPLE_LOCATIONS = [
  'Tokyo, Japan',
  'Osaka, Japan', 
  'New York, United States',
  'Los Angeles, California, United States',
  'London, United Kingdom',
  'Paris, France',
  'Stockholm, Sweden',
  'Sydney, Australia',
  'Toronto, Canada',
  'Berlin, Germany',
];